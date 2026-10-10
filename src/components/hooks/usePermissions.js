import { useCallback, useMemo } from 'react';
import { useAuth } from '../AuthContext';

export const usePermissions = () => {
  const { user: authValue } = useAuth();
  const user = authValue?.user ?? authValue ?? null;

  const permissions = useMemo(() => {
    if (!Array.isArray(user?.permissions)) return new Set();
    return new Set(user.permissions);
  }, [user?.permissions]);

  const hasPermission = useCallback(
    (permission) => user?.role === 'admin' || permissions.has(permission),
    [permissions, user?.role],
  );

  return {
    permissions: [...permissions],
    hasPermission,
    loading: false,
  };
};
