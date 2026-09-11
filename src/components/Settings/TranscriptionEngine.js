import React, { useState, useEffect, useRef } from 'react';
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
} from './SettingsSectionLayout';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';
import styles from '../ui/TranscriptionEngine.module.css';

const TranscriptionEngine = ({
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
      case 'pending': return <Clock className="iconMedium" />;
      case 'processing': return <Loader className="iconMedium spin" />;
      case 'completed': return <CheckCircle className="iconMedium" />;
      case 'failed': return <XCircle className="iconMedium" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'pillWarning';
      case 'processing': return 'pillAccent';
      case 'completed': return 'pillSuccess';
      case 'failed': return 'pillDanger';
      default: return '';
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

  const displayStatus = queueStatus || {
    queue_size: 0,
    total_tasks: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    is_running: false
  };

  const purgeDialogRef = useRef(null);

  useEffect(() => {
    const dialog = purgeDialogRef.current;
    if (!dialog) return;
    if (showPurgeModal && !dialog.open) dialog.showModal();
    if (!showPurgeModal && dialog.open) dialog.close();
  }, [showPurgeModal]);

  if (loading && !queueStatus) {
    return (
      <SettingsSectionWidth>
        <SettingsPageHero
          title="Transcriptions"
          description="Monitor and manage transcription queue status and processing tasks."
          icon={<span className="material-symbols-outlined iconMedium">graphic_eq</span>}
        />
        <div className={`${cardStyles.card} centeredContent`}>
          <div className="row"><span className="spinner" /><span className="smallText mutedText">Loading transcription queue status...</span></div>
        </div>
      </SettingsSectionWidth>
    );
  }

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Transcriptions"
        description="Monitor and manage transcription queue status and processing tasks."
        icon={<span className="material-symbols-outlined iconMedium">graphic_eq</span>}
      />
      <div className={`${cardStyles.card} stack stackLarge`}>
        <div className={styles.toolbar}>
          <Button
            type="button"
            onClick={() => setShowServiceSettings((visible) => !visible)}
            aria-expanded={showServiceSettings}
            aria-label="Transcription service settings"
            title="Transcription service settings"
            size="icon"
            variant={showServiceSettings ? 'primary' : 'secondary'}
          >
            <Settings />
          </Button>
          <div className="rowWrap">
            <Button onClick={handleStartStopQueue} disabled={queueActionLoading || loading} variant={queueStatus?.is_running ? 'danger' : 'success'}>
              {queueActionLoading ? <Loader className="spin" /> : queueStatus?.is_running ? <Square /> : <Play />}
              <span>{queueStatus?.is_running ? 'Stop queue' : 'Start queue'}</span>
            </Button>
            <Button onClick={() => setAutoRefresh(!autoRefresh)} variant={autoRefresh ? 'accent' : 'secondary'}>
              <span className={`pill ${autoRefresh ? 'pillSuccess' : ''}`}>{autoRefresh ? 'ON' : 'OFF'}</span>
              Auto-refresh
            </Button>
            <Button onClick={fetchQueueData} disabled={loading} size="icon" title="Refresh now" aria-label="Refresh now">
              <RefreshCw className={loading ? 'spin' : ''} />
            </Button>
          </div>
        </div>

        {showServiceSettings && (
          <div className={`${cardStyles.card} ${cardStyles.compact}`} data-testid="transcription-service-settings">
            <GlobalSettings activeSection="transcription-services" globalSettings={globalSettings} handleGlobalChange={handleGlobalChange} />
          </div>
        )}

        {error && (
          <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
            <AlertCircle className={noticeStyles.icon} />
            <div className={noticeStyles.body}><p>{error}</p></div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className={styles.stats}>
          {[
            ['Queue Size', displayStatus.queue_size || 0, <Database key="i" />],
            ['Pending', displayStatus.pending || 0, <Clock key="i" />],
            ['Processing', displayStatus.processing || 0, <Loader key="i" className="spin" />],
            ['Completed', displayStatus.completed || 0, <CheckCircle key="i" />],
            ['Failed', displayStatus.failed || 0, <XCircle key="i" />],
          ].map(([label, value, icon]) => (
            <div key={label} className={styles.stat}>
              <div className="rowBetween"><div><p className={styles.statLabel}>{label}</p><p className={styles.statValue}>{value}</p></div><span className="mutedText">{icon}</span></div>
            </div>
          ))}
          <div className={styles.stat}>
            <div className="rowBetween">
              <div><p className={styles.statLabel}>Status</p><p className={styles.statValue}>{displayStatus.is_running ? 'Running' : 'Stopped'}</p></div>
              <span className={`${styles.statusDot} ${displayStatus.is_running ? styles.statusDotRunning : ''}`} />
            </div>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <div className={styles.filters}>
          <div className="rowBetweenStart">
            {/* Left: Filters */}
            <div className="rowWrap">
              {/* Status Filter */}
              <label className="row smallText">
                <span>Status:</span>
                <select value={statusFilter || 'all'} onChange={(e) => { const value = e.target.value === 'all' ? null : e.target.value; setStatusFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }} className={`${formStyles.select} ${formStyles.selectInline}`}>
                  <option value="all">All Status</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="failed">Failed</option>
                </select>
              </label>
              {/* Date Filter */}
              <label className="row smallText">
                <Calendar className="iconSmall mutedText" /><span>Date Range:</span>
                <select value={dateFilter || 'all'} onChange={(e) => { const value = e.target.value === 'all' ? null : e.target.value; setDateFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }} className={`${formStyles.select} ${formStyles.selectInline}`}>
                  <option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option>
                </select>
              </label>
            </div>
            {/* Right: Actions */}
            <Button onClick={() => setShowPurgeModal(true)} variant="danger"><Trash2 />Purge Logs</Button>
          </div>
        </div>

        {/* Queue Logs Table */}
        <div className={styles.logPanel}>
          <div className={styles.logHeader}>
            <div className="rowBetweenStart">
              <div><h3 className={cardStyles.title}>Queue Logs</h3><p className={cardStyles.description}>{pagination.total > 0 ? `Showing ${((pagination.page - 1) * pagination.per_page) + 1}-${Math.min(pagination.page * pagination.per_page, pagination.total)} of ${pagination.total} tasks` : 'No tasks found'}</p></div>
            </div>
          </div>

          {queueLogs.length === 0 ? (
            <div className={styles.empty}><Database className="iconLarge" /><p>No tasks found</p><p className="tinyText">{statusFilter || dateFilter ? 'Try adjusting your filters' : 'Tasks will appear here when they are queued'}</p></div>
          ) : (
            <div className={tableStyles.scroll}>
              <table className={tableStyles.table}>
                <thead><tr><th className={tableStyles.header}>Status</th><th className={tableStyles.header}>Filename</th><th className={tableStyles.header}>Channel</th><th className={tableStyles.header}>Created</th><th className={tableStyles.header}>Actions</th></tr></thead>
                <tbody>
                  {queueLogs.map((task, index) => (
                    <tr key={index} className={`${tableStyles.rowInteractive} ${expandedTask === index ? cardStyles.selected : ''}`}>
                      <td className={tableStyles.cell}><span className={`pill ${getStatusColor(task.status)}`}>{getStatusIcon(task.status)}{task.status}</span></td>
                      <td className={tableStyles.cell}><Button size="small" variant="ghost" onClick={() => setExpandedTask(expandedTask === index ? null : index)} title={task.file_path}><code className="truncate">{formatFilename(task.file_path)}</code></Button></td>
                      <td className={tableStyles.cell}><div className="rowWrap"><span>Channel {task.channel_id}</span>{task.is_duplicate && <span className="pill pillWarning">Duplicate</span>}</div></td>
                      <td className={tableStyles.cellMuted}>{formatTimestamp(task.created_at)}</td>
                      <td className={tableStyles.cell}><div className="rowWrap">
                        {task.status === 'processing' && <Button size="small" variant="danger" onClick={(e) => { e.stopPropagation(); handleKill(task.filename); }} title="Kill this task (force fail after 30s timeout)"><X />Kill</Button>}
                        {task.status === 'failed' && <Button size="small" variant="accent" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Requeue task ${formatFilename(task.file_path)}?`)) { handleRequeue(task.filename); } }} title="Requeue this task"><RotateCcw />Requeue</Button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className={styles.pagination}>
              <div className="smallText mutedText">Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages}</strong></div>
              <div className="row">
                <Button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} size="small"><ChevronLeft />Previous</Button>
                <span className="pill">{pagination.page} / {pagination.total_pages}</span>
                <Button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages} size="small">Next<ChevronRight /></Button>
              </div>
            </div>
          )}
        </div>

        {/* Expanded Task Details */}
        {expandedTask !== null && queueLogs[expandedTask] && (
          <div className={styles.details}>
            <div className="rowBetween"><h3 className={cardStyles.title}>Task Details</h3><Button size="icon" variant="ghost" onClick={() => setExpandedTask(null)} title="Close" aria-label="Close task details"><XCircle /></Button></div>
            <div className="stack">
              <div><span className="smallText mutedText">File Path:</span><p className={styles.detailValue}><code>{queueLogs[expandedTask].file_path || 'N/A'}</code></p></div>
              <div><span className="smallText mutedText">Status:</span><p className={styles.detailValue}>{queueLogs[expandedTask].status}</p></div>
              {queueLogs[expandedTask].error && <div><span className="smallText mutedText">Error:</span><div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{queueLogs[expandedTask].error}</p></div></div></div>}
              {queueLogs[expandedTask].transcription && <div><span className="smallText mutedText">Transcription:</span><p className={styles.detailBlock}>{queueLogs[expandedTask].transcription}</p></div>}
              {/* Transcription Method Details */}
              {(queueLogs[expandedTask].transcription_method || queueLogs[expandedTask].transcription_model) && (
                <div><span className="smallText mutedText">Transcription Method:</span><div className={styles.detailBlock}><p><strong>{queueLogs[expandedTask].transcription_method || 'N/A'}</strong></p>{queueLogs[expandedTask].transcription_model && <p className="smallText">Model: <code>{queueLogs[expandedTask].transcription_model}</code></p>}{queueLogs[expandedTask].transcription_api_endpoint && <p className="smallText">API: <code>{queueLogs[expandedTask].transcription_api_endpoint}</code></p>}</div></div>
              )}
              <div className="gridTwo">
                <div><span className="smallText mutedText">Channel ID:</span><p className={styles.detailValue}>{queueLogs[expandedTask].channel_id || 'N/A'}</p></div>
                <div><span className="smallText mutedText">Timestamp:</span><p className={styles.detailValue}>{queueLogs[expandedTask].timestamp || 'N/A'}</p></div>
                {queueLogs[expandedTask].created_at && <div><span className="smallText mutedText">Created At:</span><p className={styles.detailValue}>{formatTimestamp(queueLogs[expandedTask].created_at)}</p></div>}
                {queueLogs[expandedTask].completed_at && <div><span className="smallText mutedText">Completed At:</span><p className={styles.detailValue}>{formatTimestamp(queueLogs[expandedTask].completed_at)}</p></div>}
                {queueLogs[expandedTask].is_duplicate && <div><span className="smallText mutedText">Duplicate:</span><p className={styles.detailValue}>Yes</p></div>}
              </div>
            </div>
          </div>
        )}

        {/* Purge Modal */}
        {showPurgeModal && (
          <dialog ref={purgeDialogRef} className={modalStyles.dialog} onCancel={(e) => { e.preventDefault(); if (!purging) setShowPurgeModal(false); }} onClose={() => !purging && setShowPurgeModal(false)}>
            <div className={modalStyles.header}><div><h3 className={modalStyles.title}>Purge Queue Logs</h3><p className={modalStyles.subtitle}>Select which tasks to permanently remove from the queue logs. This action cannot be undone.</p></div></div>
            <div className={`${modalStyles.body} stackCompact`}>
              <Button onClick={() => handlePurge('completed', dateFilter)} disabled={purging} variant="success" className="fullWidth">{purging ? <><Loader className="spin" />Purging...</> : 'Purge Completed Tasks'}</Button>
              <Button onClick={() => handlePurge('failed', dateFilter)} disabled={purging} variant="danger" className="fullWidth">{purging ? <><Loader className="spin" />Purging...</> : 'Purge Failed Tasks'}</Button>
              <Button onClick={() => handlePurge(null, dateFilter)} disabled={purging} variant="warning" className="fullWidth">{purging ? <><Loader className="spin" />Purging...</> : 'Purge All (Completed + Failed)'}</Button>
              <Button onClick={() => setShowPurgeModal(false)} disabled={purging} className="fullWidth">Cancel</Button>
            </div>
          </dialog>
        )}
      </div>
    </SettingsSectionWidth>
  );

};

export default TranscriptionEngine;
