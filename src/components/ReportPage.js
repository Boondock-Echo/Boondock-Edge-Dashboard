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
import { formatLocalDate, getBrowserTimeZone, localDateTimeInputToUtc, toLocalDateTimeInputValue } from '../utils/dateTime';

const ReportPage = ({ timeFormat = "24h" }) => {
  const navigate = useNavigate();
  const [densityMode, setDensityMode] = useState(() => localStorage.getItem('reports_density_mode') || 'comfortable');
  
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

  // Handle form submission
  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    
    try {
      // Convert datetime-local input value back to UTC for server storage
      // datetime-local values represent the browser’s local wall clock.
      const response = await apiFetch(`/incident-reports/${selectedIncident.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startTime: formData.startTime ? localDateTimeInputToUtc(formData.startTime) : selectedIncident.startTime,
          endTime: formData.endTime ? localDateTimeInputToUtc(formData.endTime) : selectedIncident.endTime,
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
        startTime: selectedIncident.startTime ? toLocalDateTimeInputValue(selectedIncident.startTime) : '',
        endTime: selectedIncident.endTime ? toLocalDateTimeInputValue(selectedIncident.endTime) : '',
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
              {getBrowserTimeZone()}
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
              <p><strong>Created:</strong> {formatLocalDate(incidentToDelete.date || incidentToDelete.created_at)}</p>
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
