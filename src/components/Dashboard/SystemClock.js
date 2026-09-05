import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/apiClient';
import { Clock as ClockIcon } from 'lucide-react';
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

const SystemClock = ({ userRole, isDarkMode, timeFormat: timeFormatProp = '24h', timezone, setTimezone }) => {
  const [displayTime, setDisplayTime] = useState('--:--:--');
  const [serverTimeOffset, setServerTimeOffset] = useState(null); // Offset in milliseconds
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const textColor = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const iconColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openModal}
          className={`flex flex-col items-end gap-0.5 px-3 py-1.5 font-mono text-lg md:text-xl tracking-wider transition-opacity ${
            isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
          } ${textColor}`}
          title={isAdmin ? 'Click to adjust system time' : 'System time'}
          disabled={!isAdmin}
        >
          <div className="flex items-center gap-2">
            <ClockIcon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
            <span className="whitespace-nowrap">
              {displayTime}
            </span>
          </div>
          {timezone && (
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {timezone}
            </span>
          )}
        </button>
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            padding: '1rem'
          }}
          onClick={closeModal}
        >
          <div
            className={`w-full max-w-md rounded-lg shadow-xl ${
              isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
            style={{ 
              margin: 'auto',
              position: 'relative',
              zIndex: 51
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold mb-1">Set System Time & Timezone</h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Enter the desired local date and time, and select timezone. Administrator privileges are required.
                </p>
              </div>

              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Date &amp; Time
                <input
                  type="datetime-local"
                  step="1"
                  value={pendingDateTime}
                  onChange={(event) => setPendingDateTime(event.target.value)}
                  className={`mt-2 w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-gray-100'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                />
              </label>

              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Timezone
                <select
                  value={pendingTimezone}
                  onChange={(event) => setPendingTimezone(event.target.value)}
                  className={`mt-2 w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDarkMode
                      ? 'border-gray-600 bg-gray-800 text-gray-100'
                      : 'border-gray-300 bg-white text-gray-900'
                  }`}
                  required
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SystemClock;
