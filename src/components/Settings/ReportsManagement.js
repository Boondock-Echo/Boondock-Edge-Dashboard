import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect, useRef, Fragment } from 'react';
import { useAuth } from '../AuthContext';
import { Clock, Calendar, File, AlertTriangle, Mic, Tag, FileText, List, Search, Play, Pause, 
  ChevronDown, ChevronUp, Radio, MapPin, Download, Edit, Trash2, Copy, FileDown } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { buildIncidentReportPdfBlob, incidentReportPdfFilename, fetchBrandingForPdf } from '../../utils/incidentReportPdf';

/**
 * AUDIO PLAYER
 */
const AudioPlayer = ({
  audioId,
  url,
  source,
  transcription,
  recordedAt,
  isPlaying,
  onTogglePlay,
  themeClasses,
  formatDate,
  audioRefs,
  isDarkMode,
  isCompact = false
}) => {
  const setRef = (el) => {
    if (el) {
      audioRefs.current[audioId] = el;
      el.src = url;
      if (isPlaying) {
        el.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const audioEl = audioRefs.current[audioId];
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }, [isPlaying, audioId, url]);

  return (
    <div className={`rounded-xl ${isCompact ? 'p-2.5' : 'p-4'} border transition-all duration-200 hover:shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
      <div className="flex items-start space-x-3">
        <div
          onClick={() => onTogglePlay(audioId, url)}
          className={`
            ${isCompact ? 'w-8 h-8' : 'w-10 h-10'} flex-shrink-0
            ${themeClasses.cardHover}
            ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}
            rounded-full flex items-center justify-center
            cursor-pointer transition-all duration-200
            group
          `}
        >
          <button
            className={`
              p-2 rounded-full
              bg-transparent
              ${themeClasses.secondaryBtn}
              focus:outline-none focus:ring-2 ${isDarkMode ? 'focus:ring-blue-500' : 'focus:ring-blue-500'}
            `}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} ${isDarkMode ? 'text-blue-300 group-hover:text-blue-200' : 'text-[#003178] group-hover:text-blue-700'} transition-colors`} />
            ) : (
              <Play className={`${isCompact ? 'w-3 h-3' : 'w-4 h-4'} ${isDarkMode ? 'text-blue-300 group-hover:text-blue-200' : 'text-[#003178] group-hover:text-blue-700'} transition-colors`} />
            )}
          </button>
          <audio
            ref={setRef}
            onEnded={() => onTogglePlay(audioId, null)}
          />
        </div>

        <div className="flex-1">
          <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${isCompact ? 'mb-0.5' : ''}`}>
            <span className={`text-xs uppercase tracking-wide font-bold ${themeClasses.staticText}`}>{source}</span>
            <span className={`text-[11px] ${themeClasses.staticMutedText}`}>{formatDate(recordedAt)}</span>
          </div>
          <p className={`${isCompact ? 'mt-0.5 text-xs leading-5' : 'mt-1 text-sm'} ${themeClasses.staticSecondaryText}`}>{transcription}</p>
          <div className={`${isCompact ? 'mt-1.5' : 'mt-2'} flex flex-wrap gap-4 text-[11px] ${themeClasses.staticMutedText}`}>
            <span className="inline-flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{formatDate(recordedAt)}</span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <Mic className="w-3 h-3" />
              <span>{source}</span>
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(transcription || '')}
              className={`inline-flex items-center space-x-1 font-semibold ${themeClasses.staticAccent} hover:underline`}
            >
              <Copy className="w-3 h-3" />
              <span>COPY</span>
            </button>
            <span className="inline-flex items-center space-x-1 font-semibold">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${themeClasses.staticAccent} hover:underline`}
              >
                SAVE AUDIO
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * TAB NAVIGATION
 */
const Tabs = ({ activeTab, setActiveTab, themeClasses, isDarkMode, isCompact = false }) => (
  <nav className={`flex border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
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
          className={`
            flex items-center ${isCompact ? 'px-4 py-2.5 text-xs' : 'px-6 py-4 text-sm'} font-semibold
            transition-colors duration-200
            ${isActive
              ? `${isDarkMode ? 'border-b-2 border-blue-400 text-slate-100' : 'border-b-2 border-[#003178] text-[#003178]'}`
              : `${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          `}
        >
          <Icon className={`w-4 h-4 mr-2 ${isActive ? (isDarkMode ? 'text-blue-500' : 'text-blue-500') : ''}`} />
          {tab.label}
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
  themeClasses,
  isDarkMode,
  isCompact = false,
  formatDate,
  getRelativeTime,
  deleteIncident, // Add deleteIncident prop
  deleteLoading, // Add deleteLoading prop
  setIsUpdateModalOpen, // Add setIsUpdateModalOpen prop for edit button
  setSelectedIncident, // Add setSelectedIncident prop
}) => {
  const severityClasses = {
    high: `bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/30`,
    medium: `bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/30`,
    low: `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/30`
  }[report.severity.toLowerCase()];
  const incidentCode = `RE-${String(report.id).padStart(5, '0')}`;

  return (
    <div
      onClick={() => onClick(report.id)}
      className={`
        ${isCompact ? 'p-2.5' : 'p-4'} rounded-xl transition-all duration-200 cursor-pointer border
        ${isExpanded
          ? `${isDarkMode ? 'bg-blue-500/15 border-blue-500/60' : 'bg-blue-50 border-[#003178]/30'}`
          : `${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/70' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
      `}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold tracking-tight ${isExpanded ? themeClasses.accent : themeClasses.staticMutedText}`}>
              {incidentCode}
            </span>
            <span className={`text-[10px] uppercase ${themeClasses.staticMutedText}`}>
              {getRelativeTime(report.date)}
            </span>
          </div>
          <h3 className={`font-semibold ${isCompact ? 'text-xs' : 'text-sm'} ${isExpanded ? themeClasses.accent : themeClasses.primaryText}`}>
            {report.title}
          </h3>
          <div className={`flex flex-wrap items-center text-[10px] ${isCompact ? 'mt-0.5 space-x-2' : 'mt-1 space-x-3'} ${themeClasses.staticMutedText}`}>
            <span className="inline-flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(report.date)}</span>
            </span>
            <span className="inline-flex items-center space-x-1">
              <MapPin className="w-3 h-3" />
              <span>{report.location}</span>
            </span>
          </div>
        </div>
        <button className="p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          {isExpanded
            ? <ChevronUp className={`w-4 h-4 ${themeClasses.accent}`} />
            : <ChevronDown className={`w-4 h-4 ${themeClasses.mutedText}`} />
          }
        </button>
      </div>

      {isExpanded && (
        <div className={`${isCompact ? 'mt-2 pl-0' : 'mt-3 pl-1'}`}>
          <div className="flex items-center space-x-3 flex-wrap">
            <div className={`px-2 py-0.5 rounded-md text-xs flex items-center border ${severityClasses}`}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {report.severity} Severity
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">
              {report.audios.length} audio file{report.audios.length !== 1 ? 's' : ''}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              Active
            </span>
            {/* Edit Button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the parent onClick
                setSelectedIncident(report);
                setIsUpdateModalOpen(true);
              }}
              className={`p-2 rounded-full ${themeClasses.secondaryBtn} shadow-sm hover:shadow transition-shadow`}
              title="Edit Incident"
            >
              <Edit className="w-4 h-4" />
            </button>
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the parent onClick
                deleteIncident(report.id);
              }}
              disabled={deleteLoading}
              className={`p-2 rounded-full ${deleteLoading ? 'bg-red-400' : 'bg-red-600'} hover:bg-red-700 text-white shadow hover:shadow-lg transition-shadow`}
              title="Delete Incident"
            >
              {deleteLoading ? (
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            className={`${isCompact ? 'mt-2 text-[10px] px-2 py-1' : 'mt-3 text-[11px] px-3 py-1.5'} font-bold rounded-lg ${isDarkMode ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-[#003178] hover:bg-blue-100'}`}
          >
            Click to view details
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * UPDATE INCIDENT MODAL
 */
const UpdateIncidentModal = ({ 
  isOpen, 
  onClose, 
  incident, 
  onUpdate, 
  themeClasses, 
  formatDate,
  isDarkMode 
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
        startTime: incident.startTime ? formatDateTimeForInput(incident.startTime) : '',
        endTime: incident.endTime ? formatDateTimeForInput(incident.endTime) : '',
        severity: incident.severity ? incident.severity.toLowerCase() : 'low'
      });
    }
  }, [isOpen, incident]); // Added isOpen to dependencies

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
    
    // Get the timezone from localStorage or use UTC as fallback
    let timezone = localStorage.getItem('cached_timezone') || 'Etc/UTC';
    
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


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Convert local datetime inputs back to UTC for server storage
      const convertLocalToUTC = (localDateTime) => {
        if (!localDateTime) return "";
        
        // Create a date object from the local datetime input
        const localDate = new Date(localDateTime);
        
        // Convert to UTC ISO string
        return localDate.toISOString();
      };

      await onUpdate({
        ...incident,
        ...formData,
        
        startTime: formData.startTime ? convertLocalToUTC(formData.startTime) : incident.startTime,
        endTime: formData.endTime ? convertLocalToUTC(formData.endTime) : incident.endTime,
        severity: formData.severity.charAt(0).toUpperCase() + formData.severity.slice(1),
      });
      onClose();
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  

  if (!isOpen) return null;

  return (
  <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] transition-opacity duration-300 ease-out"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <div
        className={`rounded-xl p-8 w-full max-w-lg mx-4 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        } shadow-2xl transform transition-all duration-300 ease-out scale-100 hover:scale-100 focus:scale-100`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        // Add focus:outline-none to prevent default focus ring since we handle it
        // biome-ignore lint/a11y/noAutofocus: Autofocus is used here to trap focus in the modal
        autoFocus
      >
        <div className="flex justify-between items-center mb-6">
          <h2
            id="modal-title"
            className={`text-2xl font-semibold ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            } tracking-tight`}
          >
            Update Incident
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-full ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              className={`block text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } mb-2`}
            >
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
            <label
              className={`block text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } mb-2`}
            >
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
              <label
                className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                } mb-2`}
              >
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
              <label
                className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                } mb-2`}
              >
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
            <label
              className={`block text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              } mb-2`}
            >
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
              onClick={onClose}
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
              className={`px-5 py-2.5 rounded-lg ${
                isDarkMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              } transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={formData.name === '' || formData.startTime === '' || formData.endTime === '' || formData.severity === ''}
            >
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * MAIN INCIDENT REPORTS UI
 */
const IncidentReportsUI = ({ 
  isDarkMode = false,
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
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [operationError, setOperationError] = useState(null);
  const audioRefs = useRef({});
  const { user } = useAuth();
  const [settingsTimezone, setSettingsTimezone] = useState(null);
  const [channelsById, setChannelsById] = useState({});
  const isCompact = densityMode === 'compact';

  // THEME CLASSES
  const themeClasses = {
    mainBg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    contentBg: isDarkMode ? 'bg-slate-900' : 'bg-white',
    header: isDarkMode ? 'bg-slate-900' : 'bg-white',
    sidebarBg: isDarkMode ? 'bg-slate-950' : 'bg-slate-50',
    primaryText: isDarkMode ? 'text-slate-100' : 'text-slate-900',
    secondaryText: isDarkMode ? 'text-slate-300' : 'text-slate-700',
    mutedText: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    border: isDarkMode ? 'border-slate-800' : 'border-slate-200',
    cardHover: isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100',
    input: isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300',
    inputFocus: isDarkMode
      ? 'focus:ring-blue-500 focus:border-blue-500'
      : 'focus:ring-blue-500 focus:border-blue-500',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondaryBtn: isDarkMode
      ? 'bg-slate-800 hover:bg-slate-700 text-white'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    accent: isDarkMode ? 'text-blue-300' : 'text-[#003178]',
    accentBg: isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50',
    selectedItem: isDarkMode
      ? 'bg-blue-900/50 ring-1 ring-blue-500/50'
      : 'bg-blue-50 ring-1 ring-blue-200',
    // Additional static colors for better dark mode visibility
    staticText: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    staticSecondaryText: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    staticMutedText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    staticAccent: isDarkMode ? 'text-blue-400' : 'text-blue-600',
    staticIcon: isDarkMode ? 'text-blue-400' : 'text-blue-500',
    staticSuccess: isDarkMode ? 'text-green-400' : 'text-green-600',
    staticWarning: isDarkMode ? 'text-amber-400' : 'text-amber-600',
    staticError: isDarkMode ? 'text-red-400' : 'text-red-600',
  };

  // PARSE / FORMAT DATES
  const parseCustomDate = (dateString) => {
    if (!dateString) return null;
    if (/^\d{8}_\d{6}$/.test(dateString)) {
      const year = dateString.slice(0, 4);
      const month = dateString.slice(4, 6);
      const day = dateString.slice(6, 8);
      const hour = dateString.slice(9, 11);
      const minute = dateString.slice(11, 13);
      const second = dateString.slice(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }
    return new Date(dateString);
  };
 const formatDate = (dateString) => {
  const date = parseCustomDate(dateString);
  if (!date || isNaN(date.getTime())) return 'Invalid Date';
  
  // Get the timezone from settings if available, else from cache, else UTC
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
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone
  }).format(date);
};

  const getRelativeTime = (dateString) => {
    const date = parseCustomDate(dateString);
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
        // fetch timezone settings first (best-effort)
        try {
          const settingsResp = await apiFetch(`/settings`).catch(() => null);
          let settingsData = null;
          if (settingsResp && settingsResp.ok) {
            settingsData = await settingsResp.json();
          } else {
            const fallbackResp = await apiFetch(`/settings`).catch(() => null);
            if (fallbackResp && fallbackResp.ok) settingsData = await fallbackResp.json();
          }
          const tz = settingsData?.global_timezone;
          if (tz) {
            try {
              new Intl.DateTimeFormat('en-US', { timeZone: tz });
              setSettingsTimezone(tz);
              localStorage.setItem('cached_timezone', tz);
            } catch {}
          }
        } catch {}

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

  // TOGGLE AUDIO PLAYBACK
  const toggleAudio = (audioId, url) => {
    if (playingAudioId && playingAudioId !== audioId) {
      audioRefs.current[playingAudioId]?.pause();
      setPlayingAudioId(null);
    }

    if (playingAudioId === audioId) {
      audioRefs.current[audioId]?.pause();
      setPlayingAudioId(null);
    } else {
      const newAudio = audioRefs.current[audioId];
      if (!newAudio) return;
      newAudio.src = url;
      newAudio.play().catch(() => {});
      setPlayingAudioId(audioId);
    }
  };

  // Build TXT content (shared by TXT and ZIP)
  const buildReportTxtContent = (report) => {
    // timezone resolution
    const tz = (() => {
      const cached = settingsTimezone || localStorage.getItem('cached_timezone') || 'Etc/UTC';
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: cached });
        return cached;
      } catch {
        return 'Etc/UTC';
      }
    })();

    const getTzAbbrev = (date) => {
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date);
        const part = parts.find(p => p.type === 'timeZoneName');
        return part?.value?.replace('GMT', 'UTC') || 'UTC';
      } catch {
        return 'UTC';
      }
    };

    const parseDate = (dateString) => {
      if (!dateString) return null;
      if (/^\d{8}_\d{6}$/.test(dateString)) {
        const y = Number(dateString.slice(0, 4));
        const m = Number(dateString.slice(4, 6)) - 1;
        const d = Number(dateString.slice(6, 8));
        const hh = Number(dateString.slice(9, 11));
        const mm = Number(dateString.slice(11, 13));
        const ss = Number(dateString.slice(13, 15));
        return new Date(Date.UTC(y, m, d, hh, mm, ss));
      }
      return new Date(dateString);
    };

    const formatForReport = (dateString) => {
      const date = parseDate(dateString);
      if (!date || isNaN(date.getTime())) return 'Invalid Date';
      const use12h = timeFormat !== '24h';
      const fmt = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: use12h, timeZone: tz,
      });
      const abbr = getTzAbbrev(date);
      return `${fmt.format(date)} (${abbr})`;
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
      const branding = await fetchBrandingForPdf();
      const blob = await buildIncidentReportPdfBlob(report, {
        user,
        timeFormat,
        settingsTimezone,
        channelsById,
        organizationName: branding.organizationName,
        logoDataUrl: branding.logoDataUrl,
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
      <div className={`flex flex-col items-center justify-center h-screen ${themeClasses.mainBg} ${themeClasses.staticText}`}>
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className={`text-lg ${themeClasses.staticText}`}>Loading incident reports...</p>
      </div>
    );
  }

  // ERROR STATE
  if (error && reports.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen ${themeClasses.mainBg} ${themeClasses.staticText}`}>
        <div className={`p-6 rounded-lg ${themeClasses.contentBg} max-w-md text-center shadow-lg`}>
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${themeClasses.staticText}`}>Unable to Load Reports</h2>
          <p className={`${themeClasses.staticSecondaryText} mb-4`}>{error}</p>
          <button
            className={`px-4 py-2 rounded ${themeClasses.primaryBtn}`}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen ${themeClasses.mainBg} overflow-hidden`}>
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside
          className={`
            absolute lg:relative lg:flex w-full ${isCompact ? 'lg:w-[30%]' : 'lg:w-4/12'} border-r ${themeClasses.border} ${themeClasses.sidebarBg} z-10 h-full flex-col 
            transform transition-transform duration-300
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className={`${isCompact ? 'p-2.5' : 'p-4'} sticky top-0 z-10 ${themeClasses.sidebarBg} border-b ${themeClasses.border}`}>
            <div className="relative">
              <Search className={`absolute left-3 ${isCompact ? 'top-2.5' : 'top-3'} w-4 h-4 ${themeClasses.mutedText}`} />
              <input
                type="text"
                placeholder="Filter by unit or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-10 pr-4 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} rounded-lg ${themeClasses.input} 
                  ${themeClasses.inputFocus} ${themeClasses.primaryText}
                `}
              />
            </div>
            <div className={`flex justify-between items-center ${isCompact ? 'mt-2.5' : 'mt-4'}`}>
              <h2 className={`${isCompact ? 'text-sm' : 'text-lg'} font-bold ${themeClasses.staticText}`}>Incident Reports</h2>
              <span className={`text-xs px-2 py-1 rounded-md ${themeClasses.accentBg} ${themeClasses.staticText}`}>
                {filteredReports.length}
              </span>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {filteredReports.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full ${themeClasses.staticMutedText}`}>
                <File className="w-12 h-12 mb-2 opacity-50" />
                <p className={`text-sm ${themeClasses.staticMutedText}`}>No matching reports found</p>
              </div>
            ) : (
              <div className={`${isCompact ? 'space-y-2 p-2' : 'space-y-3 p-3'}`}>
                {filteredReports.map(r => (
                  <ReportListItem
                    key={r.id}
                    report={r}
                    isExpanded={expandedReportId === r.id}
                    onClick={toggleReport}
                    themeClasses={themeClasses}
                    isDarkMode={isDarkMode}
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
        <main className={`w-full ${isCompact ? 'lg:w-[70%]' : 'lg:w-8/12'} flex flex-col h-full ${themeClasses.contentBg}`}>
          {selectedIncident ? (
            <Fragment>
              {/* HEADER */}
              <header className={`${isCompact ? 'p-3.5' : 'p-6'} border-b ${themeClasses.border} ${themeClasses.contentBg}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className={`${isCompact ? 'text-lg' : 'text-2xl'} font-bold ${themeClasses.staticText}`}>
                        {selectedIncident.title}
                      </h2>
                      <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-1 rounded ${isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-[#003178]'}`}>
                        Live Ledger
                      </span>
                    </div>
                    <div className={`flex flex-wrap items-center ${isCompact ? 'space-x-3 mt-1 text-xs' : 'space-x-6 mt-2 text-sm'} ${themeClasses.staticSecondaryText}`}>
                      <span>Created on {formatDate(selectedIncident.date)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => exportReportAsTxt(selectedIncident)}
                      className={`
                        ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl ${themeClasses.secondaryBtn}
                        border ${themeClasses.border} transition-shadow
                      `}
                      title="Export plain text"
                    >
                      <span className={`inline-flex items-center gap-2 ${isCompact ? 'text-xs' : 'text-sm'} font-semibold`}>
                        <FileText className="w-4 h-4" />
                        TXT
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportReportAsPdf(selectedIncident)}
                      disabled={exportingPdf}
                      className={`
                        ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl ${themeClasses.secondaryBtn}
                        border ${isDarkMode ? 'border-blue-500/40' : 'border-[#003178]/35'} transition-shadow
                        ${isDarkMode ? 'ring-1 ring-blue-500/20' : ''}
                        ${exportingPdf ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      title="Export styled PDF for records"
                    >
                      <span className={`inline-flex items-center gap-2 ${isCompact ? 'text-xs' : 'text-sm'} font-semibold`}>
                        <FileDown className="w-4 h-4" />
                        Export PDF
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportReportAsZip(selectedIncident)}
                      disabled={exporting}
                      className={`
                        ${isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl ${themeClasses.primaryBtn} 
                        ${exporting ? 'opacity-50 cursor-not-allowed' : ''}
                        border border-transparent transition-shadow
                      `}
                      title="ZIP with text and audio files"
                    >
                      <span className={`inline-flex items-center gap-2 ${isCompact ? 'text-xs' : 'text-sm'} font-semibold`}>
                        <Download className="w-4 h-4" />
                        Download
                      </span>
                    </button>
                  </div>
                </div>
                <div className={`${isCompact ? 'mt-3 p-2.5 text-xs gap-2' : 'mt-6 p-4 text-sm gap-4'} grid grid-cols-2 md:grid-cols-4 ${themeClasses.staticSecondaryText} ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} rounded-xl border ${themeClasses.border}`}>
                  <div>
                    <span className={`block ${isCompact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider ${themeClasses.staticMutedText}`}>Start Time</span>
                    <span className="font-medium">{formatDate(selectedIncident.startTime)}</span>
                  </div>
                  <div>
                    <span className={`block ${isCompact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider ${themeClasses.staticMutedText}`}>End Time</span>
                    <span className="font-medium">{formatDate(selectedIncident.endTime)}</span>
                  </div>
                  <div>
                    <span className={`block ${isCompact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider ${themeClasses.staticMutedText}`}>Message Count</span>
                    <span className="font-medium">{selectedIncident.audios.length} transmissions</span>
                  </div>
                  <div>
                    <span className={`block ${isCompact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider ${themeClasses.staticMutedText}`}>Identifier</span>
                    <span className={`font-medium ${themeClasses.accent}`}>RE-{String(selectedIncident.id).padStart(5, '0')}</span>
                  </div>
                </div>
                <div className={`${isCompact ? 'mt-3 p-2.5' : 'mt-6 p-4'} ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} rounded-xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} shadow-sm`}>
                  <h3 className={`font-semibold uppercase ${isCompact ? 'text-[10px] mb-1' : 'text-xs mb-2'} tracking-wider ${themeClasses.staticMutedText}`}>Incident Description</h3>
                  <p className={`${themeClasses.staticSecondaryText}`}>
                    {selectedIncident.description || 'No description available.'}
                  </p>
                </div>
              </header>

              {/* TABS & CONTENT */}
              <div className={`flex-1 flex flex-col overflow-hidden ${isCompact ? 'mt-2 mx-3 mb-3' : 'mt-4 mx-6 mb-6'} ${isDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-2xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} shadow-sm`}>
                <Tabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  themeClasses={themeClasses}
                  isDarkMode={isDarkMode}
                  isCompact={isCompact}
                />
                <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-3 space-y-3' : 'p-6 space-y-6'} ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  {activeTab === 'transcription' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className={`${isCompact ? 'text-sm' : 'text-lg'} font-semibold ${themeClasses.staticText}`}>
                          Transcriptions
                        </h3>
                        <div className={`flex items-center space-x-1 ${themeClasses.staticSuccess} text-sm font-medium`}>
                          <span className={`${isDarkMode ? 'bg-red-400' : 'bg-[#720009]'} w-2 h-2 rounded-full`}></span>
                          <span>Verified</span>
                        </div>
                      </div>
                      <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
                        {selectedIncident.audios.map(audio => (
                          <AudioPlayer
                            key={audio.id}
                            audioId={audio.id}
                            url={audio.url}
                            source={getDisplaySource(audio.source)}
                            transcription={audio.transcription}
                            recordedAt={audio.recordedAt}
                            isPlaying={playingAudioId === audio.id}
                            onTogglePlay={toggleAudio}
                            themeClasses={themeClasses}
                            formatDate={formatDate}
                            audioRefs={audioRefs}
                            isDarkMode={isDarkMode}
                            isCompact={isCompact}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'metadata' && (
                    <div>
                      <h3 className={`${isCompact ? 'text-sm mb-2' : 'text-lg mb-4'} font-semibold ${themeClasses.staticText}`}>
                        Incident Metadata
                      </h3>
                      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 ${isCompact ? 'gap-3' : 'gap-6'}`}>
                        <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl p-4 flex items-center space-x-3 shadow-sm border`}>
                          <MapPin className={`w-5 h-5 ${themeClasses.staticIcon}`} />
                          <div>
                            <div className={`text-xs ${themeClasses.staticMutedText}`}>
                              Channels Involved
                            </div>
                            <div className={`text-sm ${themeClasses.staticText}`}>
                              {getChannelsInvolvedLabel(selectedIncident)}
                            </div>
                          </div>
                        </div>

                        <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl p-4 flex items-center space-x-3 shadow-sm border`}>
                          <AlertTriangle className={`w-5 h-5 ${themeClasses.staticError}`} />
                          <div>
                            <div className={`text-xs ${themeClasses.staticMutedText}`}>
                              Severity
                            </div>
                            <div className={`text-sm ${themeClasses.staticText}`}>
                              {selectedIncident.severity}
                            </div>
                          </div>
                        </div>

                        <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl p-4 flex items-center space-x-3 shadow-sm border`}>
                          <Tag className={`w-5 h-5 ${themeClasses.staticIcon}`} />
                          <div>
                            <div className={`text-xs ${themeClasses.staticMutedText}`}>
                              Incident ID
                            </div>
                            <div className={`text-sm ${themeClasses.staticText}`}>
                              {selectedIncident.id}
                            </div>
                          </div>
                        </div>

                        <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-xl p-4 flex items-center space-x-3 shadow-sm border`}>
                          <Clock className={`w-5 h-5 ${themeClasses.staticIcon}`} />
                          <div>
                            <div className={`text-xs ${themeClasses.staticMutedText}`}>
                              Created At
                            </div>
                            <div className={`text-sm ${themeClasses.staticText}`}>
                              {formatDate(selectedIncident.date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          ) : (
            <div className={`flex flex-col items-center justify-center h-full ${themeClasses.staticMutedText}`}>
              <div className={`p-8 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-blue-50'} mb-4 shadow-lg`}>
                <Radio className={`w-16 h-16 ${themeClasses.staticAccent} opacity-60`} />
              </div>
              <h3 className={`text-xl font-medium ${themeClasses.staticSecondaryText} mb-2`}>
                No Incident Selected
              </h3>
              <p className={`text-sm max-w-md text-center ${themeClasses.staticMutedText}`}>
                Select an incident report from the list to view details.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* MOBILE MENU TOGGLE */}
      <div className="lg:hidden fixed bottom-6 right-6 z-20">
        <button
          className="bg-blue-600 text-white p-3 rounded-full shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        >
          <List className="w-6 h-6" />
        </button>
      </div>

      {/* GLOBAL SCROLLBAR STYLES */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDarkMode ? 'rgba(15,23,42,0.1)' : 'rgba(243,244,246,0.7)'};
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'};
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.4)'};
        }
        @media (max-width: 768px) {
          .custom-scrollbar::-webkit-scrollbar {
            width: 3px;
          }
        }
      `}</style>

    </div>
  );
};

export default IncidentReportsUI;
