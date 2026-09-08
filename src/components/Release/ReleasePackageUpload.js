import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { Upload, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import styles from '../ui/Page.module.css';

/**
 * Logged-in users: install boondock-edge-release-*.zip (from pack_boondock_release.py / release.bat).
 * Shown on the Release notes page; full status and rollback live at /version.
 */
const ReleasePackageUpload = () => {
  const [applying, setApplying] = useState(false);
  const [installDeps, setInstallDeps] = useState(false);
  const fileRef = useRef(null);
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
      if (data?.pip_install) {
        const [ok, logText] = data.pip_install;
        if (ok) toast.info('Python dependencies were updated.');
        else toast.error(`pip: ${(logText || '').slice(0, 200)}`);
      }
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className={styles.uploadCard}>
      <header className={styles.uploadHeader}>
        <div>
          <h2 className={styles.cardTitle}>
            <Upload size={16} />
            Install a full release
          </h2>
          <p className={styles.description}>
            Upload <code className={styles.code}>boondock-edge-release-… .zip</code> from{' '}
            <code className={styles.code}>release.bat</code> (UI + server). Restart the edge service
            afterward.
          </p>
        </div>
        <Link to="/version" className={styles.link}>
          Snapshots &amp; rollback <ExternalLink size={14} />
        </Link>
      </header>
      <div className={styles.formRow}>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className={`${styles.file} ${styles.grow}`}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={installDeps}
            onChange={(e) => setInstallDeps(e.target.checked)}
          />
          <span>Run pip after</span>
        </label>
        <Button variant="primary" disabled={applying} onClick={onApply}>
          {applying && <Spinner size="small" label="Uploading release" />}
          {applying ? 'Uploading…' : 'Install'}
        </Button>
      </div>
    </section>
  );
};

export default ReleasePackageUpload;
