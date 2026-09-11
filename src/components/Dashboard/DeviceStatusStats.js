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
  List as ListIcon,
} from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import listStyles from '../ui/List.module.css';
import navStyles from '../ui/Navigation.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from './DeviceStatusStats.module.css';

const DeviceStatusStats = ({ mac, channelName, onClose }) => {
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
        apiFetch(`/v1/channel-visual-states/${encodeURIComponent(mac)}`).catch(() => null),
      ]);

      if (healthResponse && healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealthStats(healthData.stats && healthData.stats.length > 0 ? healthData.stats[0] : null);
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
      const r = await apiFetch(`/v1/devices/${encodeURIComponent(mac)}/events?limit=150`);
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

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusColor = (state) => {
    switch (state) {
      case 'recording':
      case 'online':
        return 'var(--ui-success)';
      case 'offline':
      case 'error':
        return 'var(--ui-danger)';
      case 'warning':
        return 'var(--ui-warning)';
      default:
        return 'var(--ui-muted)';
    }
  };

  const getStatusIcon = (state) => {
    const color = getStatusColor(state);
    const iconProps = { size: 16, color, 'aria-hidden': true };

    switch (state) {
      case 'recording':
        return <Radio {...iconProps} className={styles.pulse} />;
      case 'idle':
        return <CheckCircle {...iconProps} />;
      case 'online':
        return <Wifi {...iconProps} />;
      case 'offline':
      case 'error':
        return <XCircle {...iconProps} />;
      case 'warning':
        return <AlertCircle {...iconProps} />;
      default:
        return <Activity {...iconProps} />;
    }
  };

  const getStatusLabel = (state) => {
    switch (state) {
      case 'recording': return 'Recording';
      case 'idle': return 'Recording stopped / Idle';
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      default: return 'Unknown';
    }
  };

  if (loading && !healthStats && visualState == null) {
    return (
      <div className={`${cardStyles.card} centeredContent`}>
        <span className="spinner spinnerLarge" role="status" aria-label="Loading device status" />
      </div>
    );
  }

  const stats = healthStats || {};
  const currentState = visualState ?? 'unknown';

  const statItems = [
    { label: 'Connections', value: stats.connection_count || 0, icon: Wifi, color: 'var(--ui-accent)' },
    { label: 'Events', value: stats.event_count || 0, icon: Activity, color: 'var(--ui-success)' },
    { label: 'Uploads', value: stats.file_upload_count || 0, icon: Upload, color: 'var(--ui-accent)' },
    {
      label: 'Errors',
      value: stats.error_count || 0,
      icon: AlertCircle,
      color: stats.error_count > 0 ? 'var(--ui-danger)' : 'var(--ui-muted)',
    },
    {
      label: 'Disconnects',
      value: stats.connection_loss_count || 0,
      icon: TrendingDown,
      color: stats.connection_loss_count > 0 ? 'var(--ui-warning)' : 'var(--ui-muted)',
    },
    { label: 'Uptime', value: formatUptime(stats.uptime_seconds), icon: Clock, color: 'var(--ui-accent)', compact: true },
  ];

  return (
    <section className={cardStyles.card} aria-label="Device status">
      <header className={cardStyles.header}>
        <h3 className={cardStyles.title}>
          <Activity size={20} color="var(--ui-accent)" aria-hidden="true" />
          Device Status
        </h3>
        <div className="row">
          {lastUpdate && (
            <span className={listStyles.metaSmall} title="Last refreshed">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fetchDeviceStats(true)}
            aria-label="Refresh device status"
            title="Refresh"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </Button>
          {onClose && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close device status"
            >
              <XCircle size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      {channelName && (
        <div className={listStyles.content}>
          <div className={listStyles.title}>{channelName}</div>
          <div className={`${listStyles.metaSmall} ${listStyles.identifier}`}>{mac}</div>
        </div>
      )}

      <section className="stack">
        <h4 className={cardStyles.title}>Current Status</h4>
        <div className={listStyles.item}>
          <div className="row">
            {getStatusIcon(currentState)}
            <span style={{ color: getStatusColor(currentState), fontWeight: 600 }}>
              {getStatusLabel(currentState)}
            </span>
          </div>
        </div>
      </section>

      <div className="gridTwo">
        {statItems.map(({ label, value, icon: Icon, color, compact }) => (
          <div key={label} className={`${cardStyles.card} ${cardStyles.compact} ${cardStyles.surface}`}>
            <div className="row">
              <Icon size={16} color={color} aria-hidden="true" />
              <span className={cardStyles.description}>{label}</span>
            </div>
            <div className={cardStyles.title} style={{ color, fontSize: compact ? '0.875rem' : undefined }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {(stats.first_activity || stats.last_activity) && (
        <>
          <hr className="divider" />
          <section className="stack">
          <h4 className={cardStyles.title}>Activity</h4>
          <dl className={listStyles.list}>
            {stats.first_activity && (
              <div className={listStyles.item}>
                <dt className={listStyles.meta}>First Activity</dt>
                <dd className={listStyles.title}>{new Date(stats.first_activity).toLocaleString()}</dd>
              </div>
            )}
            {stats.last_activity && (
              <div className={listStyles.item}>
                <dt className={listStyles.meta}>Last Activity</dt>
                <dd className={listStyles.title}>{new Date(stats.last_activity).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          </section>
        </>
      )}

      <hr className="divider" />
      <section className="stack">
        <h4 className={cardStyles.title}>Device logs</h4>
        <div className={navStyles.subnav} role="tablist" aria-label="Device log source">
          <button
            type="button"
            className={`${navStyles.tab} ${logsTab === 'uploaded' ? navStyles.active : ''}`}
            onClick={() => setLogsTab('uploaded')}
            role="tab"
            aria-selected={logsTab === 'uploaded'}
          >
            <FileText size={16} aria-hidden="true" />
            Uploaded files
          </button>
          <button
            type="button"
            className={`${navStyles.tab} ${logsTab === 'events' ? navStyles.active : ''}`}
            onClick={() => setLogsTab('events')}
            role="tab"
            aria-selected={logsTab === 'events'}
          >
            <ListIcon size={16} aria-hidden="true" />
            Cloud events
          </button>
        </div>

        {logsTab === 'uploaded' && (
          <div role="tabpanel">
            <div className="rowBetween">
              <span className={listStyles.metaSmall}>Files from device log upload</span>
              <Button type="button" size="small" variant="ghost" onClick={fetchLogFiles}>Refresh</Button>
            </div>
            {logFilesLoading ? (
              <div className="centeredContent"><span className="spinner" role="status" aria-label="Loading log files" /></div>
            ) : logFiles.length === 0 ? (
              <p className={listStyles.meta}>No uploaded log files yet.</p>
            ) : (
              <div className="splitPane">
                <ul className={listStyles.list} aria-label="Uploaded log files">
                  {logFiles.map((f) => (
                    <li key={f.path}>
                      <button
                        type="button"
                        onClick={() => fetchLogContent(f.path)}
                        className={`${listStyles.item} ${listStyles.interactive} ${logContentPath === f.path ? listStyles.selected : ''}`}
                        title={f.path}
                      >
                        <span className={listStyles.identifier}>{f.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <pre className={styles.codeViewer}>
                  {logContentLoading ? (
                    <span className="spinner spinnerSmall" role="status" aria-label="Loading log content" />
                  ) : logContent ? (
                    <>
                      {logContentTruncated && (
                        <span style={{ color: 'var(--ui-warning)' }}>(last 512KB){'\n'}</span>
                      )}
                      {logContent}
                    </>
                  ) : (
                    <span style={{ color: 'var(--ui-muted)' }}>Select a file to view</span>
                  )}
                </pre>
              </div>
            )}
          </div>
        )}

        {logsTab === 'events' && (
          <div role="tabpanel">
            <div className="rowBetween">
              <span className={listStyles.metaSmall}>Recent POST /api/v1/events</span>
              <Button type="button" size="small" variant="ghost" onClick={fetchCloudEvents}>Refresh</Button>
            </div>
            {eventsLoading ? (
              <div className="centeredContent"><span className="spinner" role="status" aria-label="Loading cloud events" /></div>
            ) : cloudEvents.length === 0 ? (
              <p className={listStyles.meta}>No cloud events stored yet.</p>
            ) : (
              <ul className={listStyles.list}>
                {cloudEvents.map((ev) => (
                  <li key={ev.id} className={listStyles.item}>
                    <div className={listStyles.content}>
                      <div className="rowBetween">
                        <span className={listStyles.metaSmall}>{ev.created_at}</span>
                        <span style={{ color: getStatusColor(ev.event_type), fontWeight: 600 }}>
                          {ev.event_type}
                        </span>
                      </div>
                      {ev.payload && (
                        <pre className={`${styles.codeViewer} ${styles.compactCodeViewer}`}>
                          {typeof ev.payload === 'string'
                            ? ev.payload
                            : JSON.stringify(ev.payload, null, 0).slice(0, 500)}
                        </pre>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`} role="alert">
          <AlertCircle className={noticeStyles.icon} aria-hidden="true" />
          <div className={noticeStyles.body}>{error}</div>
        </div>
      )}
    </section>
  );
};

export default DeviceStatusStats;
