import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CalendarCheck, Database, MessageSquare, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import api from '../../utils/apiClient';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from '../Settings/SettingsSectionLayout';
import { SettingsSubnav, SettingsSubnavTab } from '../Settings/SettingsSubnav';

/** Log sub-tabs (must match `logTypes` keys below). Synced to `?tab=Logs&logsTab=` when embedded in Settings. */
const LOG_TAB_IDS = ['error', 'warning', 'transcription', 'database', 'event', 'device'];

const LogEntry = ({ log, logTypes, isDarkMode }) => {
  const logType = logTypes[log.level] || logTypes.error;
  const Icon = logType.icon;

  return (
    <div className={`border-l-2 ${logType.borderColor} ${isDarkMode ? logType.bgColorDark : logType.bgColorLight} p-4 font-mono`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className={`w-4 h-4 ${logType.color}`} />}
          <span className={`text-xs ${logType.color} font-bold tracking-wider`}>
            {log.timestamp}
          </span>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${logType.color} font-bold tracking-wider`}>
          {logType.label}
        </span>
      </div>
      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-1 tracking-wider`}>
        SYSTEM/{log.logger}
      </div>
      <div className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-mono text-sm whitespace-pre-wrap break-words`}>
        {log.message}
      </div>
    </div>
  );
};

const LoadingSpinner = ({ isDarkMode }) => (
  <div className={`flex flex-col items-center justify-center min-h-[600px] ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
    <div className={`text-xl ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4 font-mono`}>INITIALIZING SYSTEMS...</div>
    <div className="w-16 h-16 border-t-4 border-red-500 border-solid rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay = ({ error, onRetry, isDarkMode }) => (
  <div className={`flex flex-col items-center justify-center min-h-[600px] ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
    <div className="text-xl text-red-500 mb-4 font-mono">SYSTEM FAILURE: {error}</div>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-red-500/20 border border-red-500 text-red-500 rounded hover:bg-red-500/30 transition-colors font-mono"
    >
      RETRY_CONNECTION
    </button>
  </div>
);

const F1TerminalLogs = ({
  isDarkMode = true,
  timezone,
  timeFormat,
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
      color: 'text-red-500',
      bgColorDark: 'bg-red-500/10',
      bgColorLight: 'bg-red-100',
      borderColor: 'border-red-500/50',
      icon: AlertCircle
    },
    warning: {
      label: 'WARNINGS',
      color: 'text-yellow-500',
      bgColorDark: 'bg-yellow-500/10',
      bgColorLight: 'bg-yellow-100',
      borderColor: 'border-yellow-500/50',
      icon: AlertTriangle
    },
    transcription: {
      label: 'COMMS',
      color: 'text-blue-500',
      bgColorDark: 'bg-blue-500/10',
      bgColorLight: 'bg-blue-100',
      borderColor: 'border-blue-500/50',
      icon: MessageSquare
    },
    database: {
      label: 'DATABASE',
      color: 'text-green-500',
      bgColorDark: 'bg-green-500/10',
      bgColorLight: 'bg-green-100',
      borderColor: 'border-green-500/50',
      icon: Database
    },
    event: {
      label: 'EVENTS',
      color: 'text-purple-500',
      bgColorDark: 'bg-purple-500/10',
      bgColorLight: 'bg-purple-100',
      borderColor: 'border-purple-500/50',
      icon: CalendarCheck
    },
    device: {
      label: 'DEVICES',
      color: 'text-teal-500',
      bgColorDark: 'bg-teal-500/10',
      bgColorLight: 'bg-teal-100',
      borderColor: 'border-teal-500/50',
      icon: Radio
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
    return <LoadingSpinner isDarkMode={isDarkMode} />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchLogs} isDarkMode={isDarkMode} />;
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
      return isDarkMode ? 'text-red-400' : 'text-red-600';
    }
    if (ty === 'warning') {
      return isDarkMode ? 'text-purple-300' : 'text-purple-600';
    }

    // default styling
    return isDarkMode ? 'text-gray-200' : 'text-gray-800';
  };

  const mainCard = settingsMainCardClass(isDarkMode);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="Logs"
        description="View and filter system and device activity by log type."
        icon={<span className="material-symbols-outlined text-2xl">history_edu</span>}
        trailing={
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
            <span className={`font-mono text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              LIVE
            </span>
          </div>
        }
      />
      <div className={`rounded-xl border p-6 md:p-8 ${mainCard}`}>
        <SettingsSubnav isDarkMode={isDarkMode} embedded aria-label="Log type tabs">
          {Object.entries(logTypes).map(([type, { label, color, icon: Icon }]) => (
            <SettingsSubnavTab
              key={type}
              isDarkMode={isDarkMode}
              active={selectedType === type}
              onClick={() => {
                setSelectedType(type);
                if (syncLogsTabToUrl) {
                  setSearchParams({ tab: 'Logs', logsTab: type });
                }
              }}
              className="flex items-center gap-2"
            >
              <Icon className={`h-4 w-4 ${color}`} />
              <span>{label}</span>
              {getTabCount(type) > 0 && (
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                    isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {getTabCount(type)}
                </span>
              )}
            </SettingsSubnavTab>
          ))}
        </SettingsSubnav>

        {/* Date Navigation + Search Row */}
        <div className={`mt-2 p-3 flex flex-wrap gap-3 items-center justify-between ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'} rounded-md`}>
          {/* Date controls (left aligned) */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousDay}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded transition-colors font-mono text-xs ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Previous Day"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>PREV</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <CalendarCheck className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {formatDateDisplay(currentDate)}
              </span>
              {currentDate !== getTodayDate() && (
                <button
                  onClick={goToToday}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors font-mono ${
                    isDarkMode 
                      ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/50' 
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300'
                  }`}
                  title="Go to Today"
                >
                  TODAY
                </button>
              )}
            </div>
            
            <button
              onClick={goToNextDay}
              disabled={currentDate >= getTodayDate()}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded transition-colors font-mono text-xs ${
                currentDate >= getTodayDate()
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Next Day"
            >
              <span>NEXT</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Search (right side, same row) */}
          <div className="flex items-center gap-2 flex-1 min-w-[220px] justify-end">
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
              className={`w-full max-w-xs px-3 py-1.5 text-xs rounded-md border outline-none ${
                isDarkMode
                  ? 'bg-gray-900 border-gray-700 text-gray-200 placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'
              }`}
            />
            <button
              onClick={handleSearch}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Search
            </button>
            {searchTerm && (
              <button
                onClick={clearSearch}
                className={`px-2 py-1 text-[11px] rounded-md font-medium border transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Logs Display */}
        {selectedType !== 'device' && (
          <div className={`h-[600px] overflow-y-auto border ${
            isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
          } rounded-md`}>
            {getFilteredStandardLogs().length > 0 ? (
              getFilteredStandardLogs().map((log, index) => (
                <LogEntry 
                  key={`${selectedType}-${index}`} 
                  log={{
                    ...log,
                    level: selectedType
                  }}
                  logTypes={logTypes}
                  isDarkMode={isDarkMode}
                />
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 font-mono">
                <div className="mx-auto h-12 w-12 text-gray-600 mb-4">NO_DATA</div>
                <p className="tracking-wider">NO_{logTypes[selectedType]?.label}_DETECTED</p>
              </div>
            )}
          </div>
        )}

        {/* Device (COM port) Logs */}
        {selectedType === 'device' && (
          <div className={`h-[600px] overflow-y-auto border ${
            isDarkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
          } rounded-md`}>
            {Object.keys(getFilteredDeviceLogs()).length === 0 && (
              <div className="p-8 text-center text-gray-500 font-mono">
                <div className="mx-auto h-12 w-12 text-gray-600 mb-4">NO_DATA</div>
                <p className="tracking-wider">NO_DEVICE_LOGS_DETECTED</p>
              </div>
            )}

            {Object.keys(getFilteredDeviceLogs()).length > 0 && (
              <div className="h-full flex flex-col">
                {/* Port Tabs (sticky inside scroll) */}
                <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-900/80' : 'border-gray-200 bg-gray-50'} sticky top-0 z-10 px-4 py-2`}>
                  <nav className="flex flex-wrap gap-3" aria-label="Device log tabs">
                    {Object.entries(getFilteredDeviceLogs()).map(([port, entries]) => (
                      <button
                        key={port}
                        onClick={() => setSelectedDevicePort(port)}
                        className={`
                          flex items-center gap-2 py-2 px-2 border-b-2 text-xs font-mono transition-colors
                          ${selectedDevicePort === port
                            ? isDarkMode
                              ? 'border-teal-500 text-teal-400'
                              : 'border-teal-600 text-teal-600'
                            : isDarkMode
                              ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        <Radio className="w-3 h-3 text-teal-500" />
                        <span>{port}</span>
                        <span className={`ml-1 text-[10px] rounded-full px-2 py-0.5 ${
                          isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {entries.length}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Active Port Log (no repeated title) */}
                {selectedDevicePort && getFilteredDeviceLogs()[selectedDevicePort] && (
                  <div className="flex-1 px-4 py-3 font-mono text-xs space-y-1">
                    {getFilteredDeviceLogs()[selectedDevicePort].map((entry, idx) => (
                      <div key={`${selectedDevicePort}-${idx}`} className="flex gap-2">
                        <span className="text-gray-500 whitespace-nowrap">
                          {entry.timestamp || '--'}
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