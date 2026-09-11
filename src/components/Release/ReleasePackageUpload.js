import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { Upload, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';

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
    <section className={cardStyles.card}>
      <header className={cardStyles.header}>
        <div>
          <h2 className={cardStyles.title}>
            <Upload size={16} />
            Install a full release
          </h2>
          <p className={cardStyles.description}>
            Upload <code>boondock-edge-release-… .zip</code> from{' '}
            <code>release.bat</code> (UI + server). Restart the edge service
            afterward.
          </p>
        </div>
        <Link to="/version" className="row">
          Snapshots &amp; rollback <ExternalLink size={14} />
        </Link>
      </header>
      <div className="rowWrap">
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className={`${formStyles.file} grow`}
        />
        <label className={formStyles.checkbox}>
          <input
            type="checkbox"
            checked={installDeps}
            onChange={(e) => setInstallDeps(e.target.checked)}
          />
          <span>Run pip after</span>
        </label>
        <Button variant="primary" disabled={applying} onClick={onApply}>
          {applying && <span className="spinner spinnerSmall" role="status" aria-label="Uploading release" />}
          {applying ? 'Uploading…' : 'Install'}
        </Button>
      </div>
    </section>
  );
};

export default ReleasePackageUpload;
