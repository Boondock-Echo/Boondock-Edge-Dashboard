import { render, screen } from '@testing-library/react';
import App from '../src/App';
import { AuthProvider } from '../src/components/AuthContext';

test('renders the unauthenticated application', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
