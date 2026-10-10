const { test, expect } = require('@playwright/test');
const {
  EMAIL,
  loginThroughDashboard,
  principalFromStored,
  apiLogin,
  getJson,
  patchJson,
} = require('./helpers');

test.describe.serial('Boondock Edge live stack', () => {
  test('real dashboard login returns the full authenticated principal', async ({ page }) => {
    const { token, stored } = await loginThroughDashboard(page);
    const principal = principalFromStored(stored);

    expect(token).toBeTruthy();
    expect(principal?.id).toEqual(expect.any(Number));
    expect(principal?.email).toBe(EMAIL.toLowerCase());
    expect(principal?.role).toBe('admin');
    expect(principal?.preferences?.inbox).toEqual(expect.any(Object));
    expect(principal?.preferences?.reports).toEqual(expect.any(Object));
    expect(principal?.preferences?.display).toBeUndefined();
  });

  test('main migrated routes render while authenticated', async ({ page }) => {
    await loginThroughDashboard(page);

    for (const path of ['/', '/report', '/settings']) {
      await page.goto(path);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText('Something went wrong.')).toHaveCount(0);
    }
  });

  test('live API contracts used by the migrated dashboard are reachable', async ({ request }) => {
    const login = await apiLogin(request);
    const token = login.token;

    const channels = await getJson(request, token, '/channels');
    expect(Array.isArray(channels)).toBeTruthy();

    const frequencies = await getJson(request, token, '/frequencies');
    expect(Array.isArray(frequencies)).toBeTruthy();

    const inbox = await getJson(
      request,
      token,
      '/recordings/inbox?limit=1&sort_direction=newest_first'
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

    expect(Array.isArray(await getJson(request, token, '/users'))).toBeTruthy();
    expect(Array.isArray(await getJson(request, token, '/groups'))).toBeTruthy();
    expect(Array.isArray(await getJson(request, token, '/hallucinations'))).toBeTruthy();
  });

  test('Inbox and Reports preferences persist through browser, API, and database', async ({ page, request }) => {
    const { stored } = await loginThroughDashboard(page);
    const principal = principalFromStored(stored);
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
      expect((await inboxPatch).ok()).toBeTruthy();

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
      expect((await reportsPatch).ok()).toBeTruthy();

      currentLogin = await apiLogin(request);
      expect(currentLogin.user.preferences.reports.density).toBe(nextDensity);
      expect(currentLogin.user.preferences.inbox.time_format).toBe(nextTimeFormat);
      expect(await page.evaluate(() => localStorage.getItem('reports_density_mode'))).toBeNull();
    } finally {
      if (currentLogin?.token) {
        await patchJson(
          request,
          currentLogin.token,
          `/users/${principal.id}`,
          { preferences: originalPreferences }
        );
      }
    }
  });
});
