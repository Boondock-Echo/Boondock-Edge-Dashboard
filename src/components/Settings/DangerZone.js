import React, { useState, useEffect, useRef } from 'react';
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

import cardStyles from '../ui/Card.module.css';
import buttonStyles from '../ui/Button.module.css';
import listStyles from '../ui/List.module.css';
import modalStyles from '../ui/Modal.module.css';
const DangerZone = ({ showToast }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const deleteDialogRef = useRef(null);

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

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (showDeleteModal && !dialog.open) dialog.showModal();
    if (!showDeleteModal && dialog.open) dialog.close();
  }, [showDeleteModal]);


  // Enhanced color utility function
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


  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={AlertTriangle}
        title="Danger Zone"
        description="Critical system operations with irreversible actions. Use with extreme caution."
        iconColor="red"
      />

      {/* Action Cards */}
      <div className="gridTwo">
        {/* Cache Management Card */}
        <div >
          <div className="row">
            <div >
              <DatabaseZap className="iconLarge" />
            </div>
            <div className="grow">
              <h3 className="pageTitle">
                Cache Management
              </h3>
              <p className="mutedText smallText">
                Clear local storage cache to free up space. This will remove stored messages, channels, and other cached data.
              </p>
              <p className="mutedText tinyText">
                Current Cache Size: {formatBytes(cacheSize)}
              </p>
            </div>
            <button
              onClick={clearCache}
              disabled={isClearingCache || cacheSize === 0}
              className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
            >
              {isClearingCache ? (
                <>
                  <span className="spinner spinnerSmall" aria-hidden="true" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="iconMedium" />
                  Clear Cache
                </>
              )}
            </button>
          </div>
        </div>
        {/* Delete Recordings Card */}
        <div className={cardStyles.card}>
          <div className="row">
            <div >
              <Radio className="iconLarge" />
            </div>
            <div className="grow">
              <h3 className="pageTitle">
                Delete Broadcast Recordings
              </h3>
              <p className="mutedText smallText">
                Permanently remove all saved radio broadcasts and recording sessions.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
            >
              <Trash2 className="iconMedium" />
              Delete
            </button>
          </div>
        </div>
        {/* Clear Logs Card */}
        <div >
          <div className="row">
            <div >
              <Waves className="iconLarge" />
            </div>
            <div className="grow">
              <h3 className="pageTitle">
                Clear Broadcasting Logs
              </h3>
              <p className="mutedText smallText">
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
              className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
            >
              <AlertCircle className="iconMedium" />
              Clear
            </button>
          </div>
        </div>
      </div>
      {/* Confirmation Modal */}
      {showDeleteModal && (
        <dialog
          ref={deleteDialogRef}
          className={modalStyles.dialog}
          onCancel={(event) => { event.preventDefault(); if (!isLoading) setShowDeleteModal(false); }}
        >
          <div className={modalStyles.body}>
            <div className="rowBetween">
              <div className="row">
                <div >
                  <AlertTriangle className="iconLarge" />
                </div>
                <h3 className="pageTitle">
                  Confirm Deletion
                </h3>
              </div>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
              >
                <XCircle className="iconLarge" />
              </button>
            </div>

            <div >
              <p >This action will delete:</p>
              <ul className={listStyles.list}>
                <li>All saved radio broadcasts</li>
                <li>Recording session data</li>
                <li>Associated metadata and timestamps</li>
              </ul>
            </div>

            <div className="rowWrap">
              <button
                onClick={() => setShowDeleteModal(false)}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecordings}
                className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner spinnerSmall" aria-hidden="true" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="iconMedium" />
                    Delete Recordings
                  </>
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}
       {/* <EventManagement /> */}
    </div>
    
  );
};

export default DangerZone;