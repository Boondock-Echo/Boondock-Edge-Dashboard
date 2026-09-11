import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../utils/apiClient';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import listStyles from '../ui/List.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/SummarySection.module.css';

const SUMMARY_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

const BentoSwitch = ({ checked, onChange }) => (
  <label className={formStyles.switch} onClick={(e) => e.stopPropagation()}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
  </label>
);

/** Device row inspired by summary.html orchestration cards */
const DeviceBentoCard = ({
  title,
  categoryLabel,
  symbol,
  checked,
  onCheckedChange,
  statusLineLeft,
  statusLineRight,
  statusLine2Left,
  statusLine2Right,
  footerNote,
  footerClass = '',
  compact = false,
}) => {
  return (
    <div className={`${cardStyles.card} ${compact ? cardStyles.compact : ''}`}>
      <div className={cardStyles.header}>
        <div className="row grow">
          <div className="iconTile iconTileAccent"><span className="material-symbols-outlined iconMedium">{symbol}</span></div>
          <div className="grow">
            <h4 className={cardStyles.title}>{title}</h4>
            <p className="eyebrow">{categoryLabel}</p>
          </div>
        </div>
        <BentoSwitch checked={checked} onChange={onCheckedChange} />
      </div>
      <div className="stackCompact">
        <div className="rowBetween"><span className="tinyText mutedText">{statusLineLeft}</span><strong className="tinyText">{statusLineRight}</strong></div>
        <div className="rowBetween"><span className="tinyText mutedText">{statusLine2Left}</span><strong className="tinyText">{statusLine2Right}</strong></div>
        {footerNote ? <p className={`tinyText mutedText ${footerClass}`}>{footerNote}</p> : null}
      </div>
    </div>
  );
};

const SummarySection = ({ timezone = 'Etc/UTC', globalSettings, handleGlobalChange }) => {
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [stats, setStats] = useState({
    totalRecordings: 0,
    todayRecordings: 0,
    errors: 0,
    warnings: 0,
    userLogins: 0,
    totalUsers: 0
  });
  const [detailData, setDetailData] = useState({
    recordings: [],
    logs: [],
    users: {}
  });
  const [detailLoading, setDetailLoading] = useState({
    recordings: false,
    logs: false,
    users: false,
  });
  const [detailLoaded, setDetailLoaded] = useState({
    recordings: false,
    logs: false,
    users: false,
  });

  const flattenLogsPayload = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    return Object.values(payload).flatMap((v) => (Array.isArray(v) ? v : []));
  }, []);

  const fetchSummaryData = useCallback(async () => {
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];

      const [metricsRes, logsRes] = await Promise.all([
        api.get(`/settings/summary/metrics`, { params: { timezone } }),
        api.get(`/logs?date=${todayStr}&limit=20`),
      ]);

      const metrics = metricsRes?.data || {};
      setStats({
        totalRecordings: Number(metrics.total_recordings || 0),
        todayRecordings: Number(metrics.today_recordings || 0),
        errors: Number(metrics.errors || 0),
        warnings: Number(metrics.warnings || 0),
        userLogins: Number(metrics.user_logins || 0),
        totalUsers: Number(metrics.total_users || 0),
      });

      const recentLogs = flattenLogsPayload(logsRes?.data);
      setDetailData((prev) => ({ ...prev, logs: recentLogs }));
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setLoading(false);
    }
  }, [timezone, flattenLogsPayload]);

  const fetchRecordingsDetail = useCallback(async () => {
    setDetailLoading((prev) => ({ ...prev, recordings: true }));
    try {
      const response = await api.get(`/recordings/inbox`, {
        params: { limit: 1000 },
      });
      const payload = response?.data;
      const recordings = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.recordings) ? payload.recordings : []);
      setDetailData((prev) => ({ ...prev, recordings }));
      setDetailLoaded((prev) => ({ ...prev, recordings: true }));
    } catch (error) {
      console.error('Error fetching recordings detail:', error);
    } finally {
      setDetailLoading((prev) => ({ ...prev, recordings: false }));
    }
  }, []);

  const fetchLogsDetail = useCallback(async () => {
    setDetailLoading((prev) => ({ ...prev, logs: true }));
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [errorRes, warningRes, eventRes] = await Promise.all([
        api.get(`/logs/error?date=${todayStr}&limit=300`),
        api.get(`/logs/warning?date=${todayStr}&limit=300`),
        api.get(`/logs/event?date=${todayStr}&limit=200`),
      ]);
      const logs = [
        ...(Array.isArray(errorRes?.data) ? errorRes.data : []),
        ...(Array.isArray(warningRes?.data) ? warningRes.data : []),
        ...(Array.isArray(eventRes?.data) ? eventRes.data : []),
      ];
      setDetailData((prev) => ({ ...prev, logs }));
      setDetailLoaded((prev) => ({ ...prev, logs: true }));
    } catch (error) {
      console.error('Error fetching logs detail:', error);
    } finally {
      setDetailLoading((prev) => ({ ...prev, logs: false }));
    }
  }, []);

  const fetchUsersDetail = useCallback(async () => {
    setDetailLoading((prev) => ({ ...prev, users: true }));
    try {
      const response = await api.get(`/users`);
      const users = response?.data && typeof response.data === 'object' ? response.data : {};
      setDetailData((prev) => ({ ...prev, users }));
      setDetailLoaded((prev) => ({ ...prev, users: true }));
    } catch (error) {
      console.error('Error fetching users detail:', error);
    } finally {
      setDetailLoading((prev) => ({ ...prev, users: false }));
    }
  }, []);

  useEffect(() => {
    fetchSummaryData();
    const interval = setInterval(fetchSummaryData, SUMMARY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchSummaryData]);

  useEffect(() => {
    if (!expandedCard) return;
    if (expandedCard === 'recordings' && !detailLoaded.recordings && !detailLoading.recordings) {
      fetchRecordingsDetail();
      return;
    }
    if (expandedCard === 'errors' && !detailLoading.logs) {
      fetchLogsDetail();
      return;
    }
    if (expandedCard === 'users' && !detailLoaded.users && !detailLoading.users) {
      fetchUsersDetail();
    }
  }, [
    expandedCard,
    detailLoaded.recordings,
    detailLoaded.users,
    detailLoading.recordings,
    detailLoading.logs,
    detailLoading.users,
    fetchRecordingsDetail,
    fetchLogsDetail,
    fetchUsersDetail,
  ]);

  const toggleCard = (cardKey) => {
    setExpandedCard(expandedCard === cardKey ? null : cardKey);
  };

  // Group recordings by day
  const groupRecordingsByDay = () => {
    const grouped = {};
    detailData.recordings.forEach(recording => {
      if (!recording.timestamp) return;
      
      let recordingDateUTC;
      if (typeof recording.timestamp === 'string') {
        if (/^\d{8}_\d{6}$/.test(recording.timestamp)) {
          const datePart = recording.timestamp.substring(0, 8);
          const timePart = recording.timestamp.substring(9, 15);
          const year = parseInt(datePart.substring(0, 4));
          const month = parseInt(datePart.substring(4, 6)) - 1;
          const day = parseInt(datePart.substring(6, 8));
          const hour = parseInt(timePart.substring(0, 2));
          const minute = parseInt(timePart.substring(2, 4));
          const second = parseInt(timePart.substring(4, 6));
          recordingDateUTC = new Date(Date.UTC(year, month, day, hour, minute, second));
        } else {
          recordingDateUTC = new Date(recording.timestamp);
        }
      } else {
        recordingDateUTC = new Date(recording.timestamp);
      }
      
      if (isNaN(recordingDateUTC.getTime())) return;
      
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(recordingDateUTC);
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(recording);
    });
    
    // Sort by date (newest first)
    return Object.keys(grouped).sort().reverse().map(date => ({
      date,
      recordings: grouped[date],
      count: grouped[date].length
    }));
  };

  // Format duration helper
  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Get errors and warnings from logs
  const getErrorsAndWarnings = () => {
    const errors = [];
    const warnings = [];
    
    if (Array.isArray(detailData.logs)) {
      detailData.logs.forEach(log => {
        const level = log.level?.toLowerCase() || '';
        if (level === 'error') {
          errors.push(log);
        } else if (level === 'warning') {
          warnings.push(log);
        }
      });
    }
    
    return { errors, warnings };
  };

  // Get users with login history
  const getUsersWithLogins = () => {
    const users = [];
    if (typeof detailData.users === 'object' && !Array.isArray(detailData.users)) {
      Object.keys(detailData.users).forEach(email => {
        const userData = detailData.users[email];
        if (userData && typeof userData === 'object' && (userData.name || userData.role || userData.email)) {
          users.push({
            email,
            name: userData.name || email,
            role: userData.role || 'User',
            login_history: userData.login_history || []
          });
        }
      });
    }
    return users.sort((a, b) => (b.login_history?.length || 0) - (a.login_history?.length || 0));
  };

  const getRecentLogEvents = () => {
    const logs = Array.isArray(detailData.logs) ? [...detailData.logs] : [];
    return logs
      .filter((l) => l && (l.message || l.msg || l.timestamp))
      .sort((a, b) => {
        const ta = new Date(a.timestamp || 0).getTime();
        const tb = new Date(b.timestamp || 0).getTime();
        return tb - ta;
      })
      .slice(0, 8);
  };

  const formatLogRowTime = (log) => {
    if (!log?.timestamp) return '—';
    try {
      return new Date(log.timestamp).toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return String(log.timestamp).slice(11, 19) || '—';
    }
  };

  const logLevelBadge = (level) => {
    const l = (level || 'info').toLowerCase();
    if (l === 'error') return 'pillDanger';
    if (l === 'warning') return 'pillWarning';
    if (l === 'transcription' || l === 'database') return 'pillSuccess';
    if (l === 'info' || l === 'user') return 'pillAccent';
    return '';
  };

  const usersList = useMemo(() => getUsersWithLogins(), [detailData.users]);
  const visibleUsers = usersList.slice(0, 3);
  const usersOverflow = Math.max(0, usersList.length - 3);
  const isCompactView = true;
  const recentLogEvents = useMemo(() => getRecentLogEvents(), [detailData.logs, timezone]);

  return (
    <div className={`${styles.root} stack stackLarge`}>
      <header>
        <h1 className="pageTitle">Settings summary</h1>
        <p className="pageSubtitle">
          Real-time activity across recordings, log health, and operators. Expand a metric below for detail, tune
          devices, or open full logs.
        </p>
      </header>

      {loading ? (
        <div className="centeredContent"><span className="spinner spinnerLarge" aria-label="Loading settings summary" /></div>
      ) : (
        <>
          <section className={styles.metrics}>
            <button type="button" onClick={() => toggleCard('recordings')} className={`${styles.metric} ${styles.metricRecordings} ${expandedCard === 'recordings' ? styles.metricSelected : ''}`}>
              <div className="rowBetweenStart">
                <div><span className="material-symbols-outlined iconLarge">analytics</span><h3 className={cardStyles.title}>Total recordings</h3></div>
                <span className="pill pillAccent">Snapshot (10 min)</span>
              </div>
              <div className="rowBetween">
                <div><p className={styles.metricValue}>{stats.totalRecordings.toLocaleString()}</p><p className="tinyText mutedText">Cached aggregate total</p></div>
                <div><p className={styles.metricValueSmall}>+{stats.todayRecordings.toLocaleString()}</p><p className={styles.metricLabel}>Today&apos;s delta</p></div>
              </div>
            </button>

            <button type="button" onClick={() => toggleCard('errors')} className={`${styles.metric} ${styles.metricAlerts} ${expandedCard === 'errors' ? styles.metricSelected : ''}`}>
              <div className="row"><span className="material-symbols-outlined iconLarge">report_problem</span><span className={styles.metricLabel}>System alerts</span></div>
              <div className="stackCompact">
                <div className="rowBetween"><div><p className={styles.metricValueSmall}>{String(stats.warnings).padStart(2, '0')}</p><p className={styles.metricLabel}>Active warnings</p></div><span className="pill pillWarning">Monitoring</span></div>
                <div className="rowBetween"><div><p className={styles.metricValueSmall}>{String(stats.errors).padStart(2, '0')}</p><p className={styles.metricLabel}>Critical errors</p></div><span className={`pill ${stats.errors === 0 ? 'pillSuccess' : 'pillDanger'}`}>{stats.errors === 0 ? 'Stable' : 'Review'}</span></div>
              </div>
            </button>

            <button type="button" onClick={() => toggleCard('users')} className={`${styles.metric} ${styles.metricUsers} ${expandedCard === 'users' ? styles.metricSelected : ''}`}>
              <h3 className={styles.metricLabel}>Active operators</h3>
              <div className={styles.avatarStack}>
                {visibleUsers.map((u, i) => (
                  <div key={u.email || i} className={styles.avatar} title={u.name || u.email}>
                    {(u.name || u.email || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {usersOverflow > 0 && <div className={styles.avatar}>+{usersOverflow}</div>}
                {usersList.length === 0 && <div className={`${styles.avatar} ${styles.avatarMuted}`}>—</div>}
              </div>
              <div><p className={styles.metricValueSmall}>{stats.totalUsers.toLocaleString()} total</p><p className="tinyText mutedText">{stats.userLogins.toLocaleString()} logins today</p></div>
            </button>
          </section>

          {expandedCard && (
            <div className={`${cardStyles.card} ${styles.detailPanel}`}>
              {expandedCard === 'recordings' && <RecordingsDetail recordingsByDay={groupRecordingsByDay()} timezone={timezone} formatDuration={formatDuration} />}
              {expandedCard === 'errors' && <ErrorsWarningsDetail errorsAndWarnings={getErrorsAndWarnings()} timezone={timezone} />}
              {expandedCard === 'users' && <UsersDetail users={getUsersWithLogins()} timezone={timezone} />}
            </div>
          )}

          {globalSettings && handleGlobalChange && (
            <section className="stack">
              <div className="rowBetweenStart">
                <div className="grow"><h2 className="pageTitle">Device management</h2><p className="pageSubtitle">Global hardware discovery and recording node toggles.</p></div>
                <Link to="/settings?tab=recorders" className="pill pillAccent"><span className="material-symbols-outlined iconSmall">open_in_new</span>Open recorders</Link>
              </div>
              <div className="gridThree">
                <DeviceBentoCard title="Uniden scanners" categoryLabel="RF monitoring" symbol="radio" checked={globalSettings.global_enable_uniden_scanners} onCheckedChange={(checked) => handleGlobalChange('global_enable_uniden_scanners', checked)} statusLineLeft="Discovery" statusLineRight={globalSettings.global_enable_uniden_scanners ? 'On' : 'Off'} statusLine2Left="Role" statusLine2Right="Scanner bridge" footerNote={globalSettings.global_enable_uniden_scanners ? 'Application will look for Uniden BC125AT devices on startup.' : 'Uniden discovery is disabled.'} compact={isCompactView} />
                <DeviceBentoCard title="USB recorders" categoryLabel="Local capture" symbol="usb" checked={globalSettings.global_enable_usb_audio_devices} onCheckedChange={(checked) => handleGlobalChange('global_enable_usb_audio_devices', checked)} statusLineLeft="USB audio path" statusLineRight={globalSettings.global_enable_usb_audio_devices ? 'Active' : 'Idle'} statusLine2Left="Interfaces" statusLine2Right="OS default" footerNote={globalSettings.global_enable_usb_audio_devices ? 'USB audio devices can be used as recorders.' : 'Enable to scan for USB audio interfaces at startup.'} compact={isCompactView} />
                <DeviceBentoCard title="Boondock Edge" categoryLabel="Edge recorders" symbol="settings_input_antenna" checked={globalSettings.global_enable_edge_devices} onCheckedChange={(checked) => handleGlobalChange('global_enable_edge_devices', checked)} statusLineLeft="Edge discovery" statusLineRight={globalSettings.global_enable_edge_devices ? 'On' : 'Off'} statusLine2Left="Note" statusLine2Right="Restart service" footerNote="ESP32 / CP210x based Boondock Edge recorders. Changing this may require a restart." footerClass="pillWarning" compact={isCompactView} />
              </div>
            </section>
          )}

          <section className="stackCompact">
            <div className="rowBetween"><h3 className="eyebrow">System events (latest)</h3><Link to="/settings?tab=Logs">View all logs</Link></div>
            {recentLogEvents.length === 0 ? (
              <div className={`${cardStyles.card} centeredContent`}><p className="mutedText">No recent log events in the current window.</p></div>
            ) : (
              <div className={listStyles.list}>
                {recentLogEvents.map((log, idx) => {
                  const msg = log.message || log.msg || '';
                  const lvl = log.level || 'info';
                  return (
                    <div key={`${log.timestamp}-${idx}`} className={listStyles.item}>
                      <span className={styles.eventTime}>{formatLogRowTime(log)}</span>
                      <span className={`pill ${logLevelBadge(lvl)}`}>{lvl}</span>
                      <p className={styles.eventMessage} title={msg}>{msg || '(no message)'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

// Recordings Detail Component
const RecordingsDetail = ({ recordingsByDay, timezone, formatDuration }) => {
  return (
    <div className="stack">
      <h3 className={cardStyles.title}>Recordings by Day</h3>
      {recordingsByDay.length === 0 ? (
        <p className="smallText mutedText">No recordings found</p>
      ) : (
        <div className="stack">
          {recordingsByDay.map((day, idx) => (
            <div key={idx} className={styles.recordingDay}>
              <div className="rowBetweenStart">
                <div className="row grow">
                  <span className="material-symbols-outlined iconSmall mutedText">calendar_today</span>
                  <strong className="smallText">
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: timezone
                    })}
                  </strong>
                </div>
                <span className="pill"><span className="material-symbols-outlined iconSmall">audio_file</span>{day.count} recording{day.count !== 1 ? 's' : ''}</span>
              </div>
              <div className="stackCompact tinyText mutedText">
                {day.recordings.slice(0, 5).map((rec, recIdx) => {
                  let timeStr = '';
                  if (rec.timestamp) {
                    if (/^\d{8}_\d{6}$/.test(rec.timestamp)) {
                      const timePart = rec.timestamp.substring(9, 15);
                      const hour = timePart.substring(0, 2);
                      const minute = timePart.substring(2, 4);
                      const second = timePart.substring(4, 6);
                      timeStr = `${hour}:${minute}:${second}`;
                    } else {
                      try {
                        const date = new Date(rec.timestamp);
                        timeStr = date.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      } catch (e) {
                        timeStr = rec.timestamp;
                      }
                    }
                  }
                  return (
                    <div key={recIdx} className="row">
                      <span className="material-symbols-outlined iconSmall">schedule</span>
                      <span>{timeStr}</span>
                      {rec.filename && <span className="truncate">{rec.filename.split('/').pop()}</span>}
                    </div>
                  );
                })}
                {day.count > 5 && <p>+{day.count - 5} more recording{day.count - 5 !== 1 ? 's' : ''}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Errors and Warnings Detail Component
const ErrorsWarningsDetail = ({ errorsAndWarnings, timezone }) => {
  const { errors, warnings } = errorsAndWarnings;
  
  return (
    <div className="stack stackLarge">
      <h3 className={cardStyles.title}>Errors and Warnings</h3>
      {errors.length > 0 && (
        <div className="stackCompact">
          <h4 className="row"><span className="material-symbols-outlined iconSmall">warning</span>Errors ({errors.length})</h4>
          <div className="scrollPanel stackCompact">
            {errors.map((error, idx) => (
              <div key={idx} className={`${noticeStyles.notice} ${noticeStyles.error}`}>
                <div className={noticeStyles.body}>
                  <p><strong>{error.message || error.msg || 'Error'}</strong></p>
                  {error.timestamp && <p>{new Date(error.timestamp).toLocaleString('en-US', { timeZone: timezone })}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="stackCompact">
          <h4 className="row"><span className="material-symbols-outlined iconSmall">error_outline</span>Warnings ({warnings.length})</h4>
          <div className="scrollPanel stackCompact">
            {warnings.map((warning, idx) => (
              <div key={idx} className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
                <div className={noticeStyles.body}>
                  <p><strong>{warning.message || warning.msg || 'Warning'}</strong></p>
                  {warning.timestamp && <p>{new Date(warning.timestamp).toLocaleString('en-US', { timeZone: timezone })}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {errors.length === 0 && warnings.length === 0 && <p className="smallText mutedText">No errors or warnings found for today</p>}
    </div>
  );
};

// Users Detail Component
const UsersDetail = ({ users, timezone }) => {
  return (
    <div className="stack">
      <h3 className={cardStyles.title}>Users and Login History</h3>
      {users.length === 0 ? (
        <p className="smallText mutedText">No users found</p>
      ) : (
        <div className="scrollPanel stack">
          {users.map((user, idx) => (
            <div key={idx} className={`${cardStyles.card} ${cardStyles.compact}`}>
              <div className="rowBetweenStart">
                <div className="grow">
                  <strong>{user.name}</strong>
                  <p className="smallText mutedText">{user.email}</p>
                </div>
                <span className={`pill ${user.role === 'admin' ? 'pillDanger' : 'pillAccent'}`}>{user.role}</span>
              </div>
              {user.login_history && user.login_history.length > 0 ? (
                <div className="stackCompact">
                  <p className="eyebrow">Recent Logins ({user.login_history.length})</p>
                  <div className={`${styles.loginList} stackCompact`}>
                    {user.login_history.slice(0, 5).map((login, loginIdx) => {
                      let loginTime = '';
                      if (login.timestamp) {
                        try {
                          loginTime = new Date(login.timestamp).toLocaleString('en-US', { timeZone: timezone });
                        } catch (e) {
                          loginTime = login.timestamp;
                        }
                      }
                      return <div key={loginIdx} className="row tinyText mutedText"><span className="material-symbols-outlined iconSmall">history</span><span>{loginTime}</span></div>;
                    })}
                    {user.login_history.length > 5 && <div className="tinyText mutedText">+{user.login_history.length - 5} more login{user.login_history.length - 5 !== 1 ? 's' : ''}</div>}
                  </div>
                </div>
              ) : (
                <div className="tinyText mutedText">No login history</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SummarySection;
