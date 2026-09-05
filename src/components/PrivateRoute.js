// PrivateRoute.js
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** One parent guard for every private route in App. */
export const PrivateRoute = () => {
  const { user } = useAuth();
  const location = useLocation();

  return user
    ? <Outlet />
    : <Navigate to="/login" state={{ from: location }} replace />;
};
