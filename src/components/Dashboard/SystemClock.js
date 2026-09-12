import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock as ClockIcon } from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import styles from '../ui/SystemClock.module.css';
import { getBrowserTimeZone } from '../../utils/dateTime';

const formatTime = (date, format = '24h') => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '--:--:--';
  }

  const pad = (n) => String(n).padStart(2, '0');
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  if (format === '12h') {
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${pad(hour12)}:${minutes}:${seconds} ${ampm}`;
  }
  return `${pad(hours)}:${minutes}:${seconds}`;
};

const toInputValue = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const SystemClock = ({ userRole, timeFormat: timeFormatProp = '24h' }) => {
  const [displayTime, setDisplayTime] = useState('--:--:--');
  const [serverTimeOffset, setServerTimeOffset] = useState(null); // Offset in milliseconds
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dialogRef = useRef(null);
  const [pendingDateTime, setPendingDateTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);

  // Fetch server UTC time and calculate offset
  const fetchServerTime = useCallback(async () => {
    // TO-DO Returning 404 from the API fix on API before re-enabling
    // try {
    //   const response = await api.get(`/system-time`);
    //   const data = response.data;
      
    //   // Check if system_time exists and is valid
    //   if (!data || !data.system_time) {
    //     logger.debug('Server time not available, using local time');
    //     setServerTimeOffset(null);
    //     return;
    //   }
      
    //   // Parse UTC time from server (should be in ISO format with Z suffix)
    //   const serverUtcTime = new Date(data.system_time);
      
    //   if (isNaN(serverUtcTime.getTime())) {
    //     logger.warn('Invalid server time format:', data.system_time);
    //     setServerTimeOffset(null);
    //     return;
    //   }

    //   // Calculate offset: server UTC time - client current time
    //   // This offset accounts for network latency and clock drift
    //   const clientTime = new Date();
    //   const offset = serverUtcTime.getTime() - clientTime.getTime();
    //   setServerTimeOffset(offset);
    //   // Don't override timeFormat from props - use prop value instead
    //   // setTimeFormat(data.time_format || '24h');
    // } catch (error) {
    //   // Only log as error if it's not a 401 (expected for non-admin users)
    //   if (error.response?.status !== 401) {
    //     logger.error('Failed to fetch server time:', error);
    //   } else {
    //     logger.debug('Server time endpoint returned 401 (expected for non-admin users)');
    //   }
    //   setServerTimeOffset(null);
    // }
  }, []);

  // Initialize: fetch server time on mount
  useEffect(() => {
    fetchServerTime();
    // Refresh server time every 30 seconds to account for drift
    const refreshInterval = setInterval(fetchServerTime, 30000);
    return () => clearInterval(refreshInterval);
  }, [fetchServerTime]);

  // Update display time every second
  useEffect(() => {
    const updateTime = () => {
      let currentTime;
      
      if (serverTimeOffset !== null && Number.isFinite(serverTimeOffset)) {
        // Use server UTC time converted to browser local timezone
        const serverUtcNow = new Date(Date.now() + serverTimeOffset);
        // Convert UTC to local timezone (JavaScript Date automatically handles this)
        currentTime = new Date(serverUtcNow);
      } else {
        // Fallback to local time
        currentTime = new Date();
      }
      
      setDisplayTime(formatTime(currentTime, timeFormatProp));
    };

    // Update immediately
    updateTime();
    
    // Then update every second
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [serverTimeOffset, timeFormatProp]);

  const openModal = async () => {
    if (!isAdmin) return;
    
    // Get current server time in local timezone for the input
    let currentTime;
    if (serverTimeOffset !== null && Number.isFinite(serverTimeOffset)) {
      const serverUtcNow = new Date(Date.now() + serverTimeOffset);
      currentTime = new Date(serverUtcNow);
    } else {
      currentTime = new Date();
    }
    setPendingDateTime(toInputValue(currentTime));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isModalOpen && !dialog.open) dialog.showModal();
    if (!isModalOpen && dialog.open) dialog.close();
  }, [isModalOpen]);

  const handleSubmit = (event) => {
    // System-time API support is currently disabled.
    event.preventDefault();
  };


  return (
    <>
      <div className="row">
        <button
          type="button"
          onClick={openModal}
          className={styles.clockButton}
          title={isAdmin ? 'Click to adjust system time' : 'System time'}
          disabled={!isAdmin}
        >
          <div className="row">
            <ClockIcon className={styles.clockIcon} aria-hidden="true" />
            <span>{displayTime}</span>
          </div>
          <span className={styles.timezone}>{getBrowserTimeZone()}</span>
        </button>
      </div>

      <dialog
          ref={dialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => {
            event.preventDefault();
            closeModal();
          }}
        >
          <form onSubmit={handleSubmit} className={formStyles.form}>
            <div className={modalStyles.header}>
              <div>
                <h2 className={modalStyles.title}>Set System Time</h2>
                <p className={modalStyles.subtitle}>
                  Enter the desired local date and time. Administrator privileges are required.
                </p>
              </div>
            </div>

            <div className={modalStyles.body}>
              <div className={formStyles.form}>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Date &amp; Time</span>
                  <input type="datetime-local" step="1" value={pendingDateTime} onChange={(event) => setPendingDateTime(event.target.value)} className={formStyles.input} required />
                </label>

              </div>
            </div>

            <div className={modalStyles.actionsBetween}>
              <span />
              <div className={modalStyles.actions}>
                <Button type="button" onClick={closeModal} variant="secondary" disabled={isSaving}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Apply'}</Button>
              </div>
            </div>
          </form>
        </dialog>
    </>
  );
};

export default SystemClock;
