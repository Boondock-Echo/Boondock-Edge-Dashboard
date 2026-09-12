import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CalendarCheck, Database, MessageSquare, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import api from '../../utils/apiClient';
import {
  SettingsPageHero,
  SettingsSectionWidth,
} from '../Settings/SettingsSectionLayout';
import { SettingsSubnav, SettingsSubnavTab } from '../Settings/SettingsSubnav';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/TerminalLogs.module.css';
import { formatLocalDateTime } from '../../utils/dateTime';

/** Log sub-tabs (must match `logTypes` keys below). Synced to `?tab=Logs&logsTab=` when embedded in Settings. */
const LOG_TAB_IDS = ['error', 'warning', 'transcription', 'database', 'event', 'device'];

const LogEntry = ({ log, logTypes }) => {
  const logType = logTypes[log.level] || logTypes.error;
  const Icon = logType.icon;

  return (
    <div className={`${styles.logEntry} ${styles[logType.tone] || styles.logNeutral}`}>
      <div className="rowBetween">
        <div className="row">
          {Icon && <Icon />}
          <span className={styles.logMeta}>
            {log.timestamp ? formatLocalDateTime(log.timestamp) : '--'}
          </span>
        </div>
        <span className="pill">
          {logType.label}
        </span>
      </div>
      <div className={styles.logMeta}>
        SYSTEM/{log.logger}
      </div>
      <div className={styles.logMessage}>
        {log.message}
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className={styles.empty}>
    <div>INITIALIZING SYSTEMS...</div>
    <span className="spinner spinnerLarge" aria-hidden="true" />
  </div>
);

const ErrorDisplay = ({ error, onRetry }) => (
  <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
    <div className={noticeStyles.body}>
      <p>SYSTEM FAILURE: {error}</p>
      <Button variant="danger" size="small" onClick={onRetry}>RETRY_CONNECTION</Button>
    </div>
  </div>
);

const F1TerminalLogs = ({
  syncLogsTabToUrl = false,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('error');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deviceLogs, setDeviceLogs] = useState({}); // COM port logs keyed by port
  const [selectedDevicePort, setSelectedDevicePort] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!syncLogsTabToUrl) return;
    const lt = searchParams.get('logsTab');
    if (lt && LOG_TAB_IDS.includes(lt)) {
      setSelectedType(lt);
    }
  }, [syncLogsTabToUrl, searchParams]);

  // Date navigation state - defaults to today
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  const [currentDate, setCurrentDate] = useState(getTodayDate());

  const logTypes = {
    error: {
      label: 'CRITICAL',
      icon: AlertCircle,
      tone: 'logError'
    },
    warning: {
      label: 'WARNINGS',
      icon: AlertTriangle,
      tone: 'logWarning'
    },
    transcription: {
      label: 'COMMS',
      icon: MessageSquare,
      tone: 'logInfo'
    },
    database: {
      label: 'DATABASE',
      icon: Database,
      tone: 'logSuccess'
    },
    event: {
      label: 'EVENTS',
      icon: CalendarCheck,
      tone: 'logInfo'
    },
    device: {
      label: 'DEVICES',
      icon: Radio,
      tone: 'logNeutral'
    },
  };

  const fetchLogs = async (date = currentDate) => {
    try {
      setLoading(true);
      setError(null);

      // No limit param = server returns all logs for the date so EVENTS (and other tabs) show everything.
      const response = await api.get(`/logs${date ? `?date=${date}` : ''}`, {
        timeout: 60000,
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.data || typeof response.data !== 'object') {
        console.error('Invalid response format:', response.data);
        throw new Error(`Invalid response format: ${typeof response.data}`);
      }

      // Base log types that come directly from the API
      const baseTypes = ['error', 'warning', 'transcription', 'database', 'event'];

      const validatedLogs = baseTypes.reduce((acc, type) => {
        acc[type] = Array.isArray(response.data[type]) ? response.data[type] : [];
        return acc;
      }, {});

      setLogs(validatedLogs);
    } catch (err) {
      let errorMessage = 'Failed to fetch logs';
      
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        errorMessage = `Server error: ${status} - ${data?.error || data?.message || JSON.stringify(data) || 'Unknown error'}`;
        console.error('Server response error:', { status, data, url: err.config?.url });
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
        console.error('No response from server:', err.request);
      } else {
        errorMessage = err.message || 'Unknown error occurred';
      }
      
      setError(errorMessage);
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Navigate to previous day
  const goToPreviousDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    const newDate = date.toISOString().split('T')[0];
    setCurrentDate(newDate);
    fetchLogs(newDate);
  };

  // Navigate to next day
  const goToNextDay = () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    const newDate = date.toISOString().split('T')[0];
    const today = getTodayDate();
    
    // Don't allow navigating to future dates
    if (newDate <= today) {
      setCurrentDate(newDate);
      fetchLogs(newDate);
    }
  };

  // Go to today
  const goToToday = () => {
    const today = getTodayDate();
    setCurrentDate(today);
    fetchLogs(today);
  };

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date(getTodayDate());
    const isToday = dateStr === getTodayDate();
    
    if (isToday) {
      return 'TODAY';
    }
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options).toUpperCase();
  };

  const fetchDeviceLogs = async (date = currentDate) => {
    try {
      const response = await api.get(`/recorders/logs${date ? `?date=${date}` : ''}`, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        }
      });

      const data = response.data || {};
      const logsByPort = data.logs || {};
      setDeviceLogs(logsByPort);
    } catch (err) {
      console.error('Error fetching recorder logs:', err);
      // Don't surface as main error; device logs are optional
    }
  };

  const handleSearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  // Clear search when switching log tabs so filters don't persist across types
  useEffect(() => {
    setSearchInput('');
    setSearchTerm('');
  }, [selectedType]);

  useEffect(() => {
    fetchLogs(currentDate);
    fetchDeviceLogs(currentDate);
    
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(currentDate);
        fetchDeviceLogs(currentDate);
      }, 30000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, currentDate]);

  // Keep selected device port in sync with available ports (unfiltered set)
  useEffect(() => {
    const ports = Object.keys(deviceLogs || {});
    if (ports.length === 0) {
      setSelectedDevicePort(null);
    } else if (!selectedDevicePort || !ports.includes(selectedDevicePort)) {
      setSelectedDevicePort(ports[0]);
    }
  }, [deviceLogs, selectedDevicePort]);

  if (loading && !Object.keys(logs).length) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchLogs} />;
  }

  const activeSearch = searchTerm.toLowerCase();

  const getTabCount = (type) => {
    if (type === 'device') {
      return Object.values(deviceLogs || {}).reduce(
        (acc, entries) => acc + (Array.isArray(entries) ? entries.length : 0),
        0
      );
    }
    const arr = logs[type];
    return Array.isArray(arr) ? arr.length : 0;
  };

  const getFilteredStandardLogs = () => {
    const base = Array.isArray(logs[selectedType]) ? logs[selectedType] : [];
    if (!activeSearch) return base;
    return base.filter((log) => {
      const msg = (log.message || '').toLowerCase();
      const loggerName = (log.logger || '').toLowerCase();
      const ts = (log.timestamp || '').toLowerCase();
      return msg.includes(activeSearch) || loggerName.includes(activeSearch) || ts.includes(activeSearch);
    });
  };

  const getFilteredDeviceLogs = () => {
    if (!deviceLogs || Object.keys(deviceLogs).length === 0) return {};
    if (!activeSearch) return deviceLogs;

    const result = {};
    Object.entries(deviceLogs).forEach(([port, entries]) => {
      const filtered = (entries || []).filter((entry) => {
        const msg = (entry.message || '').toLowerCase();
        const ts = (entry.timestamp || '').toLowerCase();
        return msg.includes(activeSearch) || ts.includes(activeSearch);
      });
      if (filtered.length > 0) {
        result[port] = filtered;
      }
    });
    return result;
  };

  // Helper: detect device log type from message JSON ("ty" field)
  const getDeviceLogType = (entry) => {
    const raw = entry?.message || '';
    if (!raw) return null;

    // Try to extract JSON substring
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = raw.slice(start, end + 1);
      try {
        const obj = JSON.parse(jsonStr);
        if (obj && typeof obj.ty === 'string') {
          return obj.ty.toLowerCase();
        }
      } catch (e) {
        // Fallback to regex if JSON parse fails
        const match = jsonStr.match(/"ty"\s*:\s*"([^"]+)"/i);
        if (match && match[1]) {
          return match[1].toLowerCase();
        }
      }
    } else {
      // Regex on full line as a fallback
      const match = raw.match(/"ty"\s*:\s*"([^"]+)"/i);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    return null;
  };

  const getDeviceLogClass = (entry) => {
    const ty = getDeviceLogType(entry);

    if (ty === 'fatal' || ty === 'error') {
      return styles.logError;
    }
    if (ty === 'warning') {
      return styles.logWarning;
    }

    // default styling
    return styles.logNeutral;
  };

  const mainCard = cardStyles.card;

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Logs"
        description="View and filter system and device activity by log type."
        icon={<span className="material-symbols-outlined">history_edu</span>}
        trailing={
          <span className="pill pillSuccess">LIVE</span>
        }
      />
      <div className={mainCard}>
        <SettingsSubnav embedded aria-label="Log type tabs">
          {Object.entries(logTypes).map(([type, { label, color, icon: Icon }]) => (
            <SettingsSubnavTab
              key={type}
              active={selectedType === type}
              onClick={() => {
                setSelectedType(type);
                if (syncLogsTabToUrl) {
                  setSearchParams({ tab: 'Logs', logsTab: type });
                }
              }}
              className="row"
            >
              <Icon />
              <span>{label}</span>
              {getTabCount(type) > 0 && (
                <span className="pill">
                  {getTabCount(type)}
                </span>
              )}
            </SettingsSubnavTab>
          ))}
        </SettingsSubnav>

        {/* Date Navigation + Search Row */}
        <div className={styles.toolbar}>
          {/* Date controls (left aligned) */}
          <div className="row">
            <Button variant="secondary" size="small" onClick={goToPreviousDay} title="Previous Day">
              <ChevronLeft />
              <span>PREV</span>
            </Button>
            
            <div className="row">
              <CalendarCheck />
              <span className={styles.logMeta}>
                {formatDateDisplay(currentDate)}
              </span>
              {currentDate !== getTodayDate() && (
                <Button variant="accent" size="small" onClick={goToToday} title="Go to Today">TODAY</Button>
              )}
            </div>
            
            <Button variant="secondary" size="small" onClick={goToNextDay} disabled={currentDate >= getTodayDate()} title="Next Day">
              <span>NEXT</span>
              <ChevronRight />
            </Button>
          </div>

          {/* Search (right side, same row) */}
          <div className="row grow">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder={`Search ${logTypes[selectedType]?.label || 'logs'}...`}
              className={formStyles.input}
            />
            <Button variant="primary" size="small" onClick={handleSearch}>Search</Button>
            {searchTerm && (
              <Button variant="secondary" size="small" onClick={clearSearch}>Clear</Button>
            )}
          </div>
        </div>

        {/* Logs Display */}
        {selectedType !== 'device' && (
          <div className={styles.logList}>
            {getFilteredStandardLogs().length > 0 ? (
              getFilteredStandardLogs().map((log, index) => (
                <LogEntry 
                  key={`${selectedType}-${index}`} 
                  log={{
                    ...log,
                    level: selectedType
                  }}
                  logTypes={logTypes}
                />
              ))
            ) : (
              <div className={styles.empty}>
                <div>NO_DATA</div>
                <p>NO_{logTypes[selectedType]?.label}_DETECTED</p>
              </div>
            )}
          </div>
        )}

        {/* Device (COM port) Logs */}
        {selectedType === 'device' && (
          <div className={styles.logList}>
            {Object.keys(getFilteredDeviceLogs()).length === 0 && (
              <div className={styles.empty}>
                <div>NO_DATA</div>
                <p>NO_DEVICE_LOGS_DETECTED</p>
              </div>
            )}

            {Object.keys(getFilteredDeviceLogs()).length > 0 && (
              <div className={styles.deviceLog}>
                {/* Port Tabs (sticky inside scroll) */}
                <div className={styles.deviceTabs}>
                  <nav className="rowWrap" aria-label="Device log tabs">
                    {Object.entries(getFilteredDeviceLogs()).map(([port, entries]) => (
                      <button
                        key={port}
                        onClick={() => setSelectedDevicePort(port)}
                        className={`pill pillInteractive ${selectedDevicePort === port ? "pillActive" : ""}`}
                      >
                        <Radio />
                        <span>{port}</span>
                        <span className="pill">
                          {entries.length}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Active Port Log (no repeated title) */}
                {selectedDevicePort && getFilteredDeviceLogs()[selectedDevicePort] && (
                  <div className={styles.deviceEntries}>
                    {getFilteredDeviceLogs()[selectedDevicePort].map((entry, idx) => (
                      <div key={`${selectedDevicePort}-${idx}`} className={styles.deviceLine}>
                        <span className={styles.timestamp}>
                          {entry.timestamp ? formatLocalDateTime(entry.timestamp) : '--'}
                        </span>
                        <span className={getDeviceLogClass(entry)}>
                          {entry.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default F1TerminalLogs;
