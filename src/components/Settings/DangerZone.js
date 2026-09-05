import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import {
  AlertCircle,
  Trash2,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Radio,
  Waves,
  DatabaseZap
} from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

const DangerZone = ({ isDarkMode, showToast }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  const CACHE_KEYS = {
    CHANNELS: 'cached_channels',
    MESSAGES: 'cached_messages',
    KEYWORDS: 'cached_keywords',
    TIMEZONE: 'cached_timezone',
    LAST_FETCH: 'last_fetch_time'
  };

  const getCacheSize = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? new Blob([data]).size : 0;
    } catch (error) {
      return 0;
    }
  };

  const getTotalCacheSize = () => {
    try {
      let totalSize = 0;
      Object.values(CACHE_KEYS).forEach(key => {
        totalSize += getCacheSize(key);
      });
      return totalSize;
    } catch (error) {
      return 0;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearCache = () => {
    setIsClearingCache(true);
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      setCacheSize(0);
      showToast('Cache cleared successfully!', 'success');
    } catch (error) {
      console.error('Error clearing cache:', error);
      showToast('Error clearing cache!', 'error');
    } finally {
      setIsClearingCache(false);
    }
  };

  useEffect(() => {
    setCacheSize(getTotalCacheSize());
  }, []);

  // Enhanced color utility function
  const getColorScheme = () => {
    return {
      bgColor: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
      textColor: isDarkMode ? 'text-gray-100' : 'text-gray-800',
      cardBg: isDarkMode ? 'bg-gray-900/60' : 'bg-white',
      borderColor: isDarkMode ? 'border-gray-800' : 'border-red-200',
      warningColor: isDarkMode ? 'text-red-400' : 'text-red-600',
      warningBg: isDarkMode
        ? 'bg-red-900/30'
        : 'bg-red-100',
      shadowColor: isDarkMode 
        ? 'shadow-lg shadow-red-900/20' 
        : 'shadow-lg shadow-red-200/40'
    };
  };

  const handleDeleteRecordings = async () => {
    setIsLoading(true);
    try {
      await api.post(`/truncate_recordings`);
      showToast('Radio recordings deleted successfully!', 'success');
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting recordings:', error);
      showToast('Error deleting radio recordings!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const colors = getColorScheme();

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        icon={AlertTriangle}
        title="Danger Zone"
        description="Critical system operations with irreversible actions. Use with extreme caution."
        isDarkMode={isDarkMode}
        iconColor="red"
      />

      {/* Action Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Cache Management Card */}
        <div className={`${colors.cardBg} rounded-2xl p-6 
          border ${colors.borderColor} 
          hover:scale-[1.02] hover:rotate-1 transition-all duration-300 
          ${colors.shadowColor}`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${colors.warningBg}`}>
              <DatabaseZap className={`h-8 w-8 ${colors.warningColor}`} />
            </div>
            <div className="flex-grow">
              <h3 className={`text-xl font-bold mb-2 ${colors.textColor}`}>
                Cache Management
              </h3>
              <p className="text-sm opacity-70 mb-2">
                Clear local storage cache to free up space. This will remove stored messages, channels, and other cached data.
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Current Cache Size: {formatBytes(cacheSize)}
              </p>
            </div>
            <button
              onClick={clearCache}
              disabled={isClearingCache || cacheSize === 0}
              className={`px-5 py-2 rounded-lg 
                ${isClearingCache || cacheSize === 0
                  ? isDarkMode 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isDarkMode 
                    ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20' 
                    : 'bg-red-100 text-red-600 hover:bg-red-200'} 
                transition-all duration-300 hover:scale-105 flex items-center gap-2`}
            >
              {isClearingCache ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-5 w-5" />
                  Clear Cache
                </>
              )}
            </button>
          </div>
        </div>
        {/* Delete Recordings Card */}
        <div className={`${colors.cardBg} rounded-2xl p-6 border ${colors.borderColor} ${colors.shadowColor}`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${colors.warningBg}/20`}>
              <Radio className={`h-8 w-8 ${colors.warningColor}`} />
            </div>
            <div className="flex-grow">
              <h3 className={`text-xl font-bold mb-2 ${colors.textColor}`}>
                Delete Broadcast Recordings
              </h3>
              <p className="text-sm opacity-70">
                Permanently remove all saved radio broadcasts and recording sessions.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className={`px-5 py-2 rounded-lg 
                ${isDarkMode 
                  ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20' 
                  : 'bg-red-100 text-red-600 hover:bg-red-200'} 
                transition-all duration-300 hover:scale-105`}
            >
              <Trash2 className="h-5 w-5 mr-2 inline" />
              Delete
            </button>
          </div>
        </div>
        {/* Clear Logs Card */}
        <div className={`${colors.cardBg} rounded-2xl p-6 
          border ${colors.borderColor} 
          hover:scale-[1.02] hover:rotate-1 transition-all duration-300 
          ${colors.shadowColor}`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-full ${colors.warningBg}/20`}>
              <Waves className={`h-8 w-8 ${colors.warningColor}`} />
            </div>
            <div className="flex-grow">
              <h3 className={`text-xl font-bold mb-2 ${colors.textColor}`}>
                Clear Broadcasting Logs
              </h3>
              <p className="text-sm opacity-70">
                Remove all transmission logs and broadcast history data.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await api.post(`/logs_clear`);
                  showToast('Broadcasting logs cleared successfully!', 'success');
                } catch (err) {
                  showToast('Failed to clear broadcast logs.', 'error');                }
              }}
              className={`px-5 py-2 rounded-lg 
                ${isDarkMode 
                  ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20' 
                  : 'bg-red-100 text-red-600 hover:bg-red-200'} 
                transition-all duration-300 hover:scale-105`}
            >
              <AlertCircle className="h-5 w-5 mr-2 inline" />
              Clear
            </button>
          </div>
        </div>
      </div>
      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl ${colors.cardBg} p-8 
            border ${colors.borderColor} ${colors.shadowColor} 
            transform transition-all duration-300 scale-100 opacity-100`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-full p-4 ${colors.warningBg}/20`}>
                  <AlertTriangle className={`h-8 w-8 ${colors.warningColor} animate-pulse`} />
                </div>
                <h3 className={`text-2xl font-bold ${colors.textColor}`}>
                  Confirm Deletion
                </h3>
              </div>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-500 hover:text-red-500 transition-colors"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className={`rounded-2xl p-6 mb-6 
              ${isDarkMode ? 'bg-red-900/20' : 'bg-red-100/50'}`}>
              <p className="mb-4 font-semibold">This action will delete:</p>
              <ul className="list-disc list-inside space-y-2 text-sm opacity-80">
                <li>All saved radio broadcasts</li>
                <li>Recording session data</li>
                <li>Associated metadata and timestamps</li>
              </ul>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className={`px-6 py-2 rounded-lg 
                  ${isDarkMode 
                    ? 'text-gray-400 hover:bg-gray-800' 
                    : 'text-gray-600 hover:bg-gray-200'} 
                  transition-colors`}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecordings}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg 
                  ${isDarkMode 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-red-500 text-white hover:bg-red-600'} 
                  transition-colors`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Delete Recordings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
       {/* <EventManagement  edgeServerEndpoint={edgeServerEndpoint} isDarkMode={isDarkMode} /> */}
    </div>
    
  );
};

export default DangerZone;