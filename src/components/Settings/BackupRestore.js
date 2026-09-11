import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import { 
  Database, 
  Cloud, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Music,
  Settings as SettingsIcon,
  AlertCircle,
  Server,
  DatabaseZap,
  Globe,
  HardDrive,
  Plug
} from 'lucide-react';
import BackupProgressModal from './BackupProgressModal';
import RestoreModal from './RestoreModal';
import SettingsSectionHeader from './SettingsSectionHeader';

// Toggle component
const Toggle = ({ checked, onChange, label, icon: Icon, description, metric, }) => (
  <div >
    <button
      onClick={() => onChange(!checked)}
      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
    >
      <div className="rowBetween">
        <div className="row">
          <div className={cardStyles.card}>
            <Icon size={24}  />
          </div>
          <div >
            <h4 className="pageTitle">
              {label}
            </h4>
            <p className="mutedText smallText">
              {description}
            </p>
            {metric && (
              <div className="row">
                {metric}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  </div>
);

const BackupRestore = ({  showToast, globalSettings, handleGlobalChange, handleBackupNow }) => {
  const [backupHistory, setBackupHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testingSamba, setTestingSamba] = useState(false);
  const [sambaTestResult, setSambaTestResult] = useState(null);
  
  const RECORDS_PER_PAGE = 10;

  useEffect(() => {
    fetchBackupHistory();
  }, [currentPage]);

  const fetchBackupHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/s3/backup/history?page=${currentPage}&per_page=${RECORDS_PER_PAGE}`
      );
      setBackupHistory(response.data.history || []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching backup history:', error);
      showToast('Error loading backup history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNowClick = () => {
    setShowBackupModal(true);
    if (handleBackupNow) {
      handleBackupNow();
    }
  };

  const handleBackupComplete = () => {
    setShowBackupModal(false);
    fetchBackupHistory();
  };

  const handleRestore = () => {
    setShowRestoreModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'completed' || status === 'success') {
      return <CheckCircle  />;
    } else if (status === 'error' || status === 'failed') {
      return <XCircle  />;
    } else if (status === 'running') {
      return <RefreshCw  />;
    }
    return <Clock  />;
  };

  const getStatusText = (status) => {
    if (status === 'completed' || status === 'success') return 'Success';
    if (status === 'error' || status === 'failed') return 'Failed';
    if (status === 'running') return 'Running';
    return 'Unknown';
  };

  return (
    <div className="stack">
      <SettingsSectionHeader
        icon={Database}
        title="Backup & Restore"
        description="Manage your backups and restore data from Boondock Cloud storage"
        iconColor="blue"
      />
      
      <div >
            <button
              onClick={handleBackupNowClick}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
            >
              <Cloud  />
              Backup Now
            </button>
            <button
              onClick={handleRestore}
              className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
            >
              <Download  />
              Restore
            </button>
            <button
              onClick={() => {
                setRefreshing(true);
                fetchBackupHistory().finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
            >
              <RefreshCw  />
            </button>
      </div>

      {/* Backup History */}
      <div className={cardStyles.card}>
        <h3 className="pageTitle">
          Backup History
        </h3>

        {loading ? (
          <div className="row">
            <RefreshCw  />
          </div>
        ) : backupHistory.length === 0 ? (
          <div >
            <Database  />
            <p>No backup history found</p>
          </div>
        ) : (
          <>
            <div >
              <table >
                <thead>
                  <tr >
                    <th >
                      Date & Time
                    </th>
                    <th >
                      Status
                    </th>
                    <th >
                      Files Uploaded
                    </th>
                    <th >
                      Files Skipped
                    </th>
                    <th >
                      Errors
                    </th>
                    <th >
                      Duration
                    </th>
                    <th >
                      Type
                    </th>
                    <th >
                      Destination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backupHistory.map((backup, index) => (
                    <tr
                      key={index}
                      
                    >
                      <td >
                        {formatDate(backup.start_time || backup.timestamp)}
                      </td>
                      <td >
                        <div className="row">
                          {getStatusIcon(backup.status)}
                          <span >
                            {getStatusText(backup.status)}
                          </span>
                        </div>
                      </td>
                      <td >
                        {backup.uploaded_files || backup.files_uploaded || 0}
                      </td>
                      <td >
                        {backup.skipped_files || backup.files_skipped || 0}
                      </td>
                      <td >
                        {backup.error_files || backup.files_errors || 0}
                      </td>
                      <td >
                        {backup.duration ? `${backup.duration}s` : 'N/A'}
                      </td>
                      <td >
                        <span className="mutedText smallText">
                          {backup.manual ? 'Manual' : 'Scheduled'}
                        </span>
                      </td>
                      <td >
                        <span className="mutedText smallText">
                          {(() => {
                            const dest = backup.destination || 'cloud';
                            if (dest === 'cloud') return 'Cloud';
                            if (dest === 'samba') return 'Samba';
                            if (dest === 'both') return 'Cloud + Samba';
                            return dest;
                          })()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="rowBetween">
                <div >
                  Page {currentPage} of {totalPages}
                </div>
                <div >
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                  >
                    <ChevronLeft  />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                  >
                    Next
                    <ChevronRight  />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backup Progress Modal */}
      <BackupProgressModal
        isOpen={showBackupModal}
        onClose={() => {
          setShowBackupModal(false);
          fetchBackupHistory();
        }}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        showToast={showToast}
      />

      {/* Boondock Cloud Storage + Samba / Network Drive Backup */}
      {globalSettings && handleGlobalChange && (
        <div >
          <div className="row">
            <div className={cardStyles.card}>
              <Cloud size={24}  />
            </div>
            <div>
              <h2 className="pageTitle">
                Backup Destinations
              </h2>
              <p className="mutedText smallText">
                Configure cloud storage and optional Samba / network drive mirroring for your nightly backups.
              </p>
            </div>
          </div>

          <div className="stack stackCompact">
            {/* Boondock Cloud configuration */}
            <div className="stack">
              <Toggle
                checked={globalSettings.global_enable_s3_upload}
                onChange={(checked) => handleGlobalChange("global_enable_s3_upload", checked)}
                label="Enable Boondock Cloud Upload"
                icon={Cloud}
                description="Automatically sync audio files to Boondock Cloud-compatible cloud storage. Files are uploaded after local save."
              />
              
              {/* Boondock Cloud Configuration - Only show when Boondock Cloud upload is enabled */}
              {globalSettings.global_enable_s3_upload && (
                <div className={cardStyles.card}>
                  <div className="stack">
                    {/* Boondock Cloud Endpoint URL */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <Server size={16}  />
                          Boondock Cloud Endpoint URL
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_endpoint_url || ""}
                        onChange={(e) => handleGlobalChange("s3_endpoint_url", e.target.value)}
                        placeholder="https://s3.example.com"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        The Boondock Cloud-compatible storage endpoint URL (e.g., https://s3.amazonaws.com or custom endpoint)
                      </p>
                    </div>

                    {/* Boondock Cloud Access Key */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <DatabaseZap size={16}  />
                          Boondock Cloud Access Key
                        </div>
                      </label>
                      <input
                        type="password"
                        value={globalSettings.s3_access_key || ""}
                        onChange={(e) => handleGlobalChange("s3_access_key", e.target.value)}
                        placeholder="Enter access key"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        Your Boondock Cloud access key ID. This field is hidden for security.
                      </p>
                    </div>

                    {/* Boondock Cloud Secret Key */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <DatabaseZap size={16}  />
                          Boondock Cloud Secret Key
                        </div>
                      </label>
                      <input
                        type="password"
                        value={globalSettings.s3_secret_key || ""}
                        onChange={(e) => handleGlobalChange("s3_secret_key", e.target.value)}
                        placeholder="Enter secret key"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        Your Boondock Cloud secret access key. This field is hidden for security.
                      </p>
                    </div>

                    {/* Boondock Cloud Region */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <Globe size={16}  />
                          Boondock Cloud Region
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_region || "us-east-1"}
                        onChange={(e) => handleGlobalChange("s3_region", e.target.value)}
                        placeholder="us-east-1"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        The Boondock Cloud region (e.g., us-east-1, eu-west-1). Default is us-east-1.
                      </p>
                    </div>

                    {/* Boondock Cloud Bucket Name */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <DatabaseZap size={16}  />
                          Boondock Cloud Bucket Name
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_bucket_name || ""}
                        onChange={(e) => handleGlobalChange("s3_bucket_name", e.target.value)}
                        placeholder="my-bucket-name"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        The default Boondock Cloud bucket name for storing all client audio files. Files will be organized by MAC address within this bucket.
                      </p>
                    </div>

                    {/* Boondock Cloud Backup Time */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <Clock size={16}  />
                          Backup Time
                        </div>
                      </label>
                      <input
                        type="time"
                        value={globalSettings.s3_backup_time || "03:00"}
                        onChange={(e) => handleGlobalChange("s3_backup_time", e.target.value)}
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        Daily backup time for audio files, database, and logs. Default is 3:00 AM. Backups run automatically in the background.
                      </p>
                    </div>

                    {/* Backup Now Button */}
                    {handleBackupNow && (
                      <div >
                        <button
                          onClick={() => handleBackupNow()}
                          className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
                        >
                          <div className="row">
                            <Cloud size={18} />
                            Backup Now
                          </div>
                        </button>
                        <p className="mutedText smallText">
                          Start an immediate backup of all audio files, database, and logs to Boondock Cloud.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Samba / Network Drive Backup */}
            <div className={cardStyles.card}>
              <div className="row">
                <div >
                  <HardDrive size={20}  />
                </div>
                <div>
                  <h3 className="pageTitle">
                    Samba / Network Drive Backup
                  </h3>
                  <p className="mutedText smallText">
                    Optionally mirror nightly backups to a Samba network share or NAS in your local environment.
                  </p>
                </div>
              </div>

              <div className="stack">
                {/* Enable Samba Backup */}
                <Toggle
                  checked={globalSettings.samba_backup_enabled}
                  onChange={(checked) => handleGlobalChange("samba_backup_enabled", checked)}
                  label="Enable Samba / Network Drive Backup"
                  icon={HardDrive}
                  description="Copy database, audio recordings, and logs to a Samba network share as part of the nightly backup."
                />

                {globalSettings.samba_backup_enabled && (
                  <div className={cardStyles.card}>
                    {/* Samba Share Path */}
                    <div >
                      <label className={formStyles.label}>
                        <div className="row">
                          <Server size={16}  />
                          Samba Share Path
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.samba_share_path || ""}
                        onChange={(e) => handleGlobalChange("samba_share_path", e.target.value)}
                        placeholder="e.g. /mnt/boondock-backups or //SERVER/Share/boondock"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        This should be a path that the device can write to. In most setups, the Samba share is mounted by the OS and exposed as a local folder.
                      </p>
                    </div>

                    {/* Samba Username */}
                    <div >
                      <label className={formStyles.label}>
                        <div className="row">
                          <DatabaseZap size={16}  />
                          Samba Username (optional)
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.samba_username || ""}
                        onChange={(e) => handleGlobalChange("samba_username", e.target.value)}
                        placeholder="Enter Samba username"
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        Stored for configuration reference. In most deployments the share is mounted by the OS using these credentials.
                      </p>
                    </div>

                    {/* Samba Password */}
                    <div>
                      <label className={formStyles.label}>
                        <div className="row">
                          <DatabaseZap size={16}  />
                          Samba Password (optional)
                        </div>
                      </label>
                      <input
                        type="password"
                        value={globalSettings.samba_password === '***' ? '******' : (globalSettings.samba_password || "")}
                        onChange={(e) => {
                          // If user clears the field or changes it from ******, send the new value
                          // If they're editing the masked password, treat it as a new password
                          const newValue = e.target.value === '******' ? '' : e.target.value;
                          handleGlobalChange("samba_password", newValue);
                        }}
                        onFocus={(e) => {
                          // When focusing on a masked password field, clear it so user can type new password
                          if (e.target.value === '******' || globalSettings.samba_password === '***') {
                            e.target.value = '';
                            handleGlobalChange("samba_password", '');
                          }
                        }}
                        placeholder={globalSettings.samba_password === '***' ? "Password is set (click to change)" : "Enter Samba password"}
                        className={formStyles.input}
                      />
                      <p className="mutedText smallText">
                        {globalSettings.samba_password === '***' 
                          ? 'Password is stored on the device. Click the field to change it.'
                          : 'Password is stored on the device and never returned in clear text to the browser.'}
                      </p>
                    </div>

                    {/* Test Connection Button */}
                    <div >
                      <button
                        onClick={async () => {
                          setTestingSamba(true);
                          setSambaTestResult(null);
                          try {
                            const response = await api.post(`/s3/backup/test-samba`, {
                              share_path: globalSettings.samba_share_path || '',
                              username: globalSettings.samba_username || '',
                              password: globalSettings.samba_password || ''
                            });
                            
                            setSambaTestResult(response.data);
                            if (response.data.success) {
                              showToast('Samba connection test successful!', 'success');
                            } else {
                              showToast(`Samba connection test failed: ${response.data.message}`, 'error');
                            }
                          } catch (error) {
                            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
                            setSambaTestResult({
                              success: false,
                              message: errorMessage,
                              details: { error: errorMessage }
                            });
                            showToast(`Samba connection test failed: ${errorMessage}`, 'error');
                          } finally {
                            setTestingSamba(false);
                          }
                        }}
                        disabled={testingSamba || !globalSettings.samba_share_path}
                        className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                      >
                        {testingSamba ? (
                          <>
                            <RefreshCw  />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <Plug  />
                            Test Connection
                          </>
                        )}
                      </button>
                      
                      {/* Test Result Display */}
                      {sambaTestResult && (
                        <div className={cardStyles.card}>
                          <div >
                            {sambaTestResult.success ? (
                              <CheckCircle  />
                            ) : (
                              <XCircle  />
                            )}
                            <div >
                              <p className="mutedText smallText">
                                {sambaTestResult.message}
                              </p>
                              {sambaTestResult.details && (
                                <div className="stack stackCompact">
                                  {sambaTestResult.details.path && (
                                    <p>Path: {sambaTestResult.details.path}</p>
                                  )}
                                  {sambaTestResult.details.exists !== undefined && (
                                    <p>Exists: {sambaTestResult.details.exists ? 'Yes' : 'No'}</p>
                                  )}
                                  {sambaTestResult.details.writable !== undefined && (
                                    <p>Writable: {sambaTestResult.details.writable ? 'Yes' : 'No'}</p>
                                  )}
                                  {sambaTestResult.details.error && (
                                    <p >Error: {sambaTestResult.details.error}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <p className="mutedText smallText">
                        Test the Samba share connection to verify the path is accessible and writable.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupRestore;
