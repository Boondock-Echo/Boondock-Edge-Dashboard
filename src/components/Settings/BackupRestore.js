import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Cloud, Database, Download, RefreshCw, Save, Server, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import BackupProgressModal from './BackupProgressModal';
import RestoreModal from './RestoreModal';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';
import tableStyles from '../ui/Table.module.css';

const EMPTY_SETTINGS = {
  s3_enabled: false,
  s3_endpoint_url: '',
  s3_access_key: '',
  s3_secret_key: '',
  s3_region: 'us-east-1',
  s3_bucket_name: '',
  samba_enabled: false,
  samba_share_path: '',
  samba_username: '',
  samba_password: '',
};

const BackupRestore = () => {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [configured, setConfigured] = useState({});
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSamba, setTestingSamba] = useState(false);
  const [error, setError] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await api.get('/settings/backup');
    setConfigured({
      s3_access_key: Boolean(data.s3_access_key_configured),
      s3_secret_key: Boolean(data.s3_secret_key_configured),
      samba_password: Boolean(data.samba_password_configured),
    });
    setSettings({
      ...EMPTY_SETTINGS,
      s3_enabled: Boolean(data.s3_enabled),
      s3_endpoint_url: data.s3_endpoint_url || '',
      s3_region: data.s3_region || 'us-east-1',
      s3_bucket_name: data.s3_bucket_name || '',
      samba_enabled: Boolean(data.samba_enabled),
      samba_share_path: data.samba_share_path || '',
      samba_username: data.samba_username || '',
    });
  }, []);

  const loadHistory = useCallback(async () => {
    const { data } = await api.get('/s3/backup/history', { params: { page, per_page: 10 } });
    setHistory(Array.isArray(data.history) ? data.history : []);
    setTotalPages(Number(data.total_pages) || 1);
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadSettings(), loadHistory()])
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.error || 'Failed to load backup settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadHistory, loadSettings]);

  const update = (field, value) => setSettings((previous) => ({ ...previous, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        s3_enabled: settings.s3_enabled,
        s3_endpoint_url: settings.s3_endpoint_url.trim(),
        s3_region: settings.s3_region.trim(),
        s3_bucket_name: settings.s3_bucket_name.trim(),
        samba_enabled: settings.samba_enabled,
        samba_share_path: settings.samba_share_path.trim(),
        samba_username: settings.samba_username.trim(),
      };
      if (settings.s3_access_key) payload.s3_access_key = settings.s3_access_key;
      if (settings.s3_secret_key) payload.s3_secret_key = settings.s3_secret_key;
      if (settings.samba_password) payload.samba_password = settings.samba_password;

      const { data } = await api.patch('/settings/backup', payload);
      setConfigured({
        s3_access_key: Boolean(data.s3_access_key_configured),
        s3_secret_key: Boolean(data.s3_secret_key_configured),
        samba_password: Boolean(data.samba_password_configured),
      });
      setSettings((previous) => ({
        ...previous,
        s3_enabled: Boolean(data.s3_enabled),
        s3_endpoint_url: data.s3_endpoint_url || '',
        s3_access_key: '',
        s3_secret_key: '',
        s3_region: data.s3_region || 'us-east-1',
        s3_bucket_name: data.s3_bucket_name || '',
        samba_enabled: Boolean(data.samba_enabled),
        samba_share_path: data.samba_share_path || '',
        samba_username: data.samba_username || '',
        samba_password: '',
      }));
      toast.success('Backup settings saved');
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Failed to save backup settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const testSamba = async () => {
    setTestingSamba(true);
    try {
      const payload = {
        share_path: settings.samba_share_path || undefined,
        username: settings.samba_username || undefined,
        password: settings.samba_password || undefined,
      };
      const { data } = await api.post('/s3/backup/test-samba', payload);
      toast[data.success ? 'success' : 'error'](data.message || (data.success ? 'Samba connection successful' : 'Samba connection failed'));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.response?.data?.error || 'Samba connection failed');
    } finally {
      setTestingSamba(false);
    }
  };

  if (loading) return <div className="centeredContent"><span className="spinner" /></div>;

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Database}
        title="Backup & restore"
        description="Configure backup destinations and manage backup history."
        iconColor="blue"
      />

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <div className="rowWrap">
        <Button variant="primary" onClick={() => setShowBackupModal(true)}><Cloud size={18} />Backup now</Button>
        <Button variant="secondary" onClick={() => setShowRestoreModal(true)}><Download size={18} />Restore</Button>
        <Button variant="ghost" onClick={loadHistory}><RefreshCw size={18} />Refresh history</Button>
      </div>

      <div className="gridTwo">
        <div className={`${cardStyles.card} stackLarge`}>
          <label className={`${formStyles.choiceCard} ${settings.s3_enabled ? formStyles.choiceCardSelected : ''}`}>
            <span className="grow"><strong>Cloud / S3 backup</strong><p className="smallText mutedText">Upload backups to an S3-compatible destination.</p></span>
            <span className={formStyles.switch}><input type="checkbox" checked={settings.s3_enabled} onChange={(event) => update('s3_enabled', event.target.checked)} /><span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span></span>
          </label>
          <label className={formStyles.label}>Endpoint URL</label>
          <input className={formStyles.input} value={settings.s3_endpoint_url} onChange={(event) => update('s3_endpoint_url', event.target.value)} />
          <label className={formStyles.label}>Region</label>
          <input className={formStyles.input} value={settings.s3_region} onChange={(event) => update('s3_region', event.target.value)} />
          <label className={formStyles.label}>Bucket</label>
          <input className={formStyles.input} value={settings.s3_bucket_name} onChange={(event) => update('s3_bucket_name', event.target.value)} />
          <label className={formStyles.label}>Access key</label>
          <input type="password" autoComplete="new-password" className={formStyles.input} value={settings.s3_access_key} onChange={(event) => update('s3_access_key', event.target.value)} placeholder={configured.s3_access_key ? 'Configured — enter to replace' : 'Access key'} />
          <label className={formStyles.label}>Secret key</label>
          <input type="password" autoComplete="new-password" className={formStyles.input} value={settings.s3_secret_key} onChange={(event) => update('s3_secret_key', event.target.value)} placeholder={configured.s3_secret_key ? 'Configured — enter to replace' : 'Secret key'} />
        </div>

        <div className={`${cardStyles.card} stackLarge`}>
          <label className={`${formStyles.choiceCard} ${settings.samba_enabled ? formStyles.choiceCardSelected : ''}`}>
            <span className="grow"><strong>Samba / network share</strong><p className="smallText mutedText">Mirror backups to a mounted or network-accessible share.</p></span>
            <span className={formStyles.switch}><input type="checkbox" checked={settings.samba_enabled} onChange={(event) => update('samba_enabled', event.target.checked)} /><span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span></span>
          </label>
          <label className={formStyles.label}>Share path</label>
          <input className={formStyles.input} value={settings.samba_share_path} onChange={(event) => update('samba_share_path', event.target.value)} placeholder="//server/share or /mnt/share" />
          <label className={formStyles.label}>Username</label>
          <input className={formStyles.input} value={settings.samba_username} onChange={(event) => update('samba_username', event.target.value)} />
          <label className={formStyles.label}>Password</label>
          <input type="password" autoComplete="new-password" className={formStyles.input} value={settings.samba_password} onChange={(event) => update('samba_password', event.target.value)} placeholder={configured.samba_password ? 'Configured — enter to replace' : 'Password'} />
          <Button variant="secondary" onClick={testSamba} disabled={testingSamba}>{testingSamba ? <RefreshCw className="spin" size={18} /> : <Server size={18} />}Test Samba connection</Button>
        </div>
      </div>

      <div className="actionsEnd"><Button variant="primary" onClick={save} disabled={saving}>{saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}Save backup settings</Button></div>

      <div className={`${cardStyles.card} stack`}>
        <h3 className={cardStyles.title}>Backup history</h3>
        {history.length === 0 ? <p className="mutedText">No backup history found.</p> : (
          <div className={tableStyles.scroll}>
            <table className={tableStyles.table}>
              <thead><tr><th className={tableStyles.header}>Date</th><th className={tableStyles.header}>Status</th><th className={tableStyles.header}>Uploaded</th><th className={tableStyles.header}>Skipped</th><th className={tableStyles.header}>Errors</th><th className={tableStyles.header}>Destination</th></tr></thead>
              <tbody>{history.map((backup, index) => <tr key={backup.id || `${backup.start_time}-${index}`} className={tableStyles.row}><td className={tableStyles.cell}>{backup.start_time ? new Date(backup.start_time).toLocaleString() : backup.timestamp || '—'}</td><td className={tableStyles.cell}><span className="row">{backup.status === 'completed' || backup.status === 'success' ? <CheckCircle size={16} /> : backup.status === 'failed' || backup.status === 'error' ? <XCircle size={16} /> : <RefreshCw size={16} />} {backup.status || 'unknown'}</span></td><td className={tableStyles.cell}>{backup.uploaded_files ?? backup.files_uploaded ?? 0}</td><td className={tableStyles.cell}>{backup.skipped_files ?? backup.files_skipped ?? 0}</td><td className={tableStyles.cell}>{backup.error_files ?? backup.files_errors ?? 0}</td><td className={tableStyles.cell}>{backup.destination || 'cloud'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {totalPages > 1 ? <div className="rowBetween"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="smallText mutedText">Page {page} of {totalPages}</span><Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div> : null}
      </div>

      <BackupProgressModal isOpen={showBackupModal} onClose={() => { setShowBackupModal(false); loadHistory().catch(() => {}); }} />
      <RestoreModal isOpen={showRestoreModal} onClose={() => setShowRestoreModal(false)} showToast={(message, type = 'success') => toast[type === 'error' ? 'error' : 'success'](message)} />
    </div>
  );
};

export default BackupRestore;
