const { test: base, expect } = require('@playwright/test');
const { randomBytes, randomUUID } = require('node:crypto');
const { EMAIL, PASSWORD, API_URL } = require('./helpers');

// Live integration test: every HTTP request reaches the actual API. No route
// interception, SQL, React imports, fake timers, or speech service stubs.
const apiUrl = (path) => `${API_URL.replace(/\/$/, '')}${path}`;
const headers = (token) => ({ Authorization: `Bearer ${token}` });

async function json(request, method, path, token, data) {
  const response = await request[method](apiUrl(path), {
    headers: headers(token), ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method.toUpperCase()} ${path}: HTTP ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}

async function login(request, email, password) {
  const response = await request.post(apiUrl('/auth/login'), { data: { email, password } });
  expect(response.ok(), `API login: HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

async function browserLogin(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('User ID', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Enter Console' }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'View settings', exact: true })).toBeVisible();
}

// A real, unique, two-second PCM WAV. On a test instance with the automatic
// queue stopped, the public transcription-save API supplies the final text.
function wav() {
  const pcm = randomBytes(16000 * 2 * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const test = base.extend({
  bootstrap: async ({ request }, use) => {
    const bootstrap = await login(request, EMAIL, PASSWORD);
    expect(bootstrap.user.role, 'E2E_EMAIL must be a test administrator').toBe('admin');
    const backup = await json(request, 'get', '/settings/backup', bootstrap.token);
    expect(backup.s3_enabled, 'Use a test instance with S3 uploads disabled').toBe(false);
    const transcription = await json(request, 'get', '/settings/transcription', bootstrap.token);
    try {
      if (transcription.queue_enabled) {
        await json(request, 'patch', '/settings/transcription', bootstrap.token, { queue_enabled: false });
      }
      await use(bootstrap);
    } finally {
      await json(request, 'patch', '/settings/transcription', bootstrap.token, {
        queue_enabled: transcription.queue_enabled,
      });
    }
  },
  scenario: async ({ request, bootstrap }, use) => {
    const groups = await json(request, 'get', '/groups', bootstrap.token);
    const defaultGroup = groups.find((group) => group.is_default);
    expect(defaultGroup, 'A default channel ownership group must exist').toBeTruthy();

    const suffix = randomUUID();
    const email = `inbox-e2e-${suffix}@example.test`;
    const password = randomBytes(24).toString('base64url');
    const resources = [];
    const create = async (path, data, idKey = 'id') => {
      const result = await json(request, 'post', path, bootstrap.token, data);
      resources.push(`${path}/${result[idKey]}`);
      return result;
    };
    try {
      const group = await create('/groups', {
        name: `Inbox E2E ${suffix}`, permissions: ['channel.read', 'recording.read'],
      });
      const user = await create('/users', {
        email, password, name: `Inbox E2E ${suffix}`, role: 'admin', groups: [group.id, defaultGroup.id],
        preferences: { inbox: {
          records_per_page: 20, show_channel: true,
          show_duplicate_recordings: false, show_hallucinations: false,
        }, reports: {} },
      });
      const channelName = `Inbox E2E ${suffix}`;
      const channel = await create('/channels', {
        name: channelName, mac: `02${randomBytes(5).toString('hex')}`,
        status: 'enabled',
      }, 'channel_id');
      const marker = `hallucination-${suffix}`;
      await create('/hallucinations', { pattern: marker, match_type: 'literal' });
      const session = await login(request, email, password);
      const recordingIds = [];
      const upload = async (audio, name = `${randomUUID()}.wav`) => {
        const response = await request.post(apiUrl('/upload/audio'), {
          headers: headers(session.token), multipart: {
            channel_id: String(channel.channel_id),
            audio_file: { name, mimeType: 'audio/wav', buffer: audio },
          },
        });
        expect(response.ok(), `Audio upload: HTTP ${response.status()}`).toBeTruthy();
        const result = await response.json();
        expect(result.recording_id).toEqual(expect.any(Number));
        recordingIds.push(result.recording_id);
        return result;
      };
      const saveTranscript = async (id, text) => {
        const response = await request.post(apiUrl(`/transcribe_save/${id}`), {
          headers: headers(session.token), form: { transcription: text },
        });
        expect(response.ok(), `Save transcription: HTTP ${response.status()}`).toBeTruthy();
      };
      try {
        await use({
          email, password, user, group, defaultGroup, channelName, marker, upload, saveTranscript,
          bootstrapToken: bootstrap.token, token: session.token,
        });
      } finally {
        for (const id of recordingIds.reverse()) {
          await json(request, 'delete', `/recordings/${id}`, bootstrap.token);
        }
      }
    } finally {
      // Reverse creation order: pattern, channel, user, then referenced group.
      // Attempt all cleanup operations even when an earlier one fails.
      const failures = [];
      for (const path of resources.reverse()) {
        try { await json(request, 'delete', path, bootstrap.token); }
        catch (error) { failures.push(error.message); }
      }
      expect(failures, 'Test resource cleanup').toEqual([]);
    }
  },
});

test('transcription matches arrive after login and drive sidebar highlights and filtering', async ({ page, request, scenario }) => {
  test.setTimeout(90_000);
  const matching = await scenario.upload(wav());
  const other = await scenario.upload(wav());
  const ordinary = `Ordinary traffic ${randomUUID()}`;
  await scenario.saveTranscript(other.recording_id, ordinary);
  await browserLogin(page, scenario.email, scenario.password);
  await isolateChannel(page, scenario.channelName);

  // Configure a Python regex after login. Stored ranges must highlight the
  // actual phrase even though it differs from the configured pattern text.
  const pattern = String.raw`Car\s+\d+`;
  const group = await json(request, 'patch', `/groups/${scenario.group.id}`, scenario.bootstrapToken, {
    keywords: [{ pattern, match_type: 'regex', case_sensitive: true }],
  });
  const keywordId = group.keyword_details[0].id;
  try {
    await scenario.saveTranscript(matching.recording_id, '🚒 Car 42 reports Car 7');
    const feed = page.locator('#dashboard-feed');
    const keyword = page.getByRole('button', { name: `${pattern} 2`, exact: true });
    await expect(keyword).toBeVisible({ timeout: 20_000 });
    const highlighted = feed.locator('span[class*="keywordHighlight"]:visible');
    await expect(highlighted).toHaveText(['Car 42', 'Car 7']);
    await expect(highlighted.first()).toHaveCSS('font-weight', '700');
    await expect(feed.getByText(ordinary, { exact: true })).toBeVisible();
    await keyword.click();
    await expect(feed.getByText(ordinary, { exact: true })).toHaveCount(0);

    // Correcting the transcript clears saved matches and the sidebar filter.
    const corrected = `Corrected traffic ${randomUUID()}`;
    await scenario.saveTranscript(matching.recording_id, corrected);
    await expect(keyword).toHaveCount(0, { timeout: 20_000 });
    await expect(feed.getByText(corrected, { exact: true })).toBeVisible();
    await expect(feed.getByText(ordinary, { exact: true })).toBeVisible();
    await expect(highlighted).toHaveCount(0);
  } finally {
    if (keywordId) await json(request, 'delete', `/keywords/${keywordId}`, scenario.bootstrapToken);
  }
});

test('keyword actions configure email templates and edits do not trigger popups', async ({ page, request, scenario }) => {
  test.setTimeout(120_000);
  const recording = await scenario.upload(wav());
  const marker = `action-${randomUUID()}`;
  const group = scenario.defaultGroup;
  let keywordId;
  const originalEmail = await json(request, 'get', '/settings/email', scenario.bootstrapToken);
  expect(originalEmail.configured, 'Run against a development instance without SMTP routing').toBe(false);
  const actionName = `Action ${randomUUID()}`;
  let actionId;
  try {
    await browserLogin(page, scenario.email, scenario.password);
    await page.goto('/settings?tab=keywords-tags');
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await expect(page.getByLabel('Action type', { exact: true }).locator('option')).toHaveText(['Popup']);
    await expect(page.getByLabel('Action group', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Action enabled', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Email delivery', exact: true }).click();
    await page.getByLabel('SMTP host', { exact: true }).fill('localhost');
    await page.getByLabel('SMTP port', { exact: true }).fill('2525');
    await expect(page.getByLabel('From email', { exact: true })).toHaveCount(0);
    await page.getByLabel('Dashboard base URL', { exact: true }).fill('http://localhost:3000');
    await page.getByRole('button', { name: 'Save email settings', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Email delivery settings saved.');
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByLabel('Action name', { exact: true }).fill(actionName);

    await page.getByRole('checkbox', { name: 'Play recording audio automatically', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save action', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Keyword action saved.');
    const configured = await json(request, 'get', '/keyword-actions', scenario.bootstrapToken);
    actionId = configured.actions.find((action) => action.name === actionName).id;
    await page.getByRole('button', { name: 'Keywords', exact: true }).click();
    await page.getByLabel('Pattern', { exact: true }).fill(marker);
    await page.getByLabel('Group', { exact: true }).selectOption(String(group.id));
    await page.getByRole('checkbox', { name: `${actionName} (popup)`, exact: true }).check();
    await page.getByRole('button', { name: 'Add keyword', exact: true }).click();
    await expect(page.getByRole('button', { name: `Edit actions for ${marker}`, exact: true })).toBeVisible();
    const updatedGroup = await json(request, 'get', `/groups/${group.id}`, scenario.bootstrapToken);
    keywordId = updatedGroup.keyword_details.find((keyword) => keyword.pattern === marker).id;
    expect(updatedGroup.keyword_details.find((keyword) => keyword.id === keywordId).action_ids).toEqual([actionId]);

    await page.goto('/');
    await isolateChannel(page, scenario.channelName);
    await setCheckbox(page.getByRole('checkbox', { name: 'Toggle live mode', exact: true }), false);
    await expect(page.locator('#dashboard-feed').getByText('Showing 1-1 of 1', { exact: true })).toBeVisible();
    await scenario.saveTranscript(recording.recording_id, `Urgent ${marker}`);
    const popup = page.getByRole('dialog', { name: 'Keyword alert', exact: true });
    await expect(page.locator('#dashboard-feed').getByText(`Urgent ${marker}`, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(popup).toHaveCount(0);
    await scenario.saveTranscript(recording.recording_id, `Updated ${marker}`);
    await expect(page.locator('#dashboard-feed').getByText(`Updated ${marker}`, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(popup).toHaveCount(0);

    await page.goto('/settings?tab=keywords-tags');
    await page.getByRole('button', { name: `Edit actions for ${marker}`, exact: true }).click();
    await page.getByRole('group', { name: 'Actions for this keyword', exact: true }).last().getByRole('checkbox', { name: `${actionName} (popup)`, exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save keyword actions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save keyword actions', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByRole('button', { name: `Edit ${actionName}`, exact: true }).click();
    await page.getByLabel('Action type', { exact: true }).selectOption('email');
    await page.getByLabel('From email', { exact: true }).fill('sender@example.test');
    await page.getByLabel('From name', { exact: true }).fill('Keyword test');
    await page.getByLabel('Reply-To email', { exact: true }).fill('reply@example.test');
    await page.getByLabel('To recipients', { exact: true }).fill('recipient@example.test');
    await page.getByLabel('Cc recipients', { exact: true }).fill('copy@example.test');
    await page.getByLabel('Bcc recipients', { exact: true }).fill('hidden@example.test');
    await page.getByLabel('Email subject', { exact: true }).fill('Alert: {keywords}');
    await page.getByLabel('Email template', { exact: true }).fill('Channel {channel}: {transcript}');
    await page.getByRole('button', { name: 'Preview email template', exact: true }).click();
    await expect(page.getByLabel('Email template preview')).toContainText('Alert: engine fire, urgent');
    await expect(page.getByLabel('Email template preview')).toContainText('Channel Race control: Car 42');
    await page.getByRole('button', { name: 'Save action', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Keyword action saved.');
    const updated = (await json(request, 'get', '/keyword-actions', scenario.bootstrapToken)).actions.find((action) => action.id === actionId);
    expect(updated).toMatchObject({ kind: 'email', from_email: 'sender@example.test', reply_to: 'reply@example.test', to: ['recipient@example.test'], cc: ['copy@example.test'], bcc: ['hidden@example.test'] });

    // A link from email opens the exact authorized recording, including after login.
    await page.goto(`/recording/${recording.recording_id}`);
    await expect(page.getByRole('heading', { name: `Recording ${recording.recording_id}`, exact: true })).toBeVisible();
    await expect(page.getByText(`Updated ${marker}`, { exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/recording/${recording.recording_id}`);
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('User ID', { exact: true }).fill(scenario.email);
    await page.getByLabel('Password', { exact: true }).fill(scenario.password);
    await page.getByRole('button', { name: 'Enter Console', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/recording/${recording.recording_id}$`));
    await expect(page.getByText(`Updated ${marker}`, { exact: true })).toBeVisible();
  } finally {
    if (!actionId) {
      const configured = await json(request, 'get', '/keyword-actions', scenario.bootstrapToken);
      actionId = configured.actions.find((action) => action.name === actionName)?.id;
    }
    if (actionId) await json(request, 'delete', `/keyword-actions/${actionId}`, scenario.bootstrapToken);
    if (keywordId) await json(request, 'delete', `/keywords/${keywordId}`, scenario.bootstrapToken);
    const { password_configured, configured, ...restoreEmail } = originalEmail;
    await json(request, 'patch', '/settings/email', scenario.bootstrapToken, restoreEmail);
  }
});

async function isolateChannel(page, name) {
  const own = page.getByRole('checkbox', { name: `Toggle ${name}`, exact: true });
  await expect(own).toBeVisible();
  await setCheckbox(own, true);
  for (const toggle of await page.getByRole('checkbox', { name: /^Toggle / }).all()) {
    if (await toggle.getAttribute('aria-label') !== `Toggle ${name}` &&
        await toggle.getAttribute('aria-label') !== 'Toggle live mode') {
      await setCheckbox(toggle, false);
    }
  }
}

async function setCheckbox(checkbox, enabled) {
  if (await checkbox.isChecked() !== enabled) {
    // The styled switch track covers its input. Use normal keyboard input,
    // which exercises the accessible control without forcing DOM events.
    await checkbox.focus();
    await checkbox.press('Space');
  }
  await expect(checkbox).toBeChecked({ checked: enabled });
}

async function setVisibility(page, name, enabled) {
  await page.getByRole('button', { name: 'View settings', exact: true }).click();
  await setCheckbox(page.getByRole('checkbox', { name, exact: true }), enabled);
  await page.getByRole('button', { name: 'Close view settings', exact: true }).click();
}

test('late hallucination disappears without reload; admin can show it and it returns when corrected', async ({ page, scenario }) => {
  test.setTimeout(90_000);
  const recording = await scenario.upload(wav());
  await browserLogin(page, scenario.email, scenario.password);
  await isolateChannel(page, scenario.channelName);
  const feed = page.locator('#dashboard-feed');

  // Prove the uploaded recording was displayed before its text was classified.
  await expect(feed.getByText(scenario.channelName, { exact: true })).toBeVisible();
  await expect(feed.getByText('Showing 1-1 of 1', { exact: true })).toBeVisible();
  await scenario.saveTranscript(recording.recording_id, scenario.marker);

  // No reload, navigation, fake timers, or manual refresh between these checks.
  await expect(feed.getByText(scenario.channelName, { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await expect(feed.getByText('No messages to display', { exact: true })).toBeVisible();

  await setVisibility(page, 'Show hallucinations', true);
  await expect(feed.getByText(scenario.marker, { exact: true })).toBeVisible();
  await setVisibility(page, 'Show hallucinations', false);
  await expect(feed.getByText(scenario.marker, { exact: true })).toHaveCount(0);

  const corrected = `Corrected radio traffic ${randomUUID()}`;
  await scenario.saveTranscript(recording.recording_id, corrected);
  await expect(feed.getByText(corrected, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(feed.getByText('Showing 1-1 of 1', { exact: true })).toBeVisible();
});

test('duplicate uploads stay hidden until an admin enables duplicate recordings', async ({ page, scenario }) => {
  test.setTimeout(90_000);
  const audio = wav();
  const filename = `${randomUUID()}.wav`;
  const first = await scenario.upload(audio, filename);
  const duplicate = await scenario.upload(audio, filename);
  expect(first.is_duplicate).toBe(false);
  expect(duplicate.is_duplicate).toBe(true);

  const originalText = `Original radio traffic ${randomUUID()}`;
  const duplicateText = `Duplicate radio traffic ${randomUUID()}`;
  await scenario.saveTranscript(first.recording_id, originalText);
  await scenario.saveTranscript(duplicate.recording_id, duplicateText);
  await browserLogin(page, scenario.email, scenario.password);
  await isolateChannel(page, scenario.channelName);
  const feed = page.locator('#dashboard-feed');
  await expect(feed.getByText(originalText, { exact: true })).toBeVisible();
  await expect(feed.getByText(duplicateText, { exact: true })).toHaveCount(0);
  await setVisibility(page, 'Show duplicate recordings', true);
  await expect(feed.getByText(duplicateText, { exact: true })).toBeVisible();
  await expect(feed.getByText('Showing 1-2 of 2', { exact: true })).toBeVisible();
  await setVisibility(page, 'Show duplicate recordings', false);
  await expect(feed.getByText(duplicateText, { exact: true })).toHaveCount(0);
  await expect(feed.getByText('Showing 1-1 of 1', { exact: true })).toBeVisible();
});

test('a demoted admin loses both controls and cannot see previously enabled hidden recordings', async ({ page, request, scenario }) => {
  test.setTimeout(90_000);
  const recording = await scenario.upload(wav());
  await scenario.saveTranscript(recording.recording_id, scenario.marker);
  const audio = wav();
  const filename = `${randomUUID()}.wav`;
  const visible = await scenario.upload(audio, filename);
  const duplicate = await scenario.upload(audio, filename);
  const visibleText = `Visible to member ${randomUUID()}`;
  const duplicateText = `Hidden duplicate ${randomUUID()}`;
  await scenario.saveTranscript(visible.recording_id, visibleText);
  await scenario.saveTranscript(duplicate.recording_id, duplicateText);
  await browserLogin(page, scenario.email, scenario.password);
  await isolateChannel(page, scenario.channelName);
  await setVisibility(page, 'Show hallucinations', true);
  await setVisibility(page, 'Show duplicate recordings', true);
  await expect(page.locator('#dashboard-feed').getByText(scenario.marker, { exact: true })).toBeVisible();
  await expect(page.locator('#dashboard-feed').getByText(duplicateText, { exact: true })).toBeVisible();

  await json(request, 'patch', `/users/${scenario.user.id}`, scenario.bootstrapToken, { role: 'member' });
  // A fresh browser session signs in normally with the actual changed role.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await browserLogin(page, scenario.email, scenario.password);
  await isolateChannel(page, scenario.channelName);
  // This positive control proves that ownership and read permission work;
  // the missing hallucination cannot be explained by an empty/denied inbox.
  await expect(page.locator('#dashboard-feed').getByText(visibleText, { exact: true })).toBeVisible();
  const viewSettings = page.getByRole('button', { name: 'View settings', exact: true });
  await viewSettings.focus();
  await viewSettings.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Show hallucinations', exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Show duplicate recordings', exact: true })).toHaveCount(0);
  await expect(page.locator('#dashboard-feed').getByText(scenario.marker, { exact: true })).toHaveCount(0);
  await expect(page.locator('#dashboard-feed').getByText(duplicateText, { exact: true })).toHaveCount(0);
});
