import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, AlertTriangle, Info, WifiOff } from 'lucide-react';
import Button from '../ui/Button';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/NotificationBanner.module.css';

const NotificationBanner = () => {
  const [visibleNotification, setVisibleNotification] = useState(null);
  const [stackedCount, setStackedCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiFetch(`/notifications`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      
      const allNotifications = data.notifications || [];
      
      // Separate stacked and non-stacked notifications
      const stacked = allNotifications.filter(n => n.mode === 'stacked');
      const nonStacked = allNotifications.filter(n => n.mode !== 'stacked');
      
      // For stacked, show the first visible one
      const visibleStacked = stacked.find(n => n.is_visible !== false) || stacked[0];
      
      // Combine: show visible stacked first, then non-stacked
      const toDisplay = [];
      if (visibleStacked) {
        toDisplay.push(visibleStacked);
      }
      toDisplay.push(...nonStacked);
      
      setVisibleNotification(toDisplay[0] || null);
      setStackedCount(stacked.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 5 seconds for new notifications
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleClear = useCallback(async (notificationId) => {
    try {
      const response = await apiFetch(`/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear notification');
      
      // Refresh notifications
      await fetchNotifications();
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  }, [fetchNotifications]);

  // Auto-dismiss temporary notifications
  useEffect(() => {
    if (visibleNotification && visibleNotification.mode === 'temporary') {
      const timer = setTimeout(() => {
        handleClear(visibleNotification.id);
      }, 10000); // 10 seconds
      return () => clearTimeout(timer);
    }
  }, [visibleNotification, handleClear]);

  const getIcon = (type) => {
    switch (type) {
      case 'system_error':
        return <AlertCircle className={styles.icon} />;
      case 'device_disconnection':
        return <WifiOff className={styles.icon} />;
      case 'warning':
        return <AlertTriangle className={styles.icon} />;
      case 'info':
        return <Info className={styles.icon} />;
      default:
        return <Info className={styles.icon} />;
    }
  };

  const getVariant = useCallback((type) => {
    switch (type) {
      case 'system_error':
        return noticeStyles.error;
      case 'device_disconnection':
      case 'warning':
        return noticeStyles.warning;
      case 'info':
        return noticeStyles.info;
      default:
        return noticeStyles.info;
    }
  }, []);

  if (!visibleNotification) {
    return null;
  }

  return (
    <div className={`${noticeStyles.notice} ${styles.banner} ${getVariant(visibleNotification.type)}`}>
      <div className={styles.content}>
        {getIcon(visibleNotification.type)}
        <div className={styles.text}>
          <div className={styles.title}>
            {visibleNotification.title}
          </div>
          <div className={styles.message}>
            {visibleNotification.message}
          </div>
        </div>
        {stackedCount > 1 && (
          <span className="pill">
            {stackedCount} more
          </span>
        )}
      </div>
      <Button type="button" onClick={() => handleClear(visibleNotification.id)}
        variant="ghost" size="icon" aria-label="Clear notification"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
};

export default NotificationBanner;
