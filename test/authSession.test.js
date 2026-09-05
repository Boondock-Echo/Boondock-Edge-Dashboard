import { clearSensitiveSession } from '../src/components/AuthContext';

beforeEach(() => localStorage.clear());

test('clearing a session removes identity and protected caches', () => {
  ['token', 'user', 'name', 'cached_channels', 'cached_messages', 'cached_keywords', 'last_fetch_time']
    .forEach((key) => localStorage.setItem(key, 'value'));

  clearSensitiveSession();

  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('user')).toBeNull();
  expect(localStorage.getItem('name')).toBeNull();
  expect(localStorage.getItem('cached_channels')).toBeNull();
  expect(localStorage.getItem('cached_messages')).toBeNull();
  expect(localStorage.getItem('cached_keywords')).toBeNull();
  expect(localStorage.getItem('last_fetch_time')).toBeNull();
});
