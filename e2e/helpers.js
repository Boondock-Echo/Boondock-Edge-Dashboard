const { expect } = require('@playwright/test');

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const API_URL =
  process.env.E2E_API_URL ||
  process.env.REACT_APP_EDGE_SERVER_ENDPOINT;

if (!EMAIL) {
  throw new Error('E2E_EMAIL is not configured');
}

if (!PASSWORD) {
  throw new Error('E2E_PASSWORD is not configured');
}

if (!API_URL) {
  throw new Error(
    'E2E_API_URL or REACT_APP_EDGE_SERVER_ENDPOINT is not configured'
  );
}

const principalFromStored = (stored) => {
  if (!stored) {
    return null;
  }

  return stored.user || stored;
};

const loginThroughDashboard = async (page) => {
  await page.goto('/login');

  await page
    .getByLabel('User ID', { exact: true })
    .fill(EMAIL);

  await page
    .getByLabel('Password', { exact: true })
    .fill(PASSWORD);

  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/auth/login')
  );

  await page
    .getByRole('button', { name: 'Enter Console' })
    .click();

  const loginResponse = await loginResponsePromise;
  const responseText = await loginResponse.text();

  console.log(
    `LOGIN RESPONSE: ${loginResponse.status()} ${responseText}`
  );

  const mfaCode = page.getByLabel('MFA code', { exact: true });

  if (await mfaCode.isVisible().catch(() => false)) {
    throw new Error(
      'The Playwright test user requires MFA.'
    );
  }

  if (!loginResponse.ok()) {
    throw new Error(
      `Dashboard login failed: HTTP ${loginResponse.status()} ${responseText}`
    );
  }

  await expect(page).toHaveURL(/\/$/, {
    timeout: 20_000,
  });

  return page.evaluate(() => ({
    token: localStorage.getItem('token'),
    stored: JSON.parse(localStorage.getItem('user') || 'null'),
  }));
};

const apiLogin = async (request) => {
  const response = await request.post(
    `${API_URL.replace(/\/$/, '')}/auth/login`,
    {
      data: {
        email: EMAIL,
        password: PASSWORD,
      },
    }
  );

  if (!response.ok()) {
    throw new Error(
      `API login failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.json();
};

const getJson = async (
  request,
  token,
  path
) => {
  const response = await request.get(
    `${API_URL.replace(/\/$/, '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    throw new Error(
      `GET ${path} failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.json();
};

const postJson = async (
  request,
  token,
  path,
  data
) => {
  const response = await request.post(
    `${API_URL.replace(/\/$/, '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data,
    }
  );

  if (!response.ok()) {
    throw new Error(
      `POST ${path} failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.status() === 204
    ? null
    : response.json();
};

const putJson = async (
  request,
  token,
  path,
  data
) => {
  const response = await request.put(
    `${API_URL.replace(/\/$/, '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data,
    }
  );

  if (!response.ok()) {
    throw new Error(
      `PUT ${path} failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.status() === 204
    ? null
    : response.json();
};

const patchJson = async (
  request,
  token,
  path,
  data
) => {
  const response = await request.patch(
    `${API_URL.replace(/\/$/, '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data,
    }
  );

  if (!response.ok()) {
    throw new Error(
      `PATCH ${path} failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.status() === 204
    ? null
    : response.json();
};

const deleteJson = async (
  request,
  token,
  path
) => {
  const response = await request.delete(
    `${API_URL.replace(/\/$/, '')}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    throw new Error(
      `DELETE ${path} failed: HTTP ${response.status()} ${await response.text()}`
    );
  }

  return response.status() === 204
    ? null
    : response.json();
};

module.exports = {
  EMAIL,
  PASSWORD,
  API_URL,
  principalFromStored,
  loginThroughDashboard,
  apiLogin,
  getJson,
  postJson,
  putJson,
  patchJson,
  deleteJson,
};