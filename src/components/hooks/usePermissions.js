import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import logger from '../../utils/logger';

export const usePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState({
    access_settings: false,
    inbox: true,
    create_reports: false,
    view_reports: true,
    modify_reports: false,
    play_audio: true,
    delete_audio: false,
    access_advanced_player: false
  });
  const [loading, setLoading] = useState(true);
  // Use ref to track if we've already fetched permissions for this user
  const fetchedUserRef = useRef(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let timeout;

    const fetchPermissions = () => {
      // Early return if no user or username
      if (!user?.username) {
        if (isMounted) {
          setLoading(false);
          // Reset to default permissions when no user
          setPermissions({
            access_settings: false,
            inbox: true,
            create_reports: false,
            view_reports: true,
            modify_reports: false,
            play_audio: true,
            delete_audio: false,
            access_advanced_player: false
          });
          fetchedUserRef.current = null;
          fetchedRef.current = false;
        }
        return;
      }

      const token = localStorage.getItem('token');
      // Early return if no token - don't make API call
      if (!token) {
        if (isMounted) {
          setLoading(false);
          // Reset to default permissions when no token
          setPermissions({
            access_settings: false,
            inbox: true,
            create_reports: false,
            view_reports: true,
            modify_reports: false,
            play_audio: true,
            delete_audio: false,
            access_advanced_player: false
          });
          fetchedUserRef.current = null;
          fetchedRef.current = false;
        }
        return;
      }

      // Don't fetch if we've already fetched for this user
      if (fetchedUserRef.current === user.username && fetchedRef.current) {
        return;
      }

      // Use .then/.catch chain instead of await to prevent unhandled rejections
      apiFetch(`/users/${user.username}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // Server returned HTML (likely 404 page), not JSON
          logger.debug('Permissions endpoint returned non-JSON response');
          if (isMounted) setLoading(false);
          return null;
        }

        if (response.ok) {
          return response.json().then(data => {
            if (isMounted) {
              setPermissions(data.features || {});
              setLoading(false);
              fetchedUserRef.current = user.username;
              fetchedRef.current = true;
            }
          });
        } else if (response.status === 401) {
          // 401 is expected for non-admin users or when token is invalid
          // Don't log as error, just use default permissions
          if (isMounted) {
            setLoading(false);
            fetchedUserRef.current = user.username;
            fetchedRef.current = true; // Mark as fetched even on 401 to prevent retries
          }
        } else {
          // Only log non-401 errors
          logger.warn(`Permissions endpoint returned ${response.status}`);
          if (isMounted) {
            setLoading(false);
            fetchedUserRef.current = user.username;
            fetchedRef.current = true;
          }
        }
      })
      .catch(err => {
        // Network errors or other issues - silently fail for permissions
        // User will just get default permissions
        // Don't log - these are expected failures
        if (isMounted) setLoading(false);
      });
    };

    // Only fetch if user exists and has username and we haven't fetched for this user yet
    // Use user?.username as dependency instead of entire user object to prevent unnecessary re-runs
    if (user?.username && (fetchedUserRef.current !== user.username || !fetchedRef.current)) {
      // Debounce: only fetch after 500ms of no changes
      timeout = setTimeout(fetchPermissions, 500);
    } else {
      // No user or already fetched, set loading to false immediately
      if (isMounted && !user?.username) {
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [user?.username]);

  const hasPermission = (feature) => {
    // Admin role always has all permissions
    if (user?.role === 'admin') {
      return true;
    }
    return permissions[feature] || false;
  };

  return { permissions, hasPermission, loading };
};
