import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../utils/apiClient';
import { Link } from 'react-router-dom';

const SUMMARY_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

const BentoSwitch = ({ checked, onChange, isDarkMode }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!checked);
    }}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
      checked ? 'bg-primary' : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

/** Device row inspired by summary.html orchestration cards */
const DeviceBentoCard = ({
  title,
  categoryLabel,
  symbol,
  checked,
  onCheckedChange,
  isDarkMode,
  statusLineLeft,
  statusLineRight,
  statusLine2Left,
  statusLine2Right,
  footerNote,
  footerClass = '',
  compact = false,
}) => {
  const shell = isDarkMode ? 'bg-slate-800/90' : 'bg-surface-container-low';
  const inner = isDarkMode ? 'bg-slate-950/30' : 'bg-surface-container-lowest/40';
  const border = isDarkMode ? 'border-slate-700/60' : 'border-outline-variant/10';
  return (
    <div className={`overflow-hidden rounded-xl ${shell}`}>
      <div className={`flex items-center justify-between ${compact ? 'gap-3 px-4 py-3.5' : 'gap-4 px-5 py-5 sm:px-6 sm:py-5'} border-b ${border}`}>
        <div className={`flex min-w-0 items-center ${compact ? 'gap-2.5' : 'gap-3 sm:gap-4'}`}>
          <div className={`shrink-0 rounded-lg bg-secondary-container text-on-secondary-container ${compact ? 'p-2' : 'p-2.5 sm:p-3'}`}>
            <span className={`material-symbols-outlined ${compact ? 'text-xl' : 'text-[22px] sm:text-2xl'}`}>{symbol}</span>
          </div>
          <div className="min-w-0 space-y-0.5">
            <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold leading-tight ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
              {title}
            </h4>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-secondary'}`}>
              {categoryLabel}
            </p>
          </div>
        </div>
        <BentoSwitch checked={checked} onChange={onCheckedChange} isDarkMode={isDarkMode} />
      </div>
      <div className={`${compact ? 'space-y-3 px-4 py-3.5' : 'space-y-4 px-5 py-5 sm:px-6 sm:py-6'} ${inner}`}>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className={isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}>{statusLineLeft}</span>
          <span className="shrink-0 font-bold text-primary">{statusLineRight}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className={isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}>{statusLine2Left}</span>
          <span className={`shrink-0 font-bold ${isDarkMode ? 'text-slate-200' : 'text-on-surface'}`}>
            {statusLine2Right}
          </span>
        </div>
        {footerNote ? (
          <div className={`mt-1 border-t pt-3 text-[10px] font-medium leading-relaxed ${border}`}>
            <p className={footerClass || (isDarkMode ? 'text-slate-500' : 'text-slate-600')}>{footerNote}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const SummarySection = ({ isDarkMode, timezone = 'Etc/UTC', globalSettings, handleGlobalChange }) => {
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
    if (l === 'error')
      return isDarkMode
        ? 'bg-red-950/50 text-red-300'
        : 'bg-error-container text-on-error-container';
    if (l === 'warning')
      return isDarkMode
        ? 'bg-amber-950/40 text-amber-300'
        : 'bg-amber-100 text-amber-900';
    if (l === 'transcription' || l === 'database')
      return isDarkMode
        ? 'bg-secondary-container/40 text-on-secondary-container'
        : 'bg-secondary-container text-on-secondary-container';
    if (l === 'info' || l === 'user')
      return isDarkMode
        ? 'bg-primary-fixed/20 text-inverse-primary'
        : 'bg-primary-fixed text-on-primary-fixed';
    return isDarkMode
      ? 'bg-slate-700 text-slate-200'
      : 'bg-slate-200 text-slate-800';
  };

  const usersList = useMemo(() => getUsersWithLogins(), [detailData.users]);
  const visibleUsers = usersList.slice(0, 3);
  const usersOverflow = Math.max(0, usersList.length - 3);
  const isCompactView = true;
  const recentLogEvents = useMemo(() => getRecentLogEvents(), [detailData.logs, timezone, isDarkMode]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pb-6 sm:space-y-5 sm:px-6 sm:pb-8 md:space-y-6 lg:px-8 lg:pb-10">
      <header className="flex flex-col gap-1.5 pt-0 md:gap-2.5">
        <h1
          className={`font-headline text-2xl font-extrabold tracking-tight sm:text-3xl md:text-[2rem] md:leading-tight ${
            isDarkMode ? 'text-slate-100' : 'text-on-surface'
          }`}
        >
          Settings summary
        </h1>
        <p
          className={`max-w-2xl text-xs leading-relaxed sm:text-sm ${
            isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'
          }`}
        >
          Real-time activity across recordings, log health, and operators. Expand a metric below for detail, tune
          devices, or open full logs.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center py-16 sm:min-h-[280px] sm:py-20 md:py-24">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent sm:h-14 sm:w-14" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-12">
            <button
              type="button"
              onClick={() => toggleCard('recordings')}
              className={`col-span-1 flex min-h-0 flex-col justify-between gap-4 rounded-xl p-4 text-left transition-colors sm:p-4.5 md:col-span-4 md:p-5 lg:col-span-5 lg:p-5 ${
                isDarkMode
                  ? 'bg-slate-800/80 hover:bg-slate-800'
                  : 'bg-surface-container-low hover:bg-surface-container-high'
              } ${expandedCard === 'recordings' ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-4">
                  <span className="material-symbols-outlined text-2xl text-primary md:text-3xl">analytics</span>
                  <span className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-primary">
                    Snapshot (10 min)
                  </span>
                </div>
                <h3 className={`font-headline text-base font-bold leading-snug sm:text-lg ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                  Total recordings
                </h3>
              </div>
              <div className="flex items-end justify-between gap-4 pt-1">
                <div className="min-w-0 space-y-1">
                  <p className="font-headline text-3xl font-extrabold tabular-nums text-primary sm:text-4xl md:text-[2.5rem] md:leading-none">
                    {stats.totalRecordings.toLocaleString()}
                  </p>
                  <p className={`text-xs font-medium leading-snug ${isDarkMode ? 'text-slate-400' : 'text-secondary'}`}>
                    Cached aggregate total
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-headline text-xl font-bold tabular-nums sm:text-2xl ${isDarkMode ? 'text-slate-200' : 'text-on-secondary-fixed-variant'}`}>
                    +{stats.todayRecordings.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-outline">Today&apos;s delta</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => toggleCard('errors')}
              className={`col-span-1 flex flex-col rounded-xl border-l-4 border-tertiary p-4 text-left transition-colors sm:p-4.5 md:col-span-4 md:p-5 lg:col-span-4 lg:p-5 ${
                isDarkMode ? 'bg-slate-800/80 hover:bg-slate-800' : 'bg-surface-container-low hover:bg-surface-container-high'
              } ${expandedCard === 'errors' ? 'ring-2 ring-tertiary/50 ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`}
            >
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <div className="relative">
                  <span className="material-symbols-outlined text-3xl text-tertiary">
                    report_problem
                  </span>
                  <div className="summary-pulse-dot absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-tertiary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-tertiary">
                  System alerts
                </span>
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className={`font-headline text-2xl font-bold tabular-nums sm:text-3xl ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                      {String(stats.warnings).padStart(2, '0')}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Active warnings
                    </p>
                  </div>
                  <div className="flex h-10 min-w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-secondary-container px-2 text-[10px] font-bold uppercase text-on-secondary-container">
                    Monitoring
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between gap-4 ${stats.errors === 0 ? 'opacity-50' : ''}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className={`font-headline text-2xl font-bold tabular-nums sm:text-3xl ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                      {String(stats.errors).padStart(2, '0')}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Critical errors
                    </p>
                  </div>
                  <div
                    className={`flex h-10 min-w-[5.5rem] shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold uppercase ${
                      isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-surface-container-highest text-outline'
                    }`}
                  >
                    {stats.errors === 0 ? 'Stable' : 'Review'}
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => toggleCard('users')}
              className={`col-span-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-sm transition-colors sm:p-4.5 md:col-span-4 md:p-5 lg:col-span-3 lg:p-5 dark:border-slate-700 dark:bg-slate-900/50 dark:shadow-none ${
                isDarkMode ? 'hover:bg-slate-900' : 'hover:bg-surface-container-low'
              } ${expandedCard === 'users' ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`}
            >
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-secondary sm:mb-4">
                Active operators
              </h3>
              <div className="mb-3 flex -space-x-3 sm:mb-4">
                {visibleUsers.map((u, i) => (
                  <div
                    key={u.email || i}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary ring-4 ring-surface-container-lowest dark:ring-slate-900/50"
                    title={u.name || u.email}
                  >
                    {(u.name || u.email || '?')
                      .trim()
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                ))}
                {usersOverflow > 0 && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed-dim text-[10px] font-bold text-on-primary-fixed ring-4 ring-surface-container-lowest dark:bg-primary-fixed-dim/40 dark:text-inverse-primary dark:ring-slate-900/50">
                    +{usersOverflow}
                  </div>
                )}
                {usersList.length === 0 && (
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-medium ring-4 ring-surface-container-lowest dark:ring-slate-900/50 ${
                      isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    —
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className={`font-headline text-xl font-bold tabular-nums sm:text-2xl ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                  {stats.totalUsers.toLocaleString()} total
                </p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {stats.userLogins.toLocaleString()} logins today
                </p>
              </div>
            </button>
          </section>

          {expandedCard && (
            <div
              className={`rounded-xl border p-4 sm:p-5 md:p-6 ${
                isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-outline-variant/30 bg-white shadow-sm'
              }`}
            >
              {expandedCard === 'recordings' && (
                <RecordingsDetail
                  recordingsByDay={groupRecordingsByDay()}
                  isDarkMode={isDarkMode}
                  timezone={timezone}
                  formatDuration={formatDuration}
                />
              )}
              {expandedCard === 'errors' && (
                <ErrorsWarningsDetail
                  errorsAndWarnings={getErrorsAndWarnings()}
                  isDarkMode={isDarkMode}
                  timezone={timezone}
                />
              )}
              {expandedCard === 'users' && (
                <UsersDetail users={getUsersWithLogins()} isDarkMode={isDarkMode} timezone={timezone} />
              )}
            </div>
          )}

          {globalSettings && handleGlobalChange && (
            <section className="space-y-4 pt-1 md:space-y-5 md:pt-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                <div className="max-w-xl space-y-2">
                  <h2 className={`font-headline text-xl font-bold tracking-tight sm:text-2xl ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                    Device management
                  </h2>
                  <p className={`text-xs leading-relaxed sm:text-sm ${isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}>
                    Global hardware discovery and recording node toggles.
                  </p>
                </div>
                <Link
                  to="/settings?tab=recorders"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary transition-all hover:bg-on-primary-fixed-variant sm:self-end"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                  Open recorders
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-4">
                <DeviceBentoCard
                  title="Uniden scanners"
                  categoryLabel="RF monitoring"
                  symbol="radio"
                  checked={globalSettings.global_enable_uniden_scanners}
                  onCheckedChange={(checked) => handleGlobalChange('global_enable_uniden_scanners', checked)}
                  isDarkMode={isDarkMode}
                  statusLineLeft="Discovery"
                  statusLineRight={
                    globalSettings.global_enable_uniden_scanners ? 'On' : 'Off'
                  }
                  statusLine2Left="Role"
                  statusLine2Right="Scanner bridge"
                  footerNote={
                    globalSettings.global_enable_uniden_scanners
                      ? 'Application will look for Uniden BC125AT devices on startup.'
                      : 'Uniden discovery is disabled.'
                  }
                  compact={isCompactView}
                />
                <DeviceBentoCard
                  title="USB recorders"
                  categoryLabel="Local capture"
                  symbol="usb"
                  checked={globalSettings.global_enable_usb_audio_devices}
                  onCheckedChange={(checked) => handleGlobalChange('global_enable_usb_audio_devices', checked)}
                  isDarkMode={isDarkMode}
                  statusLineLeft="USB audio path"
                  statusLineRight={
                    globalSettings.global_enable_usb_audio_devices ? 'Active' : 'Idle'
                  }
                  statusLine2Left="Interfaces"
                  statusLine2Right="OS default"
                  footerNote={
                    globalSettings.global_enable_usb_audio_devices
                      ? 'USB audio devices can be used as recorders.'
                      : 'Enable to scan for USB audio interfaces at startup.'
                  }
                  compact={isCompactView}
                />
                <DeviceBentoCard
                  title="Boondock Edge"
                  categoryLabel="Edge recorders"
                  symbol="settings_input_antenna"
                  checked={globalSettings.global_enable_edge_devices}
                  onCheckedChange={(checked) => handleGlobalChange('global_enable_edge_devices', checked)}
                  isDarkMode={isDarkMode}
                  statusLineLeft="Edge discovery"
                  statusLineRight={
                    globalSettings.global_enable_edge_devices ? 'On' : 'Off'
                  }
                  statusLine2Left="Note"
                  statusLine2Right="Restart service"
                  footerNote="ESP32 / CP210x based Boondock Edge recorders. Changing this may require a restart."
                  footerClass={isDarkMode ? 'text-amber-300/90' : 'text-amber-800'}
                  compact={isCompactView}
                />
              </div>
            </section>
          )}

          <section className="space-y-3 pt-2 md:space-y-4 md:pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <h3
                className={`text-xs font-bold uppercase tracking-[0.2em] sm:text-[0.8rem] ${
                  isDarkMode ? 'text-slate-300' : 'text-on-surface'
                }`}
              >
                System events (latest)
              </h3>
              <Link
                to="/settings?tab=Logs"
                className="inline-flex border-b border-primary/40 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary transition-colors hover:border-primary sm:text-[11px]"
              >
                View all logs
              </Link>
            </div>
            <div
              className={`overflow-hidden rounded-xl ${
                isDarkMode ? 'bg-slate-800/80' : 'bg-surface-container-low'
              }`}
            >
              {recentLogEvents.length === 0 ? (
                <div
                  className={`px-6 py-12 text-center text-sm leading-relaxed sm:px-10 sm:py-14 md:py-16 ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-600'
                  }`}
                >
                  No recent log events in the current window.
                </div>
              ) : (
                <div className={`divide-y ${isDarkMode ? 'divide-slate-700/80' : 'divide-outline-variant/10'}`}>
                  {recentLogEvents.map((log, idx) => {
                    const msg = log.message || log.msg || '';
                    const lvl = log.level || 'info';
                    return (
                      <div
                        key={`${log.timestamp}-${idx}`}
                        className={`group flex cursor-default items-center justify-between gap-3 px-4 py-2.5 transition-colors sm:px-5 sm:py-3 md:px-6 md:py-3 ${
                          isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-surface-container-high'
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5 md:gap-6">
                          <span className="w-auto shrink-0 font-body text-[11px] font-bold tabular-nums text-outline sm:w-24 sm:text-xs">
                            {formatLogRowTime(log)}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                            <span
                              className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${logLevelBadge(
                                lvl,
                              )}`}
                            >
                              {lvl}
                            </span>
                            <p
                              className={`min-w-0 flex-1 text-sm font-medium leading-snug sm:truncate ${
                                isDarkMode ? 'text-slate-100' : 'text-on-surface'
                              }`}
                              title={msg}
                            >
                              {msg || '(no message)'}
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined hidden shrink-0 text-outline opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                          chevron_right
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

// Recordings Detail Component
const RecordingsDetail = ({ recordingsByDay, isDarkMode, timezone, formatDuration }) => {
  return (
    <div className="space-y-5 md:space-y-6">
      <h3 className={`text-lg font-semibold leading-snug md:text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Recordings by Day
      </h3>
      {recordingsByDay.length === 0 ? (
        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No recordings found</p>
      ) : (
        <div className="space-y-4 md:space-y-5">
          {recordingsByDay.map((day, idx) => (
            <div key={idx} className={`rounded-lg p-4 sm:p-5 md:p-6 ${isDarkMode ? 'bg-gray-700/50' : 'bg-white'}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span className={`material-symbols-outlined text-[18px] ${isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}>
                    calendar_today
                  </span>
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      timeZone: timezone
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-4 sm:shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined shrink-0 text-[18px] ${isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}>
                      audio_file
                    </span>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {day.count} recording{day.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`space-y-0.5 text-xs leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
                    <div key={recIdx} className="flex items-center gap-2 py-1.5">
                      <span className={`material-symbols-outlined text-[14px] ${isDarkMode ? 'text-slate-500' : 'text-outline'}`}>
                        schedule
                      </span>
                      <span>{timeStr}</span>
                      {rec.filename && (
                        <span className={`truncate max-w-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {rec.filename.split('/').pop()}
                        </span>
                      )}
                    </div>
                  );
                })}
                {day.count > 5 && (
                  <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    +{day.count - 5} more recording{day.count - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Errors and Warnings Detail Component
const ErrorsWarningsDetail = ({ errorsAndWarnings, isDarkMode, timezone }) => {
  const { errors, warnings } = errorsAndWarnings;
  
  return (
    <div className="space-y-5 md:space-y-6">
      <h3 className={`text-lg font-semibold leading-snug md:text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Errors and Warnings
      </h3>
      <div className="space-y-6 md:space-y-8">
        {errors.length > 0 && (
          <div className="space-y-3">
            <h4 className={`text-md flex items-center gap-2 font-medium ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
              <span className="material-symbols-outlined shrink-0 text-[18px]">warning</span>
              Errors ({errors.length})
            </h4>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {errors.map((error, idx) => (
                <div key={idx} className={`rounded-lg border p-3 sm:p-4 ${isDarkMode ? 'border-red-800 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>
                    {error.message || error.msg || 'Error'}
                  </div>
                  {error.timestamp && (
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      {new Date(error.timestamp).toLocaleString('en-US', { timeZone: timezone })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {warnings.length > 0 && (
          <div className="space-y-3">
            <h4 className={`text-md flex items-center gap-2 font-medium ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
              <span className="material-symbols-outlined shrink-0 text-[18px]">error_outline</span>
              Warnings ({warnings.length})
            </h4>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {warnings.map((warning, idx) => (
                <div key={idx} className={`rounded-lg border p-3 sm:p-4 ${isDarkMode ? 'border-yellow-800 bg-yellow-900/20' : 'border-yellow-200 bg-yellow-50'}`}>
                  <div className={`text-sm font-medium ${isDarkMode ? 'text-yellow-300' : 'text-yellow-800'}`}>
                    {warning.message || warning.msg || 'Warning'}
                  </div>
                  {warning.timestamp && (
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {new Date(warning.timestamp).toLocaleString('en-US', { timeZone: timezone })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {errors.length === 0 && warnings.length === 0 && (
          <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No errors or warnings found for today
          </p>
        )}
      </div>
    </div>
  );
};

// Users Detail Component
const UsersDetail = ({ users, isDarkMode, timezone }) => {
  return (
    <div className="space-y-5 md:space-y-6">
      <h3 className={`text-lg font-semibold leading-snug md:text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Users and Login History
      </h3>
      {users.length === 0 ? (
        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No users found</p>
      ) : (
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1 md:space-y-5">
          {users.map((user, idx) => (
            <div key={idx} className={`rounded-lg p-4 sm:p-5 ${isDarkMode ? 'bg-gray-700/50' : 'bg-white'}`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className={`font-medium leading-snug ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {user.name}
                  </div>
                  <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {user.email}
                  </div>
                </div>
                <div className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
                  user.role === 'admin' 
                    ? (isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-700')
                    : (isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700')
                }`}>
                  {user.role}
                </div>
              </div>
              {user.login_history && user.login_history.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600/60">
                  <div className={`mb-2 text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Recent Logins ({user.login_history.length})
                  </div>
                  <div className="max-h-32 space-y-2 overflow-y-auto pr-0.5">
                    {user.login_history.slice(0, 5).map((login, loginIdx) => {
                      let loginTime = '';
                      if (login.timestamp) {
                        try {
                          loginTime = new Date(login.timestamp).toLocaleString('en-US', { timeZone: timezone });
                        } catch (e) {
                          loginTime = login.timestamp;
                        }
                      }
                      return (
                        <div key={loginIdx} className={`text-xs flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span className="material-symbols-outlined text-[14px]">history</span>
                          <span>{loginTime}</span>
                        </div>
                      );
                    })}
                    {user.login_history.length > 5 && (
                      <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        +{user.login_history.length - 5} more login{user.login_history.length - 5 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  No login history
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SummarySection;

