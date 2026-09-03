import { useState, useRef, useEffect } from 'react';
import { X, Clock, Tag, Radio, User, CheckCheck, Moon, Sun, LayoutList } from 'lucide-react';
import SystemClock from './SystemClock';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../AuthContext';
import {
  TIME_FILTERS,
  INBOX_TIME_RANGE_DROPDOWN_ORDER,
  getDefaultCustomRangeDates,
} from '../../utils/inboxViewWindow';

const TopBar = ({
  timeFilter,
  setTimeFilter,
  showTime,
  setShowTime,
  showCar,
  setShowCar,
  showChannel,
  setShowChannel,
  showPerson,
  setShowPerson,
  branding,
  isDarkMode,
  timezone,
  setTimezone,
  isMobile,
   isMultiSelectMode,
  setIsMultiSelectMode,
  setSelectedMessages,
  selectedMessages,
  toggleMultiSelectMode,
  edgeServerEndpoint,
  userRole,
  showFullTimestamps,
  setShowFullTimestamps,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  toggleTheme,
  timeFormat = "24h",
  isVolumeOn,
  setIsVolumeOn,
  inboxViewMode,
  onInboxViewModeChange,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions(edgeServerEndpoint);
  
  // Show settings button only if user has access_settings permission or is admin
  const canAccessSettings = user?.role === 'admin' || hasPermission('access_settings');
  
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [isViewModalClosing, setIsViewModalClosing] = useState(false);
  const viewModalTimerRef = useRef(null);

  // Clear any pending timers on unmount (MEDIUM-29)
  useEffect(() => {
    return () => {
      if (viewModalTimerRef.current) clearTimeout(viewModalTimerRef.current);
    };
  }, []);

//  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const closeViewModal = () => {
    setIsViewModalClosing(true);
    if (viewModalTimerRef.current) clearTimeout(viewModalTimerRef.current);
    viewModalTimerRef.current = setTimeout(() => {
      setIsViewSettingsOpen(false);
      setIsViewModalClosing(false);
    }, 300);
  };

  const applyTimeRangePreset = (value) => {
    if (value === TIME_FILTERS.CUSTOM) {
      setTimeFilter(TIME_FILTERS.CUSTOM);
      if (!startDate || !endDate) {
        const d = getDefaultCustomRangeDates();
        setStartDate(d.startDate);
        setEndDate(d.endDate);
      }
      return;
    }
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setTimeFilter(value);
  };

  const commonStyles = {
    modalBackground: isDarkMode ? 'bg-gray-900' : 'bg-white',
    borderColor: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    textColor: isDarkMode ? 'text-white' : 'text-gray-800',
    secondaryTextColor: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    buttonBackground: isDarkMode ? 'bg-gray-800' : 'bg-gray-100',
    buttonHoverBackground: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200',
    toggleInactive: isDarkMode ? 'bg-gray-700' : 'bg-gray-200',
    inputBackground: isDarkMode ? 'bg-gray-800' : 'bg-gray-50',
    // Static colors for better visibility in dark mode
    headerColor: 'var(--ui-text)',
    iconColor: 'var(--ui-accent)',
    accentColor: 'var(--ui-accent)',
  };


  return (
    <>
      <div
        className={`sticky top-0 z-30 border-b shadow-sm backdrop-blur-md transition-colors duration-300 dark:shadow-none ${
          isDarkMode
            ? "border-slate-800 bg-slate-950/80"
            : "border-slate-200/60 bg-white/80"
        }`}
      >
        <div className={`flex h-16 items-center justify-between ${isMobile ? "px-3" : "px-6 md:px-8"}`}>
          <div className="flex min-w-0 items-center gap-4 md:gap-8">
            {isMobile ? (
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  isDarkMode ? "bg-slate-800" : "bg-slate-100"
                }`}
                title="Messages"
              >
                <span className="material-symbols-outlined text-[20px] text-primary">dashboard</span>
              </div>
            ) : (
              <div className="min-w-0">
                <h2
                  className={`font-headline text-lg font-semibold tracking-tight md:text-xl ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Messages
                </h2>
                <p
                  className={`hidden text-xs font-normal md:block ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
                >
                  Transcripts and audio for your channels
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
            <div
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-1.5 py-1 md:px-2 md:py-1.5 ${
                isDarkMode ? 'border-slate-600 bg-slate-800/90' : 'border-slate-200 bg-slate-50'
              }`}
              title="Time range shown in the inbox"
            >
              <Clock
                className={`h-3.5 w-3.5 flex-shrink-0 md:h-4 md:w-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                aria-hidden
              />
              {!isMobile && (
                <span
                  className={`hidden text-[10px] font-bold uppercase tracking-wide sm:inline ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}
                >
                  View
                </span>
              )}
              <label htmlFor="topbar-inbox-time-range" className="sr-only">
                Inbox time range
              </label>
              <select
                id="topbar-inbox-time-range"
                value={timeFilter}
                onChange={(e) => applyTimeRangePreset(e.target.value)}
                className={`min-w-0 max-w-[6.5rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-6 text-xs font-bold outline-none focus:ring-0 sm:max-w-[10rem] md:max-w-[12rem] ${
                  isDarkMode ? 'text-slate-100' : 'text-slate-800'
                }`}
                aria-label="Inbox time range"
              >
                {INBOX_TIME_RANGE_DROPDOWN_ORDER.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleMultiSelectMode}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                isMultiSelectMode
                  ? "bg-primary text-on-primary"
                  : "bg-blue-900/40 text-blue-200 hover:bg-blue-900/55"
              } ${isMobile ? "px-2 py-1.5" : ""}`}
              title={isMultiSelectMode ? "Exit select" : "Select messages"}
            >
              {isMobile ? (
                <CheckCheck className="h-4 w-4" />
              ) : isMultiSelectMode ? (
                "Exit select"
              ) : (
                "Select messages"
              )}
            </button>

            <div className={`hidden h-6 w-px md:block ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`} />

            {isVolumeOn !== undefined && setIsVolumeOn && (
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 md:px-3 ${
                  isDarkMode ? "bg-slate-800/90" : "bg-slate-50"
                }`}
              >
                <div
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    isVolumeOn ? "bg-tertiary ledger-live-pulse" : isDarkMode ? "bg-slate-600" : "bg-slate-300"
                  }`}
                />
                {!isMobile && (
                  <span
                    className={`text-[10px] font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    LIVE
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsVolumeOn(!isVolumeOn)}
                  className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
                    isVolumeOn ? "bg-primary" : isDarkMode ? "bg-slate-600" : "bg-slate-300"
                  }`}
                  title={isVolumeOn ? "Turn off live mode" : "Turn on live mode"}
                  aria-label="Toggle live mode"
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      isVolumeOn ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsViewSettingsOpen(true)}
              className={`rounded-lg p-2 transition-colors ${
                isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
              }`}
              aria-label="View settings"
              title="View settings"
            >
              <span className="material-symbols-outlined text-[22px] leading-none">visibility</span>
            </button>

            {canAccessSettings && (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className={`rounded-lg p-2 transition-colors ${
                  isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                }`}
                aria-label="Settings"
                title="Settings"
              >
                <span className="material-symbols-outlined text-[22px] leading-none">settings</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/report")}
              className={`hidden rounded-lg p-2 transition-colors md:inline-flex ${
                isDarkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
              }`}
              aria-label="Reports"
              title="Incident reports"
            >
              <span className="material-symbols-outlined text-[22px] leading-none">assignment</span>
            </button>

            <SystemClock
              edgeServerEndpoint={edgeServerEndpoint}
              userRole={userRole}
              isDarkMode={isDarkMode}
              timeFormat={timeFormat}
              timezone={timezone}
              setTimezone={setTimezone}
            />
          </div>
        </div>

        {timeFilter === TIME_FILTERS.CUSTOM && (
          <div
            className={`border-t px-3 py-2.5 md:px-8 ${
              isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-slate-50/90'
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                Custom from / to (local date and time)
              </span>
              <button
                type="button"
                onClick={() => applyTimeRangePreset(TIME_FILTERS.DAYS7)}
                className={`text-xs font-semibold underline ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}
              >
                Use last 7 days
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
              <div className="space-y-1">
                <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>From date</label>
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-800 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>From time</label>
                <input
                  type="time"
                  value={startTime || ''}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="1"
                  lang="en-GB"
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-800 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>To date</label>
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-800 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
              <div className="space-y-1">
                <label className={`block text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>To time</label>
                <input
                  type="time"
                  value={endTime || ''}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="1"
                  lang="en-GB"
                  className={`w-full rounded-md border px-2 py-1.5 text-xs ${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-800 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Settings Modal */}
      {isViewSettingsOpen && (
        <div 
          className={`fixed inset-0 ${isDarkMode ? 'bg-gray-900/80' : 'bg-gray-800/30'} backdrop-blur-md z-30 flex items-center justify-center transitionuffed transition-opacity duration-300 ${isViewModalClosing ? 'opacity-0' : 'opacity-100'}`}
        >
          <div 
            className={`${commonStyles.modalBackground} rounded-2xl w-full max-w-[90%] md:max-w-md mx-4 shadow-2xl relative border ${commonStyles.borderColor} overflow-hidden transition-transform duration-300 ${isViewModalClosing ? 'scale-95' : 'scale-100'}`}
          >
            <div 
              className="absolute top-0 left-0 w-full h-1 transition-colors duration-300"
              style={{ backgroundColor: commonStyles.accentColor }}
            />

            <div className={`relative flex items-center justify-between p-3 md:p-4 border-b ${commonStyles.borderColor}`}>
              <h3 className={`text-base md:text-lg font-bold tracking-wide ${commonStyles.textColor} transition-colors duration-300`}>
                VIEW SETTINGS
              </h3>
              <button
                onClick={closeViewModal}
                className={`p-1 md:p-1.5 rounded-full ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} transition-colors duration-200`}
                aria-label="Close view settings"
              >
                <X className={`h-4 w-4 ${commonStyles.secondaryTextColor}`} />
              </button>
            </div>

            <div className="relative p-4 md:p-6 space-y-4 md:space-y-6">

              <div className="space-y-2 md:space-y-3">
                {[
                  { label: 'TIMING', icon: Clock, state: showTime, setState: setShowTime },
                  { label: 'TAG', icon: Tag, state: showCar, setState: setShowCar },
                  { label: 'CHANNEL', icon: Radio, state: showChannel, setState: setShowChannel },
                  { label: 'PERSON', icon: User, state: showPerson, setState: setShowPerson },
                ].map(({ label, icon: Icon, state, setState }) => (
                  <div 
                    key={label} 
                    className={`flex items-center justify-between p-2 md:p-3 rounded-lg border ${state ? 'border-opacity-50' : 'border-opacity-20'} transition-all duration-300`}
                    style={{ 
                      borderColor: state ? commonStyles.accentColor : commonStyles.borderColor,
                      backgroundColor: state ? 'rgb(var(--ui-accent-rgb) / 0.08)' : 'var(--ui-surface)'
                    }}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`p-1 md:p-1.5 rounded-lg ${state ? '' : commonStyles.buttonBackground} transition-all duration-300`}
                        style={{ backgroundColor: state ? 'rgb(var(--ui-accent-rgb) / 0.18)' : '' }}
                      >
                        <Icon 
                          className="h-3.5 w-3.5 transition-all duration-300"
                          style={{ color: commonStyles.accentColor }}
                        />
                      </div>
                      <span className={`text-xs font-semibold tracking-wide ${commonStyles.textColor} transition-colors duration-300`}>
                        {label}
                      </span>
                    </div>
                    <button
                      onClick={() => setState(!state)}
                      className={`relative inline-flex h-4 md:h-5 w-8 md:w-9 items-center rounded-full transition-all duration-300 ease-out focus:outline-none ${
                        state 
                          ? 'bg-blue-600' 
                          : isDarkMode 
                            ? 'bg-gray-600' 
                            : 'bg-gray-300'
                      }`}
                      aria-checked={state}
                      role="switch"
                    >
                      <span 
                        className={`inline-block h-3 md:h-4 w-3 md:w-4 transform rounded-full shadow-md transition-all duration-300 ease-out ${
                          state 
                            ? 'translate-x-4 md:translate-x-4 bg-white' 
                            : isDarkMode 
                              ? 'translate-x-0.5 bg-gray-400' 
                              : 'translate-x-0.5 bg-gray-500'
                        }`} 
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Show Full Timestamps Toggle */}
              <div className="space-y-2">
                <label 
                  className={`flex items-center gap-2 text-xs font-semibold tracking-wide transition-colors duration-300`}
                  style={{ color: commonStyles.accentColor }}
                >
                  <Clock className="h-3.5 w-3.5" style={{ color: commonStyles.accentColor }} />
                  DATE
                </label>
                <div 
                  className={`flex items-center justify-between p-2 md:p-3 rounded-lg border ${showFullTimestamps ? 'border-opacity-50' : 'border-opacity-20'} transition-all duration-300`}
                  style={{ 
                    borderColor: showFullTimestamps ? commonStyles.accentColor : commonStyles.borderColor,
                    backgroundColor: showFullTimestamps ? 'rgb(var(--ui-accent-rgb) / 0.08)' : 'var(--ui-surface)'
                  }}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`p-1 md:p-1.5 rounded-lg ${showFullTimestamps ? '' : commonStyles.buttonBackground} transition-all duration-300`}
                      style={{ backgroundColor: showFullTimestamps ? 'rgb(var(--ui-accent-rgb) / 0.18)' : '' }}
                    >
                      <Clock 
                        className="h-3.5 w-3.5 transition-all duration-300"
                        style={{ color: commonStyles.accentColor }}
                      />
                    </div>
                    <span className={`text-xs font-semibold tracking-wide ${commonStyles.textColor} transition-colors duration-300`}>
                      Show full timestamps
                    </span>
                  </div>
                  <button
                    onClick={() => setShowFullTimestamps(!showFullTimestamps)}
                    className={`relative inline-flex h-4 md:h-5 w-8 md:w-9 items-center rounded-full transition-all duration-300 ease-out focus:outline-none ${
                      showFullTimestamps 
                        ? 'bg-blue-600' 
                        : isDarkMode 
                          ? 'bg-gray-600' 
                          : 'bg-gray-300'
                    }`}
                    aria-checked={showFullTimestamps}
                    role="switch"
                  >
                    <span 
                      className={`inline-block h-3 md:h-4 w-3 md:w-4 transform rounded-full shadow-md transition-all duration-300 ease-out ${
                        showFullTimestamps 
                          ? 'translate-x-4 md:translate-x-4 bg-white' 
                          : isDarkMode 
                            ? 'translate-x-0.5 bg-gray-400' 
                            : 'translate-x-0.5 bg-gray-500'
                      }`} 
                    />
                  </button>
                </div>
              </div>

              {/* Inbox layout (pagination vs continuous) */}
              {inboxViewMode != null && typeof onInboxViewModeChange === 'function' && (
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-2 text-xs font-semibold tracking-wide transition-colors duration-300`}
                    style={{ color: commonStyles.accentColor }}
                  >
                    <LayoutList className="h-3.5 w-3.5" style={{ color: commonStyles.accentColor }} />
                    INBOX LAYOUT
                  </label>
                  <div className={`relative rounded-lg border ${commonStyles.borderColor} transition-colors duration-300`}>
                    <select
                      value={inboxViewMode === 'continuous' ? 'continuous' : 'pagination'}
                      onChange={(e) => onInboxViewModeChange(e.target.value)}
                      className={`w-full appearance-none rounded-lg ${commonStyles.inputBackground} px-3 py-2.5 text-sm ${commonStyles.textColor} focus:outline-none transition-colors duration-300`}
                      style={{ borderColor: commonStyles.accentColor + '40' }}
                      aria-label="Inbox layout"
                    >
                      <option value="pagination">Pagination (pages)</option>
                      <option value="continuous">Continuous scroll</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                      <svg className={`h-4 w-4 ${commonStyles.secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Theme Toggle */}
              {toggleTheme && (
                <div className="space-y-2">
                  <label 
                    className={`flex items-center gap-2 text-xs font-semibold tracking-wide transition-colors duration-300`}
                    style={{ color: commonStyles.accentColor }}
                  >
                    {isDarkMode ? (
                      <Sun className="h-3.5 w-3.5" style={{ color: commonStyles.accentColor }} />
                    ) : (
                      <Moon className="h-3.5 w-3.5" style={{ color: commonStyles.accentColor }} />
                    )}
                    APPEARANCE THEME
                  </label>
                  <div 
                    className={`flex items-center justify-between p-2 md:p-3 rounded-lg border ${isDarkMode ? 'border-opacity-50' : 'border-opacity-20'} transition-all duration-300`}
                    style={{ 
                      borderColor: 'var(--ui-border)',
                      backgroundColor: isDarkMode ? 'rgb(var(--ui-accent-rgb) / 0.08)' : 'var(--ui-surface)'
                    }}
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`p-1 md:p-1.5 rounded-lg ${isDarkMode ? '' : commonStyles.buttonBackground} transition-all duration-300`}
                        style={{ backgroundColor: isDarkMode ? 'rgb(var(--ui-accent-rgb) / 0.18)' : '' }}
                      >
                        {isDarkMode ? (
                          <Sun 
                            className="h-3.5 w-3.5 transition-all duration-300"
                            style={{ color: commonStyles.accentColor }}
                          />
                        ) : (
                          <Moon 
                            className="h-3.5 w-3.5 transition-all duration-300"
                            style={{ color: commonStyles.accentColor }}
                          />
                        )}
                      </div>
                      <span className={`text-xs font-semibold tracking-wide ${commonStyles.textColor} transition-colors duration-300`}>
                        {isDarkMode ? 'Night Ops' : 'Ember Command'}
                      </span>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative inline-flex h-4 md:h-5 w-8 md:w-9 items-center rounded-full transition-all duration-300 ease-out focus:outline-none ${
                        isDarkMode 
                          ? 'bg-primary'
                          : 'bg-gray-300'
                      }`}
                      aria-checked={isDarkMode}
                      aria-label={`Switch to ${isDarkMode ? 'Ember Command' : 'Night Ops'}`}
                      role="switch"
                    >
                      <span 
                        className={`inline-block h-3 md:h-4 w-3 md:w-4 transform rounded-full shadow-md transition-all duration-300 ease-out ${
                          isDarkMode 
                            ? 'translate-x-4 md:translate-x-4 bg-white' 
                            : 'translate-x-0.5 bg-gray-500'
                        }`} 
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`relative flex justify-end px-4 md:px-6 py-3 md:py-4 border-t ${commonStyles.borderColor} transition-colors duration-300`}>
              <button
                onClick={closeViewModal}
                className={`px-4 md:px-5 py-1.5 md:py-2 rounded-lg text-sm font-medium text-white shadow-md transition-all duration-300 hover:shadow-lg active:scale-95`}
                style={{ backgroundColor: commonStyles.accentColor, outline: 'none' }}
              >
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
