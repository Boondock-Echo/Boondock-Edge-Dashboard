import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
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

const RestoreModal = ({ isOpen, onClose, isDarkMode, showToast }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({});
  
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`w-full max-w-4xl mx-4 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <Database className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`text-2xl font-bold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              Restore Data
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={restoring}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            } ${restoring ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep === step
                      ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                      : currentStep > step
                      ? (isDarkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white')
                      : (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                  }`}>
                    {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                  </div>
                  <span className={`text-sm font-medium ${
                    currentStep === step
                      ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                      : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                  }`}>
                    {step === 1 ? 'Settings' : step === 2 ? 'Database' : 'Audio Files'}
                  </span>
                </div>
                {step < 3 && (
                  <ChevronRight className={`w-5 h-5 ${
                    isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}

          {/* Step 1: Settings */}
          {currentStep === 1 && !loading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <SettingsIcon className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Select Settings Files to Restore
                </h3>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                Choose which settings files you want to restore from Boondock Cloud backup.
              </p>
              
              {settingsFiles.length === 0 ? (
                <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No settings files found in Boondock Cloud</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={handleSelectAllSettings}
                      className={`text-sm font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {selectedSettingsFiles.length === settingsFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedSettingsFiles.length} of {settingsFiles.length} selected
                    </span>
                  </div>
                  <div className={`space-y-2 max-h-96 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  } rounded-lg p-4`}>
                    {settingsFiles.map((file, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedSettingsFiles.includes(file)
                            ? (isDarkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                            : (isDarkMode ? 'hover:bg-gray-700 border border-gray-600' : 'hover:bg-gray-100 border border-gray-200')
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSettingsFiles.includes(file)}
                          onChange={() => handleSettingsFileToggle(file)}
                          className="hidden"
                        />
                        {selectedSettingsFiles.includes(file) ? (
                          <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Square className={`w-5 h-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                        <FileText className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`flex-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Database className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Select Database Files to Restore
                </h3>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                Choose which database files you want to restore from Boondock Cloud backup.
              </p>
              
              {databaseFiles.length === 0 ? (
                <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No database files found in Boondock Cloud</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={handleSelectAllDatabase}
                      className={`text-sm font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {selectedDatabaseFiles.length === databaseFiles.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedDatabaseFiles.length} of {databaseFiles.length} selected
                    </span>
                  </div>
                  <div className={`space-y-2 max-h-96 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  } rounded-lg p-4`}>
                    {databaseFiles.map((file, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedDatabaseFiles.includes(file)
                            ? (isDarkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                            : (isDarkMode ? 'hover:bg-gray-700 border border-gray-600' : 'hover:bg-gray-100 border border-gray-200')
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDatabaseFiles.includes(file)}
                          onChange={() => handleDatabaseFileToggle(file)}
                          className="hidden"
                        />
                        {selectedDatabaseFiles.includes(file) ? (
                          <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Square className={`w-5 h-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                        <Database className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`flex-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Music className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Select Audio Files to Restore
                </h3>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                Select a channel, then choose the year, month, and days to restore audio files.
              </p>

              {/* Channel Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
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
                  className={`w-full p-3 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
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
                  <div className="flex items-center justify-between mb-3">
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Years
                    </label>
                    <button
                      onClick={handleSelectAllYears}
                      className={`text-sm font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {selectedYears.length === years.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className={`grid grid-cols-4 gap-2 max-h-48 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  } rounded-lg p-4`}>
                    {years.map((year, index) => (
                      <label
                        key={index}
                        className={`flex items-center justify-center p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedYears.includes(year)
                            ? (isDarkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                            : (isDarkMode ? 'hover:bg-gray-700 border border-gray-600' : 'hover:bg-gray-100 border border-gray-200')
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedYears.includes(year)}
                          onChange={() => handleYearToggle(year)}
                          className="hidden"
                        />
                        {selectedYears.includes(year) ? (
                          <CheckSquare className="w-5 h-5 text-blue-500 mr-2" />
                        ) : (
                          <Square className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
                  <div className="flex items-center justify-between mb-3">
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Months
                    </label>
                    <button
                      onClick={handleSelectAllMonths}
                      className={`text-sm font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {selectedMonths.length === months.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className={`grid grid-cols-4 gap-2 max-h-48 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  } rounded-lg p-4`}>
                    {months.map((month, index) => (
                      <label
                        key={index}
                        className={`flex items-center justify-center p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedMonths.includes(month)
                            ? (isDarkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                            : (isDarkMode ? 'hover:bg-gray-700 border border-gray-600' : 'hover:bg-gray-100 border border-gray-200')
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(month)}
                          onChange={() => handleMonthToggle(month)}
                          className="hidden"
                        />
                        {selectedMonths.includes(month) ? (
                          <CheckSquare className="w-5 h-5 text-blue-500 mr-2" />
                        ) : (
                          <Square className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                        )}
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
                  <div className="flex items-center justify-between mb-3">
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Days ({audioFilesCount} files available)
                    </label>
                    <button
                      onClick={handleSelectAllDays}
                      className={`text-sm font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      {selectedDays.length === days.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className={`grid grid-cols-7 gap-2 max-h-64 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                  } rounded-lg p-4`}>
                    {days.map((dayStr, index) => {
                      const [, , day] = dayStr.split('-');
                      return (
                        <label
                          key={index}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedDays.includes(dayStr)
                              ? (isDarkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                              : (isDarkMode ? 'hover:bg-gray-700 border border-gray-600' : 'hover:bg-gray-100 border border-gray-200')
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(dayStr)}
                            onChange={() => handleDayToggle(dayStr)}
                            className="hidden"
                          />
                          {selectedDays.includes(dayStr) ? (
                            <CheckSquare className="w-5 h-5 text-blue-500 mb-1" />
                          ) : (
                            <Square className={`w-5 h-5 mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                          <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
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
            <div className={`mt-4 p-4 rounded-lg ${
              restoreProgress.status === 'completed'
                ? (isDarkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200')
                : restoreProgress.status === 'error'
                ? (isDarkMode ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200')
                : (isDarkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200')
            }`}>
              <div className="flex items-center gap-2">
                {restoreProgress.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : restoreProgress.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                )}
                <span className={`text-sm font-medium ${
                  restoreProgress.status === 'completed'
                    ? (isDarkMode ? 'text-green-300' : 'text-green-800')
                    : restoreProgress.status === 'error'
                    ? (isDarkMode ? 'text-red-300' : 'text-red-800')
                    : (isDarkMode ? 'text-blue-300' : 'text-blue-800')
                }`}>
                  {restoreProgress.message}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-between items-center p-6 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || restoring}
            className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
              currentStep === 1 || restoring
                ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="flex gap-3">
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToNextStep() || restoring}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                  !canProceedToNextStep() || restoring
                    ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                    : (isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')
                }`}
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleRestore}
                disabled={!hasSelections() || restoring}
                className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                  !hasSelections() || restoring
                    ? (isDarkMode ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                    : (isDarkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white')
                }`}
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Restore Selected
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestoreModal;

