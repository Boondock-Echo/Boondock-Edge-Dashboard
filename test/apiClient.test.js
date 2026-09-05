import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/components/AuthContext';
import api, { API_BASE_URL } from '../src/utils/apiClient';

beforeEach(() => {
  localStorage.clear();
  window.fetch = jest.fn().mockResolvedValue(new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  ));
});

const AuthHarness = () => {
  const { login, user } = useAuth();
  return (
    <button onClick={() => login({ username: 'user@example.com', token: 'test-token' })}>
      {user ? user.username : 'Log in'}
    </button>
  );
};

test('login updates the in-memory token used by the Fetch client', async () => {
  render(<AuthProvider><AuthHarness /></AuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  await api.get('/protected');

  const [, options] = window.fetch.mock.calls[0];
  expect(options.headers.get('Authorization')).toBe('Bearer test-token');
});

test('the deployment API endpoint is applied to relative requests', async () => {
  await api.get('/status');

  expect(window.fetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/status`);
  expect(window.fetch.mock.calls[0][1].signal).toBeDefined();
});

test('a protected 401 logs out through AuthContext', async () => {
  window.fetch.mockResolvedValueOnce(new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  ));
  render(<AuthProvider><AuthHarness /></AuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  await expect(api.get('/mfa/status')).rejects.toThrow('Unauthorized');

  await waitFor(() => expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument());
  expect(localStorage.getItem('token')).toBeNull();
});
