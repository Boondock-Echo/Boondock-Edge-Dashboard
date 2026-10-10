import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Cloud, Loader2, X } from 'lucide-react';
import api from '../../utils/apiClient';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';

const EMPTY_PROGRESS = {
  status: 'idle',
  current_operation: '',
  total_files: 0,
  processed_files: 0,
  uploaded_files: 0,
  skipped_files: 0,
  error_files: 0,
  message: '',
};

const BackupProgressModal = ({ isOpen, onClose }) => {
  const dialogRef = useRef(null);
  const timerRef = useRef(null);
  const [backupType, setBackupType] = useState('incremental');
  const [destination, setDestination] = useState('both');
  const [available, setAvailable] = useState({ cloud: false, samba: false });
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const stopPolling = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const fetchProgress = async () => {
    const { data } = await api.get('/s3/backup/status');
    setProgress(data || EMPTY_PROGRESS);
    if (data?.status && data.status !== 'running') stopPolling();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setProgress(EMPTY_PROGRESS);
      setError('');
      setBackupType('incremental');
      return undefined;
    }

    let cancelled = false;
    api.get('/settings/backup')
      .then(({ data }) => {
        if (cancelled) return;
        const next = { cloud: Boolean(data.s3_enabled), samba: Boolean(data.samba_enabled) };
        setAvailable(next);
        if (next.cloud && next.samba) setDestination('both');
        else if (next.cloud) setDestination('cloud');
        else if (next.samba) setDestination('samba');
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.response?.data?.error || 'Failed to load backup destinations');
      });

    fetchProgress().catch(() => {});
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [isOpen]);

  const startBackup = async () => {
    setStarting(true);
    setError('');
    try {
      await api.post('/s3/backup/start', {
        backup_type: backupType,
        destination,
      });
      await fetchProgress();
      stopPolling();
      timerRef.current = window.setInterval(() => {
        fetchProgress().catch((requestError) => {
          stopPolling();
          setError(requestError.response?.data?.error || 'Failed to read backup progress');
        });
      }, 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to start backup');
    } finally {
      setStarting(false);
    }
  };

  if (!isOpen) return null;

  const running = progress.status === 'running';
  const finished = progress.status === 'completed';
  const total = Number(progress.total_files) || 0;
  const processed = Number(progress.processed_files) || 0;
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const canStart = available.cloud || available.samba;

  return (
    <dialog
      ref={dialogRef}
      className={modalStyles.dialog}
      onCancel={(event) => { event.preventDefault(); if (!running) onClose(); }}
      onClose={() => { if (!running) onClose(); }}
    >
      <div className={modalStyles.header}>
        <div><h2 className={modalStyles.title}>Run backup</h2><p className="smallText mutedText">Start a manual backup using the configured destinations.</p></div>
        <Button size="icon" variant="ghost" disabled={running} onClick={onClose}><X size={18} /></Button>
      </div>

      <div className={`${modalStyles.body} stack stackLarge`}>
        {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><AlertCircle className={noticeStyles.icon} /><div className={noticeStyles.body}><p>{error}</p></div></div> : null}
        {!canStart ? <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}><AlertCircle className={noticeStyles.icon} /><div className={noticeStyles.body}><p>Enable at least one backup destination before starting a backup.</p></div></div> : null}

        {!running && !finished ? (
          <>
            <div>
              <label className={formStyles.label}>Backup type</label>
              <select className={formStyles.select} value={backupType} onChange={(event) => setBackupType(event.target.value)}>
                <option value="incremental">Incremental</option>
                <option value="full">Full</option>
              </select>
            </div>
            <div>
              <label className={formStyles.label}>Destination</label>
              <select className={formStyles.select} value={destination} onChange={(event) => setDestination(event.target.value)}>
                {available.cloud ? <option value="cloud">Cloud</option> : null}
                {available.samba ? <option value="samba">Samba</option> : null}
                {available.cloud && available.samba ? <option value="both">Cloud + Samba</option> : null}
              </select>
            </div>
          </>
        ) : null}

        {running || finished ? (
          <div className={`${cardStyles.card} stack`}>
            <div className="rowBetween">
              <span className="row">{finished ? <CheckCircle size={18} /> : <Loader2 className="spin" size={18} />}{finished ? 'Backup complete' : 'Backup running'}</span>
              <strong>{percent}%</strong>
            </div>
            <progress max="100" value={percent} />
            <p className="smallText mutedText">{progress.current_operation || progress.message || 'Processing backup...'}</p>
            <div className="gridThree smallText">
              <span>Processed: {processed}</span>
              <span>Uploaded: {Number(progress.uploaded_files) || 0}</span>
              <span>Skipped: {Number(progress.skipped_files) || 0}</span>
              <span>Errors: {Number(progress.error_files) || 0}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={modalStyles.actions}>
        {finished ? <Button variant="primary" onClick={onClose}><CheckCircle size={18} />Close</Button> : <Button variant="primary" disabled={!canStart || starting || running} onClick={startBackup}>{starting || running ? <Loader2 className="spin" size={18} /> : <Cloud size={18} />}Start backup</Button>}
      </div>
    </dialog>
  );
};

export default BackupProgressModal;
