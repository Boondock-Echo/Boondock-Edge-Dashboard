import { useState, useRef, useEffect } from 'react';
import { X, Clock, Tag, Radio, User, CheckCheck, Moon, Sun, LayoutList } from 'lucide-react';
import SystemClock from './SystemClock';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import styles from '../ui/TopBar.module.css';
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
  isMobile,
  isMultiSelectMode,
  setIsMultiSelectMode,
  setSelectedMessages,
  selectedMessages,
  toggleMultiSelectMode,
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
  timeFormat = "24h",
  isVolumeOn,
  setIsVolumeOn,
  inboxViewMode,
  onInboxViewModeChange,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  
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


  const [isDarkMode, setIsDarkMode] = useState(() => {
    return JSON.parse(localStorage.getItem("isDarkMode")) || false;
  });

  useEffect(() => {
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
    const root = document.documentElement;
    root.dataset.uiTheme = isDarkMode ? "night-ops" : "ember-command";
  }, [isDarkMode]);
  

  // Static colors for better visibility in dark mode

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            {isMobile ? (
              <div className={`${styles.mobileMark} ${styles.mobileOnly}`} title="Messages">
                <span className="material-symbols-outlined">dashboard</span>
              </div>
            ) : (
              <div>
                <h2 className={styles.title}>Messages</h2>
                <p className={styles.subtitle}>Transcripts and audio for your channels</p>
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <div className={styles.rangeControl} title="Time range shown in the inbox">
              <Clock aria-hidden="true" />
              {!isMobile && <span className={styles.rangeLabel}>View</span>}
              <label htmlFor="topbar-inbox-time-range" className={formStyles.srOnly}>
                Inbox time range
              </label>
              <select
                id="topbar-inbox-time-range"
                value={timeFilter}
                onChange={(e) => applyTimeRangePreset(e.target.value)}
                className={`${formStyles.select} ${styles.rangeSelect}`}
                aria-label="Inbox time range"
              >
                {INBOX_TIME_RANGE_DROPDOWN_ORDER.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              onClick={toggleMultiSelectMode}
              size="small"
              variant={isMultiSelectMode ? 'primary' : 'accent'}
              title={isMultiSelectMode ? "Exit select" : "Select messages"}
              aria-label={isMultiSelectMode ? "Exit select" : "Select messages"}
            >
              {isMobile ? <CheckCheck aria-hidden="true" /> : isMultiSelectMode ? "Exit select" : "Select messages"}
            </Button>

            <div className={styles.divider} aria-hidden="true" />

            {isVolumeOn !== undefined && setIsVolumeOn && (
              <div className={styles.liveControl}>
                <span className={`${styles.liveDot}${isVolumeOn ? ` ${styles.liveDotActive}` : ''}`} aria-hidden="true" />
                {!isMobile && <span className={styles.liveLabel}>LIVE</span>}
                <label className={formStyles.switch} title={isVolumeOn ? "Turn off live mode" : "Turn on live mode"}>
                  <input
                    type="checkbox"
                    checked={isVolumeOn}
                    onChange={() => setIsVolumeOn(!isVolumeOn)}
                    aria-label="Toggle live mode"
                  />
                  <span className={formStyles.switchTrack} aria-hidden="true">
                    <span className={formStyles.switchThumb} />
                  </span>
                </label>
              </div>
            )}

            <Button type="button" onClick={() => setIsViewSettingsOpen(true)} variant="ghost" size="icon" aria-label="View settings" title="View settings">
              <span className="material-symbols-outlined">visibility</span>
            </Button>

            {canAccessSettings && (
              <Button type="button" onClick={() => navigate("/settings")} variant="ghost" size="icon" aria-label="Settings" title="Settings">
                <span className="material-symbols-outlined">settings</span>
              </Button>
            )}

            <Button type="button" onClick={() => navigate("/report")} variant="ghost" size="icon" className={styles.desktopOnly} aria-label="Reports" title="Incident reports">
              <span className="material-symbols-outlined">assignment</span>
            </Button>

            <SystemClock
              userRole={userRole}
              timeFormat={timeFormat}
            />
          </div>
        </div>

        {timeFilter === TIME_FILTERS.CUSTOM && (
          <div className={styles.customRange}>
            <div className={`rowBetween ${styles.customRangeHeader}`}>
              <span className={styles.customRangeTitle}>Custom from / to (local date and time)</span>
              <Button type="button" onClick={() => applyTimeRangePreset(TIME_FILTERS.DAYS7)} variant="ghost" size="small">
                Use last 7 days
              </Button>
            </div>
            <div className={styles.customRangeGrid}>
              <label className={formStyles.field}>
                <span className={formStyles.label}>From date</span>
                <input type="date" value={startDate || ''} onChange={(e) => setStartDate(e.target.value)} className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>From time</span>
                <input type="time" value={startTime || ''} onChange={(e) => setStartTime(e.target.value)} step="1" lang="en-GB" className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>To date</span>
                <input type="date" value={endDate || ''} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>To time</span>
                <input type="time" value={endTime || ''} onChange={(e) => setEndTime(e.target.value)} step="1" lang="en-GB" className={formStyles.input} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* View Settings Modal */}
      {isViewSettingsOpen && (
        <div className={`${styles.viewOverlay}${isViewModalClosing ? ` ${styles.viewOverlayClosing}` : ''}`}>
          <div className={`${styles.viewModal}${isViewModalClosing ? ` ${styles.viewModalClosing}` : ''}`}>
            <div className={styles.accentBar} />

            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>VIEW SETTINGS</h3>
              <Button onClick={closeViewModal} variant="ghost" size="icon" aria-label="Close view settings">
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.settingList}>
                {[
                  { label: 'TIMING', icon: Clock, state: showTime, setState: setShowTime },
                  { label: 'TAG', icon: Tag, state: showCar, setState: setShowCar },
                  { label: 'CHANNEL', icon: Radio, state: showChannel, setState: setShowChannel },
                  { label: 'PERSON', icon: User, state: showPerson, setState: setShowPerson },
                ].map(({ label, icon: Icon, state, setState }) => (
                  <div key={label} className={`${styles.settingRow}${state ? ` ${styles.settingRowActive}` : ''}`}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingIcon}><Icon aria-hidden="true" /></span>
                      <span className={styles.settingLabel}>{label}</span>
                    </div>
                    <label className={formStyles.switch}>
                      <input type="checkbox" checked={state} onChange={() => setState(!state)} aria-label={label} />
                      <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                    </label>
                  </div>
                ))}
              </div>

              {/* Show Full Timestamps Toggle */}
              <div className="stackCompact">
                <div className={styles.groupLabel}><Clock aria-hidden="true" /> DATE</div>
                <div className={`${styles.settingRow}${showFullTimestamps ? ` ${styles.settingRowActive}` : ''}`}>
                  <div className={styles.settingInfo}>
                    <span className={styles.settingIcon}><Clock aria-hidden="true" /></span>
                    <span className={styles.settingLabel}>Show full timestamps</span>
                  </div>
                  <label className={formStyles.switch}>
                    <input type="checkbox" checked={showFullTimestamps} onChange={() => setShowFullTimestamps(!showFullTimestamps)} aria-label="Show full timestamps" />
                    <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                  </label>
                </div>
              </div>

              {/* Inbox layout (pagination vs continuous) */}
              {inboxViewMode != null && typeof onInboxViewModeChange === 'function' && (
                <label className={formStyles.field}>
                  <span className={styles.groupLabel}><LayoutList aria-hidden="true" /> INBOX LAYOUT</span>
                  <select value={inboxViewMode === 'continuous' ? 'continuous' : 'pagination'} onChange={(e) => onInboxViewModeChange(e.target.value)} className={formStyles.select} aria-label="Inbox layout">
                    <option value="pagination">Pagination (pages)</option>
                    <option value="continuous">Continuous scroll</option>
                  </select>
                </label>
              )}

              {/* Theme Toggle */}
              <div className="stackCompact">
                <div className={styles.groupLabel}>{isDarkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} APPEARANCE THEME</div>
                <div className={styles.settingRow}>
                  <div className={styles.settingInfo}>
                    <span className={styles.settingIcon}>{isDarkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</span>
                    <span className={styles.settingLabel}>{isDarkMode ? 'Night Ops' : 'Ember Command'}</span>
                  </div>
                  <label className={formStyles.switch}>
                    <input type="checkbox" checked={isDarkMode} onClick={() => setIsDarkMode((current) => !current)} aria-label={`Switch to ${isDarkMode ? 'Ember Command' : 'Night Ops'}`} />
                    <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button onClick={closeViewModal} variant="primary">APPLY</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
