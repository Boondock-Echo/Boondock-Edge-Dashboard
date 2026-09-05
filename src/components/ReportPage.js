import { apiFetch } from '../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock } from 'lucide-react';
import ReportsManagement from './Settings/ReportsManagement';

const ReportPage = ({ isDarkMode = false, timeFormat = "24h" }) => {
  const navigate = useNavigate();
  const [densityMode, setDensityMode] = useState(() => localStorage.getItem('reports_density_mode') || 'comfortable');
  const [timezone, setTimezone] = useState(() => {
    const cachedTimezone = localStorage.getItem('cached_timezone');
    return cachedTimezone || 'Etc/UTC';
  });
  const [settingsTimezone, setSettingsTimezone] = useState(null);
  
  // Dynamic data state
  const [reportsData, setReportsData] = useState({
    totalReports: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
    recentReports: 0,
    totalAudioFiles: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Modal state for ReportsManagement
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [incidentToDelete, setIncidentToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Form state for modal
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    severity: 'low'
  });

  const themeClasses = {
    pageBg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    headerBg: isDarkMode ? 'bg-slate-900/85' : 'bg-white/85',
    cardBg: isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80',
    primaryText: isDarkMode ? 'text-slate-100' : 'text-slate-900',
    secondaryText: isDarkMode ? 'text-slate-300' : 'text-slate-600',
    mutedText: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    accent: isDarkMode ? 'text-blue-300' : 'text-[#003178]',
    iconSoftBg: isDarkMode ? 'bg-blue-500/15' : 'bg-blue-50',
    highText: isDarkMode ? 'text-red-300' : 'text-[#720009]',
    highBg: isDarkMode ? 'bg-red-500/15' : 'bg-red-50',
    greenText: isDarkMode ? 'text-emerald-300' : 'text-emerald-600',
    border: isDarkMode ? 'border-slate-800' : 'border-slate-200',
  };


  // Fetch timezone from settings
  useEffect(() => {
    const fetchTimezone = async () => {
      try {
        const settingsResp = await apiFetch(`/settings`).catch(() => null);
        if (settingsResp && settingsResp.ok) {
          const settingsData = await settingsResp.json();
          const tz = settingsData?.global_timezone;
          if (tz) {
            try {
              new Intl.DateTimeFormat('en-US', { timeZone: tz });
              setSettingsTimezone(tz);
              setTimezone(tz);
              localStorage.setItem('cached_timezone', tz);
            } catch (err) {
              console.warn('Invalid timezone from settings:', tz);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching timezone settings:', error);
      }
    };
    fetchTimezone();
  }, []);

  useEffect(() => {
    localStorage.setItem('reports_density_mode', densityMode);
  }, [densityMode]);

  // Fetch reports data
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        const response = await apiFetch(`/incident-reports`);
        if (!response.ok) throw new Error('Failed to fetch reports');
        
        const data = await response.json();
        
        // Calculate statistics
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const stats = {
          totalReports: data.length,
          highSeverity: data.filter(r => r.severity.toLowerCase() === 'high').length,
          mediumSeverity: data.filter(r => r.severity.toLowerCase() === 'medium').length,
          lowSeverity: data.filter(r => r.severity.toLowerCase() === 'low').length,
          recentReports: data.filter(r => new Date(r.created_at) > oneWeekAgo).length,
          totalAudioFiles: data.reduce((sum, r) => sum + (r.messages?.length || 0), 0)
        };
        
        setReportsData(stats);
      } catch (error) {
        console.error('Error fetching reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportsData();
  }, []);

  // Format date for datetime-local input (YYYY-MM-DDTHH:MM:SS) with timezone conversion
  const formatDateTimeForInput = (dateString) => {
    if (!dateString) return '';
    
    // Try parsing the date string
    let date = new Date(dateString);
    
    // If parsing fails, try removing milliseconds
    if (isNaN(date.getTime())) {
      const withoutMilliseconds = dateString.replace(/\.\d+/, '');
      date = new Date(withoutMilliseconds);
    }
    
    // If still invalid, return empty string
    if (isNaN(date.getTime())) return '';
    
    // Use settingsTimezone if available, otherwise try localStorage, fallback to UTC
    let timezone = settingsTimezone || localStorage.getItem('cached_timezone') || 'Etc/UTC';
    
    // Validate timezone before using it
    const validateAndFixTimezone = (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return tz;
      } catch (error) {
        console.warn(`Invalid timezone "${tz}", falling back to Etc/UTC`);
        return 'Etc/UTC';
      }
    };
    
    timezone = validateAndFixTimezone(timezone);
    
    // Use Intl.DateTimeFormat to get parts in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const second = parts.find(p => p.type === 'second')?.value || '';
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  };

  // Handle form submission
  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    
    try {
      // Convert datetime-local input value back to UTC for server storage
      // The user entered a time that was displayed in the configured timezone
      // but the browser interprets datetime-local as browser local time
      // We need to find what UTC time corresponds to the entered time in the configured timezone
      const convertLocalToUTC = (localDateTime) => {
        if (!localDateTime) return "";
        
        // Get the configured timezone
        const tz = settingsTimezone || localStorage.getItem('cached_timezone') || 'Etc/UTC';
        
        // Parse the datetime-local string (YYYY-MM-DDTHH:MM:SS)
        const [datePart, timePart] = localDateTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes, seconds = 0] = (timePart || '00:00:00').split(':').map(Number);
        
        // Find the UTC time that, when formatted in the target timezone, equals the input
        // We'll use binary search to find the correct UTC time
        const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
        let low = startOfDay.getTime();
        let high = endOfDay.getTime();
        let bestMatch = new Date((low + high) / 2);
        
        for (let i = 0; i < 50; i++) {
          const mid = new Date((low + high) / 2);
          
          // Format this UTC time in the target timezone
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
          const parts = formatter.formatToParts(mid);
          const tzYear = parseInt(parts.find(p => p.type === 'year')?.value || '0');
          const tzMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0');
          const tzDay = parseInt(parts.find(p => p.type === 'day')?.value || '0');
          const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
          const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
          const tzSecond = parseInt(parts.find(p => p.type === 'second')?.value || '0');
          
          // Check if this matches what we want
          if (tzYear === year && tzMonth === month && tzDay === day &&
              tzHour === hours && tzMinute === minutes && tzSecond === seconds) {
            return mid.toISOString();
          }
          
          // Compare lexicographically to adjust search range
          const needIncrease = 
            tzYear < year ||
            (tzYear === year && tzMonth < month) ||
            (tzYear === year && tzMonth === month && tzDay < day) ||
            (tzYear === year && tzMonth === month && tzDay === day && tzHour < hours) ||
            (tzYear === year && tzMonth === month && tzDay === day && tzHour === hours && tzMinute < minutes) ||
            (tzYear === year && tzMonth === month && tzDay === day && tzHour === hours && tzMinute === minutes && tzSecond < seconds);
          
          if (needIncrease) {
            low = mid.getTime() + 1;
          } else {
            high = mid.getTime() - 1;
          }
          
          bestMatch = mid;
        }
        
        // Return the best match we found (should be very close)
        return bestMatch.toISOString();
      };
      
      const response = await apiFetch(`/incident-reports/${selectedIncident.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startTime: formData.startTime ? convertLocalToUTC(formData.startTime) : selectedIncident.startTime,
          endTime: formData.endTime ? convertLocalToUTC(formData.endTime) : selectedIncident.endTime,
          severity: formData.severity.charAt(0).toUpperCase() + formData.severity.slice(1),
          channels_involved: selectedIncident.location.split(', '),
          messages: selectedIncident.audios.map(audio => ({
            id: parseInt(audio.id.replace('aud-', '')),
            time: audio.recordedAt,
            message: audio.transcription,
            channel: audio.source.replace('Channel ', ''),
            url: audio.url
          })),
          messageCount: selectedIncident.audios.length,
        }),
      });

      if (!response.ok) throw new Error('Failed to update incident');
      
      // Close modal and reset form
      setIsUpdateModalOpen(false);
      setFormData({
        name: '',
        description: '',
        startTime: '',
        endTime: '',
        severity: 'low'
      });
      
      // Refresh the page to show updated data
      window.location.reload();
      
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update incident. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isUpdateModalOpen && selectedIncident) {
      setFormData({
        name: selectedIncident.name || selectedIncident.title || '',
        description: selectedIncident.description || '',
        startTime: selectedIncident.startTime ? formatDateTimeForInput(selectedIncident.startTime) : '',
        endTime: selectedIncident.endTime ? formatDateTimeForInput(selectedIncident.endTime) : '',
        severity: selectedIncident.severity ? selectedIncident.severity.toLowerCase() : 'low'
      });
    }
  }, [isUpdateModalOpen, selectedIncident]);

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!incidentToDelete) return;
    
    setDeleteLoading(true);
    
    try {      
      const response = await apiFetch(`/incident-reports/${incidentToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete incident');
      
      // Close modal and refresh the page to show updated data
      setIsDeleteModalOpen(false);
      setIncidentToDelete(null);
      window.location.reload();
      
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete incident. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle delete request (opens confirmation modal)
  const handleDeleteRequest = (incident) => {
    setIncidentToDelete(incident);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className={`min-h-screen ${themeClasses.pageBg}`}>
      <div className={`sticky top-0 z-30 ${themeClasses.headerBg} border-b ${themeClasses.border} backdrop-blur-md`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-5">
              <button
                onClick={() => navigate(-1)}
                className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.cardBg} transition-all duration-200 hover:scale-[1.02]`}
                aria-label="Go back"
              >
                <ArrowLeft className={`w-5 h-5 ${themeClasses.primaryText}`} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${themeClasses.iconSoftBg}`}>
                  <FileText className={`w-8 h-8 ${themeClasses.accent}`} />
                </div>
                <div>
                  <h1 className={`text-2xl font-extrabold tracking-tight ${themeClasses.primaryText}`}>
                    Incident Reports
                  </h1>
                  <p className={`text-sm mt-1 ${themeClasses.mutedText}`}>
                    {loading ? 'Loading statistics...' : `${reportsData.totalReports} total reports`}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.cardBg}`}>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setDensityMode('comfortable')}
                    className={`px-2 py-1 rounded ${densityMode === 'comfortable' ? (isDarkMode ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-800') : themeClasses.mutedText}`}
                  >
                    Comfortable
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityMode('compact')}
                    className={`px-2 py-1 rounded ${densityMode === 'compact' ? (isDarkMode ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-100 text-[#003178]') : themeClasses.mutedText}`}
                  >
                    Compact
                  </button>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg border ${themeClasses.border} ${themeClasses.cardBg}`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${themeClasses.accent}`} />
                  <span className={`text-sm font-medium ${themeClasses.primaryText}`}>{timezone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-14">
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${themeClasses.cardBg}`}>
          <ReportsManagement 
            isDarkMode={isDarkMode} 
            densityMode={densityMode}
            isUpdateModalOpen={isUpdateModalOpen}
            setIsUpdateModalOpen={setIsUpdateModalOpen}
            selectedIncident={selectedIncident}
            setSelectedIncident={setSelectedIncident}
            updateLoading={updateLoading}
            setUpdateLoading={setUpdateLoading}
            onDeleteRequest={handleDeleteRequest}
            deleteLoading={deleteLoading}
          />
        </div>
      </div>

      {/* MODAL - Rendered at page level to avoid positioning issues */}
      {isUpdateModalOpen && selectedIncident && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] transition-opacity duration-300 ease-out">
          <div className={`rounded-xl p-8 w-full max-w-lg mx-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} tracking-tight`}>
                Update Incident
              </h2>
              <button
                onClick={() => setIsUpdateModalOpen(false)}
                className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'} transition-colors duration-200`}
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateIncident} className="space-y-6">
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Incident Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full p-3 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                  } transition-all duration-200 focus:ring-2 focus:ring-offset-2`}
                  required
                  aria-required="true"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full p-3 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                  } transition-all duration-200 focus:ring-2 focus:ring-offset-2`}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    step="1"
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={`w-full p-3 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    } transition-all duration-200 focus:ring-2 focus:ring-offset-2`}
                    required
                    aria-required="true"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    step="1"
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className={`w-full p-3 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                    } transition-all duration-200 focus:ring-2 focus:ring-offset-2`}
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                  Severity <span className="text-red-500">*</span>
                  <span
                    className="ml-2 text-xs text-gray-500 cursor-help"
                    title="Low: Minor impact, Medium: Moderate impact, High: Critical impact"
                  >
                    (?)
                  </span>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className={`w-full p-3 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500'
                  } transition-all duration-200 focus:ring-2 focus:ring-offset-2`}
                  required
                  aria-required="true"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className={`px-5 py-2.5 rounded-lg ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoading || formData.name === '' || formData.startTime === '' || formData.endTime === '' || formData.severity === ''}
                  className={`px-5 py-2.5 rounded-lg ${
                    isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {updateLoading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && incidentToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] transition-opacity duration-300 ease-out">
          <div className={`rounded-xl p-8 w-full max-w-md mx-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'} shadow-2xl`}>
            <div className="flex items-center space-x-3 mb-6">
              <div className={`p-3 rounded-full ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} tracking-tight`}>
                  Delete Incident Report
                </h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                <span className="font-medium">Incident:</span> {incidentToDelete.title || incidentToDelete.name}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Created:</span> {new Date(incidentToDelete.date || incidentToDelete.created_at).toLocaleDateString()}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Audio Files:</span> {incidentToDelete.audios?.length || 0}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setIncidentToDelete(null);
                }}
                disabled={deleteLoading}
                className={`px-5 py-2.5 rounded-lg ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className={`px-5 py-2.5 rounded-lg ${
                  isDarkMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {deleteLoading ? (
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </div>
                ) : (
                  'Delete Report'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportPage; 
