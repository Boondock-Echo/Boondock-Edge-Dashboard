import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Wifi, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Upload, 
  Radio,
  XCircle,
  RefreshCw,
  TrendingDown,
  FileText,
  List,
} from 'lucide-react';

const DeviceStatusStats = ({ mac, channelName, isDarkMode, onClose }) => {
  const [healthStats, setHealthStats] = useState(null);
  const [visualState, setVisualState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [logsTab, setLogsTab] = useState('uploaded');
  const [logFiles, setLogFiles] = useState([]);
  const [logFilesLoading, setLogFilesLoading] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [logContentPath, setLogContentPath] = useState('');
  const [logContentTruncated, setLogContentTruncated] = useState(false);
  const [logContentLoading, setLogContentLoading] = useState(false);

  const [cloudEvents, setCloudEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);


  const fetchDeviceStats = async (showSpinner = false) => {
    if (!mac) return;
    
    try {
      if (showSpinner) setLoading(true);
      setError(null);
      
      const [healthResponse, visualResponse] = await Promise.all([
        apiFetch(`/health/devices/${encodeURIComponent(mac)}?current=true`).catch(() => null),
        apiFetch(`/v1/channel-visual-states/${encodeURIComponent(mac)}`).catch(() => null)
      ]);

      if (healthResponse && healthResponse.ok) {
        const healthData = await healthResponse.json();
        if (healthData.stats && healthData.stats.length > 0) {
          setHealthStats(healthData.stats[0]);
        } else {
          setHealthStats(null);
        }
      }

      if (visualResponse && visualResponse.ok) {
        const visualData = await visualResponse.json();
        setVisualState(visualData.state);
      }
      
      setLastUpdate(new Date());
    } catch (err) {
      console.error(`Error fetching device stats for ${mac}:`, err);
      setError('Failed to load device statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogFiles = useCallback(async () => {
    if (!mac) return;
    setLogFilesLoading(true);
    try {
      const r = await apiFetch(`/v1/devices/${encodeURIComponent(mac)}/logs/files`);
      const data = r.ok ? await r.json() : { files: [] };
      setLogFiles(data.files || []);
    } catch {
      setLogFiles([]);
    } finally {
      setLogFilesLoading(false);
    }
  }, [mac]);

  const fetchLogContent = async (path) => {
    if (!mac || !path) return;
    setLogContentLoading(true);
    setLogContent('');
    try {
      const r = await apiFetch(
        `/v1/devices/${encodeURIComponent(mac)}/logs/content?path=${encodeURIComponent(path)}`
      );
      const data = r.ok ? await r.json() : {};
      setLogContent(data.content || (r.ok ? '' : `Error: ${r.status}`));
      setLogContentPath(data.path || path);
      setLogContentTruncated(!!data.truncated);
    } catch (e) {
      setLogContent(String(e));
      setLogContentPath(path);
      setLogContentTruncated(false);
    } finally {
      setLogContentLoading(false);
    }
  };

  const fetchCloudEvents = useCallback(async () => {
    if (!mac) return;
    setEventsLoading(true);
    try {
      const r = await apiFetch(
        `/v1/devices/${encodeURIComponent(mac)}/events?limit=150`
      );
      const data = r.ok ? await r.json() : { events: [] };
      setCloudEvents(data.events || []);
    } catch {
      setCloudEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [mac]);

  useEffect(() => {
    fetchDeviceStats(true);
    const interval = setInterval(() => fetchDeviceStats(false), 5000);
    return () => clearInterval(interval);
  }, [mac]);

  useEffect(() => {
    if (logsTab === 'uploaded') {
      fetchLogFiles();
    } else {
      fetchCloudEvents();
    }
  }, [logsTab, fetchLogFiles, fetchCloudEvents]);

  const formatUptime = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = (state) => {
    switch (state) {
      case 'recording':
        return isDarkMode ? 'text-green-400' : 'text-green-600';
      case 'idle':
        return isDarkMode ? 'text-gray-400' : 'text-gray-600';
      case 'online':
        return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
      case 'offline':
        return isDarkMode ? 'text-red-400' : 'text-red-600';
      case 'error':
        return isDarkMode ? 'text-red-400' : 'text-red-600';
      case 'warning':
        return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return isDarkMode ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getStatusIcon = (state) => {
    switch (state) {
      case 'recording':
        return <Radio className="h-4 w-4 text-green-500 animate-pulse" />;
      case 'idle':
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
      case 'online':
        return <Wifi className="h-4 w-4 text-emerald-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = (state) => {
    switch (state) {
      case 'recording':
        return 'Recording';
      case 'idle':
        return 'Recording stopped / Idle';
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      default:
        return 'Unknown';
    }
  };

  const borderMuted = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  if (loading && !healthStats && visualState == null) {
    return (
      <div className={`p-4 rounded-lg border ${cardBg}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  const stats = healthStats || {};
  const currentState = visualState ?? 'unknown';

  return (
    <div className={`p-4 rounded-lg border max-h-[85vh] overflow-y-auto ${cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className={`h-5 w-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Device Status
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdate && (
            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchDeviceStats(true)}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {channelName && (
        <div className={`mb-4 pb-4 border-b ${borderMuted}`}>
          <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {channelName}
          </div>
          <div className={`text-xs font-mono ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            {mac}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className={`text-xs font-semibold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Current Status
        </div>
        <div className={`flex items-center space-x-2 p-2 rounded ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
          {getStatusIcon(currentState)}
          <span className={`font-medium ${getStatusColor(currentState)}`}>
            {getStatusLabel(currentState)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <Wifi className={`h-4 w-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Connections
            </span>
          </div>
          <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {stats.connection_count || 0}
          </div>
        </div>

        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <Activity className={`h-4 w-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Events
            </span>
          </div>
          <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {stats.event_count || 0}
          </div>
        </div>

        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <Upload className={`h-4 w-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Uploads
            </span>
          </div>
          <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {stats.file_upload_count || 0}
          </div>
        </div>

        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className={`h-4 w-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Errors
            </span>
          </div>
          <div className={`text-lg font-bold ${stats.error_count > 0 ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>
            {stats.error_count || 0}
          </div>
        </div>

        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <TrendingDown className={`h-4 w-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Disconnects
            </span>
          </div>
          <div className={`text-lg font-bold ${stats.connection_loss_count > 0 ? (isDarkMode ? 'text-orange-400' : 'text-orange-600') : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>
            {stats.connection_loss_count || 0}
          </div>
        </div>

        <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2 mb-1">
            <Clock className={`h-4 w-4 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Uptime
            </span>
          </div>
          <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {formatUptime(stats.uptime_seconds)}
          </div>
        </div>
      </div>

      {(stats.first_activity || stats.last_activity) && (
        <div className={`mt-4 pt-4 border-t ${borderMuted}`}>
          <div className={`text-xs font-semibold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Activity
          </div>
          <div className="space-y-1">
            {stats.first_activity && (
              <div className="flex justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>First Activity:</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {new Date(stats.first_activity).toLocaleString()}
                </span>
              </div>
            )}
            {stats.last_activity && (
              <div className="flex justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Last Activity:</span>
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                  {new Date(stats.last_activity).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`mt-4 pt-4 border-t ${borderMuted}`}>
        <div className={`text-xs font-semibold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Device logs
        </div>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setLogsTab('uploaded')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              logsTab === 'uploaded'
                ? isDarkMode
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-blue-100 text-blue-800'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Uploaded files
          </button>
          <button
            type="button"
            onClick={() => setLogsTab('events')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              logsTab === 'events'
                ? isDarkMode
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-blue-100 text-blue-800'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Cloud events
          </button>
        </div>

        {logsTab === 'uploaded' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Files from device log upload
              </span>
              <button
                type="button"
                onClick={fetchLogFiles}
                className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Refresh
              </button>
            </div>
            {logFilesLoading ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : logFiles.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No uploaded log files yet.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 max-h-56">
                <ul className={`text-xs overflow-y-auto min-w-[140px] max-h-56 rounded border ${borderMuted} p-1`}>
                  {logFiles.map((f) => (
                    <li key={f.path}>
                      <button
                        type="button"
                        onClick={() => fetchLogContent(f.path)}
                        className={`w-full text-left px-2 py-1 rounded truncate ${
                          logContentPath === f.path
                            ? isDarkMode
                              ? 'bg-gray-700 text-white'
                              : 'bg-gray-200 text-gray-900'
                            : isDarkMode
                              ? 'hover:bg-gray-700/50 text-gray-300'
                              : 'hover:bg-gray-100 text-gray-700'
                        }`}
                        title={f.path}
                      >
                        {f.path}
                      </button>
                    </li>
                  ))}
                </ul>
                <div
                  className={`flex-1 min-h-[120px] max-h-56 overflow-auto rounded border p-2 font-mono text-[11px] whitespace-pre-wrap ${
                    isDarkMode ? 'border-gray-600 bg-gray-900/50 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-800'
                  }`}
                >
                  {logContentLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                  ) : logContent ? (
                    <>
                      {logContentTruncated && (
                        <div className="text-amber-500 mb-1 text-[10px]">(last 512KB)</div>
                      )}
                      {logContent}
                    </>
                  ) : (
                    <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
                      Select a file to view
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {logsTab === 'events' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Recent POST /api/v1/events
              </span>
              <button
                type="button"
                onClick={fetchCloudEvents}
                className={`text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Refresh
              </button>
            </div>
            {eventsLoading ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              </div>
            ) : cloudEvents.length === 0 ? (
              <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                No cloud events stored yet.
              </p>
            ) : (
              <ul className={`max-h-64 overflow-y-auto text-xs space-y-1 rounded border ${borderMuted} p-2`}>
                {cloudEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className={`border-b pb-1 last:border-0 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}
                  >
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[10px] text-gray-500">{ev.created_at}</span>
                      <span
                        className={`font-semibold ${
                          ev.event_type === 'error' || ev.event_type === 'fatal_error'
                            ? 'text-red-500'
                            : ev.event_type === 'warning'
                              ? 'text-yellow-500'
                              : isDarkMode
                                ? 'text-blue-400'
                                : 'text-blue-600'
                        }`}
                      >
                        {ev.event_type}
                      </span>
                    </div>
                    {ev.payload && (
                      <pre className="mt-0.5 text-[10px] opacity-90 overflow-x-auto max-w-full">
                        {typeof ev.payload === 'string'
                          ? ev.payload
                          : JSON.stringify(ev.payload, null, 0).slice(0, 500)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className={`mt-4 p-2 rounded text-xs ${isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}
    </div>
  );
};

export default DeviceStatusStats;
