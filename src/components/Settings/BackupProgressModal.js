import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/apiClient';
import { X, Cloud, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

const BackupProgressModal = ({ isOpen, onClose, isDarkMode, globalSettings }) => {
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
      return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    } else if (progress.status === 'completed') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    } else if (progress.status === 'error') {
      return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
    return <Cloud className="w-6 h-6 text-gray-500" />;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`w-full max-w-2xl mx-4 rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Boondock Backup Progress
            </h2>
          </div>
          {progress.status !== 'running' && (
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Backup Type & Destination Selection (before backup starts) */}
          {!backupStarted && progress.status === 'idle' && (
            <div className="space-y-4">
              <div>
                <h3 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Select Backup Type
                </h3>

                {/* Side-by-side backup type radios */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    backupType === 'incremental'
                      ? isDarkMode 
                        ? 'bg-blue-900/30 border-blue-500' 
                        : 'bg-blue-50 border-blue-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="backupType"
                      value="incremental"
                      checked={backupType === 'incremental'}
                      onChange={(e) => setBackupType(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          Incremental
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          isDarkMode ? 'bg-blue-700 text-blue-200' : 'bg-blue-100 text-blue-700'
                        }`}>
                          Recommended
                        </span>
                      </div>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    backupType === 'full'
                      ? isDarkMode 
                        ? 'bg-blue-900/30 border-blue-500' 
                        : 'bg-blue-50 border-blue-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="backupType"
                      value="full"
                      checked={backupType === 'full'}
                      onChange={(e) => setBackupType(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          Full
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Dynamic description based on backup type */}
                <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
                  isDarkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <p className={`text-xs ${
                    isDarkMode ? 'text-blue-300' : 'text-blue-700'
                  }`}>
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
                <h3 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Select Destination
                </h3>

                {!cloudEnabled && !sambaEnabled && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    isDarkMode ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                    }`}>
                      <strong>Warning:</strong> Neither Cloud nor Samba backup is enabled. Please enable at least one backup destination in Settings.
                    </p>
                  </div>
                )}

                {/* Side-by-side destination checkboxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Cloud checkbox */}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                    !cloudEnabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    includeCloud
                      ? isDarkMode
                        ? 'bg-blue-900/30 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeCloud}
                      onChange={(e) => cloudEnabled && setIncludeCloud(e.target.checked)}
                      disabled={!cloudEnabled}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          Boondock Cloud
                        </span>
                        {!cloudEnabled && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                          }`}>
                            Not Enabled
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Store backups in Boondock Cloud storage.
                      </p>
                    </div>
                  </label>

                  {/* Samba checkbox */}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${
                    !sambaEnabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    includeSamba
                      ? isDarkMode
                        ? 'bg-blue-900/30 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : isDarkMode
                        ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={includeSamba}
                      onChange={(e) => sambaEnabled && setIncludeSamba(e.target.checked)}
                      disabled={!sambaEnabled}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          Samba / Network Drive
                        </span>
                        {!sambaEnabled && (
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                          }`}>
                            Not Enabled
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Mirror backups to a Samba / NAS share.
                      </p>
                    </div>
                  </label>
                </div>

                <p className={`mt-3 text-xs ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  You can select one or both destinations. If both are selected, the backup will run to Cloud and Samba in a single job.
                </p>
              </div>
            </div>
          )}

          {/* Status Message */}
          {backupStarted && (
            <div className={`p-4 rounded-xl ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
            }`}>
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {progress.message || 'Initializing backup...'}
              </p>
              {progress.current_operation && (
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Current: {getOperationLabel(progress.current_operation)}
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {backupStarted && progress.status === 'running' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Progress
                </span>
                <span className={`text-sm font-medium ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {progress.processed_files} of {progress.total_files} files
                </span>
              </div>
              <div className={`w-full h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isDarkMode ? 'bg-blue-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Statistics */}
          {backupStarted && (
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
            } p-4 rounded-xl`}>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>
                {progress.uploaded_files}
              </div>
              <div className={`text-xs mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Uploaded
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
              }`}>
                {progress.skipped_files}
              </div>
              <div className={`text-xs mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Skipped
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}>
                {progress.error_files}
              </div>
              <div className={`text-xs mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Errors
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {progress.total_files}
              </div>
              <div className={`text-xs mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total
              </div>
            </div>
          </div>
          )}

          {/* Completion Message */}
          {backupStarted && progress.status === 'completed' && (
            <div className={`p-4 rounded-xl bg-green-50 border border-green-200 ${
              isDarkMode ? 'bg-green-900/20 border-green-700' : ''
            }`}>
              <p className={`text-sm font-medium ${
                isDarkMode ? 'text-green-300' : 'text-green-800'
              }`}>
                Backup completed successfully!
              </p>
              <p className={`text-xs mt-1 ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>
                {progress.uploaded_files} files uploaded, {progress.skipped_files} skipped, {progress.error_files} errors
              </p>
            </div>
          )}

          {/* Error Message */}
          {backupStarted && progress.status === 'error' && (
            <div className={`p-4 rounded-xl bg-red-50 border border-red-200 ${
              isDarkMode ? 'bg-red-900/20 border-red-700' : ''
            }`}>
              <p className={`text-sm font-medium ${
                isDarkMode ? 'text-red-300' : 'text-red-800'
              }`}>
                Backup failed
              </p>
              <p className={`text-xs mt-1 ${
                isDarkMode ? 'text-red-400' : 'text-red-600'
              }`}>
                {progress.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-3 p-6 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {!backupStarted ? (
            <>
              <button
                onClick={onClose}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleStartBackup}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Start Backup
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              disabled={progress.status === 'running'}
              className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                progress.status === 'running'
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
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

