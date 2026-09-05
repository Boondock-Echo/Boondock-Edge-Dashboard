import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/apiClient';
import { ArrowLeft, Package, Upload, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../AuthContext';

const VersionPage = ({ isDarkMode }) => {
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
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-8 ${
          isDarkMode ? 'bg-gray-900 text-slate-200' : 'bg-gray-50 text-gray-800'
        }`}
      >
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">Sign in required</h1>
        <p className="text-sm opacity-80 mb-6">Log in to manage release packages.</p>
        <Link to="/login" className="text-violet-500 hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full p-4 md:p-8 ${isDarkMode ? 'bg-gray-900 text-slate-200' : 'bg-gray-50 text-gray-900'}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`p-2 rounded-lg ${
              isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-500 hover:bg-gray-200'
            }`}
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 rounded-xl bg-violet-500/20">
            <Package className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Software version</h1>
            <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Apply a full release (UI + server) or roll back to a previous snapshot. Also available on{' '}
              <Link to="/release" className="text-violet-400 hover:underline">
                Release notes
              </Link>
              .
            </p>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-6 mb-6 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <h2 className="text-lg font-semibold mb-4">Current</h2>
          {loading && <p className="text-sm opacity-70">Loading…</p>}
          {!loading && !current && (
            <p className="text-sm opacity-70">No release has been applied through this system yet (or state is new).</p>
          )}
          {!loading && current && (
            <ul className="text-sm space-y-1.5">
              {current.version && (
                <li>
                  <span className={isDarkMode ? 'text-slate-500' : 'text-gray-500'}>Version:</span> {current.version}
                </li>
              )}
              {current.build_id && (
                <li>
                  <span className={isDarkMode ? 'text-slate-500' : 'text-gray-500'}>Build id:</span> {current.build_id}
                </li>
              )}
              {current.applied_at && (
                <li>
                  <span className={isDarkMode ? 'text-slate-500' : 'text-gray-500'}>Applied:</span> {current.applied_at}
                </li>
              )}
            </ul>
          )}
        </div>

        <div
          className={`rounded-2xl border p-6 mb-6 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Install release
          </h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Upload a <code className="text-xs px-1 rounded bg-black/20">.zip</code> created by{' '}
            <code className="text-xs px-1 rounded bg-black/20">pack_boondock_release.py</code> (includes React build and
            Python <code className="text-xs">app</code>).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                className={`block w-full text-sm ${
                  isDarkMode
                    ? 'file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-slate-700 file:text-slate-200'
                    : 'file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-violet-50 file:text-violet-700'
                }`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={installDeps}
                onChange={(e) => setInstallDeps(e.target.checked)}
                className="rounded border-gray-500"
              />
              Run <code className="text-xs">pip install -r requirements.txt</code> after
            </label>
            <button
              type="button"
              disabled={applying}
              onClick={onApply}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
            >
              {applying ? 'Installing…' : 'Apply update'}
            </button>
          </div>
        </div>

        <div
          className={`rounded-2xl border p-6 ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
          }`}
        >
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Snapshots &amp; rollback
          </h2>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            The last few states before an upgrade are kept on disk. Restart the server after a rollback.
          </p>
          {loading && <p className="text-sm">Loading list…</p>}
          {!loading && (!status?.backups || status.backups.length === 0) && (
            <p className="text-sm opacity-70">No backups yet.</p>
          )}
          {!loading && status?.backups?.length > 0 && (
            <ul className="space-y-3">
              {status.backups.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg ${
                    isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50'
                  }`}
                >
                  <div className="min-w-0 text-sm">
                    <div className="font-mono text-xs break-all">{b.id}</div>
                    {b.label && <div className="opacity-80 mt-0.5">{b.label}</div>}
                    {b.version && b.type === 'pre_update' && (
                      <div className="text-xs opacity-60">Was before: {b.version} ({b.build_id})</div>
                    )}
                    {b.created_at && <div className="text-xs opacity-60 mt-0.5">{b.created_at}</div>}
                  </div>
                  <button
                    type="button"
                    disabled={!!rolling}
                    onClick={() => onRollback(b.id)}
                    className="shrink-0 px-3 py-1.5 rounded-md text-sm border border-amber-600/50 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {rolling === b.id ? 'Restoring…' : 'Roll back to this'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={`mt-6 p-4 rounded-xl flex gap-3 ${
            isDarkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200/80'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-200/90">After any apply or rollback</p>
            <p className={`mt-1 ${isDarkMode ? 'text-amber-100/70' : 'text-amber-900/80'}`}>
              Restart the Boondock Edge / Waitress / systemd service on this machine so the server loads new Python code
              and the UI is fully consistent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionPage;
