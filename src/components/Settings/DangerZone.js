import React, { useRef, useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';

const DangerZone = () => {
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showLogsModal && !dialog.open) dialog.showModal();
    if (!showLogsModal && dialog.open) dialog.close();
  }, [showLogsModal]);

  const clearLogs = async () => {
    setClearingLogs(true);
    try {
      await api.post('/logs_clear');
      toast.success('Logs cleared');
      setShowLogsModal(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to clear logs');
    } finally {
      setClearingLogs(false);
    }
  };

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={AlertTriangle}
        title="Danger Zone"
        description="Destructive system operations that cannot be undone."
        iconColor="red"
      />

      <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
        <AlertTriangle className={noticeStyles.icon} />
        <div className={noticeStyles.body}>
          <p><strong>Destructive operations are intentionally limited.</strong></p>
          <p>The current API does not expose a bulk recordings-delete endpoint, so the old broken action has been removed instead of emulated in the browser.</p>
        </div>
      </div>

      <div className={`${cardStyles.card} rowBetweenStart`}>
        <div className="row grow">
          <AlertCircle className="iconLarge" />
          <div className="grow">
            <h3 className={cardStyles.title}>Clear logs</h3>
            <p className={cardStyles.description}>Permanently remove stored application logs.</p>
          </div>
        </div>
        <Button variant="danger" onClick={() => setShowLogsModal(true)}>Clear logs</Button>
      </div>

      {showLogsModal ? (
        <dialog
          ref={dialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => {
            event.preventDefault();
            if (!clearingLogs) setShowLogsModal(false);
          }}
        >
          <div className={modalStyles.header}>
            <h2 className={modalStyles.title}>Clear all logs?</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowLogsModal(false)} disabled={clearingLogs} aria-label="Close">
              <XCircle />
            </Button>
          </div>
          <div className={`${modalStyles.body} stack`}>
            <p>This permanently removes stored application log history.</p>
            <div className={modalStyles.actions}>
              <Button onClick={() => setShowLogsModal(false)} disabled={clearingLogs}>Cancel</Button>
              <Button variant="danger" onClick={clearLogs} disabled={clearingLogs}>
                {clearingLogs ? <span className="spinner spinnerSmall" /> : null}
                {clearingLogs ? 'Clearing...' : 'Clear logs'}
              </Button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
};

export default DangerZone;
