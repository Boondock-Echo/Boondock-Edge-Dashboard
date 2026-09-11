import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/apiClient';
import { X, Cloud, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

const BackupProgressModal = ({ isOpen, onClose, globalSettings }) => {
  const [backupType, setBackupType] = useState('incremental');
  // Separate destination checkboxes to reduce vertical height
  const [includeCloud, setIncludeCloud] = useState(true);
  const [includeSamba, setIncludeSamba] = useState(false);
  const [backupStarted, setBackupStarted] = useState(false);
  const [progress, setProgress] = useState({
    status: 'idle',
    current_operation: null,
    total_files: 0,
    processed_files: 0,
    uploaded_files: 0,
    skipped_files: 0,
    error_files: 0,
    message: '',
    start_time: null,
    end_time: null
  });

  const cloudEnabled = globalSettings?.global_enable_s3_upload || false;
  const sambaEnabled = globalSettings?.samba_backup_enabled || false;
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset progress when modal closes
      setBackupStarted(false);
      setBackupType('incremental');
      setIncludeCloud(true);
      setIncludeSamba(false);
      setProgress({
        status: 'idle',
        current_operation: null,
        total_files: 0,
        processed_files: 0,
        uploaded_files: 0,
        skipped_files: 0,
        error_files: 0,
        message: '',
        start_time: null,
        end_time: null
      });
      return;
    }

    // Initialize destinations based on enabled targets
    if (cloudEnabled && sambaEnabled) {
      setIncludeCloud(true);
      setIncludeSamba(true);
    } else if (cloudEnabled) {
      setIncludeCloud(true);
      setIncludeSamba(false);
    } else if (sambaEnabled) {
      setIncludeCloud(false);
      setIncludeSamba(true);
    } else {
      setIncludeCloud(false);
      setIncludeSamba(false);
    }
  }, [isOpen, globalSettings]);

  const handleStartBackup = async () => {
    // Derive destination string from checkbox selections
    let destination = null;
    if (includeCloud && includeSamba) destination = 'both';
    else if (includeCloud) destination = 'cloud';
    else if (includeSamba) destination = 'samba';

    if (!destination) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: 'Please select at least one backup destination.'
      }));
      return;
    }

    // Validate destination against enabled flags
    if (destination === 'cloud' && !cloudEnabled) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: 'Cloud backup is not enabled. Please enable it in Settings first.'
      }));
      return;
    }

    if (destination === 'samba' && !sambaEnabled) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: 'Samba backup is not enabled. Please enable it in Settings first.'
      }));
      return;
    }

    if (destination === 'both' && (!cloudEnabled || !sambaEnabled)) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: 'Both Cloud and Samba must be enabled to use both destinations.'
      }));
      return;
    }
    
    try {
      setBackupStarted(true);
      await api.post(`/s3/backup/start`, { backup_type: backupType, destination });
    } catch (error) {
      console.error('Error starting backup:', error);
      setBackupStarted(false);
      setProgress(prev => ({
        ...prev,
        status: 'error',
        message: error.response?.data?.error || 'Failed to start backup'
      }));
    }
  };

  useEffect(() => {
    if (!isOpen || !backupStarted) {
      // Clear interval when modal closes or backup hasn't started
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Poll for progress updates
    const pollProgress = async () => {
      try {
        const response = await api.get(`/s3/backup/status`);
        const newProgress = response.data;
        setProgress(newProgress);

        // Stop polling if backup is completed or errored
        if (newProgress.status === 'completed' || newProgress.status === 'error') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error fetching backup status:', error);
        // Don't clear interval on error, keep trying
      }
    };

    // Start polling immediately, then every second
    pollProgress();
    intervalRef.current = setInterval(pollProgress, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, backupStarted]);

  if (!isOpen) return null;

  const progressPercentage = progress.total_files > 0 
    ? Math.round((progress.processed_files / progress.total_files) * 100) 
    : 0;

  const getStatusIcon = () => {
    if (progress.status === 'running') {
      return <Loader2  />;
    } else if (progress.status === 'completed') {
      return <CheckCircle  />;
    } else if (progress.status === 'error') {
      return <AlertCircle  />;
    }
    return <Cloud  />;
  };

  const getStatusColor = () => {
    if (progress.status === 'running') return 'text-blue-500';
    if (progress.status === 'completed') return 'text-green-500';
    if (progress.status === 'error') return 'text-red-500';
    return 'text-gray-500';
  };

  const getOperationLabel = (operation) => {
    switch (operation) {
      case 'audio': return 'Audio Files';
      case 'db': return 'Database';
      case 'logs': return 'Logs';
      case 'samba_db': return 'Samba Settings/DB';
      case 'samba_audio': return 'Samba Audio Files';
      case 'samba_logs': return 'Samba Logs';
      default: return 'Initializing...';
    }
  };

  return (
    <div className="screenCenter">
      <div >
        {/* Header */}
        <div className="rowBetween">
          <div className="row">
            {getStatusIcon()}
            <h2 className="pageTitle">
              Boondock Backup Progress
            </h2>
          </div>
          {progress.status !== 'running' && (
            <button
              onClick={onClose}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.icon}`}
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="stack">
          {/* Backup Type & Destination Selection (before backup starts) */}
          {!backupStarted && progress.status === 'idle' && (
            <div className="stack">
              <div>
                <h3 className="pageTitle">
                  Select Backup Type
                </h3>

                {/* Side-by-side backup type radios */}
                <div className="gridTwo">
                  <label className={formStyles.label}>
                    <input
                      type="radio"
                      name="backupType"
                      value="incremental"
                      checked={backupType === 'incremental'}
                      onChange={(e) => setBackupType(e.target.value)}
                      className={formStyles.input}
                    />
                    <div >
                      <div className="row">
                        <span className="mutedText smallText">
                          Incremental
                        </span>
                        <span className="mutedText smallText">
                          Recommended
                        </span>
                      </div>
                    </div>
                  </label>

                  <label className={formStyles.label}>
                    <input
                      type="radio"
                      name="backupType"
                      value="full"
                      checked={backupType === 'full'}
                      onChange={(e) => setBackupType(e.target.value)}
                      className={formStyles.input}
                    />
                    <div >
                      <div className="row">
                        <span className="mutedText smallText">
                          Full
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Dynamic description based on backup type */}
                <div className={cardStyles.card}>
                  <Info  />
                  <p className="mutedText smallText">
                    {backupType === 'incremental' ? (
                      <>
                        <strong>Incremental:</strong> Only backs up files that haven&apos;t been backed up yet. Faster and more efficient for regular backups.
                      </>
                    ) : (
                      <>
                        <strong>Full:</strong> Backs up all audio files regardless of previous backup status. Useful for periodic full backups and verification.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Destination Selection */}
              <div>
                <h3 className="pageTitle">
                  Select Destination
                </h3>

                {!cloudEnabled && !sambaEnabled && (
                  <div className={cardStyles.card}>
                    <p className="mutedText smallText">
                      <strong>Warning:</strong> Neither Cloud nor Samba backup is enabled. Please enable at least one backup destination in Settings.
                    </p>
                  </div>
                )}

                {/* Side-by-side destination checkboxes */}
                <div className="gridTwo">
                  {/* Cloud checkbox */}
                  <label className={formStyles.label}>
                    <input
                      type="checkbox"
                      checked={includeCloud}
                      onChange={(e) => cloudEnabled && setIncludeCloud(e.target.checked)}
                      disabled={!cloudEnabled}
                      className={formStyles.input}
                    />
                    <div >
                      <div className="row">
                        <span className="mutedText smallText">
                          Boondock Cloud
                        </span>
                        {!cloudEnabled && (
                          <span className="mutedText smallText">
                            Not Enabled
                          </span>
                        )}
                      </div>
                      <p className="mutedText smallText">
                        Store backups in Boondock Cloud storage.
                      </p>
                    </div>
                  </label>

                  {/* Samba checkbox */}
                  <label className={formStyles.label}>
                    <input
                      type="checkbox"
                      checked={includeSamba}
                      onChange={(e) => sambaEnabled && setIncludeSamba(e.target.checked)}
                      disabled={!sambaEnabled}
                      className={formStyles.input}
                    />
                    <div >
                      <div className="row">
                        <span className="mutedText smallText">
                          Samba / Network Drive
                        </span>
                        {!sambaEnabled && (
                          <span className="mutedText smallText">
                            Not Enabled
                          </span>
                        )}
                      </div>
                      <p className="mutedText smallText">
                        Mirror backups to a Samba / NAS share.
                      </p>
                    </div>
                  </label>
                </div>

                <p className="mutedText smallText">
                  You can select one or both destinations. If both are selected, the backup will run to Cloud and Samba in a single job.
                </p>
              </div>
            </div>
          )}

          {/* Status Message */}
          {backupStarted && (
            <div className={cardStyles.card}>
              <p className="mutedText smallText">
                {progress.message || 'Initializing backup...'}
              </p>
              {progress.current_operation && (
                <p className="mutedText smallText">
                  Current: {getOperationLabel(progress.current_operation)}
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {backupStarted && progress.status === 'running' && (
            <div>
              <div className="rowBetween">
                <span className="mutedText smallText">
                  Progress
                </span>
                <span className="mutedText smallText">
                  {progress.processed_files} of {progress.total_files} files
                </span>
              </div>
              <div >
                <div style={{ width: `${progressPercentage}%` }} />
              </div>
            </div>
          )}

          {/* Statistics */}
          {backupStarted && (
            <div className="gridTwo">
            <div >
              <div >
                {progress.uploaded_files}
              </div>
              <div >
                Uploaded
              </div>
            </div>
            <div >
              <div >
                {progress.skipped_files}
              </div>
              <div >
                Skipped
              </div>
            </div>
            <div >
              <div >
                {progress.error_files}
              </div>
              <div >
                Errors
              </div>
            </div>
            <div >
              <div >
                {progress.total_files}
              </div>
              <div >
                Total
              </div>
            </div>
          </div>
          )}

          {/* Completion Message */}
          {backupStarted && progress.status === 'completed' && (
            <div className={cardStyles.card}>
              <p className="mutedText smallText">
                Backup completed successfully!
              </p>
              <p className="mutedText smallText">
                {progress.uploaded_files} files uploaded, {progress.skipped_files} skipped, {progress.error_files} errors
              </p>
            </div>
          )}

          {/* Error Message */}
          {backupStarted && progress.status === 'error' && (
            <div className={cardStyles.card}>
              <p className="mutedText smallText">
                Backup failed
              </p>
              <p className="mutedText smallText">
                {progress.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cardStyles.card}>
          {!backupStarted ? (
            <>
              <button
                onClick={onClose}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
              >
                Cancel
              </button>
              <button
                onClick={handleStartBackup}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
              >
                Start Backup
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              disabled={progress.status === 'running'}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
            >
              {progress.status === 'running' ? 'Backup in Progress...' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupProgressModal;
