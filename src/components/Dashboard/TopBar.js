import { useEffect, useRef, useState } from 'react';
import { X, Clock, Tag, Radio, User, CheckCheck, Moon, Sun, LayoutList } from 'lucide-react';
import SystemClock from './SystemClock';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import styles from '../ui/TopBar.module.css';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useInboxFilters, useInboxPreferences, useInboxLayout, useInboxSelection, useInboxLive, useInboxMessages } from '../InboxContext';
import {
  TIME_FILTERS,
  INBOX_TIME_RANGE_DROPDOWN_ORDER,
  getDefaultCustomRangeDates,
} from '../../utils/inboxViewWindow';

const TopBar = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { timeFilter, appliedCustomRange, applyTimeView } = useInboxFilters();
  const {
    principal,
    showTime,
    showCar,
    showChannel,
    showPerson,
    showDuplicateRecordings,
    showHallucinations,
    showFullTimestamps,
    updatePreference,
    timeFormat,
    inboxViewMode,
    setInboxViewMode,
  } = useInboxPreferences();
  const { isMobile } = useInboxLayout();
  const { isMultiSelectMode, toggleMultiSelectMode } = useInboxSelection();
  const { isVolumeOn, setIsVolumeOn } = useInboxLive();
  const { refresh } = useInboxMessages();
  const isAdmin = principal?.role === 'admin';

  const updateRecordingVisibility = async (key, value) => {
    if (await updatePreference(key, value)) refresh();
  };

  const canAccessSettings = principal?.role === 'admin' || hasPermission('access_settings');

  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [isViewModalClosing, setIsViewModalClosing] = useState(false);
  const viewModalTimerRef = useRef(null);

  const [selectedTimeFilter, setSelectedTimeFilter] = useState(timeFilter);
  const [draftStartDate, setDraftStartDate] = useState(appliedCustomRange.startDate || '');
  const [draftEndDate, setDraftEndDate] = useState(appliedCustomRange.endDate || '');
  const [draftStartTime, setDraftStartTime] = useState(appliedCustomRange.startTime || '');
  const [draftEndTime, setDraftEndTime] = useState(appliedCustomRange.endTime || '');

  useEffect(() => {
    setSelectedTimeFilter(timeFilter);
  }, [timeFilter]);

  useEffect(() => {
    setDraftStartDate(appliedCustomRange.startDate || '');
    setDraftEndDate(appliedCustomRange.endDate || '');
    setDraftStartTime(appliedCustomRange.startTime || '');
    setDraftEndTime(appliedCustomRange.endTime || '');
  }, [appliedCustomRange]);

  useEffect(() => () => {
    if (viewModalTimerRef.current) clearTimeout(viewModalTimerRef.current);
  }, []);

  const closeViewModal = () => {
    setIsViewModalClosing(true);
    if (viewModalTimerRef.current) clearTimeout(viewModalTimerRef.current);
    viewModalTimerRef.current = setTimeout(() => {
      setIsViewSettingsOpen(false);
      setIsViewModalClosing(false);
    }, 300);
  };

  const applyTimeRangePreset = (value) => {
    setSelectedTimeFilter(value);
    if (value === TIME_FILTERS.CUSTOM) {
      let startDate = draftStartDate;
      let endDate = draftEndDate;
      if (!startDate || !endDate) {
        const defaults = getDefaultCustomRangeDates();
        startDate = defaults.startDate;
        endDate = defaults.endDate;
        setDraftStartDate(startDate);
        setDraftEndDate(endDate);
      }
      // Selecting Custom only opens the editor. It does not hit the API until Apply range.
      return;
    }

    setDraftStartDate('');
    setDraftEndDate('');
    setDraftStartTime('');
    setDraftEndTime('');
    applyTimeView({ timeFilter: value });
  };

  const applyCustomRange = () => {
    applyTimeView({
      timeFilter: TIME_FILTERS.CUSTOM,
      startDate: draftStartDate,
      startTime: draftStartTime,
      endDate: draftEndDate,
      endTime: draftEndTime,
    });
  };

  const selectValue = selectedTimeFilter;

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('isDarkMode')) || false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    document.documentElement.dataset.uiTheme = isDarkMode ? 'night-ops' : 'ember-command';
  }, [isDarkMode]);

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
                value={selectValue}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === TIME_FILTERS.CUSTOM) {
                    setSelectedTimeFilter(value);
                    const defaults = getDefaultCustomRangeDates();
                    if (!draftStartDate) setDraftStartDate(defaults.startDate);
                    if (!draftEndDate) setDraftEndDate(defaults.endDate);
                  } else {
                    applyTimeRangePreset(value);
                  }
                }}
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
              title={isMultiSelectMode ? 'Exit select' : 'Select messages'}
              aria-label={isMultiSelectMode ? 'Exit select' : 'Select messages'}
            >
              {isMobile ? <CheckCheck aria-hidden="true" /> : isMultiSelectMode ? 'Exit select' : 'Select messages'}
            </Button>

            <div className={styles.divider} aria-hidden="true" />

            <div className={styles.liveControl}>
              <span className={`${styles.liveDot}${isVolumeOn ? ` ${styles.liveDotActive}` : ''}`} aria-hidden="true" />
              {!isMobile && <span className={styles.liveLabel}>LIVE</span>}
              <label className={formStyles.switch} title={isVolumeOn ? 'Turn off live mode' : 'Turn on live mode'}>
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

            <Button type="button" onClick={() => setIsViewSettingsOpen(true)} variant="ghost" size="icon" aria-label="View settings" title="View settings">
              <span className="material-symbols-outlined">visibility</span>
            </Button>

            {canAccessSettings && (
              <Button type="button" onClick={() => navigate('/settings')} variant="ghost" size="icon" aria-label="Settings" title="Settings">
                <span className="material-symbols-outlined">settings</span>
              </Button>
            )}

            <Button type="button" onClick={() => navigate('/report')} variant="ghost" size="icon" className={styles.desktopOnly} aria-label="Reports" title="Incident reports">
              <span className="material-symbols-outlined">assignment</span>
            </Button>

            <SystemClock userRole={principal?.role || 'member'} timeFormat={timeFormat} />
          </div>
        </div>

        {selectedTimeFilter === TIME_FILTERS.CUSTOM && (
          <div className={styles.customRange}>
            <div className={`rowBetween ${styles.customRangeHeader}`}>
              <span className={styles.customRangeTitle}>Custom from / to (local date and time)</span>
              <div className="row">
                <Button type="button" onClick={() => applyTimeRangePreset(TIME_FILTERS.DAYS7)} variant="ghost" size="small">
                  Use last 7 days
                </Button>
                <Button type="button" onClick={applyCustomRange} variant="primary" size="small" disabled={!draftStartDate || !draftEndDate}>
                  Apply range
                </Button>
              </div>
            </div>
            <div className={styles.customRangeGrid}>
              <label className={formStyles.field}>
                <span className={formStyles.label}>From date</span>
                <input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>From time</span>
                <input type="time" value={draftStartTime} onChange={(e) => setDraftStartTime(e.target.value)} step="1" lang="en-GB" className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>To date</span>
                <input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} min={draftStartDate || undefined} className={formStyles.input} />
              </label>
              <label className={formStyles.field}>
                <span className={formStyles.label}>To time</span>
                <input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} step="1" lang="en-GB" className={formStyles.input} />
              </label>
            </div>
          </div>
        )}
      </div>

      {isViewSettingsOpen && (
        <div className={`${modalStyles.overlay} ${styles.viewOverlay}${isViewModalClosing ? ` ${styles.viewOverlayClosing}` : ''}`}>
          <div className={`${modalStyles.panel} ${styles.viewModal}${isViewModalClosing ? ` ${styles.viewModalClosing}` : ''}`}>
            <div className={styles.accentBar} />

            <div className={modalStyles.header}>
              <h3 className={`${modalStyles.title} ${styles.modalTitle}`}>VIEW SETTINGS</h3>
              <Button onClick={closeViewModal} variant="ghost" size="icon" aria-label="Close view settings">
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className={`${modalStyles.body} ${styles.viewSettingsBody}`}>
              <div className={styles.settingList}>
                {[
                  { label: 'TIMING', icon: Clock, state: showTime, key: 'show_time' },
                  { label: 'TAG', icon: Tag, state: showCar, key: 'show_car' },
                  { label: 'CHANNEL', icon: Radio, state: showChannel, key: 'show_channel' },
                  { label: 'PERSON', icon: User, state: showPerson, key: 'show_person' },
                  ...(isAdmin ? [
                    { label: 'Show duplicate recordings', icon: Radio, state: showDuplicateRecordings, key: 'show_duplicate_recordings' },
                    { label: 'Show hallucinations', icon: Radio, state: showHallucinations, key: 'show_hallucinations' },
                  ] : []),
                ].map(({ label, icon: Icon, state, key }) => (
                  <div key={label} className={`${styles.settingRow}${state ? ` ${styles.settingRowActive}` : ''}`}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingIcon}><Icon aria-hidden="true" /></span>
                      <span className={styles.settingLabel}>{label}</span>
                    </div>
                    <label className={formStyles.switch}>
                      <input type="checkbox" checked={state} onChange={() => (
                        ['show_duplicate_recordings', 'show_hallucinations'].includes(key)
                          ? updateRecordingVisibility(key, !state)
                          : updatePreference(key, !state)
                      )} aria-label={label} />
                      <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                    </label>
                  </div>
                ))}
              </div>

              <label className={formStyles.field}>
                <span className={styles.groupLabel}><Clock aria-hidden="true" /> TIME FORMAT</span>
                <select
                  value={timeFormat}
                  onChange={(e) => updatePreference('time_format', e.target.value)}
                  className={formStyles.select}
                  aria-label="Time format"
                >
                  <option value="24h">24-hour (14:30:45)</option>
                  <option value="12h">12-hour (2:30:45 PM)</option>
                </select>
              </label>

              <div className="stackCompact">
                <div className={styles.groupLabel}><Clock aria-hidden="true" /> DATE</div>
                <div className={`${styles.settingRow}${showFullTimestamps ? ` ${styles.settingRowActive}` : ''}`}>
                  <div className={styles.settingInfo}>
                    <span className={styles.settingIcon}><Clock aria-hidden="true" /></span>
                    <span className={styles.settingLabel}>Show full timestamps</span>
                  </div>
                  <label className={formStyles.switch}>
                    <input type="checkbox" checked={showFullTimestamps} onChange={() => updatePreference('show_full_timestamps', !showFullTimestamps)} aria-label="Show full timestamps" />
                    <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                  </label>
                </div>
              </div>

              <label className={formStyles.field}>
                <span className={styles.groupLabel}><LayoutList aria-hidden="true" /> INBOX LAYOUT</span>
                <select value={inboxViewMode} onChange={(e) => setInboxViewMode(e.target.value)} className={formStyles.select} aria-label="Inbox layout">
                  <option value="pagination">Pagination (pages)</option>
                  <option value="continuous">Continuous scroll</option>
                </select>
              </label>

              <div className="stackCompact">
                <div className={styles.groupLabel}>{isDarkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />} APPEARANCE THEME</div>
                <div className={styles.settingRow}>
                  <div className={styles.settingInfo}>
                    <span className={styles.settingIcon}>{isDarkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</span>
                    <span className={styles.settingLabel}>{isDarkMode ? 'Night Ops' : 'Ember Command'}</span>
                  </div>
                  <label className={formStyles.switch}>
                    <input type="checkbox" checked={isDarkMode} onChange={() => setIsDarkMode((current) => !current)} aria-label={`Switch to ${isDarkMode ? 'Ember Command' : 'Night Ops'}`} />
                    <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
                  </label>
                </div>
              </div>
            </div>

            <div className={modalStyles.footer}>
              <Button onClick={closeViewModal} variant="primary">CLOSE</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopBar;
