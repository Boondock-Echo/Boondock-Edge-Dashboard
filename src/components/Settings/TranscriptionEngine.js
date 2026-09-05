import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import { 
  Loader, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Database,
  AlertCircle,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Play,
  Square,
  Settings
} from 'lucide-react';
import GlobalSettings from './GlobalSettings';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from './SettingsSectionLayout';

const TranscriptionEngine = ({
  isDarkMode,
  globalSettings,
  handleGlobalChange,
}) => {
  const [queueStatus, setQueueStatus] = useState(null);
  const [queueLogs, setQueueLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 50, total: 0, total_pages: 1 });
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);
  const [queueActionLoading, setQueueActionLoading] = useState(false);
  const [showServiceSettings, setShowServiceSettings] = useState(false);

  const fetchQueueData = async () => {
    try {
      setError(null);
      
      // Build logs URL with filters
      const logsParams = new URLSearchParams();
      if (statusFilter) logsParams.append('status', statusFilter);
      if (dateFilter) logsParams.append('date_filter', dateFilter);
      logsParams.append('page', pagination.page);
      logsParams.append('limit', pagination.per_page);
      
      const [statusResponse, logsResponse] = await Promise.all([
        api.get(`/queue/status`).catch(err => {
          console.error('Error fetching queue status:', err);
          return { data: null };
        }),
        api.get(`/queue/logs?${logsParams.toString()}`).catch(err => {
          console.error('Error fetching queue logs:', err);
          return { data: { tasks: [], pagination: {} } };
        })
      ]);

      if (statusResponse.data) {
        setQueueStatus(statusResponse.data);
      }

      if (logsResponse.data) {
        setQueueLogs(logsResponse.data.tasks || []);
        if (logsResponse.data.pagination) {
          setPagination(logsResponse.data.pagination);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching queue data:', err);
      setError(err.message || 'Failed to load queue data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchQueueData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, statusFilter, dateFilter, pagination.page]);

  const handleStartStopQueue = async () => {
    const url = queueStatus?.is_running ? '/queue/stop' : '/queue/start';
    setQueueActionLoading(true);
    try {
      await api.post(url);
      await fetchQueueData();
    } catch (err) {
      console.error('Queue start/stop failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update queue');
    } finally {
      setQueueActionLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return isDarkMode ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'processing':
        return isDarkMode ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700';
      case 'completed':
        return isDarkMode ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700';
      case 'failed':
        return isDarkMode ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700';
      default:
        return isDarkMode ? 'bg-gray-800/50 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-700';
    }
  };

  const formatFilename = (filePath) => {
    if (!filePath) return 'N/A';
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handleKill = async (filename) => {
    try {
      if (!window.confirm(`Kill this task? It will be marked as failed and the queue will continue processing other tasks.`)) {
        return;
      }

      const response = await api.post(`/queue/kill/${filename}`);
      
      if (response.data.message) {
        // Refresh data after kill
        await fetchQueueData();
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Error killing task:', err);
      alert(err.response?.data?.error || 'Failed to kill task');
    }
  };

  const handleRequeue = async (filename) => {
    try {
      const response = await api.post(`/queue/requeue/${filename}`);
      
      if (response.data.message) {
        // Refresh data after requeue
        await fetchQueueData();
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Error requeueing task:', err);
      alert(err.response?.data?.error || 'Failed to requeue task');
    }
  };

  const handlePurge = async (statusFilter, dateFilter) => {
    try {
      setPurging(true);
      const purgeParams = new URLSearchParams();
      if (statusFilter) purgeParams.append('status', statusFilter);
      if (dateFilter) purgeParams.append('date_filter', dateFilter);

      const response = await api.post(`/queue/purge?${purgeParams.toString()}`);
      
      if (response.data.purged_count !== undefined) {
        alert(`Purged ${response.data.purged_count} tasks`);
        setShowPurgeModal(false);
        await fetchQueueData();
      }
    } catch (err) {
      console.error('Error purging logs:', err);
      alert(err.response?.data?.error || 'Failed to purge logs');
    } finally {
      setPurging(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading && !queueStatus) {
    return (
      <SettingsSectionWidth>
        <SettingsPageHero
          isDarkMode={isDarkMode}
          title="Transcriptions"
          description="Monitor and manage transcription queue status and processing tasks."
          icon={<span className="material-symbols-outlined text-2xl">graphic_eq</span>}
        />
        <div className={`rounded-xl border p-6 md:p-8 ${settingsMainCardClass(isDarkMode)}`}>
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 animate-spin text-primary" />
            <span className={`ml-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-on-surface-variant'}`}>
              Loading transcription queue status...
            </span>
          </div>
        </div>
      </SettingsSectionWidth>
    );
  }

  const displayStatus = queueStatus || {
    queue_size: 0,
    total_tasks: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    is_running: false
  };

  const mainCard = settingsMainCardClass(isDarkMode);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="Transcriptions"
        description="Monitor and manage transcription queue status and processing tasks."
        icon={<span className="material-symbols-outlined text-2xl">graphic_eq</span>}
      />
      <div className={`rounded-xl border p-6 md:p-8 ${mainCard}`}>
      <div className={`mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center ${isDarkMode ? 'border-slate-700/80' : 'border-outline-variant/30'}`}>
        <button
          type="button"
          onClick={() => setShowServiceSettings((visible) => !visible)}
          aria-expanded={showServiceSettings}
          aria-label="Transcription service settings"
          title="Transcription service settings"
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:mr-auto ${
            showServiceSettings
              ? 'bg-primary text-white'
              : isDarkMode
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Settings className="h-5 w-5" />
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleStartStopQueue}
            disabled={queueActionLoading || loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              queueStatus?.is_running
                ? isDarkMode
                  ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                  : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
                : isDarkMode
                  ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                  : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={queueStatus?.is_running ? 'Stop transcription queue' : 'Start transcription queue'}
          >
            {queueActionLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : queueStatus?.is_running ? (
              <Square className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {queueStatus?.is_running ? 'Stop queue' : 'Start queue'}
            </span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              autoRefresh
                ? isDarkMode
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600 active:bg-indigo-700'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400' : 'bg-gray-400'}`} />
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={fetchQueueData}
            disabled={loading}
            className={`p-2 rounded-lg transition-all ${
              isDarkMode
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Refresh now"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {showServiceSettings && (
        <div className={`mb-6 rounded-xl border p-5 ${
          isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-gray-200 bg-gray-50'
        }`} data-testid="transcription-service-settings">
          <GlobalSettings
            activeSection="transcription-services"
            globalSettings={globalSettings}
            handleGlobalChange={handleGlobalChange}
            isDarkMode={isDarkMode}
          />
        </div>
      )}

      {error && (
        <div className={`p-4 rounded-lg mb-6 border flex items-start gap-3 ${
          isDarkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            isDarkMode ? 'text-red-400' : 'text-red-600'
          }`} />
          <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode ? 'bg-gray-800/50 border-indigo-700/50' : 'bg-white border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Queue Size
              </p>
              <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {displayStatus.queue_size || 0}
              </p>
            </div>
            <Database className={`w-8 h-8 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode ? 'bg-gray-800/50 border-yellow-700/50' : 'bg-white border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Pending
              </p>
              <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                {displayStatus.pending || 0}
              </p>
            </div>
            <Clock className={`w-8 h-8 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode ? 'bg-gray-800/50 border-blue-700/50' : 'bg-white border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Processing
              </p>
              <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {displayStatus.processing || 0}
              </p>
            </div>
            <Loader className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode ? 'bg-gray-800/50 border-green-700/50' : 'bg-white border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Completed
              </p>
              <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                {displayStatus.completed || 0}
              </p>
            </div>
            <CheckCircle className={`w-8 h-8 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode ? 'bg-gray-800/50 border-red-700/50' : 'bg-white border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Failed
              </p>
              <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                {displayStatus.failed || 0}
              </p>
            </div>
            <XCircle className={`w-8 h-8 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border-2 ${
          isDarkMode 
            ? displayStatus.is_running
              ? 'bg-green-900/20 border-green-700/50'
              : 'bg-red-900/20 border-red-700/50'
            : displayStatus.is_running
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Status
              </p>
              <p className={`text-lg font-bold mt-1 ${
                isDarkMode
                  ? displayStatus.is_running ? 'text-green-300' : 'text-red-300'
                  : displayStatus.is_running ? 'text-green-700' : 'text-red-700'
              }`}>
                {displayStatus.is_running ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              displayStatus.is_running
                ? isDarkMode ? 'bg-green-400' : 'bg-green-500'
                : isDarkMode ? 'bg-red-400' : 'bg-red-500'
            } ${displayStatus.is_running ? 'animate-pulse' : ''}`} />
          </div>
        </div>
      </div>

      {/* Filters and Actions Bar */}
      <div className={`rounded-xl border p-4 mb-6 ${
        isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className={`text-sm font-medium whitespace-nowrap ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Status:
              </label>
              <select
                value={statusFilter || 'all'}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? null : e.target.value;
                  setStatusFilter(value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              <label className={`text-sm font-medium whitespace-nowrap ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Date Range:
              </label>
              <select
                value={dateFilter || 'all'}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? null : e.target.value;
                  setDateFilter(value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPurgeModal(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Purge Logs
            </button>
          </div>
        </div>
      </div>

      {/* Queue Logs Table */}
      <div className={`rounded-xl border overflow-hidden shadow-sm ${
        isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Queue Logs
              </h3>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {pagination.total > 0 
                  ? `Showing ${((pagination.page - 1) * pagination.per_page) + 1}-${Math.min(pagination.page * pagination.per_page, pagination.total)} of ${pagination.total} tasks`
                  : 'No tasks found'
                }
              </p>
            </div>
            {displayStatus.timestamp && (
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Last updated: {formatTimestamp(displayStatus.timestamp)}
              </span>
            )}
          </div>
        </div>
        
        {queueLogs.length === 0 ? (
          <div className={`p-12 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <Database className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
            <p className="text-sm font-medium">No tasks found</p>
            <p className="text-xs mt-1 opacity-75">
              {statusFilter || dateFilter 
                ? 'Try adjusting your filters' 
                : 'Tasks will appear here when they are queued'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Status
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Filename
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Channel
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Created
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700/50' : 'divide-gray-200'}`}>
                {queueLogs.map((task, index) => (
                  <tr 
                    key={index} 
                    className={`transition-colors ${
                      isDarkMode 
                        ? 'hover:bg-gray-800/30' 
                        : 'hover:bg-gray-50'
                    } ${expandedTask === index ? (isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50') : ''}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <span className={`font-medium capitalize text-sm ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <button
                        onClick={() => setExpandedTask(expandedTask === index ? null : index)}
                        className="max-w-xs truncate font-mono text-sm hover:underline text-left"
                        title={task.file_path}
                      >
                        {formatFilename(task.file_path)}
                      </button>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Channel {task.channel_id}</span>
                        {task.is_duplicate && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            Duplicate
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {formatTimestamp(task.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {task.status === 'processing' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKill(task.filename);
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                              isDarkMode
                                ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                                : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
                            }`}
                            title="Kill this task (force fail after 30s timeout)"
                          >
                            <X className="w-3.5 h-3.5" />
                            Kill
                          </button>
                        )}
                        {task.status === 'failed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Requeue task ${formatFilename(task.file_path)}?`)) {
                                handleRequeue(task.filename);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                              isDarkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                                : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                            }`}
                            title="Requeue this task"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Requeue
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.total_pages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    pagination.page <= 1
                      ? isDarkMode 
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                      : isDarkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500' 
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-300 text-gray-700'
                }`}>
                  {pagination.page} / {pagination.total_pages}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    pagination.page >= pagination.total_pages
                      ? isDarkMode 
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                      : isDarkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500' 
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Task Details */}
      {expandedTask !== null && queueLogs[expandedTask] && (
        <div className={`mt-6 rounded-xl border p-6 shadow-sm ${
          isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h4 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Task Details
            </h4>
            <button
              onClick={() => setExpandedTask(null)}
              className={`p-1.5 rounded-md transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-300' 
                  : 'hover:bg-gray-200 text-gray-600 hover:text-gray-700'
              }`}
              title="Close"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                File Path:
              </span>
              <p className={`mt-1 font-mono text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {queueLogs[expandedTask].file_path || 'N/A'}
              </p>
            </div>
            
            <div>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Status:
              </span>
              <p className={`mt-1 capitalize ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {queueLogs[expandedTask].status}
              </p>
            </div>
            
            {queueLogs[expandedTask].error && (
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Error:
                </span>
                <p className={`mt-1 p-3 rounded-lg ${isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'}`}>
                  {queueLogs[expandedTask].error}
                </p>
              </div>
            )}
            
            {queueLogs[expandedTask].transcription && (
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Transcription:
                </span>
                <p className={`mt-1 p-3 rounded-lg max-h-40 overflow-y-auto ${
                  isDarkMode ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-700'
                }`}>
                  {queueLogs[expandedTask].transcription}
                </p>
              </div>
            )}
            
            {/* Transcription Method Details */}
            {(queueLogs[expandedTask].transcription_method || queueLogs[expandedTask].transcription_model) && (
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Transcription Method:
                </span>
                <div className={`mt-1 p-3 rounded-lg ${
                  isDarkMode ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                }`}>
                  <p className="font-medium capitalize">
                    {queueLogs[expandedTask].transcription_method || 'N/A'}
                  </p>
                  {queueLogs[expandedTask].transcription_model && (
                    <p className="text-sm mt-1">
                      Model: <span className="font-mono">{queueLogs[expandedTask].transcription_model}</span>
                    </p>
                  )}
                  {queueLogs[expandedTask].transcription_api_endpoint && (
                    <p className="text-sm mt-1">
                      API: <span className="font-mono">{queueLogs[expandedTask].transcription_api_endpoint}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Channel ID:
                </span>
                <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {queueLogs[expandedTask].channel_id || 'N/A'}
                </p>
              </div>
              <div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Timestamp:
                </span>
                <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {queueLogs[expandedTask].timestamp || 'N/A'}
                </p>
              </div>
              {queueLogs[expandedTask].created_at && (
                <div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Created At:
                  </span>
                  <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatTimestamp(queueLogs[expandedTask].created_at)}
                  </p>
                </div>
              )}
              {queueLogs[expandedTask].completed_at && (
                <div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Completed At:
                  </span>
                  <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {formatTimestamp(queueLogs[expandedTask].completed_at)}
                  </p>
                </div>
              )}
              {queueLogs[expandedTask].is_duplicate && (
                <div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Duplicate:
                  </span>
                  <p className={`mt-1 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
                    Yes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purge Modal */}
      {showPurgeModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !purging && setShowPurgeModal(false)}
        >
          <div 
            className={`rounded-xl shadow-2xl max-w-md w-full ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Purge Queue Logs
              </h3>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Select which tasks to permanently remove from the queue logs. This action cannot be undone.
              </p>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => handlePurge('completed', dateFilter)}
                disabled={purging}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                    : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {purging ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Purging...
                  </>
                ) : (
                  'Purge Completed Tasks'
                )}
              </button>
              <button
                onClick={() => handlePurge('failed', dateFilter)}
                disabled={purging}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                    : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {purging ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Purging...
                  </>
                ) : (
                  'Purge Failed Tasks'
                )}
              </button>
              <button
                onClick={() => handlePurge(null, dateFilter)}
                disabled={purging}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800'
                    : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {purging ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Purging...
                  </>
                ) : (
                  'Purge All (Completed + Failed)'
                )}
              </button>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SettingsSectionWidth>
  );
};

export default TranscriptionEngine;
