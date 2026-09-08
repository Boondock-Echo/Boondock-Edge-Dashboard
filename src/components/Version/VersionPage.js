import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { ArrowLeft, Package, Upload, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../AuthContext';
import Button from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import styles from '../ui/Page.module.css';

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
      <div className={styles.centered}>
        <AlertTriangle size={48} />
        <h1>Sign in required</h1>
        <p>Log in to manage release packages.</p>
        <Link to="/login" className={styles.link}>Go to login</Link>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Button size="icon" onClick={() => navigate(-1)} aria-label="Back" title="Back">
            <ArrowLeft size={20} />
          </Button>
          <div className={styles.headerIcon}>
            <Package size={24} />
          </div>
          <div>
            <h1 className={styles.title}>Software version</h1>
            <p className={styles.subtitle}>
              Apply a full release (UI + server) or roll back to a previous snapshot. Also available on{' '}
              <Link to="/release" className={styles.link}>Release notes</Link>
              .
            </p>
          </div>
        </header>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Current</h2>
          {loading && <p className={styles.muted}>Loading…</p>}
          {!loading && !current && (
            <p className={styles.muted}>No release has been applied through this system yet (or state is new).</p>
          )}
          {!loading && current && (
            <ul className={styles.details}>
              {current.version && (
                <li><span className={styles.label}>Version:</span> {current.version}</li>
              )}
              {current.build_id && (
                <li><span className={styles.label}>Build id:</span> {current.build_id}</li>
              )}
              {current.applied_at && (
                <li><span className={styles.label}>Applied:</span> {current.applied_at}</li>
              )}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={`${styles.cardTitle} ${styles.cardTitleCompact}`}>
            <Upload size={16} />
            Install release
          </h2>
          <p className={styles.description}>
            Upload a <code className={styles.code}>.zip</code> created by{' '}
            <code className={styles.code}>pack_boondock_release.py</code> (includes React build and Python <code className={styles.code}>app</code>).
          </p>
          <div className={styles.formRow}>
            <div className={styles.grow}>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                className={styles.file}
              />
            </div>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={installDeps}
                onChange={(e) => setInstallDeps(e.target.checked)}
              />
              Run <code className={styles.code}>pip install -r requirements.txt</code> after
            </label>
            <Button variant="primary" disabled={applying} onClick={onApply}>
              {applying && <Spinner size="small" label="Installing release" />}
              {applying ? 'Installing…' : 'Apply update'}
            </Button>
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <RotateCcw size={16} />
            Snapshots &amp; rollback
          </h2>
          <p className={styles.description}>
            The last few states before an upgrade are kept on disk. Restart the server after a rollback.
          </p>
          {loading && <p className={styles.muted}>Loading list…</p>}
          {!loading && (!status?.backups || status.backups.length === 0) && (
            <p className={styles.muted}>No backups yet.</p>
          )}
          {!loading && status?.backups?.length > 0 && (
            <ul className={styles.list}>
              {status.backups.map((b) => (
                <li key={b.id} className={styles.listItem}>
                  <div className={styles.listContent}>
                    <div className={styles.identifier}>{b.id}</div>
                    {b.label && <div>{b.label}</div>}
                    {b.version && b.type === 'pre_update' && (
                      <div className={styles.listMeta}>Was before: {b.version} ({b.build_id})</div>
                    )}
                    {b.created_at && <div className={styles.listMeta}>{b.created_at}</div>}
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

        <aside className={styles.notice}>
          <CheckCircle2 size={20} />
          <div>
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
