import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { ArrowLeft, Package } from 'lucide-react';
import { useAuth } from '../AuthContext';
import Button from '../ui/Button';
import pageStyles from '../ui/Page.module.css';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import listStyles from '../ui/List.module.css';

const COMPONENTS = ['api', 'dashboard'];
const ACTIVE = new Set(['pending', 'queued', 'scheduled', 'running', 'restarting', 'in_progress']);
export const retryAfterMs = (headers, now = Date.now()) => {
  const value = headers?.get?.('Retry-After') ?? headers?.['retry-after'];
  if (value == null) return 3000;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - now) || 3000;
};
const pending = (value) => ACTIVE.has(value?.restart?.status) || ACTIVE.has(value?.operation?.status);
const releaseTag = (release) => typeof release === 'string' ? release : release.tag_name || release.tag || release.git_tag;

const VersionPage = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = (user?.user ?? user)?.role === 'admin';
  const [status, setStatus] = useState(null);
  const [releases, setReleases] = useState({ api: [], dashboard: [] });
  const [tags, setTags] = useState({ api: 'latest', dashboard: 'latest' });
  const [busy, setBusy] = useState(false);
  const [retryRestart, setRetryRestart] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const locked = useRef(false);
  const pollTimer = useRef(null);
  const cooldownTimer = useRef(null);
  const mounted = useRef(false);
  const monitor = useRef(null);
  const monitorStatus = useRef(null);
  const retryUntil = useRef(0);

  useEffect(() => {
    if (!admin) return undefined;
    mounted.current = true;
    let stopped = false;
    const cooling = (headers) => {
      setCooldown(true);
      clearTimeout(cooldownTimer.current);
      retryUntil.current = Math.max(retryUntil.current, Date.now() + retryAfterMs(headers));
      const delay = retryUntil.current - Date.now();
      cooldownTimer.current = setTimeout(() => {
        if (!stopped) setCooldown(false);
      }, delay);
      return delay;
    };
    const schedule = (fn, delay = 3000) => {
      clearTimeout(pollTimer.current);
      if (!stopped) pollTimer.current = setTimeout(fn, delay);
    };
    const loadStatus = async () => {
      if (retryUntil.current > Date.now()) {
        schedule(loadStatus, retryUntil.current - Date.now());
        return;
      }
      try {
        const { data } = await api.get('/version/status');
        if (stopped) return;
        setStatus(data);
        setError('');
        const watching = monitor.current;
        if (watching?.restart && data.restart?.status === 'failed') {
          setRetryRestart(true);
          monitor.current = null;
          setBusy(false);
          locked.current = false;
          setError('API restart failed. Retry the restart without reinstalling.');
          return;
        }
        if (watching?.restart && data.restart?.status === 'completed') {
          const installed = data.installed?.api;
          const expected = watching.expected;
          const matches = installed?.version && installed?.git_tag
            && (!expected || installed.git_tag === expected)
            && (!watching.version || installed.version === watching.version)
            && (!watching.commit || installed.git_commit === watching.commit);
          if (matches) {
            monitor.current = null;
            setRetryRestart(false);
            setBusy(false);
            locked.current = false;
            setMessage('API restart completed. Installed API: ' + (installed.display_name || installed.version) + ' (' + installed.version + ').');
            return;
          }
          setError('Restart completed, but installed API metadata is missing or differs from the selected release. Check status before continuing.');
        }
        if (pending(data) || watching?.restart) {
          locked.current = true;
          setBusy(true);
          schedule(loadStatus);
        } else {
          locked.current = false;
          setBusy(false);
          monitor.current = null;
          if (data.restart?.status === 'failed') setRetryRestart(true);
        }
      } catch (failure) {
        if (stopped) return;
        const code = failure.response?.status;
        if (code === 401 || code === 403) {
          setError('Administrator sign-in is required. A rollback may restore older credentials.');
          locked.current = false;
          setBusy(false);
          return;
        }
        if (code === 429) {
          schedule(loadStatus, cooling(failure.response.headers));
          return;
        }
        if (monitor.current || locked.current) {
          setMessage('Waiting for the API to reconnect and confirm its restart…');
          schedule(loadStatus);
        } else {
          setError(failure.response?.data?.error || failure.message || 'Could not load version status.');
        }
      }
    };
    monitor.current = null;
    locked.current = true;
    setBusy(true);
    loadStatus();
    const releaseTimers = [];
    COMPONENTS.forEach((component) => {
      const loadReleases = async () => {
        if (stopped) return;
        if (retryUntil.current > Date.now()) {
          releaseTimers.push(setTimeout(loadReleases, retryUntil.current - Date.now()));
          return;
        }
        try {
          const { data } = await api.get('/version/releases', { params: { component } });
          if (!stopped) setReleases((current) => ({ ...current, [component]: Array.isArray(data) ? data : data.releases || [] }));
        } catch (failure) {
          if (stopped) return;
          if (failure.response?.status === 429) {
            const timer = setTimeout(loadReleases, cooling(failure.response.headers));
            releaseTimers.push(timer);
          } else {
            setError(failure.response?.data?.error || 'Could not load ' + component + ' releases.');
          }
        }
      };
      loadReleases();
    });
    // POST handlers use the same status monitor and rate-limit deadline.
    monitorStatus.current = { loadStatus, schedule, cooling };
    return () => {
      stopped = true;
      mounted.current = false;
      clearTimeout(pollTimer.current);
      clearTimeout(cooldownTimer.current);
      releaseTimers.forEach(clearTimeout);
    };
  }, [admin]);
  const submit = async (path, body, component, tag) => {
    if (!admin || locked.current || cooldown || retryUntil.current > Date.now()) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setMessage(component === 'api' ? 'Updating API…' : 'Applying change…');
    try {
      const response = await api.post(path, body, { timeout: 0 });
      if (!mounted.current) return;
      if (response.status === 200 && path !== '/version/restart') {
        window.location.reload();
        return;
      }
      if (response.status === 202) {
        const build = response.data?.installed?.api || response.data?.build_info;
        const numbered = tag && !['latest', 'beta'].includes(tag) ? tag : null;
        monitor.current = {
          restart: true,
          expected: build?.git_tag || numbered,
          version: build?.version || (numbered ? numbered.replace(/^v/, '') : null),
          commit: build?.git_commit,
        };
        setRetryRestart(false);
        setMessage('API restart queued. Waiting for the API to reconnect…');
        monitorStatus.current.schedule(monitorStatus.current.loadStatus, 3000);
        return;
      }
      locked.current = false;
      setBusy(false);
      monitorStatus.current.loadStatus();
    } catch (failure) {
      if (!mounted.current) return;
      const response = failure.response;
      const data = response?.data;
      if (response?.status === 503 && data?.operation_succeeded === true && data?.restart_required === true) {
        setRetryRestart(true);
        setMessage('Installation or rollback succeeded. Restart scheduling failed; retry the restart without reinstalling.');
      } else if (response?.status === 409) {
        setMessage('Another operation or restart is pending. Waiting for it to finish…');
        monitor.current = { conflict: true };
        monitorStatus.current.schedule(monitorStatus.current.loadStatus, 3000);
        return;
      } else if (response?.status === 429) {
        monitorStatus.current.cooling(response.headers);
        setError('Too many requests. Wait before trying again.');
      } else if (!response) {
        monitor.current = { restart: component === 'api' };
        setMessage('Connection interrupted. Checking operation status before allowing another submission…');
        monitorStatus.current.schedule(monitorStatus.current.loadStatus, 3000);
        return;
      } else {
        setError(response.status === 401 || response.status === 403
          ? 'Administrator sign-in is required. A rollback may restore older credentials.'
          : data?.error || failure.message || 'Operation failed.');
      }
      locked.current = false;
      setBusy(false);
    }
  };

  if (!admin) return (
    <main className={pageStyles.centered}>
      <h1>Administrator access required</h1>
      <p>Sign in as an administrator to manage software versions and backups.</p>
      {!user && <Link to="/login">Go to login</Link>}
    </main>
  );
  const disabled = busy || cooldown || !status;
  const Container = embedded ? 'section' : 'main';
  return (
    <Container className={embedded ? undefined : pageStyles.page}>
      <div className={embedded ? 'stack' : `${pageStyles.container} stack`}>
        <header className={pageStyles.header}>
          {!embedded && <Button size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></Button>}
          <Package size={24} />
          <div>
            <h1 className={pageStyles.title}>Software versions</h1>
            <p className={pageStyles.subtitle}>Install API and dashboard releases independently.</p>
          </div>
        </header>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {cooldown && <p role="status">Waiting for the server’s Retry-After deadline…</p>}
        {COMPONENTS.map((component) => {
          const installed = status?.installed?.[component];
          const title = component === 'api' ? 'API' : 'Dashboard';
          const available = [...new Set(['latest', 'beta', ...releases[component].map(releaseTag).filter(Boolean)])];
          return (
            <section key={component} className={`${cardStyles.card} stack`} aria-label={title}>
              <h2 className={cardStyles.title}>{title}</h2>
              <p>{installed?.display_name || 'Installed version unavailable'}</p>
              <p>Version: {installed?.version || 'Unknown'}</p>
              {installed?.git_tag && <p>Tag: {installed.git_tag}</p>}
              <label className={formStyles.label} htmlFor={component + '-release'}>{title} release</label>
              <select id={component + '-release'} className={formStyles.select} disabled={disabled || retryRestart}
                value={tags[component]} onChange={(event) => setTags({ ...tags, [component]: event.target.value })}>
                {available.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <Button variant="primary" disabled={disabled || retryRestart}
                onClick={() => submit('/version/apply', { component, tag: tags[component] }, component, tags[component])}>
                Install {title}
              </Button>
            </section>
          );
        })}
        {(retryRestart || status?.restart?.status === 'failed') && (
          <section className={`${cardStyles.card} stack`}>
            <h2 className={cardStyles.title}>API restart needed</h2>
            <p>Retry the API restart. Installed files and migrations will not be applied again.</p>
            <Button disabled={disabled} onClick={() => submit('/version/restart', {}, 'api')}>Retry API restart</Button>
          </section>
        )}
        <section className={`${cardStyles.card} stack`}>
          <h2 className={cardStyles.title}>Backups and rollback</h2>
          <p>API changes restart automatically. A rollback may restore older credentials and require administrator sign-in again.</p>
          {!status?.backups?.length && <p>No backups available.</p>}
          <ul className={listStyles.list}>
            {(status?.backups || []).map((backup) => (
              <li key={backup.id || backup.backup_id} className={listStyles.item}>
                <div className={listStyles.content}>
                  <strong>{backup.label || backup.id || backup.backup_id}</strong>
                  <p>{backup.component} {backup.version} {backup.created_at}</p>
                </div>
                <Button variant="danger" disabled={disabled || retryRestart} onClick={() => {
                  if (window.confirm('Restore this backup? A rollback may restore older administrator credentials.')) {
                    submit('/version/rollback', { backup_id: backup.id || backup.backup_id }, backup.component);
                  }
                }}>Restore backup</Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Container>
  );
};
export default VersionPage;
