const { test, expect } = require('@playwright/test');
const {
  loginThroughDashboard,
  apiLogin,
  getJson,
  patchJson,
} = require('./helpers');

test.describe.serial('Transcription settings', () => {
  test('Transcription settings UI reads the live /settings/transcription values', async ({ page, request }) => {
    await loginThroughDashboard(page);
    const login = await apiLogin(request);
    const settings = await getJson(request, login.token, '/settings/transcription');

    await page.goto('/settings?tab=transcription-engine');
    await page.getByRole('button', { name: 'Transcription service settings' }).click();

    await expect(page.getByLabel('Target language')).toHaveValue(settings.target_language);
    await expect(page.getByLabel('Model')).toHaveValue(settings.model);
    await expect(page.getByLabel('Method')).toHaveValue(settings.method);
    await expect(page.getByRole('checkbox', { name: /transcription queue/i })).toBeChecked({
      checked: Boolean(settings.queue_enabled),
    });
  });

  test('Transcription settings save through the real API and are restored afterward', async ({ page, request }) => {
    await loginThroughDashboard(page);
    const login = await apiLogin(request);
    const original = await getJson(request, login.token, '/settings/transcription');

    const languages = ['english', 'spanish', 'french', 'german'];
    const nextLanguage = languages.find((language) => language !== original.target_language) || 'english';

    try {
      await page.goto('/settings?tab=transcription-engine');
      await page.getByRole('button', { name: 'Transcription service settings' }).click();

      await page.getByLabel('Target language').selectOption(nextLanguage);

      const saveResponse = page.waitForResponse((response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith('/settings/transcription')
      );
      await page.getByRole('button', { name: /save transcription settings/i }).click();
      expect((await saveResponse).ok()).toBeTruthy();

      const saved = await getJson(request, login.token, '/settings/transcription');
      expect(saved.target_language).toBe(nextLanguage);
    } finally {
      await patchJson(request, login.token, '/settings/transcription', {
        target_language: original.target_language,
        model: original.model,
        method: original.method,
        queue_enabled: Boolean(original.queue_enabled),
      });
    }
  });
});
