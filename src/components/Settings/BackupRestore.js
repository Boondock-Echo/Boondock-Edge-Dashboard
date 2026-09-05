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
const Toggle = ({ checked, onChange, label, icon: Icon, description, metric, isDarkMode }) => (
  <div className="group relative">
    <button
      onClick={() => onChange(!checked)}
      className={`w-full p-5 rounded-xl border-2 transition-all duration-300 transform hover:scale-102 ${
        checked 
          ? isDarkMode
            ? 'bg-blue-900/30 border-blue-400 shadow-lg'
            : 'bg-blue-50 border-blue-500 shadow-lg'
          : isDarkMode
            ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl transition-all duration-300 ${
            checked 
              ? isDarkMode 
                ? 'bg-blue-500/20 shadow-inner' 
                : 'bg-blue-500 shadow-inner'
              : isDarkMode 
                ? 'bg-gray-700' 
                : 'bg-gray-100'
          }`}>
            <Icon size={24} className={checked 
              ? isDarkMode 
                ? 'text-blue-300' 
                : 'text-white'
              : isDarkMode 
                ? 'text-gray-400' 
                : 'text-gray-500'
            } />
          </div>
          <div className="text-left">
            <h4 className={`font-semibold text-lg ${
              isDarkMode 
                ? checked 
                  ? 'text-blue-300' 
                  : 'text-gray-300'
                : checked 
                  ? 'text-blue-900' 
                  : 'text-gray-700'
            }`}>
              {label}
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {description}
            </p>
            {metric && (
              <div className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isDarkMode 
                  ? 'bg-blue-900/50 text-blue-300' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {metric}
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${
            checked 
              ? isDarkMode 
                ? 'bg-blue-500' 
                : 'bg-blue-500'
              : isDarkMode 
                ? 'bg-gray-700' 
                : 'bg-gray-200'
          }`}>
            <div className={`absolute w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 top-0.5 ${
              checked ? 'translate-x-6 left-1' : 'translate-x-0 left-1'
            }`} />
          </div>
        </div>
      </div>
    </button>
  </div>
);

const BackupRestore = ({ isDarkMode, showToast, globalSettings, handleGlobalChange, handleBackupNow }) => {
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
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (status === 'error' || status === 'failed') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else if (status === 'running') {
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    return <Clock className="w-5 h-5 text-gray-500" />;
  };

  const getStatusText = (status) => {
    if (status === 'completed' || status === 'success') return 'Success';
    if (status === 'error' || status === 'failed') return 'Failed';
    if (status === 'running') return 'Running';
    return 'Unknown';
  };

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={Database}
        title="Backup & Restore"
        description="Manage your backups and restore data from Boondock Cloud storage"
        isDarkMode={isDarkMode}
        iconColor="blue"
      />
      
      <div className="flex gap-3 justify-end mb-4">
            <button
              onClick={handleBackupNowClick}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Cloud className="w-5 h-5" />
              Backup Now
            </button>
            <button
              onClick={handleRestore}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Download className="w-5 h-5" />
              Restore
            </button>
            <button
              onClick={() => {
                setRefreshing(true);
                fetchBackupHistory().finally(() => setRefreshing(false));
              }}
              disabled={refreshing}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
      </div>

      {/* Backup History */}
      <div className={`rounded-xl shadow-lg p-6 ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          Backup History
        </h3>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : backupHistory.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No backup history found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Date & Time
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Status
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Files Uploaded
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Files Skipped
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Errors
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Duration
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Type
                    </th>
                    <th className={`text-left py-3 px-4 font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Destination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backupHistory.map((backup, index) => (
                    <tr
                      key={index}
                      className={`border-b ${isDarkMode ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {formatDate(backup.start_time || backup.timestamp)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(backup.status)}
                          <span className={`
                            ${backup.status === 'completed' || backup.status === 'success' ? 'text-green-500' : ''}
                            ${backup.status === 'error' || backup.status === 'failed' ? 'text-red-500' : ''}
                            ${backup.status === 'running' ? 'text-blue-500' : ''}
                          `}>
                            {getStatusText(backup.status)}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {backup.uploaded_files || backup.files_uploaded || 0}
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {backup.skipped_files || backup.files_skipped || 0}
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {backup.error_files || backup.files_errors || 0}
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {backup.duration ? `${backup.duration}s` : 'N/A'}
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className={`px-2 py-1 rounded text-xs ${
                          backup.manual 
                            ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700')
                            : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')
                        }`}>
                          {backup.manual ? 'Manual' : 'Scheduled'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className={`px-2 py-1 rounded text-xs ${
                          isDarkMode ? 'bg-purple-900/40 text-purple-200' : 'bg-purple-50 text-purple-700'
                        }`}>
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
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 ${
                      currentPage === 1
                        ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                        : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 ${
                      currentPage === totalPages
                        ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                        : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
                    }`}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
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
        isDarkMode={isDarkMode}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        isDarkMode={isDarkMode}
        showToast={showToast}
      />

      {/* Boondock Cloud Storage + Samba / Network Drive Backup */}
      {globalSettings && handleGlobalChange && (
        <div className={`rounded-2xl shadow-lg p-8 transition-all duration-300 border ${
          isDarkMode
            ? 'bg-gray-900/60 border-gray-800'
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-4 mb-8">
            <div className={`p-3 rounded-2xl shadow-md ${isDarkMode ? 'bg-green-600' : 'bg-green-500'}`}>
              <Cloud size={24} className="text-white" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Backup Destinations
              </h2>
              <p className={`mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Configure cloud storage and optional Samba / network drive mirroring for your nightly backups.
              </p>
            </div>
          </div>

          <div className="space-y-10">
            {/* Boondock Cloud configuration */}
            <div className="space-y-6">
              <Toggle
                checked={globalSettings.global_enable_s3_upload}
                onChange={(checked) => handleGlobalChange("global_enable_s3_upload", checked)}
                label="Enable Boondock Cloud Upload"
                icon={Cloud}
                description="Automatically sync audio files to Boondock Cloud-compatible cloud storage. Files are uploaded after local save."
                isDarkMode={isDarkMode}
              />
              
              {/* Boondock Cloud Configuration - Only show when Boondock Cloud upload is enabled */}
              {globalSettings.global_enable_s3_upload && (
                <div className={`ml-12 p-5 rounded-xl border-2 transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="space-y-4">
                    {/* Boondock Cloud Endpoint URL */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-green-500" />
                          Boondock Cloud Endpoint URL
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_endpoint_url || ""}
                        onChange={(e) => handleGlobalChange("s3_endpoint_url", e.target.value)}
                        placeholder="https://s3.example.com"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        The Boondock Cloud-compatible storage endpoint URL (e.g., https://s3.amazonaws.com or custom endpoint)
                      </p>
                    </div>

                    {/* Boondock Cloud Access Key */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <DatabaseZap size={16} className="text-green-500" />
                          Boondock Cloud Access Key
                        </div>
                      </label>
                      <input
                        type="password"
                        value={globalSettings.s3_access_key || ""}
                        onChange={(e) => handleGlobalChange("s3_access_key", e.target.value)}
                        placeholder="Enter access key"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Your Boondock Cloud access key ID. This field is hidden for security.
                      </p>
                    </div>

                    {/* Boondock Cloud Secret Key */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <DatabaseZap size={16} className="text-green-500" />
                          Boondock Cloud Secret Key
                        </div>
                      </label>
                      <input
                        type="password"
                        value={globalSettings.s3_secret_key || ""}
                        onChange={(e) => handleGlobalChange("s3_secret_key", e.target.value)}
                        placeholder="Enter secret key"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Your Boondock Cloud secret access key. This field is hidden for security.
                      </p>
                    </div>

                    {/* Boondock Cloud Region */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Globe size={16} className="text-green-500" />
                          Boondock Cloud Region
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_region || "us-east-1"}
                        onChange={(e) => handleGlobalChange("s3_region", e.target.value)}
                        placeholder="us-east-1"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        The Boondock Cloud region (e.g., us-east-1, eu-west-1). Default is us-east-1.
                      </p>
                    </div>

                    {/* Boondock Cloud Bucket Name */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <DatabaseZap size={16} className="text-green-500" />
                          Boondock Cloud Bucket Name
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.s3_bucket_name || ""}
                        onChange={(e) => handleGlobalChange("s3_bucket_name", e.target.value)}
                        placeholder="my-bucket-name"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        The default Boondock Cloud bucket name for storing all client audio files. Files will be organized by MAC address within this bucket.
                      </p>
                    </div>

                    {/* Boondock Cloud Backup Time */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-green-500" />
                          Backup Time
                        </div>
                      </label>
                      <input
                        type="time"
                        value={globalSettings.s3_backup_time || "03:00"}
                        onChange={(e) => handleGlobalChange("s3_backup_time", e.target.value)}
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-green-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500'
                        } focus:ring focus:ring-green-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Daily backup time for audio files, database, and logs. Default is 3:00 AM. Backups run automatically in the background.
                      </p>
                    </div>

                    {/* Backup Now Button */}
                    {handleBackupNow && (
                      <div className="mt-6">
                        <button
                          onClick={() => handleBackupNow()}
                          className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 ${
                            isDarkMode
                              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                              : 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Cloud size={18} />
                            Backup Now
                          </div>
                        </button>
                        <p className={`mt-2 text-xs text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Start an immediate backup of all audio files, database, and logs to Boondock Cloud.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Samba / Network Drive Backup */}
            <div className={`rounded-2xl shadow-inner p-6 border-2 ${
              isDarkMode
                ? 'bg-gray-900/40 border-gray-700'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-600' : 'bg-indigo-500'} shadow-md`}>
                  <HardDrive size={20} className="text-white" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    Samba / Network Drive Backup
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Optionally mirror nightly backups to a Samba network share or NAS in your local environment.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Enable Samba Backup */}
                <Toggle
                  checked={globalSettings.samba_backup_enabled}
                  onChange={(checked) => handleGlobalChange("samba_backup_enabled", checked)}
                  label="Enable Samba / Network Drive Backup"
                  icon={HardDrive}
                  description="Copy database, audio recordings, and logs to a Samba network share as part of the nightly backup."
                  isDarkMode={isDarkMode}
                />

                {globalSettings.samba_backup_enabled && (
                  <div className={`ml-12 p-5 rounded-xl border-2 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-gray-800/60 border-gray-700'
                      : 'bg-white border-gray-200'
                  }`}>
                    {/* Samba Share Path */}
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <Server size={16} className="text-indigo-500" />
                          Samba Share Path
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.samba_share_path || ""}
                        onChange={(e) => handleGlobalChange("samba_share_path", e.target.value)}
                        placeholder="e.g. /mnt/boondock-backups or //SERVER/Share/boondock"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-indigo-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                        } focus:ring focus:ring-indigo-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        This should be a path that the device can write to. In most setups, the Samba share is mounted by the OS and exposed as a local folder.
                      </p>
                    </div>

                    {/* Samba Username */}
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <DatabaseZap size={16} className="text-indigo-500" />
                          Samba Username (optional)
                        </div>
                      </label>
                      <input
                        type="text"
                        value={globalSettings.samba_username || ""}
                        onChange={(e) => handleGlobalChange("samba_username", e.target.value)}
                        placeholder="Enter Samba username"
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-indigo-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                        } focus:ring focus:ring-indigo-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Stored for configuration reference. In most deployments the share is mounted by the OS using these credentials.
                      </p>
                    </div>

                    {/* Samba Password */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex items-center gap-2">
                          <DatabaseZap size={16} className="text-indigo-500" />
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
                        className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500 focus:border-indigo-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                        } focus:ring focus:ring-indigo-200/50`}
                      />
                      <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {globalSettings.samba_password === '***' 
                          ? 'Password is stored on the device. Click the field to change it.'
                          : 'Password is stored on the device and never returned in clear text to the browser.'}
                      </p>
                    </div>

                    {/* Test Connection Button */}
                    <div className="mt-6">
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
                        className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                          testingSamba || !globalSettings.samba_share_path
                            ? isDarkMode
                              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : isDarkMode
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                              : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-md hover:shadow-lg'
                        }`}
                      >
                        {testingSamba ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <Plug className="w-5 h-5" />
                            Test Connection
                          </>
                        )}
                      </button>
                      
                      {/* Test Result Display */}
                      {sambaTestResult && (
                        <div className={`mt-4 p-4 rounded-xl border-2 ${
                          sambaTestResult.success
                            ? isDarkMode
                              ? 'bg-green-900/30 border-green-700'
                              : 'bg-green-50 border-green-200'
                            : isDarkMode
                              ? 'bg-red-900/30 border-red-700'
                              : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-start gap-3">
                            {sambaTestResult.success ? (
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className={`font-medium text-sm ${
                                sambaTestResult.success
                                  ? isDarkMode ? 'text-green-300' : 'text-green-800'
                                  : isDarkMode ? 'text-red-300' : 'text-red-800'
                              }`}>
                                {sambaTestResult.message}
                              </p>
                              {sambaTestResult.details && (
                                <div className={`mt-2 text-xs space-y-1 ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>
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
                                    <p className="text-red-500">Error: {sambaTestResult.details.error}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <p className={`mt-2 text-xs text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
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

