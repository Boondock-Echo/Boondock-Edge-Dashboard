const { test, expect } = require('@playwright/test');

const metadata = (component, version = '1.0.0') => ({
  component, version, display_name: `${component} build ${version}`,
  git_tag: `v${version}`, git_commit: 'a'.repeat(40),
});
const state = (overrides = {}) => ({
  installed: { api: metadata('api'), dashboard: metadata('dashboard', '3.0.0') },
  restart: { status: 'idle' },
  backups: [{ id: 'api-backup', component: 'api', version: '1.0.0' }],
  ...overrides,
});
const json = (route, body, status = 200, headers = {}) => route.fulfill({
  status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', ...headers },
  body: JSON.stringify(body),
});

async function freezeClock(page) {
  await page.clock.install({ time: new Date('2026-10-27T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-27T18:00:01Z'));
}

async function setup(page, handler, role = 'admin', path = '/version') {
  await page.addInitScript((role) => {
    localStorage.setItem('token', 'version-test-token');
    localStorage.setItem('user', JSON.stringify({ user: { id: 1, role, permissions: ['access_settings'] } }));
  }, role);
  await page.route(/\/version\/(status|releases|apply|rollback|restart)(\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return json(route, {}, 200, {
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    const url = new URL(request.url());
    if (await handler?.(route, url, request)) return;
    if (url.pathname.endsWith('/releases')) {
      const component = url.searchParams.get('component');
      return json(route, { releases: [{ tag: component === 'api' ? 'v2.0.0' : 'v4.0.0' }] });
    }
    return json(route, state());
  });
  await page.goto(path);
}

test('release and version Settings tabs keep the settings navigation and fit mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/release-notes', (route) => json(route, { releases: [{
    title: 'Dashboard 3.0.0', date: '2026-10-27', branch: 'latest',
    sections: [{ heading: 'Software management', items: ['Independent API and dashboard updates.', 'Automatic API restart recovery.'] }],
  }] }));
  await setup(page, undefined, 'admin', '/settings?tab=release');
  await expect(page.getByRole('heading', { name: 'Release Notes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Release Notes$/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Dashboard 3.0.0', exact: true })).toBeVisible();
  await page.screenshot({ path: '/workspace/output/settings-release-notes.png', fullPage: true });
  await page.getByRole('link', { name: 'Manage software versions and backups' }).click();
  await expect(page).toHaveURL(/settings\?tab=version$/);
  await expect(page.getByRole('button', { name: /Software Versions$/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toBeEnabled();
  await expect(page.locator('main')).toHaveCount(1);
  await page.screenshot({ path: '/workspace/output/settings-software-versions.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Software versions', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/workspace/output/settings-software-versions-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: /Release Notes$/ }).click();
  await expect(page.getByRole('heading', { name: 'Release Notes', exact: true })).toBeVisible();
});

test('settings members can see release notes but do not get a software management tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/release-notes', (route) => json(route, { releases: [] }));
  let requests = 0;
  await setup(page, async () => { requests += 1; return false; }, 'member', '/settings?tab=release');
  await expect(page.getByRole('heading', { name: 'Release Notes', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Software Versions$/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage software versions and backups' })).toHaveCount(0);
  expect(requests).toBe(0);
});

test('independent selections send only component and tag with administrator authentication', async ({ page }) => {
  const submissions = [];
  const releaseComponents = new Set();
  await setup(page, async (route, url, request) => {
    expect(request.headers().authorization).toBe('Bearer version-test-token');
    if (url.pathname.endsWith('/releases')) releaseComponents.add(url.searchParams.get('component'));
    if (url.pathname.endsWith('/apply')) {
      submissions.push(request.postDataJSON());
      await json(route, { message: 'Installed' });
      return true;
    }
  });
  await expect(page.getByText('api build 1.0.0')).toBeVisible();
  await expect(page.getByText('dashboard build 3.0.0')).toBeVisible();
  await page.getByLabel('API release', { exact: true }).selectOption('v2.0.0');
  await page.getByLabel('Dashboard release', { exact: true }).selectOption('beta');
  await expect(page.getByLabel('API release', { exact: true })).toHaveValue('v2.0.0');
  const navigated = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
  await page.getByRole('button', { name: 'Install Dashboard', exact: true }).click();
  await navigated;
  expect(submissions).toEqual([{ component: 'dashboard', tag: 'beta' }]);
  expect([...releaseComponents].sort()).toEqual(['api', 'dashboard']);
});

test('API restart waits three seconds, tolerates disconnects, and confirms installed metadata', async ({ page }) => {
  await freezeClock(page);
  let applied = false;
  let polls = 0;
  const submissions = [];
  await setup(page, async (route, url, request) => {
    if (url.pathname.endsWith('/apply')) {
      applied = true;
      submissions.push(request.postDataJSON());
      await json(route, {}, 202);
      return true;
    }
    if (applied && url.pathname.endsWith('/status')) {
      polls += 1;
      if (polls === 1) await route.abort('connectionrefused');
      else await json(route, state({
        restart: { status: 'completed' },
        installed: { api: metadata('api', '2.0.0'), dashboard: metadata('dashboard', '3.0.0') },
      }));
      return true;
    }
  });
  await page.getByLabel('API release', { exact: true }).selectOption('v2.0.0');
  await page.getByRole('button', { name: 'Install API', exact: true }).click();
  await expect(page.getByText('API restart queued.', { exact: false })).toBeVisible();
  await page.clock.fastForward(2999);
  expect(polls).toBe(0);
  await page.clock.fastForward(1);
  await expect.poll(() => polls).toBe(1);
  await expect(page.getByText('Waiting for the API to reconnect and confirm its restart…')).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByText('API restart completed.', { exact: false })).toBeVisible();
  await expect(page.getByText('api build 2.0.0', { exact: true })).toBeVisible();
  expect(submissions).toEqual([{ component: 'api', tag: 'v2.0.0' }]);
});

test('successful files with failed scheduling offers restart without reinstalling', async ({ page }) => {
  const submissions = [];
  await setup(page, async (route, url, request) => {
    if (request.method() !== 'POST') return false;
    submissions.push({ path: url.pathname, body: request.postDataJSON() });
    if (url.pathname.endsWith('/apply')) await json(route, { operation_succeeded: true, restart_required: true }, 503);
    else await json(route, {}, 202);
    return true;
  });
  await page.getByRole('button', { name: 'Install API', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry API restart', exact: true }).click();
  expect(submissions.map((item) => item.path.split('/').pop())).toEqual(['apply', 'restart']);
  expect(submissions[1].body).toEqual({});
});

test('409 blocks duplicate submissions until the pending operation clears', async ({ page }) => {
  await freezeClock(page);
  let submissions = 0;
  let polls = 0;
  await setup(page, async (route, url) => {
    if (url.pathname.endsWith('/apply')) {
      submissions += 1;
      await json(route, { error: 'busy' }, 409);
      return true;
    }
    if (submissions && url.pathname.endsWith('/status')) {
      polls += 1;
      await json(route, state({ restart: { status: polls === 1 ? 'pending' : 'idle' } }));
      return true;
    }
  });
  const install = page.getByRole('button', { name: 'Install API', exact: true });
  await expect(install).toBeEnabled();
  await install.evaluate((button) => { button.click(); button.click(); });
  await expect(page.getByText('Another operation or restart is pending.', { exact: false })).toBeVisible();
  await expect(install).toBeDisabled();
  expect(submissions).toBe(1);
  await page.clock.fastForward(3000);
  await expect.poll(() => polls).toBe(1);
  await page.clock.fastForward(3000);
  await expect(install).toBeEnabled();
});

for (const header of ['2', 'date']) {
  test(`429 honors ${header === 'date' ? 'HTTP-date' : 'seconds'} Retry-After`, async ({ page }) => {
    await freezeClock(page);
    let submissions = 0;
    await setup(page, async (route, url) => {
      if (!url.pathname.endsWith('/apply')) return false;
      submissions += 1;
      const retry = header === 'date' ? new Date(await page.evaluate(() => Date.now()) + 2000).toUTCString() : header;
      await json(route, {}, 429, { 'Retry-After': retry, 'Access-Control-Expose-Headers': 'Retry-After' });
      return true;
    });
    const install = page.getByRole('button', { name: 'Install API', exact: true });
    await install.click();
    await expect(install).toBeDisabled();
    await page.clock.fastForward(header === 'date' ? 1000 : 1999);
    await expect(install).toBeDisabled();
    await page.clock.fastForward(1001);
    await expect(install).toBeEnabled();
    expect(submissions).toBe(1);
  });
}

test('rollback sends only backup_id and warns about restored credentials', async ({ page }) => {
  let rollback;
  await setup(page, async (route, url, request) => {
    if (!url.pathname.endsWith('/rollback')) return false;
    rollback = request.postDataJSON();
    await json(route, {}, 202);
    return true;
  });
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('older administrator credentials');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(page.getByText('API restart queued.', { exact: false })).toBeVisible();
  expect(rollback).toEqual({ backup_id: 'api-backup' });
});

test('non-administrators cannot load version endpoints or submit updates', async ({ page }) => {
  let requests = 0;
  await setup(page, async () => { requests += 1; return false; }, 'member');
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toHaveCount(0);
});

test('failed API restart offers a restart retry and blocks another installation', async ({ page }) => {
  await freezeClock(page);
  let applied = false;
  await setup(page, async (route, url) => {
    if (url.pathname.endsWith('/apply')) {
      applied = true;
      await json(route, {}, 202);
      return true;
    }
    if (applied && url.pathname.endsWith('/status')) {
      await json(route, state({ restart: { status: 'failed' } }));
      return true;
    }
  });
  await page.getByRole('button', { name: 'Install API', exact: true }).click();
  await expect(page.getByText('API restart queued.', { exact: false })).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByRole('button', { name: 'Retry API restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toBeDisabled();
});

test('a completed restart with mismatched numbered metadata does not confirm success', async ({ page }) => {
  await freezeClock(page);
  let applied = false;
  await setup(page, async (route, url) => {
    if (url.pathname.endsWith('/apply')) {
      applied = true;
      await json(route, {}, 202);
      return true;
    }
    if (applied && url.pathname.endsWith('/status')) {
      await json(route, state({ restart: { status: 'completed' } }));
      return true;
    }
  });
  await page.getByLabel('API release', { exact: true }).selectOption('v2.0.0');
  await page.getByRole('button', { name: 'Install API', exact: true }).click();
  await expect(page.getByText('API restart queued.', { exact: false })).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByRole('alert')).toContainText('differs from the selected release');
  await expect(page.getByRole('button', { name: 'Install API', exact: true })).toBeDisabled();
});

test('restart polling also respects Retry-After', async ({ page }) => {
  await freezeClock(page);
  let applied = false;
  let polls = 0;
  await setup(page, async (route, url) => {
    if (url.pathname.endsWith('/apply')) {
      applied = true;
      await json(route, {}, 202);
      return true;
    }
    if (applied && url.pathname.endsWith('/status')) {
      polls += 1;
      if (polls === 1) await json(route, {}, 429, { 'Retry-After': '7', 'Access-Control-Expose-Headers': 'Retry-After' });
      else await json(route, state({ restart: { status: 'completed' } }));
      return true;
    }
  });
  await page.getByRole('button', { name: 'Install API', exact: true }).click();
  await expect(page.getByText('API restart queued.', { exact: false })).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page.getByText('Waiting for the server’s Retry-After deadline…')).toBeVisible();
  await page.clock.fastForward(6999);
  expect(polls).toBe(1);
  await page.clock.fastForward(1);
  await expect(page.getByText('API restart completed.', { exact: false })).toBeVisible();
});
