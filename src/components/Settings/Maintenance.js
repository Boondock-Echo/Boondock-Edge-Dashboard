import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, Play, RefreshCw, Save, Wrench, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';

const TASKS = [
  { id: 'data_backup', label: 'Data backup' },
  { id: 'logs_cleanup', label: 'Logs cleanup' },
  { id: 'health_checks', label: 'Health checks' },
];

const Maintenance = () => {
  const [settings, setSettings] = useState({ scheduled_time: '03:00', enabled_tasks: [] });
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    const { data } = await api.get('/settings/maintenance');
    setSettings({
      scheduled_time: data.scheduled_time || '03:00',
      enabled_tasks: Array.isArray(data.enabled_tasks) ? data.enabled_tasks : [],
    });
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await api.get('/maintenance/history', { params: { page, per_page: 20 } });
    setHistory(Array.isArray(data.history) ? data.history : Array.isArray(data.items) ? data.items : []);
    setTotalPages(Number(data.total_pages) || 1);
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadSettings(), loadHistory()])
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.error || 'Failed to load maintenance settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadHistory, loadSettings]);

  const toggleTask = (taskId) => {
    setSettings((previous) => ({
      ...previous,
      enabled_tasks: previous.enabled_tasks.includes(taskId)
        ? previous.enabled_tasks.filter((id) => id !== taskId)
        : [...previous.enabled_tasks, taskId],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/settings/maintenance', settings);
      setSettings(data);
      toast.success('Maintenance settings saved');
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Failed to save maintenance settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError('');
    try {
      await api.post('/maintenance/run', { tasks: settings.enabled_tasks });
      toast.success('Maintenance started');
      window.setTimeout(() => loadHistory().catch(() => {}), 1000);
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Failed to start maintenance';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="centeredContent"><span className="spinner" /></div>;

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Wrench}
        title="Maintenance"
        description="Schedule recurring maintenance or run selected tasks immediately."
        iconColor="blue"
      />

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <div className={`${cardStyles.card} stackLarge`}>
        <div>
          <label className={formStyles.label}>Scheduled time</label>
          <input type="time" className={formStyles.input} value={settings.scheduled_time} onChange={(event) => setSettings((previous) => ({ ...previous, scheduled_time: event.target.value }))} />
        </div>

        <div className="gridThree">
          {TASKS.map((task) => {
            const checked = settings.enabled_tasks.includes(task.id);
            return (
              <label key={task.id} className={`${formStyles.choiceCard} ${checked ? formStyles.choiceCardSelected : ''}`}>
                <span className="grow"><strong>{task.label}</strong></span>
                <span className={formStyles.switch}>
                  <input type="checkbox" checked={checked} onChange={() => toggleTask(task.id)} />
                  <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="rowWrap">
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
            Save schedule
          </Button>
          <Button variant="secondary" onClick={runNow} disabled={running || settings.enabled_tasks.length === 0}>
            {running ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
            Run selected tasks
          </Button>
        </div>
      </div>

      <div className={`${cardStyles.card} stack`}>
        <div className="row"><Calendar size={18} /><h3 className={cardStyles.title}>Maintenance history</h3></div>
        {history.length === 0 ? (
          <p className="mutedText">No maintenance history available.</p>
        ) : (
          <div className={tableStyles.scroll}>
            <table className={tableStyles.table}>
              <thead><tr><th className={tableStyles.header}>Task</th><th className={tableStyles.header}>Started</th><th className={tableStyles.header}>Duration</th><th className={tableStyles.header}>Status</th></tr></thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id || `${record.task_id}-${record.started_at}`} className={tableStyles.row}>
                    <td className={tableStyles.cell}>{record.description || record.task_id || 'Maintenance'}</td>
                    <td className={tableStyles.cell}>{record.started_at ? new Date(record.started_at).toLocaleString() : '—'}</td>
                    <td className={tableStyles.cell}>{Number.isFinite(Number(record.duration_seconds)) ? `${Number(record.duration_seconds).toFixed(1)}s` : '—'}</td>
                    <td className={tableStyles.cell}><span className="row">{record.status === 'success' || record.status === 'completed' ? <CheckCircle size={16} /> : record.status === 'failed' || record.status === 'error' ? <XCircle size={16} /> : <RefreshCw size={16} />} {record.status || 'unknown'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? (
          <div className="rowBetween">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span className="smallText mutedText">Page {page} of {totalPages}</span>
            <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Maintenance;
