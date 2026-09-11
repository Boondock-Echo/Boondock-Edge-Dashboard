import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { ArrowLeft, Package, Upload, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../AuthContext';
import Button from '../ui/Button';
import pageStyles from '../ui/Page.module.css';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import listStyles from '../ui/List.module.css';
import noticeStyles from '../ui/Notice.module.css';

const VersionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [rolling, setRolling] = useState(null);
  const [installDeps, setInstallDeps] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/version/status`);
      setStatus(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to load version status');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const onApply = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      toast.warn('Choose a release .zip file first');
      return;
    }
    const fd = new FormData();
    fd.append('file', f, f.name);
    if (installDeps) fd.append('install_dependencies', 'true');
    setApplying(true);
    try {

      const { data } = await api.post(`/version/apply`, fd, {
        maxContentLength: 250 * 1024 * 1024,
        maxBodyLength: 250 * 1024 * 1024,
      });
      toast.success(data?.message || 'Update applied');
      if (data?.log?.length) {
        console.info('[Release]', data.log);
      }
      if (data?.pip_install) {
        const [ok, logText] = data.pip_install;
        if (ok) {
          toast.info('Python dependencies were updated.');
        } else {
          toast.error(`pip install had issues. Check server logs. ${(logText || '').slice(0, 200)}`);
        }
      }
      if (f) {
        f.value = '';
      }
      load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  const onRollback = async (backupId) => {
    if (!window.confirm('Restore the system to this saved snapshot? You should restart the Boondock Edge service afterward.')) {
      return;
    }
    setRolling(backupId);
    try {
      const { data } = await api.post(`/version/rollback`,
        { backup_id: backupId },
        { headers: { 'Content-Type': 'application/json' } }
      );
      toast.success(data?.message || 'Rolled back');
      load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Rollback failed';
      toast.error(msg);
    } finally {
      setRolling(null);
    }
  };

  const current = status?.current;

  if (!user) {
    return (
      <div className={pageStyles.centered}>
        <AlertTriangle size={48} />
        <h1>Sign in required</h1>
        <p>Log in to manage release packages.</p>
        <Link to="/login" className={pageStyles.link}>Go to login</Link>
      </div>
    );
  }

  return (
    <main className={pageStyles.page}>
      <div className={`${pageStyles.container} stack`}>
        <header className={pageStyles.header}>
          <Button size="icon" onClick={() => navigate(-1)} aria-label="Back" title="Back">
            <ArrowLeft size={20} />
          </Button>
          <div className={pageStyles.headerIcon}>
            <Package size={24} />
          </div>
          <div>
            <h1 className={pageStyles.title}>Software version</h1>
            <p className={pageStyles.subtitle}>
              Apply a full release (UI + server) or roll back to a previous snapshot. Also available on{' '}
              <Link to="/release" className={pageStyles.link}>Release notes</Link>
              .
            </p>
          </div>
        </header>

        <section className={`${cardStyles.card} stack`}>
          <h2 className={cardStyles.title}>Current</h2>
          {loading && <p className={cardStyles.description}>Loading…</p>}
          {!loading && !current && (
            <p className={cardStyles.description}>No release has been applied through this system yet (or state is new).</p>
          )}
          {!loading && current && (
            <ul className={listStyles.list}>
              {current.version && (
                <li><strong>Version:</strong> {current.version}</li>
              )}
              {current.build_id && (
                <li><strong>Build id:</strong> {current.build_id}</li>
              )}
              {current.applied_at && (
                <li><strong>Applied:</strong> {current.applied_at}</li>
              )}
            </ul>
          )}
        </section>

        <section className={`${cardStyles.card} stack`}>
          <h2 className={`${cardStyles.title} ${cardStyles.title}`}>
            <Upload size={16} />
            Install release
          </h2>
          <p className={cardStyles.description}>
            Upload a <code>.zip</code> created by{' '}
            <code>pack_boondock_release.py</code> (includes React build and Python <code>app</code>).
          </p>
          <div className="rowWrap">
            <div className="grow">
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                className={formStyles.file}
              />
            </div>
            <label className={formStyles.checkbox}>
              <input
                type="checkbox"
                checked={installDeps}
                onChange={(e) => setInstallDeps(e.target.checked)}
              />
              Run <code>pip install -r requirements.txt</code> after
            </label>
            <Button variant="primary" disabled={applying} onClick={onApply}>
              {applying && <span className="spinner spinnerSmall" role="status" aria-label="Installing release" />}
              {applying ? 'Installing…' : 'Apply update'}
            </Button>
          </div>
        </section>

        <section className={`${cardStyles.card} stack`}>
          <h2 className={cardStyles.title}>
            <RotateCcw size={16} />
            Snapshots &amp; rollback
          </h2>
          <p className={cardStyles.description}>
            The last few states before an upgrade are kept on disk. Restart the server after a rollback.
          </p>
          {loading && <p className={cardStyles.description}>Loading list…</p>}
          {!loading && (!status?.backups || status.backups.length === 0) && (
            <p className={cardStyles.description}>No backups yet.</p>
          )}
          {!loading && status?.backups?.length > 0 && (
            <ul className={listStyles.list}>
              {status.backups.map((b) => (
                <li key={b.id} className={listStyles.item}>
                  <div className={listStyles.content}>
                    <div className={listStyles.identifier}>{b.id}</div>
                    {b.label && <div>{b.label}</div>}
                    {b.version && b.type === 'pre_update' && (
                      <div className={listStyles.metaSmall}>Was before: {b.version} ({b.build_id})</div>
                    )}
                    {b.created_at && <div className={listStyles.metaSmall}>{b.created_at}</div>}
                  </div>
                  <Button
                    disabled={!!rolling}
                    onClick={() => onRollback(b.id)}
                    variant="danger"
                    size="small"
                  >
                    {rolling === b.id ? 'Restoring…' : 'Roll back to this'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
          <CheckCircle2 size={20} className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p><strong>After any apply or rollback</strong></p>
            <p>
              Restart the Boondock Edge / Waitress / systemd service on this machine so the server loads new Python code
              and the UI is fully consistent.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default VersionPage;
