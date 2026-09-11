import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/apiClient';
import { Clock as ClockIcon } from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import styles from '../ui/SystemClock.module.css';
import { toast } from 'react-toastify';
import logger from '../../utils/logger';

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

const TIMEZONES = [
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  
  // North America - US Timezones
  { value: "America/New_York", label: "US Eastern Time (ET)" },
  { value: "America/Chicago", label: "US Central Time (CT)" },
  { value: "America/Denver", label: "US Mountain Time (MT)" },
  { value: "America/Phoenix", label: "US Arizona Time (AZ)" },
  { value: "America/Los_Angeles", label: "US Pacific Time (PT)" },
  { value: "America/Anchorage", label: "US Alaska Time (AKT)" },
  { value: "America/Adak", label: "US Hawaii-Aleutian Time (HST)" },
  { value: "Pacific/Honolulu", label: "US Hawaii Time (HST)" },
  
  // North America - Canada
  { value: "America/Vancouver", label: "Canada Pacific Time" },
  { value: "America/Edmonton", label: "Canada Mountain Time" },
  { value: "America/Winnipeg", label: "Canada Central Time" },
  { value: "America/Toronto", label: "Canada Eastern Time" },
  { value: "America/Halifax", label: "Canada Atlantic Time" },
  { value: "America/St_Johns", label: "Canada Newfoundland Time" },
  
  // Mexico
  { value: "America/Mexico_City", label: "Mexico Central Time" },
  { value: "America/Tijuana", label: "Mexico Pacific Time" },
  
  // South America
  { value: "America/Bogota", label: "Colombia Time (COT)" },
  { value: "America/Lima", label: "Peru Time (PET)" },
  { value: "America/Santiago", label: "Chile Time (CLT)" },
  { value: "America/Sao_Paulo", label: "Brazil Time (BRT)" },
  { value: "America/Buenos_Aires", label: "Argentina Time (ART)" },
  
  // Europe
  { value: "Europe/London", label: "UK Time (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Europe/Berlin", label: "Germany Time (CET)" },
  { value: "Europe/Rome", label: "Italy Time (CET)" },
  { value: "Europe/Madrid", label: "Spain Time (CET)" },
  { value: "Europe/Amsterdam", label: "Netherlands Time (CET)" },
  { value: "Europe/Stockholm", label: "Sweden Time (CET)" },
  { value: "Europe/Oslo", label: "Norway Time (CET)" },
  { value: "Europe/Copenhagen", label: "Denmark Time (CET)" },
  { value: "Europe/Helsinki", label: "Finland Time (EET)" },
  { value: "Europe/Warsaw", label: "Poland Time (CET)" },
  { value: "Europe/Prague", label: "Czech Republic Time (CET)" },
  { value: "Europe/Budapest", label: "Hungary Time (CET)" },
  { value: "Europe/Athens", label: "Greece Time (EET)" },
  { value: "Europe/Moscow", label: "Russia Time (MSK)" },
  { value: "Europe/Istanbul", label: "Turkey Time (TRT)" },
  
  // Asia
  { value: "Asia/Dubai", label: "UAE Time (GST)" },
  { value: "Asia/Karachi", label: "Pakistan Time (PKT)" },
  { value: "Asia/Kolkata", label: "India Time (IST)" },
  { value: "Asia/Dhaka", label: "Bangladesh Time (BST)" },
  { value: "Asia/Bangkok", label: "Thailand Time (ICT)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time (HKT)" },
  { value: "Asia/Shanghai", label: "China Time (CST)" },
  { value: "Asia/Tokyo", label: "Japan Time (JST)" },
  { value: "Asia/Seoul", label: "South Korea Time (KST)" },
  { value: "Asia/Manila", label: "Philippines Time (PHT)" },
  { value: "Asia/Jakarta", label: "Indonesia Time (WIB)" },
  
  // Australia & Oceania
  { value: "Australia/Sydney", label: "Australia Eastern Time (AEST)" },
  { value: "Australia/Melbourne", label: "Australia Eastern Time (AEST)" },
  { value: "Australia/Brisbane", label: "Australia Eastern Time (AEST)" },
  { value: "Australia/Adelaide", label: "Australia Central Time (ACST)" },
  { value: "Australia/Perth", label: "Australia Western Time (AWST)" },
  { value: "Australia/Darwin", label: "Australia Central Time (ACST)" },
  { value: "Pacific/Auckland", label: "New Zealand Time (NZST)" },
  
  // Africa
  { value: "Africa/Cairo", label: "Egypt Time (EET)" },
  { value: "Africa/Johannesburg", label: "South Africa Time (SAST)" },
  { value: "Africa/Lagos", label: "Nigeria Time (WAT)" },
  { value: "Africa/Nairobi", label: "Kenya Time (EAT)" },
];

const SystemClock = ({ userRole, timeFormat: timeFormatProp = '24h', timezone, setTimezone }) => {
  const [displayTime, setDisplayTime] = useState('--:--:--');
  const [serverTimeOffset, setServerTimeOffset] = useState(null); // Offset in milliseconds
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dialogRef = useRef(null);
  const [pendingDateTime, setPendingDateTime] = useState('');
  const [pendingTimezone, setPendingTimezone] = useState(timezone || 'UTC');
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

  // Fetch current timezone from settings
  const fetchCurrentTimezone = useCallback(async () => {
    try {
      const response = await api.get(`/settings`);
      if (response.data && response.data.global_timezone) {
        setPendingTimezone(response.data.global_timezone);
      }
    } catch (error) {
      logger.error('Failed to fetch timezone:', error);
    }
  }, []);

  const openModal = async () => {
    if (!isAdmin) return;
    
    // Fetch current timezone
    await fetchCurrentTimezone();
    
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

  const handleSubmit = async (event) => {
    // TO-DO Returning 404 from the API fix on API before re-enabling
    // event.preventDefault();
    // if (!pendingDateTime) {
    //   toast.error('Please enter a valid date and time.');
    //   return;
    // }

    // setIsSaving(true);
    // try {
    //   // Update system time
    //   const timePayload = { datetime: pendingDateTime };
    //   await api.post(`/system-time`, timePayload);
      
    //   // Update timezone if it changed
    //   if (pendingTimezone !== timezone) {
    //     await api.put(`/settings`, {
    //       global_timezone: pendingTimezone
    //     });
    //     // Update parent component's timezone state if setter is provided
    //     if (setTimezone) {
    //       setTimezone(pendingTimezone);
    //     }
    //   }
      
    //   toast.success('System time and timezone updated successfully.');
    //   setIsModalOpen(false);
      
    //   // Refresh server time after update
    //   await fetchServerTime();
    // } catch (error) {
    //   logger.error('Failed to update system time/timezone:', error);
    //   const message = error.response?.data?.error || 'Failed to update system time and timezone.';
    //   toast.error(message);
    // } finally {
    //   setIsSaving(false);
    // }
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
          {timezone && <span className={styles.timezone}>{timezone}</span>}
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
                <h2 className={modalStyles.title}>Set System Time &amp; Timezone</h2>
                <p className={modalStyles.subtitle}>
                  Enter the desired local date and time, and select timezone. Administrator privileges are required.
                </p>
              </div>
            </div>

            <div className={modalStyles.body}>
              <div className={formStyles.form}>
                <label className={formStyles.field}>
                  <span className={formStyles.label}>Date &amp; Time</span>
                  <input type="datetime-local" step="1" value={pendingDateTime} onChange={(event) => setPendingDateTime(event.target.value)} className={formStyles.input} required />
                </label>

                <label className={formStyles.field}>
                  <span className={formStyles.label}>Timezone</span>
                  <select value={pendingTimezone} onChange={(event) => setPendingTimezone(event.target.value)} className={formStyles.select} required>
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
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
