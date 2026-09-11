import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/apiClient';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import modalStyles from '../ui/Modal.module.css';
import {
  X,
  Database,
  Settings as SettingsIcon,
  Music,
  ChevronRight,
  ChevronLeft,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  CheckSquare,
  Square
} from 'lucide-react';

const RestoreModal = ({ isOpen, onClose, showToast }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({});
  const dialogRef = useRef(null);
  
  // Step 1: Settings files
  const [settingsFiles, setSettingsFiles] = useState([]);
  const [selectedSettingsFiles, setSelectedSettingsFiles] = useState([]);
  
  // Step 2: Database files
  const [databaseFiles, setDatabaseFiles] = useState([]);
  const [selectedDatabaseFiles, setSelectedDatabaseFiles] = useState([]);
  
  // Step 3: Audio files
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [years, setYears] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [days, setDays] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);
  const [audioFilesCount, setAudioFilesCount] = useState(0);
  
  useEffect(() => {
    if (isOpen) {
      resetModal();
      loadSettingsFiles();
      loadDatabaseFiles();
      loadChannels();
    }
  }, [isOpen]);

  const resetModal = () => {
    setCurrentStep(1);
    setSelectedSettingsFiles([]);
    setSelectedDatabaseFiles([]);
    setSelectedChannel(null);
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedDays([]);
    setRestoreProgress({});
  };

  const loadSettingsFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/s3/restore/list?type=settings`);
      setSettingsFiles(response.data.files || []);
    } catch (error) {
      console.error('Error loading settings files:', error);
      showToast('Error loading settings files', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseFiles = async () => {
    try {
      const response = await api.get(`/s3/restore/list?type=database`);
      setDatabaseFiles(response.data.files || []);
    } catch (error) {
      console.error('Error loading database files:', error);
      showToast('Error loading database files', 'error');
    }
  };

  const loadChannels = async () => {
    try {
      const response = await api.get(`/s3/restore/channels`);
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error('Error loading channels:', error);
      showToast('Error loading channels', 'error');
    }
  };

  const loadYears = async (channelMac) => {
    try {
      const response = await api.get(`/s3/restore/years?channel=${channelMac}`);
      setYears(response.data.years || []);
    } catch (error) {
      console.error('Error loading years:', error);
      showToast('Error loading years', 'error');
    }
  };

  const loadMonths = async (channelMac, years) => {
    try {
      // Load months for all selected years
      const allMonths = new Set();
      for (const year of years) {
        const response = await api.get(`/s3/restore/months?channel=${channelMac}&year=${year}`);
        (response.data.months || []).forEach(month => allMonths.add(month));
      }
      setMonths(Array.from(allMonths).sort());
    } catch (error) {
      console.error('Error loading months:', error);
      showToast('Error loading months', 'error');
    }
  };

  const loadDays = async (channelMac, years, months) => {
    try {
      // Load days for all selected year/month combinations
      const allDays = new Set();
      let totalCount = 0;
      for (const year of years) {
        for (const month of months) {
          const response = await api.get(`/s3/restore/days?channel=${channelMac}&year=${year}&month=${month}`);
          (response.data.days || []).forEach(day => allDays.add(`${year}-${month}-${day}`));
          totalCount += response.data.file_count || 0;
        }
      }
      setDays(Array.from(allDays).sort());
      setAudioFilesCount(totalCount);
    } catch (error) {
      console.error('Error loading days:', error);
      showToast('Error loading days', 'error');
    }
  };

  useEffect(() => {
    if (selectedChannel && currentStep === 3) {
      loadYears(selectedChannel.mac_address);
      setSelectedYears([]);
      setSelectedMonths([]);
      setSelectedDays([]);
    }
  }, [selectedChannel, currentStep]);

  useEffect(() => {
    if (selectedChannel && selectedYears.length > 0 && currentStep === 3) {
      loadMonths(selectedChannel.mac_address, selectedYears);
      setSelectedMonths([]);
      setSelectedDays([]);
    } else if (selectedYears.length === 0) {
      setMonths([]);
      setSelectedMonths([]);
      setSelectedDays([]);
    }
  }, [selectedChannel, selectedYears, currentStep]);

  useEffect(() => {
    if (selectedChannel && selectedYears.length > 0 && selectedMonths.length > 0 && currentStep === 3) {
      loadDays(selectedChannel.mac_address, selectedYears, selectedMonths);
      setSelectedDays([]);
    } else if (selectedMonths.length === 0) {
      setDays([]);
      setSelectedDays([]);
    }
  }, [selectedChannel, selectedYears, selectedMonths, currentStep]);

  const handleSettingsFileToggle = (file) => {
    setSelectedSettingsFiles(prev => {
      if (prev.includes(file)) {
        return prev.filter(f => f !== file);
      }
      return [...prev, file];
    });
  };

  const handleSelectAllSettings = () => {
    if (selectedSettingsFiles.length === settingsFiles.length) {
      setSelectedSettingsFiles([]);
    } else {
      setSelectedSettingsFiles([...settingsFiles]);
    }
  };

  const handleDatabaseFileToggle = (file) => {
    setSelectedDatabaseFiles(prev => {
      if (prev.includes(file)) {
        return prev.filter(f => f !== file);
      }
      return [...prev, file];
    });
  };

  const handleSelectAllDatabase = () => {
    if (selectedDatabaseFiles.length === databaseFiles.length) {
      setSelectedDatabaseFiles([]);
    } else {
      setSelectedDatabaseFiles([...databaseFiles]);
    }
  };

  const handleYearToggle = (year) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      return [...prev, year];
    });
  };

  const handleSelectAllYears = () => {
    if (selectedYears.length === years.length) {
      setSelectedYears([]);
    } else {
      setSelectedYears([...years]);
    }
  };

  const handleMonthToggle = (month) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      }
      return [...prev, month];
    });
  };

  const handleSelectAllMonths = () => {
    if (selectedMonths.length === months.length) {
      setSelectedMonths([]);
    } else {
      setSelectedMonths([...months]);
    }
  };

  const handleDayToggle = (day) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      return [...prev, day];
    });
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === days.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...days]);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      setRestoreProgress({ status: 'starting', message: 'Starting restore process...' });

      // Parse selected days back into year/month/day format
      const parsedDays = selectedDays.map(dayStr => {
        const [year, month, day] = dayStr.split('-');
        return { year, month, day };
      });

      const restoreData = {
        settings_files: selectedSettingsFiles,
        database_files: selectedDatabaseFiles,
        audio_files: selectedChannel && selectedYears.length > 0 && selectedMonths.length > 0 && selectedDays.length > 0 ? {
          channel_mac: selectedChannel.mac_address,
          channel_name: selectedChannel.name,
          years: selectedYears,
          months: selectedMonths,
          days: parsedDays
        } : null
      };

      const response = await api.post(`/s3/restore/execute`, restoreData, {
        timeout: 300000 // 5 minutes timeout
      });

      setRestoreProgress({ status: 'completed', message: 'Restore completed successfully!' });
      showToast('Restore completed successfully!', 'success');
      
      setTimeout(() => {
        onClose();
        resetModal();
      }, 2000);
    } catch (error) {
      console.error('Error during restore:', error);
      setRestoreProgress({ status: 'error', message: error.response?.data?.error || 'Restore failed' });
      showToast('Restore failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      return true; // Can always proceed from step 1
    }
    if (currentStep === 2) {
      return true; // Can always proceed from step 2
    }
    if (currentStep === 3) {
      return selectedChannel && selectedYears.length > 0 && selectedMonths.length > 0 && selectedDays.length > 0;
    }
    return false;
  };

  const hasSelections = () => {
    return selectedSettingsFiles.length > 0 || 
           selectedDatabaseFiles.length > 0 || 
           (selectedChannel && selectedYears.length > 0 && selectedMonths.length > 0 && selectedDays.length > 0);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className={`${modalStyles.dialog} ${modalStyles.wide}`} onCancel={(event) => { event.preventDefault(); if (!restoring) onClose(); }}>
      <div className={modalStyles.body}>
        {/* Header */}
        <div className="rowBetween">
          <div className="row">
            <Database className="iconLarge" />
            <h2 className="pageTitle">
              Restore Data
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={restoring}
            className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.icon}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div >
          <div className="rowBetween">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="row">
                  <div className="row">
                    {currentStep > step ? <CheckCircle className="iconMedium" /> : step}
                  </div>
                  <span className="pill pillAccent">
                    {step === 1 ? 'Settings' : step === 2 ? 'Database' : 'Audio Files'}
                  </span>
                </div>
                {step < 3 && (
                  <ChevronRight className="iconMedium" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="grow scrollY">
          {loading && (
            <div className="row">
              <Loader2 className="iconLarge spin" />
            </div>
          )}

          {/* Step 1: Settings */}
          {currentStep === 1 && !loading && (
            <div className="stack">
              <div className="row">
                <SettingsIcon className="iconLarge" />
                <h3 className={cardStyles.title}>
                  Select Settings Files to Restore
                </h3>
              </div>
              <p className="mutedText smallText">
                Choose which settings files you want to restore from Boondock Cloud backup.
              </p>
              
              {settingsFiles.length === 0 ? (
                <div className="centeredContent mutedText smallText">
                  <FileText className="iconLarge" />
                  <p>No settings files found in Boondock Cloud</p>
                </div>
              ) : (
                <>
                  <div className="rowBetween">
                    <button
                      onClick={handleSelectAllSettings}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      {selectedSettingsFiles.length === settingsFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="mutedText smallText">
                      {selectedSettingsFiles.length} of {settingsFiles.length} selected
                    </span>
                  </div>
                  <div className="scrollPanel">
                    {settingsFiles.map((file, index) => (
                      <label
                        key={index}
                        className={formStyles.checkbox}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSettingsFiles.includes(file)}
                          onChange={() => handleSettingsFileToggle(file)}
                        />
                        {selectedSettingsFiles.includes(file) ? (
                          <CheckSquare className="iconMedium" />
                        ) : (
                          <Square className="iconMedium" />
                        )}
                        <FileText className="iconMedium" />
                        <span className="mutedText smallText">
                          {file}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Database */}
          {currentStep === 2 && !loading && (
            <div className="stack">
              <div className="row">
                <Database className="iconLarge" />
                <h3 className={cardStyles.title}>
                  Select Database Files to Restore
                </h3>
              </div>
              <p className="mutedText smallText">
                Choose which database files you want to restore from Boondock Cloud backup.
              </p>
              
              {databaseFiles.length === 0 ? (
                <div className="centeredContent mutedText smallText">
                  <Database className="iconLarge" />
                  <p>No database files found in Boondock Cloud</p>
                </div>
              ) : (
                <>
                  <div className="rowBetween">
                    <button
                      onClick={handleSelectAllDatabase}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      {selectedDatabaseFiles.length === databaseFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="mutedText smallText">
                      {selectedDatabaseFiles.length} of {databaseFiles.length} selected
                    </span>
                  </div>
                  <div className="scrollPanel">
                    {databaseFiles.map((file, index) => (
                      <label
                        key={index}
                        className={formStyles.checkbox}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDatabaseFiles.includes(file)}
                          onChange={() => handleDatabaseFileToggle(file)}
                        />
                        {selectedDatabaseFiles.includes(file) ? (
                          <CheckSquare className="iconMedium" />
                        ) : (
                          <Square className="iconMedium" />
                        )}
                        <Database className="iconMedium" />
                        <span className="mutedText smallText">
                          {file}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Audio Files */}
          {currentStep === 3 && !loading && (
            <div className="stack stackLarge">
              <div className="row">
                <Music className="iconLarge" />
                <h3 className={cardStyles.title}>
                  Select Audio Files to Restore
                </h3>
              </div>
              <p className="mutedText smallText">
                Select a channel, then choose the year, month, and days to restore audio files.
              </p>

              {/* Channel Selection */}
              <div>
                <label className={formStyles.label}>
                  Channel
                </label>
                <select
                  value={selectedChannel?.mac_address || ''}
                  onChange={(e) => {
                    const channel = channels.find(c => c.mac_address === e.target.value);
                    setSelectedChannel(channel || null);
                    setSelectedYears([]);
                    setSelectedMonths([]);
                    setSelectedDays([]);
                  }}
                  className={formStyles.select}
                >
                  <option value="">Select a channel...</option>
                  {channels.map((channel, index) => (
                    <option key={index} value={channel.mac_address}>
                      {channel.name} ({channel.mac_address}) - {channel.file_count || 0} files
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Selection */}
              {selectedChannel && (
                <div>
                  <div className="rowBetween">
                    <label className={formStyles.label}>
                      Years
                    </label>
                    <button
                      onClick={handleSelectAllYears}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      {selectedYears.length === years.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="scrollPanel">
                    {years.map((year, index) => (
                      <label
                        key={index}
                        className={formStyles.checkbox}
                      >
                        <input
                          type="checkbox"
                          checked={selectedYears.includes(year)}
                          onChange={() => handleYearToggle(year)}
                        />
                        {selectedYears.includes(year) ? (
                          <CheckSquare className="iconMedium" />
                        ) : (
                          <Square className="iconMedium" />
                        )}
                        <span className="mutedText smallText">
                          {year}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Month Selection */}
              {selectedChannel && selectedYears.length > 0 && (
                <div>
                  <div className="rowBetween">
                    <label className={formStyles.label}>
                      Months
                    </label>
                    <button
                      onClick={handleSelectAllMonths}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      {selectedMonths.length === months.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="scrollPanel">
                    {months.map((month, index) => (
                      <label
                        key={index}
                        className={formStyles.checkbox}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(month)}
                          onChange={() => handleMonthToggle(month)}
                        />
                        {selectedMonths.includes(month) ? (
                          <CheckSquare className="iconMedium" />
                        ) : (
                          <Square className="iconMedium" />
                        )}
                        <span className="mutedText smallText">
                          {new Date(2000, parseInt(month) - 1).toLocaleString('default', { month: 'short' })} ({month})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Days Selection */}
              {selectedChannel && selectedYears.length > 0 && selectedMonths.length > 0 && (
                <div>
                  <div className="rowBetween">
                    <label className={formStyles.label}>
                      Days ({audioFilesCount} files available)
                    </label>
                    <button
                      onClick={handleSelectAllDays}
                      className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                    >
                      {selectedDays.length === days.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="scrollPanel">
                    {days.map((dayStr, index) => {
                      const [, , day] = dayStr.split('-');
                      return (
                        <label
                          key={index}
                          className={formStyles.checkbox}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(dayStr)}
                            onChange={() => handleDayToggle(dayStr)}
                          />
                          {selectedDays.includes(dayStr) ? (
                            <CheckSquare className="iconMedium" />
                          ) : (
                            <Square className="iconMedium" />
                          )}
                          <span className="mutedText tinyText">
                            {day}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Restore Progress */}
          {restoreProgress.status && (
            <div >
              <div className="row">
                {restoreProgress.status === 'completed' ? (
                  <CheckCircle className="iconMedium" />
                ) : restoreProgress.status === 'error' ? (
                  <AlertCircle className="iconMedium" />
                ) : (
                  <Loader2 className="iconMedium spin" />
                )}
                <span className="pill pillSuccess">
                  {restoreProgress.message}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="rowBetween">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || restoring}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
          >
            <ChevronLeft className="iconMedium" />
            Previous
          </button>

          <div className="rowWrap">
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToNextStep() || restoring}
                className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
              >
                Next
                <ChevronRight className="iconMedium" />
              </button>
            ) : (
              <button
                onClick={handleRestore}
                disabled={!hasSelections() || restoring}
                className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
              >
                {restoring ? (
                  <>
                    <Loader2 className="iconMedium spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Download className="iconMedium" />
                    Restore Selected
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default RestoreModal;
