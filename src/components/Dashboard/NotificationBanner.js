import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, AlertCircle, AlertTriangle, Info, WifiOff } from 'lucide-react';
import api from '../../utils/apiClient';
import { useInboxLive } from '../InboxContext';
import Button from '../ui/Button';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/NotificationBanner.module.css';

const NotificationBanner = () => {
  const { notifications, removeNotification } = useInboxLive();
  const [hiddenTemporaryIds, setHiddenTemporaryIds] = useState(() => new Set());

  const { visibleNotification, stackedCount } = useMemo(() => {
    const available = (notifications || []).filter(
      (notification) => !hiddenTemporaryIds.has(notification.id),
    );

    const stacked = available.filter((notification) => notification.mode === 'stacked');
    const nonStacked = available.filter((notification) => notification.mode !== 'stacked');
    const visibleStacked =
      stacked.find((notification) => notification.is_visible !== false) || stacked[0];

    return {
      visibleNotification: visibleStacked || nonStacked[0] || null,
      stackedCount: stacked.length,
    };
  }, [hiddenTemporaryIds, notifications]);

  const handleClear = useCallback(async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      removeNotification(notificationId);
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  }, [removeNotification]);

  useEffect(() => {
    if (!visibleNotification || visibleNotification.mode !== 'temporary') {
      return undefined;
    }

    const notificationId = visibleNotification.id;
    const timer = window.setTimeout(() => {
      setHiddenTemporaryIds((previous) => {
        const next = new Set(previous);
        next.add(notificationId);
        return next;
      });
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [visibleNotification]);

  useEffect(() => {
    setHiddenTemporaryIds((previous) => {
      if (!previous.size) return previous;
      const activeIds = new Set((notifications || []).map((notification) => notification.id));
      const next = new Set(
        [...previous].filter((notificationId) => activeIds.has(notificationId)),
      );
      return next.size === previous.size ? previous : next;
    });
  }, [notifications]);

  const getIcon = (type) => {
    switch (type) {
      case 'system_error':
        return <AlertCircle className={styles.icon} />;
      case 'device_disconnection':
        return <WifiOff className={styles.icon} />;
      case 'warning':
        return <AlertTriangle className={styles.icon} />;
      case 'info':
      default:
        return <Info className={styles.icon} />;
    }
  };

  const getVariant = (type) => {
    switch (type) {
      case 'system_error':
        return noticeStyles.error;
      case 'device_disconnection':
      case 'warning':
        return noticeStyles.warning;
      case 'info':
      default:
        return noticeStyles.info;
    }
  };

  if (!visibleNotification) return null;

  return (
    <div
      className={`${noticeStyles.notice} ${styles.banner} ${getVariant(visibleNotification.type)}`}
    >
      <div className={styles.content}>
        {getIcon(visibleNotification.type)}
        <div className={styles.text}>
          <div className={styles.title}>{visibleNotification.title}</div>
          <div className={styles.message}>{visibleNotification.message}</div>
        </div>
        {stackedCount > 1 && (
          <span className="pill">{stackedCount} more</span>
        )}
      </div>
      <Button
        type="button"
        onClick={() => handleClear(visibleNotification.id)}
        variant="ghost"
        size="icon"
        aria-label="Clear notification"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
};

export default NotificationBanner;
