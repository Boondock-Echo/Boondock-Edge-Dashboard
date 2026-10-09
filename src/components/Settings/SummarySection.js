import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Radio, Settings2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/SummarySection.module.css';
import { formatLocalDateTime, getBrowserTimeZone } from '../../utils/dateTime';

const SUMMARY_REFRESH_MS = 10 * 60 * 1000;

const ToggleCard = ({ icon: Icon, title, description, checked, disabled, onChange }) => (
  <div className={`${cardStyles.card} ${cardStyles.compact}`}>
    <div className="rowBetweenStart">
      <div className="row grow">
        <Icon className="iconMedium" />
        <div className="grow">
          <h4 className={cardStyles.title}>{title}</h4>
          <p className="smallText mutedText">{description}</p>
        </div>
      </div>
      <label className={formStyles.switch}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
      </label>
    </div>
  </div>
);

const SummarySection = () => {
  const [metrics, setMetrics] = useState({ total_recordings: 0, today_recordings: 0, errors: 0, warnings: 0, total_users: 0 });
  const [logs, setLogs] = useState([]);
  const [recorders, setRecorders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingRecorders, setSavingRecorders] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [metricsResponse, logsResponse, recorderResponse] = await Promise.all([
        api.get('/settings/summary/metrics', { params: { timezone: getBrowserTimeZone() } }),
        api.get('/logs', { params: { date: today, limit: 20 } }),
        api.get('/settings/recorders'),
      ]);
      setMetrics(metricsResponse.data || {});
      const logPayload = logsResponse.data;
      setLogs(Array.isArray(logPayload)
        ? logPayload
        : Object.values(logPayload || {}).flatMap((value) => (Array.isArray(value) ? value : [])));
      setRecorders(recorderResponse.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load settings summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, SUMMARY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const updateRecorderSetting = async (field, value) => {
    setRecorders((previous) => ({ ...previous, [field]: value }));
    setSavingRecorders(true);
    try {
      const { data } = await api.patch('/settings/recorders', { [field]: value });
      setRecorders(data);
      toast.success('Recorder setting saved');
    } catch (requestError) {
      await load();
      toast.error(requestError.response?.data?.error || 'Failed to save recorder setting');
    } finally {
      setSavingRecorders(false);
    }
  };

  const recentLogs = useMemo(() => [...logs]
    .filter((item) => item && (item.message || item.msg || item.timestamp))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 8), [logs]);

  if (loading) return <div className="centeredContent"><span className="spinner spinnerLarge" /></div>;

  return (
    <div className={`${styles.root} stack stackLarge`}>
      <header>
        <h1 className="pageTitle">Settings summary</h1>
        <p className="pageSubtitle">System health, recorder services, and recent activity.</p>
      </header>

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <section className={styles.metrics}>
        <div className={`${styles.metric} ${styles.metricRecordings}`}>
          <div className="rowBetweenStart"><div className="row"><Activity className="iconLarge" /><h3 className={cardStyles.title}>Recordings</h3></div><span className="pill pillAccent">10 min cache</span></div>
          <p className={styles.metricValue}>{Number(metrics.total_recordings || 0).toLocaleString()}</p>
          <p className="smallText mutedText">+{Number(metrics.today_recordings || 0).toLocaleString()} today</p>
        </div>
        <div className={`${styles.metric} ${styles.metricAlerts}`}>
          <h3 className={cardStyles.title}>System alerts</h3>
          <div className="rowBetween"><span>Warnings</span><strong>{Number(metrics.warnings || 0)}</strong></div>
          <div className="rowBetween"><span>Errors</span><strong>{Number(metrics.errors || 0)}</strong></div>
        </div>
        <div className={`${styles.metric} ${styles.metricUsers}`}>
          <div className="row"><Users className="iconLarge" /><h3 className={cardStyles.title}>Users</h3></div>
          <p className={styles.metricValueSmall}>{Number(metrics.total_users || 0).toLocaleString()}</p>
        </div>
      </section>

      {recorders ? (
        <section className="stack">
          <div className="rowBetweenStart">
            <div><h2 className="pageTitle">Recorder services</h2><p className="pageSubtitle">Global device discovery switches.</p></div>
            <Link to="/settings?tab=recorders" className="pill pillAccent"><Settings2 size={18} />Open recorders</Link>
          </div>
          <div className="gridTwo">
            <ToggleCard icon={Radio} title="Uniden scanners" description="Discover supported Uniden scanners." checked={Boolean(recorders.uniden_scanners_enabled)} disabled={savingRecorders} onChange={(value) => updateRecorderSetting('uniden_scanners_enabled', value)} />
            <ToggleCard icon={Activity} title="Edge recorders" description="Discover and manage Boondock Edge recorders." checked={Boolean(recorders.edge_recorders_enabled)} disabled={savingRecorders} onChange={(value) => updateRecorderSetting('edge_recorders_enabled', value)} />
          </div>
        </section>
      ) : null}

      <section className="stackCompact">
        <div className="rowBetween"><h3 className="eyebrow">Recent system events</h3><Link to="/settings?tab=Logs">View all logs</Link></div>
        {recentLogs.length === 0 ? <div className={`${cardStyles.card} centeredContent`}><p className="mutedText">No recent log events.</p></div> : (
          <div className="stackCompact">
            {recentLogs.map((log, index) => (
              <div key={`${log.timestamp || 'log'}-${index}`} className={`${cardStyles.card} ${cardStyles.compact} rowBetweenStart`}>
                <div className="grow"><p>{log.message || log.msg || '(no message)'}</p><p className="tinyText mutedText">{log.timestamp ? formatLocalDateTime(log.timestamp) : '—'}</p></div>
                <span className={`pill ${String(log.level || '').toLowerCase() === 'error' ? 'pillDanger' : String(log.level || '').toLowerCase() === 'warning' ? 'pillWarning' : 'pillAccent'}`}>{log.level || 'info'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SummarySection;
