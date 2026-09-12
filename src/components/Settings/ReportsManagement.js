import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect, Fragment, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Clock, Calendar, File, AlertTriangle, Mic, Tag, FileText, List, Search,
  ChevronDown, ChevronUp, Radio, MapPin, Download, Edit, Trash2, Copy, FileDown } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { buildIncidentReportPdfBlob, incidentReportPdfFilename } from '../../utils/incidentReportPdf';
import {
  formatLocalDateTime,
  getLocalTimeZoneAbbreviation,
  localDateTimeInputToUtc,
  parseUtcTimestamp,
  toLocalDateTimeInputValue,
} from '../../utils/dateTime';
import InlineAudioPlayer from '../InlineAudioPlayer';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import navStyles from '../ui/Navigation.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/ReportsManagement.module.css';

/**
 * AUDIO PLAYER
 */
// TO-DO should be using InlineAudioPlayer
const AudioPlayer = ({
  audioId,
  url,
  source,
  transcription,
  recordedAt,
  formatDate,
  isCompact = false
}) => {
  return (
    <div className={styles.audioItem}>
      <div className="rowBetweenStart">
        <InlineAudioPlayer ownerId={`report:${audioId}`} src={url} />
        <div className={styles.audioBody}>
          <div className="rowWrap">
            <span className="eyebrow">{source}</span>
            <span className="tinyText mutedText">{formatDate(recordedAt)}</span>
          </div>
          <p className={styles.audioTranscript}>{transcription}</p>
          <div className={styles.audioMeta}>
            <span className="row"><Clock className="iconSmall" /><span>{formatDate(recordedAt)}</span></span>
            <span className="row"><Mic className="iconSmall" /><span>{source}</span></span>
            <Button type="button" size="small" variant="ghost" onClick={() => navigator.clipboard?.writeText(transcription || '')}>
              <Copy /><span>COPY</span>
            </Button>
            <a href={url} target="_blank" rel="noopener noreferrer">SAVE AUDIO</a>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * TAB NAVIGATION
 */
const Tabs = ({ activeTab, setActiveTab, isCompact = false }) => (
  <nav className={navStyles.subnav} aria-label="Incident report detail">
    {[
      { key: 'transcription', label: 'Transcription', icon: FileText },
      { key: 'metadata', label: 'Metadata', icon: Tag }
    ].map(tab => {
      const Icon = tab.icon;
      const isActive = activeTab === tab.key;
      return (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`${navStyles.tab} ${isActive ? navStyles.active : ''}`}
        >
          <span className="row"><Icon className="iconSmall" />{tab.label}</span>
        </button>
      );
    })}
  </nav>
);

/**
 * REPORT LIST ITEM (sidebar entry)
 */
const ReportListItem = ({
  report,
  isExpanded,
  onClick,
  isCompact = false,
  formatDate,
  getRelativeTime,
  deleteIncident, // Add deleteIncident prop
  deleteLoading, // Add deleteLoading prop
  setIsUpdateModalOpen, // Add setIsUpdateModalOpen prop for edit button
  setSelectedIncident, // Add setSelectedIncident prop
}) => {
  const severityClasses = {
    high: 'pillDanger',
    medium: 'pillWarning',
    low: 'pillSuccess'
  }[report.severity.toLowerCase()];
  const incidentCode = `RE-${String(report.id).padStart(5, '0')}`;

  return (
    <div
      onClick={() => onClick(report.id)}
      className={`${styles.reportItem} ${isExpanded ? styles.reportItemActive : ''}`}
    >
      <div className="rowBetweenStart">
        <div className="grow">
          <div className="rowBetween">
            <span className={styles.reportCode}>{incidentCode}</span>
            <span className="tinyText mutedText">{getRelativeTime(report.date)}</span>
          </div>
          <h3 className={styles.reportTitle}>{report.title}</h3>
          <div className={styles.reportMeta}>
            <span className="row"><Calendar className="iconSmall" /><span>{formatDate(report.date)}</span></span>
            <span className="row"><MapPin className="iconSmall" /><span>{report.location}</span></span>
          </div>
        </div>
        <Button size="icon" variant="ghost" aria-label={isExpanded ? 'Collapse report' : 'Expand report'}>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>

      {isExpanded && (
        <div className={styles.expandedActions}>
          <span className={`pill ${severityClasses}`}><AlertTriangle className="iconSmall" />{report.severity} Severity</span>
          <span className="pill">{report.audios.length} audio file{report.audios.length !== 1 ? 's' : ''}</span>
          <span className="pill pillAccent">Active</span>
          {/* Edit Button */}
          <Button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick
              setSelectedIncident(report);
              setIsUpdateModalOpen(true);
            }}
            size="icon"
            variant="ghost"
            title="Edit Incident"
            aria-label="Edit incident"
          >
            <Edit />
          </Button>
          {/* Delete Button */}
          <Button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick
              deleteIncident(report.id);
            }}
            disabled={deleteLoading}
            size="icon"
            variant="danger"
            title="Delete Incident"
            aria-label="Delete incident"
          >
            {deleteLoading ? <span className="spinner spinnerSmall" /> : <Trash2 />}
          </Button>
          <span className="tinyText mutedText">Click to view details</span>
        </div>
      )}
    </div>
  );
};

/**
 * UPDATE INCIDENT MODAL
 */
// TO-DO Check with Mark if this need to be implemented or removed
const UpdateIncidentModal = ({ 
  isOpen, 
  onClose, 
  incident, 
  onUpdate, 
  formatDate,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    severity: 'low'
  });

  // Reset form when incident changes or modal opens
  useEffect(() => {
    if (isOpen && incident) {
      setFormData({
        name: incident.name || incident.title || '',
        description: incident.description || '',
        startTime: incident.startTime ? toLocalDateTimeInputValue(incident.startTime) : '',
        endTime: incident.endTime ? toLocalDateTimeInputValue(incident.endTime) : '',
        severity: incident.severity ? incident.severity.toLowerCase() : 'low'
      });
    }
  }, [isOpen, incident]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onUpdate({
        ...incident,
        ...formData,
        
        startTime: formData.startTime ? localDateTimeInputToUtc(formData.startTime) : incident.startTime,
        endTime: formData.endTime ? localDateTimeInputToUtc(formData.endTime) : incident.endTime,
        severity: formData.severity.charAt(0).toUpperCase() + formData.severity.slice(1),
      });
      onClose();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  

  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={modalStyles.dialog}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Add focus:outline-none to prevent default focus ring since we handle it
      // biome-ignore lint/a11y/noAutofocus: Autofocus is used here to trap focus in the modal
      autoFocus
    >
      <div className={modalStyles.header}>
        <h2 id="modal-title" className={modalStyles.title}>Update Incident</h2>
        <Button onClick={onClose} size="icon" variant="ghost" aria-label="Close modal">
          <span className="material-symbols-outlined">close</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className={`${formStyles.form} ${modalStyles.body}`}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Incident Name <span aria-hidden="true">*</span></label>
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
            className={formStyles.textarea}
            rows={4}
          />
        </div>

        <div className="gridTwo">
          <div className={formStyles.field}>
            <label className={formStyles.label}>Start Time <span aria-hidden="true">*</span></label>
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
            <label className={formStyles.label}>End Time <span aria-hidden="true">*</span></label>
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
            Severity <span aria-hidden="true">*</span>
            <span className="tinyText mutedText" title="Low: Minor impact, Medium: Moderate impact, High: Critical impact"> (?)</span>
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
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={formData.name === '' || formData.startTime === '' || formData.endTime === '' || formData.severity === ''}
          >
            Update
          </Button>
        </div>
      </form>
    </dialog>
  );

};

/**
 * MAIN INCIDENT REPORTS UI
 */
const IncidentReportsUI = ({ 
  densityMode = 'comfortable',
  timeFormat = "24h",
  isUpdateModalOpen,
  setIsUpdateModalOpen,
  selectedIncident,
  setSelectedIncident,
  updateLoading,
  setUpdateLoading,
  onDeleteRequest,
  deleteLoading
}) => {
  const [reports, setReports] = useState([]);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transcription');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [operationError, setOperationError] = useState(null);
  const { user } = useAuth();
  const [channelsById, setChannelsById] = useState({});
  const isCompact = densityMode === 'compact';

  // PARSE / FORMAT DATES

 const formatDate = (dateString) => formatLocalDateTime(dateString, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

  const getRelativeTime = (dateString) => {
    const date = parseUtcTimestamp(dateString);
    if (!date || isNaN(date.getTime())) return 'Unknown';
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  // Helper to present 'Channel (id) Name' for a source string
  const getDisplaySource = (src) => {
    if (!src) return '';
    const match = String(src).match(/Channel\s+(\d+)/i);
    const id = match ? parseInt(match[1], 10) : null;
    if (id != null) {
      const name = channelsById[String(id)] || `Channel ${id}`;
      return `Channel (${id}) ${name}`;
    }
    return src;
  };

  // Helper: Build Channels Involved label like: 'Channel (1) NAME, Channel (2) NAME'
  const getChannelsInvolvedLabel = (incident) => {
    if (!incident) return incident?.location || '';
    const idsFromAudios = Array.from(new Set(
      (incident.audios || [])
        .map(a => {
          const m = String(a.source || '').match(/Channel\s+(\d+)/i);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter(id => id !== null)
    ));
    if (idsFromAudios.length === 0) return incident.location || '';
    return idsFromAudios
      .map(id => `Channel (${id}) ${channelsById[String(id)] || `Channel ${id}`}`)
      .join(', ');
  };

  // FETCH REPORTS
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        // fetch channels for id->name mapping (best-effort)
        try {
          const chResp = await apiFetch(`/channels`).catch(() => null);
          if (chResp && chResp.ok) {
            const chData = await chResp.json();
            const map = (Array.isArray(chData) ? chData : []).reduce((acc, ch) => {
              if (ch && typeof ch.id !== 'undefined') {
                acc[String(ch.id)] = ch.name || `Channel ${ch.id}`;
              }
              return acc;
            }, {});
            setChannelsById(map);
          }
        } catch {}

        const resp = await apiFetch(`/incident-reports`);
        if (!resp.ok) throw new Error('Failed to fetch incident reports');
        const data = await resp.json();

        const mapped = data.map(r => ({
          id: r.id,
          title: r.name,
          detailedTitle: `${r.name} at ${r.channels_involved.join(', ')}`,
          date: r.created_at,
          location: r.channels_involved.join(', '),
          severity: r.severity.charAt(0).toUpperCase() + r.severity.slice(1),
          startTime: r.startTime,
          endTime: r.endTime,
          description: r.description,
          audios: r.messages.map(m => ({
            id: `aud-${m.id}`,
            filename: m.url.split('/').pop(),
            recordedAt: m.time,
            source: `Channel ${m.channel}`,
            transcription: m.message,
            url: m.url
          }))
        }));

        setReports(mapped);
        if (mapped.length > 0) {
          setSelectedIncident(mapped[0]);
          setExpandedReportId(mapped[0].id);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // SEARCH FILTER
  const filteredReports = reports.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // TOGGLE REPORT (sidebar)
  const toggleReport = (id) => {
    const isSame = expandedReportId === id;
    setExpandedReportId(isSame ? null : id);
    const found = reports.find(r => r.id === id);
    if (!isSame && found) setSelectedIncident(found);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  // Build TXT content (shared by TXT and ZIP)
  const buildReportTxtContent = (report) => {
    const formatForReport = (dateString) => {
      const date = parseUtcTimestamp(dateString);
      if (!date || isNaN(date.getTime())) return 'Invalid Date';
      const use12h = timeFormat !== '24h';
      const formatted = formatLocalDateTime(date, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: use12h,
      });
      return `${formatted} (${getLocalTimeZoneAbbreviation(date)})`;
    };

    const createdAt = report.date;
    const createdByName = user?.name || user?.username || 'Boondock Team';
    const createdByFull = user ? `${user.name || createdByName} (${user.username || ''})` : 'Unknown';

    const extractIdFromSource = (src) => {
      if (!src) return null;
      const match = String(src).match(/Channel\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : null;
    };
    const uniqueIds = Array.from(new Set((report.audios || []).map(a => extractIdFromSource(a.source)).filter(id => id !== null)));
    const channelLabel = uniqueIds.length > 0
      ? uniqueIds.map(id => `(${id}) ${channelsById[String(id)] || `Channel ${id}`}`).join(', ')
      : (report.location || '');

    const formatSource = (src) => {
      if (!src) return 'Source: Unknown';
      const match = String(src).match(/Channel\s+(\d+)/i);
      const id = match ? parseInt(match[1], 10) : null;
      if (id != null) {
        const name = channelsById[String(id)] || `Channel ${id}`;
        return `Source: Channel (${id}) ${name}`;
      }
      return `Source: ${src}`;
    };

    const headerLines = [
      `Incident: ${report.title} created by ${createdByName}`,
      `Created(24H): ${formatForReport(createdAt)}`,
      `Created By : ${createdByFull}`,
      '',
      `Incident Start : ${formatForReport(report.startTime)}`,
      `Incident End : ${formatForReport(report.endTime)}`,
      '',
      `Channel: ${channelLabel}`,
      `Severity: ${report.severity}`,
      'Description:',
      `${report.description || ''}`,
      '',
      'Transcriptions:',
      '',
    ];

    const bodyLines = report.audios.flatMap(a => [
      `${formatSource(a.source)}`,
      `Time: ${formatForReport(a.recordedAt)}`,
      `Transcription: ${a.transcription}`,
      '',
      '',
    ]);

    return [...headerLines, ...bodyLines].join('\n');
  };

  // EXPORT ZIP
  const exportReportAsZip = async (report) => {
    if (!report) return;
    setExporting(true);
    const zip = new JSZip();
    const txt = buildReportTxtContent(report);
    zip.file(`${report.title.replace(/[^a-z0-9]/gi, '_')}_report.txt`, txt);

    try {
      await Promise.all(report.audios.map(async a => {
        try {
          const res = await apiFetch(a.url);
          if (!res.ok) throw new Error(`Failed to fetch ${a.filename}`);
          const blob = await res.blob();
          zip.file(`audio/${a.filename}`, blob);
        } catch (err) {
          console.error(err);
          zip.file(
            `${report.title.replace(/[^a-z0-9]/gi, '_')}_errors.txt`,
            `Failed to include ${a.filename}: ${err.message}\n`,
            { append: true }
          );
        }
      }));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${report.title.replace(/[^a-z0-9]/gi, '_')}_report.zip`);
    } catch (err) {
      console.error(err);
      setError('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // EXPORT PLAIN TEXT (requested format)
  const exportReportAsTxt = (report) => {
    if (!report) return;
    const content = buildReportTxtContent(report);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const safeName = `${report.title.replace(/[^a-z0-9]/gi, '_')}_report.txt`;
    saveAs(blob, safeName);
  };

  const exportReportAsPdf = async (report) => {
    if (!report) return;
    setExportingPdf(true);
    try {
      const blob = await buildIncidentReportPdfBlob(report, {
        user,
        timeFormat,
        channelsById,
      });
      saveAs(blob, incidentReportPdfFilename(report.title));
    } catch (err) {
      console.error(err);
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  // UPDATE INCIDENT
  useEffect(() => {
    if (selectedIncident) {
      const updated = reports.find(r => r.id === selectedIncident.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedIncident)) {
        setSelectedIncident(updated);
      }
    }
  }, [reports, selectedIncident]);

  const updateIncident = async (updatedIncident) => {
    setUpdateLoading(true);
    setOperationError(null);
    
    const previousReports = [...reports];
    const previousSelected = selectedIncident;
    
    try {
      const updatedReports = reports.map(r => 
        r.id === updatedIncident.id ? updatedIncident : r
      );
      
      setReports(updatedReports);
      setSelectedIncident(updatedIncident);
      
      const response = await apiFetch(`/incident-reports/${updatedIncident.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: updatedIncident.name,
          description: updatedIncident.description,
          startTime: updatedIncident.startTime,
          endTime: updatedIncident.endTime,
          severity: updatedIncident.severity,
          channels_involved: updatedIncident.location.split(', '),
          messages: updatedIncident.audios.map(audio => ({
            id: parseInt(audio.id.replace('aud-', '')),
            time: audio.recordedAt,
            message: audio.transcription,
            channel: audio.source.replace('Channel ', ''),
            url: audio.url
          })),
          messageCount: updatedIncident.audios.length,
        }),
      });

      if (!response.ok) throw new Error('Failed to update incident');
    } catch (err) {
      setReports(previousReports);
      setSelectedIncident(previousSelected);
      setOperationError('Failed to update incident report');
      console.error(err);
    } finally {
      setUpdateLoading(false);
      setIsUpdateModalOpen(false);
    }
  };

  // DELETE INCIDENT
  const deleteIncident = async (incidentId) => {
    // Find the incident to delete
    const incidentToDelete = reports.find(r => r.id === incidentId);
    if (!incidentToDelete) return;
    
    // Use the new delete confirmation modal
    if (onDeleteRequest) {
      onDeleteRequest(incidentToDelete);
    }
  };

  // LOADING STATE
  if (loading) {
    return (
      <div className="screenCenter">
        <div className="stack centeredContent">
          <span className="spinner spinnerLarge" aria-label="Loading incident reports" />
          <p>Loading incident reports...</p>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (error && reports.length === 0) {
    return (
      <div className="screenCenter">
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <AlertTriangle className={noticeStyles.icon} />
          <div className={noticeStyles.body}>
            <p><strong>Unable to Load Reports</strong></p>
            <p>{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${isCompact ? styles.compact : ''}`}>
      <div className={styles.workspace}>
        {/* SIDEBAR */}
        <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <div className={formStyles.inputFrame}>
              <Search className={formStyles.inputIcon} />
              <input
                type="text"
                placeholder="Filter by unit or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={formStyles.iconInput}
              />
            </div>
            <div className="rowBetween">
              <h2 className={cardStyles.title}>Incident Reports</h2>
              <span className="pill pillAccent">{filteredReports.length}</span>
            </div>
          </div>

          <div className={styles.sidebarList}>
            {filteredReports.length === 0 ? (
              <div className={styles.empty}>
                <div>
                  <File className="iconLarge" />
                  <p>No matching reports found</p>
                </div>
              </div>
            ) : (
              <div className="stackCompact">
                {filteredReports.map(r => (
                  <ReportListItem
                    key={r.id}
                    report={r}
                    isExpanded={expandedReportId === r.id}
                    onClick={toggleReport}
                    isCompact={isCompact}
                    formatDate={formatDate}
                    getRelativeTime={getRelativeTime}
                    deleteIncident={deleteIncident}
                    deleteLoading={deleteLoading}
                    setIsUpdateModalOpen={setIsUpdateModalOpen}
                    setSelectedIncident={setSelectedIncident}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className={styles.main}>
          {selectedIncident ? (
            <Fragment>
              {/* HEADER */}
              <header className={styles.mainHeader}>
                <div className="rowBetweenStart">
                  <div className="grow">
                    <div className="rowWrap">
                      <h2 className="pageTitle">{selectedIncident.title}</h2>
                      <span className="pill pillAccent">Live Ledger</span>
                    </div>
                    <p className="smallText mutedText">Created on {formatDate(selectedIncident.date)}</p>
                  </div>
                  <div className="rowWrap noShrink">
                    <Button size={isCompact ? 'small' : 'medium'} onClick={() => exportReportAsTxt(selectedIncident)} title="Export plain text">
                      <FileText /> TXT
                    </Button>
                    <Button size={isCompact ? 'small' : 'medium'} onClick={() => exportReportAsPdf(selectedIncident)} disabled={exportingPdf} title="Export styled PDF for records">
                      <FileDown /> Export PDF
                    </Button>
                    <Button size={isCompact ? 'small' : 'medium'} variant="primary" onClick={() => exportReportAsZip(selectedIncident)} disabled={exporting} title="ZIP with text and audio files">
                      <Download /> Download
                    </Button>
                  </div>
                </div>

                <div className={styles.summaryGrid}>
                  <div><span className={styles.summaryLabel}>Start Time</span><span>{formatDate(selectedIncident.startTime)}</span></div>
                  <div><span className={styles.summaryLabel}>End Time</span><span>{formatDate(selectedIncident.endTime)}</span></div>
                  <div><span className={styles.summaryLabel}>Message Count</span><span>{selectedIncident.audios.length} transmissions</span></div>
                  <div><span className={styles.summaryLabel}>Identifier</span><span className="pill pillAccent">RE-{String(selectedIncident.id).padStart(5, '0')}</span></div>
                </div>

                <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                  <p className="eyebrow">Incident Description</p>
                  <p className={cardStyles.description}>{selectedIncident.description || 'No description available.'}</p>
                </div>
              </header>

              {/* TABS & CONTENT */}
              <div className={styles.contentCard}>
                <Tabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isCompact={isCompact}
                />
                <div className={styles.scrollContent}>
                  {activeTab === 'transcription' && (
                    <div className="stack">
                      <div className="rowBetween">
                        <h3 className={cardStyles.title}>Transcriptions</h3>
                        <span className="pill pillSuccess">Verified</span>
                      </div>
                      <div className="stack">
                        {selectedIncident.audios.map(audio => (
                          <AudioPlayer
                            key={audio.id}
                            audioId={audio.id}
                            url={audio.url}
                            source={getDisplaySource(audio.source)}
                            transcription={audio.transcription}
                            recordedAt={audio.recordedAt}
                            formatDate={formatDate}
                            isCompact={isCompact}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'metadata' && (
                    <div className="stack">
                      <h3 className={cardStyles.title}>Incident Metadata</h3>
                      <div className="gridTwo">
                        <div className={styles.metadataCard}><MapPin className="iconMedium" /><div><div className="tinyText mutedText">Channels Involved</div><div className="smallText">{getChannelsInvolvedLabel(selectedIncident)}</div></div></div>
                        <div className={styles.metadataCard}><AlertTriangle className="iconMedium" /><div><div className="tinyText mutedText">Severity</div><div className="smallText">{selectedIncident.severity}</div></div></div>
                        <div className={styles.metadataCard}><Tag className="iconMedium" /><div><div className="tinyText mutedText">Incident ID</div><div className="smallText">{selectedIncident.id}</div></div></div>
                        <div className={styles.metadataCard}><Clock className="iconMedium" /><div><div className="tinyText mutedText">Created At</div><div className="smallText">{formatDate(selectedIncident.date)}</div></div></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          ) : (
            <div className={styles.empty}>
              <div>
                <Radio className="iconLarge" />
                <h3>No Incident Selected</h3>
                <p>Select an incident report from the list to view details.</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE MENU TOGGLE */}
      <div className={styles.floatingToggle}>
        <Button size="icon" variant="primary" onClick={() => setIsMobileMenuOpen(prev => !prev)} aria-label="Toggle incident report list">
          <List />
        </Button>
      </div>

      {/* GLOBAL SCROLLBAR STYLES */}
    </div>
  );

};

export default IncidentReportsUI;
