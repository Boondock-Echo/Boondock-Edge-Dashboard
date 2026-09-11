import { apiFetch } from '../utils/apiClient';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, AlertTriangle } from 'lucide-react';
import ReportsManagement from './Settings/ReportsManagement';
import Button from './ui/Button';
import pageStyles from './ui/Page.module.css';
import cardStyles from './ui/Card.module.css';
import formStyles from './ui/Form.module.css';
import modalStyles from './ui/Modal.module.css';

const ReportPage = ({ timeFormat = "24h" }) => {
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

  const updateDialogRef = useRef(null);
  const deleteDialogRef = useRef(null);

  useEffect(() => {
    const dialog = updateDialogRef.current;
    if (!dialog) return;
    if (isUpdateModalOpen && selectedIncident && !dialog.open) dialog.showModal();
    if ((!isUpdateModalOpen || !selectedIncident) && dialog.open) dialog.close();
  }, [isUpdateModalOpen, selectedIncident]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (isDeleteModalOpen && incidentToDelete && !dialog.open) dialog.showModal();
    if ((!isDeleteModalOpen || !incidentToDelete) && dialog.open) dialog.close();
  }, [isDeleteModalOpen, incidentToDelete]);

  return (
    <main className={pageStyles.page}>
      <header className={pageStyles.stickyHeader}>
        <div className={pageStyles.wideContainer}>
          <div className="row">
            <Button size="icon" onClick={() => navigate(-1)} aria-label="Go back">
              <ArrowLeft size={20} />
            </Button>
            <div className={pageStyles.headerIcon}>
              <FileText size={24} />
            </div>
            <div>
              <h1 className={pageStyles.title}>Incident Reports</h1>
              <p className={pageStyles.subtitle}>
                {loading ? 'Loading statistics...' : `${reportsData.totalReports} total reports`}
              </p>
            </div>
          </div>

          <div className="rowWrap">
            <div className="row">
              <Button
                size="small"
                variant={densityMode === 'comfortable' ? 'primary' : 'secondary'}
                onClick={() => setDensityMode('comfortable')}
              >
                Comfortable
              </Button>
              <Button
                size="small"
                variant={densityMode === 'compact' ? 'primary' : 'secondary'}
                onClick={() => setDensityMode('compact')}
              >
                Compact
              </Button>
            </div>
            <span className="pill pillAccent">
              <Clock size={16} />
              {timezone}
            </span>
          </div>
        </div>
      </header>

      <div className="contentWide">
        <div className={`${cardStyles.card} ${cardStyles.flush}`}>
          <ReportsManagement
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
        <dialog
          ref={updateDialogRef}
          className={modalStyles.dialog}
          onCancel={() => setIsUpdateModalOpen(false)}
        >
          <div className={modalStyles.header}>
            <h2 className={modalStyles.title}>Update Incident</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsUpdateModalOpen(false)}
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined iconSmall">close</span>
            </Button>
          </div>

          <div className={modalStyles.body}>
            <form onSubmit={handleUpdateIncident} className={formStyles.form}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>
                  Incident Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={formStyles.input}
                  required
                  aria-required="true"
                />
              </div>

              <div className={formStyles.field}>
                <label className={formStyles.label}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={formStyles.input}
                  rows={4}
                />
              </div>

              <div className="gridTwo">
                <div className={formStyles.field}>
                  <label className={formStyles.label}>Start Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.startTime}
                    step="1"
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className={formStyles.input}
                    required
                    aria-required="true"
                  />
                </div>

                <div className={formStyles.field}>
                  <label className={formStyles.label}>End Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.endTime}
                    step="1"
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className={formStyles.input}
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div className={formStyles.field}>
                <label className={formStyles.label}>
                  Severity *
                  <span className={formStyles.helpText} title="Low: Minor impact, Medium: Moderate impact, High: Critical impact"> (?)</span>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className={formStyles.select}
                  required
                  aria-required="true"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className={modalStyles.actions}>
                <Button onClick={() => setIsUpdateModalOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateLoading || formData.name === '' || formData.startTime === '' || formData.endTime === '' || formData.severity === ''}
                >
                  {updateLoading ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && incidentToDelete && (
        <dialog
          ref={deleteDialogRef}
          className={modalStyles.dialog}
          onCancel={() => {
            setIsDeleteModalOpen(false);
            setIncidentToDelete(null);
          }}
        >
          <div className={modalStyles.header}>
            <div className="row">
              <span className="pill pillDanger"><AlertTriangle size={20} /></span>
              <div>
                <h2 className={modalStyles.title}>Delete Incident Report</h2>
                <p className={modalStyles.subtitle}>This action cannot be undone</p>
              </div>
            </div>
          </div>

          <div className={modalStyles.body}>
            <div className={cardStyles.card}>
              <p><strong>Incident:</strong> {incidentToDelete.title || incidentToDelete.name}</p>
              <p><strong>Created:</strong> {new Date(incidentToDelete.date || incidentToDelete.created_at).toLocaleDateString()}</p>
              <p><strong>Audio Files:</strong> {incidentToDelete.audios?.length || 0}</p>
            </div>

            <div className={modalStyles.actions}>
              <Button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setIncidentToDelete(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading && <span className="spinner spinnerSmall" role="status" aria-label="Deleting report" />}
                {deleteLoading ? 'Deleting...' : 'Delete Report'}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
};

export default ReportPage; 
