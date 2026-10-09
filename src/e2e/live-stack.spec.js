const { test, expect } = require('@playwright/test');

const API_URL = (process.env.E2E_API_URL || '').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

function requireCredentials() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD are required');
  }
}

async function loginThroughDashboard(page) {
  requireCredentials();

  await page.goto('/login');
  await page.getByLabel('User ID').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter Console' }).click();

  const mfa = page.getByLabel('MFA code');
  if (await mfa.isVisible().catch(() => false)) {
    throw new Error(
      'The E2E account requires MFA. Use a dedicated test account without MFA for unattended Playwright runs.'
    );
  }

  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });

  return page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    return {
      token: localStorage.getItem('token'),
      stored,
    };
  });
}

function principalFromStored(stored) {
  return stored?.user || stored;
}

async function apiLogin(request) {
  requireCredentials();
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(response.ok(), `POST ${API_URL}/auth/login`).toBeTruthy();
  return response.json();
}

async function getJson(request, token, path) {
  const response = await request.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `GET ${path} returned ${response.status()}`).toBeTruthy();
  return response.json();
}

async function restorePreferences(request, userId, token, preferences) {
  const response = await request.patch(`${API_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { preferences },
  });
  expect(response.ok(), 'Failed to restore original test-user preferences').toBeTruthy();
}

test.describe.serial('Boondock Edge live stack', () => {
  test('login reaches the real API and returns the full authenticated principal', async ({ page }) => {
    const { token, stored } = await loginThroughDashboard(page);
    const principal = principalFromStored(stored);

    expect(token).toBeTruthy();
    expect(principal?.id).toEqual(expect.any(Number));
    expect(principal?.email).toBe(EMAIL.toLowerCase());
    expect(principal?.preferences?.inbox).toEqual(expect.any(Object));
    expect(principal?.preferences?.reports).toEqual(expect.any(Object));
    expect(principal?.preferences?.display).toBeUndefined();
  });

  test('Inbox and Reports preferences persist through dashboard -> API -> database', async ({ page, request }) => {
    const { stored } = await loginThroughDashboard(page);
    const principal = principalFromStored(stored);
    expect(principal?.id).toEqual(expect.any(Number));

    const originalPreferences = JSON.parse(JSON.stringify(principal.preferences));
    const originalTimeFormat = originalPreferences.inbox?.time_format || '24h';
    const originalDensity = originalPreferences.reports?.density || 'comfortable';
    const nextTimeFormat = originalTimeFormat === '12h' ? '24h' : '12h';
    const nextDensity = originalDensity === 'compact' ? 'comfortable' : 'compact';

    let currentLogin = await apiLogin(request);

    try {
      await page.getByRole('button', { name: 'View settings' }).click();

      const timeFormat = page.getByLabel('Time format');
      await expect(timeFormat).toBeVisible();

      const inboxPatch = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/users/${principal.id}`)
      );
      await timeFormat.selectOption(nextTimeFormat);
      const inboxPatchResponse = await inboxPatch;
      expect(inboxPatchResponse.ok()).toBeTruthy();

      currentLogin = await apiLogin(request);
      expect(currentLogin.user.preferences.inbox.time_format).toBe(nextTimeFormat);
      expect(currentLogin.user.preferences.display).toBeUndefined();

      await page.goto('/report');
      await expect(page.getByRole('heading', { name: 'Incident Reports' })).toBeVisible();

      const reportsPatch = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/users/${principal.id}`)
      );
      await page.getByRole('button', {
        name: nextDensity === 'compact' ? 'Compact' : 'Comfortable',
      }).click();
      const reportsPatchResponse = await reportsPatch;
      expect(reportsPatchResponse.ok()).toBeTruthy();

      currentLogin = await apiLogin(request);
      expect(currentLogin.user.preferences.reports.density).toBe(nextDensity);
      expect(currentLogin.user.preferences.inbox.time_format).toBe(nextTimeFormat);

      const oldLocalStorageValue = await page.evaluate(() =>
        localStorage.getItem('reports_density_mode')
      );
      expect(oldLocalStorageValue).toBeNull();
    } finally {
      if (currentLogin?.token) {
        await restorePreferences(
          request,
          principal.id,
          currentLogin.token,
          originalPreferences,
        );
      }
    }
  });

  test('live API contracts used by the rewritten dashboard are reachable', async ({ page, request }) => {
    const { stored } = await loginThroughDashboard(page);
    const principal = principalFromStored(stored);
    expect(principal?.role).toBe('admin');

    const login = await apiLogin(request);
    const token = login.token;

    const channels = await getJson(request, token, '/channels');
    expect(Array.isArray(channels)).toBeTruthy();

    const frequencies = await getJson(request, token, '/frequencies');
    expect(Array.isArray(frequencies)).toBeTruthy();

    const inbox = await getJson(
      request,
      token,
      '/recordings/inbox?limit=1&sort_direction=newest_first',
    );
    expect(Array.isArray(inbox.messages)).toBeTruthy();
    expect(inbox.meta).toEqual(expect.any(Object));

    const recorderSettings = await getJson(request, token, '/settings/recorders');
    expect(typeof recorderSettings.edge_recorders_enabled).toBe('boolean');
    expect(typeof recorderSettings.uniden_scanners_enabled).toBe('boolean');

    const wifi = await getJson(request, token, '/settings/wifi');
    expect(wifi).toEqual(expect.objectContaining({
      ssid: expect.any(String),
      host_ip: expect.any(String),
      host_port: expect.any(Number),
      password_configured: expect.any(Boolean),
    }));

    const backup = await getJson(request, token, '/settings/backup');
    expect(typeof backup.s3_enabled).toBe('boolean');
    expect(typeof backup.samba_enabled).toBe('boolean');

    const maintenance = await getJson(request, token, '/settings/maintenance');
    expect(maintenance.scheduled_time).toEqual(expect.any(String));
    expect(Array.isArray(maintenance.enabled_tasks)).toBeTruthy();

    const users = await getJson(request, token, '/users');
    expect(Array.isArray(users)).toBeTruthy();

    const groups = await getJson(request, token, '/groups');
    expect(Array.isArray(groups)).toBeTruthy();

    const hallucinations = await getJson(request, token, '/hallucinations');
    expect(Array.isArray(hallucinations)).toBeTruthy();
  });

  test('main migrated routes render against the live API without redirecting to login', async ({ page }) => {
    await loginThroughDashboard(page);

    for (const path of ['/', '/report', '/settings']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
