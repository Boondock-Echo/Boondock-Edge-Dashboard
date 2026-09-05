import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { Upload, ExternalLink } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Logged-in users: install boondock-edge-release-*.zip (from pack_boondock_release.py / release.bat).
 * Shown on the Release notes page; full status and rollback live at /version.
 */
const ReleasePackageUpload = ({ isDarkMode }) => {
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
    <div
      className={`mb-8 rounded-2xl border p-5 ${
        isDarkMode ? 'bg-violet-950/30 border-violet-800/50' : 'bg-violet-50/80 border-violet-200/80'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div>
          <h2
            className={`text-base font-semibold flex items-center gap-2 ${
              isDarkMode ? 'text-violet-200' : 'text-violet-900'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            Install a full release
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-violet-800/80'}`}>
            Upload <code className="text-xs px-1 rounded bg-black/20">boondock-edge-release-… .zip</code> from{' '}
            <code className="text-xs px-1 rounded bg-black/20">release.bat</code> (UI + server). Restart the edge service
            afterward.
          </p>
        </div>
        <Link
          to="/version"
          className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-medium ${
            isDarkMode
              ? 'text-violet-300 hover:text-violet-200'
              : 'text-violet-700 hover:text-violet-900'
          }`}
        >
          Snapshots &amp; rollback
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className={
            isDarkMode
              ? 'block w-full sm:flex-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-slate-800 file:text-slate-200'
              : 'block w-full sm:flex-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-white file:text-violet-800'
          }
        />
        <label className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={installDeps}
            onChange={(e) => setInstallDeps(e.target.checked)}
            className="rounded"
          />
          <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>Run pip after</span>
        </label>
        <button
          type="button"
          disabled={applying}
          onClick={onApply}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          {applying ? 'Uploading…' : 'Install'}
        </button>
      </div>
    </div>
  );
};

export default ReleasePackageUpload;
