import React, { useEffect, useRef, useState, useCallback } from "react";
import TeamsSidebar from "./Sidebar";
import { Volume2, Volume1, X } from "lucide-react";
import TopBar from "./TopBar";
import FooterPagination from "./FooterPagination";
import FullscreenMessages from './FullscreenMessages';
import FloatingChatbot from './FloatingChatbot';
import GlobalAudioPlayer from "./GlobalAudioPlayer";
import NotificationBanner from './NotificationBanner';
import axios from "axios";
import { useAuth } from "../AuthContext";
import MFAReminderModal from "../MFAReminderModal";
import logger from "../../utils/logger";
import {
  TIME_FILTERS,
  DEFAULT_INBOX_TIME_FILTER,
  INBOX_CUSTOM_DATE_STORAGE_KEYS,
  normalizeStoredTimeFilter,
  getPresetCutoffMs,
} from "../../utils/inboxViewWindow";

const channelColors = {
  0: "var(--ui-accent)",
  1: "var(--ui-warning)",
  2: "var(--ui-muted)",
  3: "var(--ui-success)",
  4: "var(--ui-border)",
};
const ITEMS_PER_PAGE = 100;

/** True when the live new-message popup should keep polling for transcription. */
function popupTranscriptionStillPending(messageText) {
  if (messageText == null) return true;
  const s = String(messageText).trim();
  if (!s) return true;
  return s === 'No transcription available' || s === '....';
}

const POPUP_TRANSCRIPTION_POLL_MS = 2000;
/** When transcript was missing on open, max time before force-close if audio never ends */
const POPUP_NO_TRANSCRIPT_SAFETY_MS = 40000;
/** After transcript appears (e.g. from poll), minimum time before auto-close for reading + audio tail */
const POPUP_AFTER_TRANSCRIPT_MIN_MS = 6000;
/** Keep only the newest burst of live notifications to avoid overload. */
const LIVE_POPUP_QUEUE_LIMIT = 10;

function getMessageCursorTuple(message) {
  if (!message) return [0, 0];
  const tsRaw = String(message.time || '');
  const compact = tsRaw.replace(/[^0-9]/g, '');
  const tsNum = Number(compact) || 0;
  const idNum = Number(message.id) || 0;
  return [tsNum, idNum];
}

function isCursorGreater(a, b) {
  if (!a) return false;
  if (!b) return true;
  if (a[0] > b[0]) return true;
  if (a[0] < b[0]) return false;
  return a[1] > b[1];
}

const LiveCommunications = ({
  edgeServerEndpoint,
  toggleTheme,
  channels,
  setChannels,
  timezone,
  timeFormat,
  isDarkMode,
  setMessages,
  setIsDarkMode,
  messages,
  keywords,
  reverseSort,
  setReverseSort,
  onFiltersActiveChange,
  inboxServerHasMore = false,
  inboxServerTotal = null,
  onFetchOlderInbox,
}) => {
  const { user, isReLogin, resetReLoginFlag } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeKeywords, setActiveKeywords] = useState(new Set());
  const [showMfaReminder, setShowMfaReminder] = useState(false);
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [isVolumeOn, setIsVolumeOn] = useState(false);
  const [keywordCounts, setKeywordCounts] = useState({});
  const [playingAudio, setPlayingAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastPlayedMessageId, setLastPlayedMessageId] = useState(null);
  const [newMessagePopup, setNewMessagePopup] = useState(null);
  const [popupQueue, setPopupQueue] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeFilter, setTimeFilter] = useState(() => {
    try {
      return normalizeStoredTimeFilter(localStorage.getItem('timeFilter'));
    } catch {
      return DEFAULT_INBOX_TIME_FILTER;
    }
  });
  const [activeAudioUrl, setActiveAudioUrl] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const audioRef = useRef(new Audio());
  const [iconToggle, setIconToggle] = useState(false);
  const [channelMessageCounts, setChannelMessageCounts] = useState({});
  const [activeChannels, setActiveChannels] = useState(
    Object.keys(channels).reduce((acc, channelId) => {
      acc[channelId] = channels[channelId]?.isActive || true;
      return acc;
    }, {})
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [previousMessages, setPreviousMessages] = useState([]);
  const [newMessages, setNewMessages] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [paginationLoaded, setPaginationLoaded] = useState(false);
  const [hasAppliedDefaultPage, setHasAppliedDefaultPage] = useState(false);
  const [showFullTimestamps, setShowFullTimestamps] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const isMobile = windowWidth < 768;
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [userRole, setUserRole] = useState('member');
  const [inboxViewMode, setInboxViewMode] = useState('continuous'); // 'pagination' or 'continuous'
  
  // Infinite scroll state for mobile
  const [mobileMessages, setMobileMessages] = useState([]);
  const [mobileCurrentPage, setMobileCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  // Infinite scroll state for desktop
  const [desktopMessages, setDesktopMessages] = useState([]);
  const [desktopCurrentPage, setDesktopCurrentPage] = useState(1);
  /** After a lazy inbox fetch, apply the next continuous page once `messages` has updated. */
  const resumeContinuousLoadMoreRef = useRef(null);
  const [paginationFetchingOlder, setPaginationFetchingOlder] = useState(false);
  /** Skip firing inbox refresh on mount (App already initializes); fire when View range changes. */
  const skipInboxViewChangedEventRef = useRef(true);
  const inboxServerHasMoreRef = useRef(inboxServerHasMore);
  useEffect(() => {
    inboxServerHasMoreRef.current = inboxServerHasMore;
  }, [inboxServerHasMore]);

  // Track total filtered messages count
  const [totalFilteredMessages, setTotalFilteredMessages] = useState(0);
  
  // Custom filter state (persisted for cache + reload)
  const [startDate, setStartDate] = useState(
    () => localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startDate) || ''
  );
  const [endDate, setEndDate] = useState(
    () => localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endDate) || ''
  );
  const [startTime, setStartTime] = useState(
    () => localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startTime) || ''
  );
  const [endTime, setEndTime] = useState(
    () => localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endTime) || ''
  );

  const popupDismissTimerRef = useRef(null);
  const popupAudioEndedCleanupRef = useRef(null);
  const activePopupMessageIdRef = useRef(null);
  const livePopupCursorRef = useRef(null);

  const clearPopupDismissTimer = useCallback(() => {
    if (popupDismissTimerRef.current) {
      clearTimeout(popupDismissTimerRef.current);
      popupDismissTimerRef.current = null;
    }
  }, []);

  const detachPopupAudioEndedListener = useCallback(() => {
    if (popupAudioEndedCleanupRef.current) {
      popupAudioEndedCleanupRef.current();
      popupAudioEndedCleanupRef.current = null;
    }
  }, []);

  const schedulePopupDismissTimer = useCallback(
    (ms) => {
      clearPopupDismissTimer();
      popupDismissTimerRef.current = setTimeout(() => {
        detachPopupAudioEndedListener();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayingAudio(null);
        setIsPlaying(false);
        setNewMessagePopup(null);
        popupDismissTimerRef.current = null;
      }, ms);
    },
    [clearPopupDismissTimer, detachPopupAudioEndedListener],
  );

  const closeNewMessagePopup = useCallback(() => {
    clearPopupDismissTimer();
    detachPopupAudioEndedListener();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingAudio(null);
    setIsPlaying(false);
    setNewMessagePopup(null);
  }, [clearPopupDismissTimer, detachPopupAudioEndedListener]);

  useEffect(() => {
    activePopupMessageIdRef.current = newMessagePopup?.id ?? null;
  }, [newMessagePopup?.id]);

  useEffect(() => {
    return () => {
      clearPopupDismissTimer();
      detachPopupAudioEndedListener();
    };
  }, [clearPopupDismissTimer, detachPopupAudioEndedListener]);

  /** After transcript loads in the popup, align auto-close with remaining playback + read time */
  const schedulePopupDismissAfterTranscription = useCallback(() => {
    clearPopupDismissTimer();
    detachPopupAudioEndedListener();
    const a = audioRef.current;
    if (!a || !a.src) {
      schedulePopupDismissTimer(POPUP_AFTER_TRANSCRIPT_MIN_MS);
      return;
    }
    const dur = a.duration;
    const ct = a.currentTime;
    if (!a.paused && isFinite(dur) && dur > 0 && isFinite(ct)) {
      const remaining = Math.max((dur - ct) * 1000 + 500, POPUP_AFTER_TRANSCRIPT_MIN_MS);
      schedulePopupDismissTimer(remaining);
    } else {
      schedulePopupDismissTimer(POPUP_AFTER_TRANSCRIPT_MIN_MS);
    }
  }, [
    clearPopupDismissTimer,
    detachPopupAudioEndedListener,
    schedulePopupDismissTimer,
  ]);

  // Persist custom date range for offline cache + App.js cache window
  useEffect(() => {
    try {
      if (startDate) localStorage.setItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startDate, startDate);
      else localStorage.removeItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startDate);
    } catch { /* ignore */ }
  }, [startDate]);
  useEffect(() => {
    try {
      if (endDate) localStorage.setItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endDate, endDate);
      else localStorage.removeItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endDate);
    } catch { /* ignore */ }
  }, [endDate]);
  useEffect(() => {
    try {
      if (startTime) localStorage.setItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startTime, startTime);
      else localStorage.removeItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startTime);
    } catch { /* ignore */ }
  }, [startTime]);
  useEffect(() => {
    try {
      if (endTime) localStorage.setItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endTime, endTime);
      else localStorage.removeItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endTime);
    } catch { /* ignore */ }
  }, [endTime]);

  /**
   * When true, pause full inbox polling (only for a locked custom date/time range).
   * Preset ranges (e.g. Last 1 hr) still poll so new recordings appear.
   */
  const inboxViewNarrowingActive =
    timeFilter === TIME_FILTERS.CUSTOM && !!(startDate && endDate);

  // Notify parent when filters are active/inactive
  useEffect(() => {
    if (onFiltersActiveChange) {
      onFiltersActiveChange(inboxViewNarrowingActive);
    }
  }, [inboxViewNarrowingActive, onFiltersActiveChange]);

  // Save pagination preferences to backend
  const savePaginationPreferences = useCallback(async (newRecordsPerPage, newCurrentPage, newReverseSort, newShowFullTimestamps) => {
    if (!user?.username) return;

    try {
      await axios.post(`${edgeServerEndpoint}/pagination-preferences/${user.username}`, {
        recordsPerPage: newRecordsPerPage || recordsPerPage,
        currentPage: newCurrentPage || currentPage,
        reverseSort: newReverseSort !== undefined ? newReverseSort : reverseSort,
        showFullTimestamps: newShowFullTimestamps !== undefined ? newShowFullTimestamps : showFullTimestamps
      });
    } catch (error) {
      logger.error('Failed to save pagination preferences:', error);
    }
  }, [user?.username, edgeServerEndpoint, recordsPerPage, currentPage, reverseSort, showFullTimestamps]);

  const fetchOlderForPagination = useCallback(async () => {
    if (!onFetchOlderInbox || inboxViewMode !== 'pagination') return false;
    setPaginationFetchingOlder(true);
    try {
      return await onFetchOlderInbox();
    } catch (e) {
      logger.error('Pagination older inbox fetch:', e);
      return false;
    } finally {
      setPaginationFetchingOlder(false);
    }
  }, [onFetchOlderInbox, inboxViewMode]);

  // Save reverse sort preference when it changes
  const saveReverseSortPreference = useCallback(async (newReverseSort) => {
    await savePaginationPreferences(recordsPerPage, currentPage, newReverseSort);
  }, [savePaginationPreferences, recordsPerPage, currentPage]);

  // Custom setter for reverseSort that saves the preference
  const setReverseSortWithSave = useCallback((newReverseSort) => {
    setReverseSort(newReverseSort);
    saveReverseSortPreference(newReverseSort);
  }, [setReverseSort, saveReverseSortPreference]);

  const handleInboxViewModeChange = useCallback(
    async (mode) => {
      const previous = inboxViewMode;
      if (mode !== 'pagination' && mode !== 'continuous') return;
      if (mode === previous) return;
      setInboxViewMode(mode);
      try {
        await axios.put(`${edgeServerEndpoint}/settings`, {
          global_inbox_view_mode: mode,
        });
        if (mode === 'pagination' && !reverseSort) {
          setReverseSortWithSave(true);
        }
      } catch (error) {
        logger.error('Failed to save inbox view mode:', error);
        setInboxViewMode(previous);
      }
    },
    [edgeServerEndpoint, inboxViewMode, reverseSort, setReverseSortWithSave],
  );

  // Save showFullTimestamps preference when it changes (only after initial load)
  useEffect(() => {
    if (paginationLoaded && user?.username) {
      savePaginationPreferences(recordsPerPage, currentPage, reverseSort, showFullTimestamps);
    }
  }, [showFullTimestamps, paginationLoaded, user?.username, savePaginationPreferences, recordsPerPage, currentPage, reverseSort]);

  // Check for MFA reminder on mount
  useEffect(() => {
    let isMounted = true;
    let timeout;

    const checkMfaReminder = () => {
      // Early return if no user - don't make API call
      if (!user?.username) {
        return;
      }
      
      const token = localStorage.getItem('token');
      // Early return if no token - don't make API call
      if (!token) {
        return;
      }

      // Use .then/.catch chain instead of await to prevent unhandled rejections
      fetch(`${edgeServerEndpoint}/mfa/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        // Check if response is actually JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // Server returned HTML (likely 404 page), not JSON
          logger.debug('MFA status endpoint returned non-JSON response');
          return null;
        }

        if (response.ok) {
          return response.json().then(data => {
            // Show reminder if MFA is enforced but not enabled
            if (isMounted && data.mfa_enforced && !data.mfa_enabled) {
              // Check if user has dismissed it for this session
              const dismissed = sessionStorage.getItem('mfa_reminder_dismissed');
              if (!dismissed) {
                setMfaEnforced(true);
                setShowMfaReminder(true);
              }
            }
          });
        } else if (response.status === 401) {
          // 401 is expected for non-admin users or when token is invalid
          // Don't log as error or warning - this is normal
        } else {
          // Only log non-401 errors
          logger.warn(`MFA status endpoint returned ${response.status}`);
        }
      })
      .catch(err => {
        // Network errors during fetch - silently fail for MFA status
        // These are expected failures when token is invalid or unavailable
        // Don't log anything
      });
    };
    
    // Only check if user exists and has username
    // Use user?.username as dependency instead of entire user object to prevent unnecessary re-runs
    if (user?.username) {
      // Debounce: only check after 500ms of no changes
      timeout = setTimeout(checkMfaReminder, 500);
    }

    return () => {
      isMounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [user?.username, edgeServerEndpoint]);

  // Load pagination preferences from backend
  useEffect(() => {
    const loadPaginationPreferences = async () => {
      if (!user?.username || paginationLoaded) return;
      
      try {
        const response = await axios.get(`${edgeServerEndpoint}/pagination-preferences/${user.username}`);
        if (response.data) {
          const { recordsPerPage: savedRecordsPerPage, currentPage: savedCurrentPage, reverseSort: savedReverseSort, showFullTimestamps: savedShowFullTimestamps } = response.data;
          if (savedRecordsPerPage) {
            setRecordsPerPage(savedRecordsPerPage);
          }
          if (savedCurrentPage) {
            setCurrentPage(savedCurrentPage);
          }
          if (savedReverseSort !== undefined) {
            setReverseSort(savedReverseSort);
          }
          if (savedShowFullTimestamps !== undefined) {
            setShowFullTimestamps(savedShowFullTimestamps);
          }
        }
      } catch (error) {
        logger.error('Failed to load pagination preferences:', error);
        // Use default values if loading fails
        setRecordsPerPage(20);
        setCurrentPage(1);
        setReverseSort(false);
      } finally {
        setPaginationLoaded(true);
      }
    };

    loadPaginationPreferences();
  }, [user?.username, edgeServerEndpoint, paginationLoaded, setReverseSort]);

  // Load global inbox view mode and default records-per-page from settings
  useEffect(() => {
    const loadInboxSettings = async () => {
      try {
        const response = await axios.get(`${edgeServerEndpoint}/settings`);
        const mode = response.data?.global_inbox_view_mode || 'pagination';
        const defaultPageSize = response.data?.global_inbox_records_per_page || 10;
        setInboxViewMode(mode);
        // Only override recordsPerPage if the user hasn't already saved a preference
        setRecordsPerPage(prev => (prev === 20 ? defaultPageSize : prev));

        // In pagination mode, always show newest messages on page 1 (newest at top)
        // by forcing reverseSort=true once when loading settings.
        if (mode === 'pagination' && !reverseSort) {
          setReverseSortWithSave(true);
        }

      } catch (error) {
        logger.error('Failed to load inbox settings:', error);
        // Fallback: keep existing state (infinite scroll behaviour)
      }
    };

    if (edgeServerEndpoint) {
      loadInboxSettings();
    }
  }, [edgeServerEndpoint, reverseSort, setReverseSortWithSave]);

  // Load live mode setting from database (separate effect to prevent reloading on other changes)
  useEffect(() => {
    const loadLiveModeSetting = async () => {
      try {
        const response = await axios.get(`${edgeServerEndpoint}/settings`);
        const liveModeEnabled = response.data?.global_live_mode_enabled;
        // Convert string "True"/"False" to boolean, default to false if not set
        const isEnabled = liveModeEnabled === 'True' || liveModeEnabled === true;
        setIsVolumeOn(isEnabled);
        logger.debug('Live mode setting loaded from database:', isEnabled);
      } catch (error) {
        logger.error('Failed to load live mode setting:', error);
        // Keep default false state on error
      }
    };

    if (edgeServerEndpoint) {
      loadLiveModeSetting();
    }
  }, [edgeServerEndpoint]); // Only depend on edgeServerEndpoint

  // Save live mode setting to database
  const saveLiveModeSetting = useCallback(async (enabled) => {
    try {
      await axios.put(`${edgeServerEndpoint}/settings`, {
        global_live_mode_enabled: enabled ? 'True' : 'False'
      });
      logger.debug('Live mode setting saved to database:', enabled);
    } catch (error) {
      logger.error('Failed to save live mode setting:', error);
    }
  }, [edgeServerEndpoint]);

  // Wrapper for setIsVolumeOn that also saves to database
  const setLiveMode = useCallback((enabled) => {
    setIsVolumeOn(enabled);
    saveLiveModeSetting(enabled);
  }, [saveLiveModeSetting]);

  // While the new-message popup is open, poll transcription for that recording only (does not hit the full inbox).
  useEffect(() => {
    if (!newMessagePopup?.id || !edgeServerEndpoint) return;
    if (!popupTranscriptionStillPending(newMessagePopup.message)) return;

    const recordingId = newMessagePopup.id;

    const poll = async () => {
      try {
        const { data } = await axios.get(`${edgeServerEndpoint}/transcribe_save/${recordingId}`, {
          timeout: 4000,
        });
        const t = data?.transcription;
        if (!t || !String(t).trim() || t === 'No transcription available') return;

        setNewMessagePopup((prev) =>
          prev && prev.id === recordingId ? { ...prev, message: t } : prev,
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === recordingId ? { ...m, message: t, status: 'new' } : m)),
        );
        // Avoid popup closing early from pre-transcript timers; align dismiss with playback + read time
        schedulePopupDismissAfterTranscription();
      } catch {
        /* ignore transient errors */
      }
    };

    const timer = setInterval(poll, POPUP_TRANSCRIPTION_POLL_MS);
    poll();
    return () => clearInterval(timer);
  }, [
    newMessagePopup?.id,
    newMessagePopup?.message,
    edgeServerEndpoint,
    setMessages,
    schedulePopupDismissAfterTranscription,
  ]);

  // Handle re-login scenario - automatically redirect to latest messages
  useEffect(() => {
    if (isReLogin && paginationLoaded) {
      // Set reverse sort to true to show latest messages first
      setReverseSortWithSave(true);
      // Set current page to 1 to show the first page (which will be the latest messages)
      setCurrentPage(1);
      // Save the new preferences
      savePaginationPreferences(recordsPerPage, 1, true);
      // Reset the re-login flag
      resetReLoginFlag();
    }
  }, [isReLogin, paginationLoaded, setReverseSortWithSave, savePaginationPreferences, recordsPerPage, resetReLoginFlag]);

  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => setWindowWidth(window.innerWidth), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Helper function to filter messages (defined early for use in effects)
  const getFilteredMessages = useCallback(() => {
    let filtered = messages.filter((message) => {
      const channelActive = activeChannels[message.channel];
      const matchesSearch = searchQuery
        ? message.message.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesKeywords =
        activeKeywords.size === 0 ||
        [...activeKeywords].some((keyword) =>
          message.message.toLowerCase().includes(keyword.toLowerCase())
        );
      return channelActive && matchesSearch && matchesKeywords;
    });
    filtered = filterMessagesByTime(filtered);

    // In pagination mode we always want newest messages first (page 1 = newest side),
    // so we ignore the reverseSort flag and keep the natural (newest-first) order.
    if (inboxViewMode === 'pagination') {
      return filtered;
    }

    // In continuous mode, respect the user's reverseSort preference.
    if (reverseSort) {
      // For reverse sorting, we want newest first, so we don't reverse
      return filtered;
    } else {
      // For normal sorting, we want oldest first, so we reverse
      return filtered.slice().reverse();
    }
  }, [messages, activeChannels, activeKeywords, searchQuery, timeFilter, reverseSort, startDate, endDate, startTime, endTime, inboxViewMode]);

  // Helper function to filter messages for mobile (defined early for use in effects)
  const getFilteredMessagesForMobile = useCallback(() => {
    let filtered = messages.filter(msg => {
      const channelActive = activeChannels[msg.channel] !== false;
      const keywordMatch = activeKeywords.size === 0 || 
        Array.from(activeKeywords).some(kw => 
          msg.message.toLowerCase().includes(kw.toLowerCase())
        );
      return channelActive && keywordMatch;
    });
    
    if (timeFilter === TIME_FILTERS.CUSTOM) {
      if (startDate && endDate) {
        const localToUTC = (dateStr, timeStr) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          const [hours = 0, minutes = 0, seconds = 0] = timeStr ? timeStr.split(':').map(Number) : [0, 0, 0];
          return new Date(year, month - 1, day, hours, minutes, seconds);
        };
        let start;
        let end;
        if (startTime) start = localToUTC(startDate, startTime);
        else start = localToUTC(startDate, '00:00:00');
        if (endTime) {
          const [hours, minutes] = endTime.split(':').map(Number);
          end = localToUTC(endDate, `${hours}:${minutes}:59`);
          end.setMilliseconds(999);
        } else {
          end = localToUTC(endDate, '23:59:59');
          end.setMilliseconds(999);
        }
        filtered = filtered.filter((msg) => {
          const msgTime = parseTimestamp(msg.time);
          return msgTime >= start && msgTime <= end;
        });
      }
    } else if (timeFilter !== TIME_FILTERS.ALL) {
      const cutoffMs = getPresetCutoffMs(timeFilter);
      if (cutoffMs != null) {
        const cutoff = new Date(cutoffMs);
        filtered = filtered.filter((msg) => parseTimestamp(msg.time) >= cutoff);
      }
    }
    
    // Apply sorting
    if (inboxViewMode === 'pagination') {
      // Pagination mode: always newest first (page 1 = newest side)
      return filtered;
    }

    if (reverseSort) {
      return filtered;
    } else {
      return filtered.slice().reverse();
    }
  }, [messages, activeChannels, activeKeywords, timeFilter, reverseSort, startDate, endDate, startTime, endTime, inboxViewMode]);

  const applyContinuousLoadMorePage = useCallback(
    (slot, nextPage) => {
      const allowServerMore = inboxServerHasMoreRef.current;
      if (slot === 'mobile') {
        const filtered = getFilteredMessagesForMobile();
        setTotalFilteredMessages(filtered.length);
        let pageMessages;
        let hasMore;
        if (reverseSort) {
          const endIndex = nextPage * recordsPerPage;
          pageMessages = filtered.slice(0, endIndex);
          hasMore = endIndex < filtered.length || allowServerMore;
        } else {
          const newStartIndex = Math.max(0, filtered.length - nextPage * recordsPerPage);
          pageMessages = filtered.slice(newStartIndex);
          hasMore = newStartIndex > 0 || allowServerMore;
        }
        setMobileMessages(pageMessages);
        setMobileCurrentPage(nextPage);
        setHasMoreMessages(hasMore);
      } else {
        const filtered = getFilteredMessages();
        setTotalFilteredMessages(filtered.length);
        let pageMessages;
        let hasMore;
        if (reverseSort) {
          const endIndex = nextPage * recordsPerPage;
          pageMessages = filtered.slice(0, endIndex);
          hasMore = endIndex < filtered.length || allowServerMore;
        } else {
          const newStartIndex = Math.max(0, filtered.length - nextPage * recordsPerPage);
          pageMessages = filtered.slice(newStartIndex);
          hasMore = newStartIndex > 0 || allowServerMore;
        }
        setDesktopMessages(pageMessages);
        setDesktopCurrentPage(nextPage);
        setHasMoreMessages(hasMore);
      }
    },
    [reverseSort, recordsPerPage, getFilteredMessagesForMobile, getFilteredMessages],
  );

  const applyContinuousLoadMorePageRef = useRef(() => {});
  useEffect(() => {
    applyContinuousLoadMorePageRef.current = applyContinuousLoadMorePage;
  }, [applyContinuousLoadMorePage]);

  // Initialize messages according to view mode
  useEffect(() => {
    if (isMobile) {
      const filtered = getFilteredMessagesForMobile();
      setTotalFilteredMessages(filtered.length);
      let initialMessages;
      if (inboxViewMode === 'pagination') {
        // For pagination mode, use the current page
        initialMessages = filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);
      } else {
        // For continuous mode
        if (reverseSort) {
          // reverseSort=true: newest at top, start from beginning
          initialMessages = filtered.slice(0, recordsPerPage);
        } else {
          // reverseSort=false: newest at bottom, start from end (show most recent messages)
          const startIndex = Math.max(0, filtered.length - recordsPerPage);
          initialMessages = filtered.slice(startIndex);
        }
      }
      setMobileMessages(initialMessages);
      setMobileCurrentPage(1);
      // For continuous mode, hasMore depends on sort order
      if (inboxViewMode === 'continuous') {
        if (reverseSort) {
          setHasMoreMessages(filtered.length > recordsPerPage || inboxServerHasMore);
        } else {
          const startIndex = Math.max(0, filtered.length - recordsPerPage);
          setHasMoreMessages(startIndex > 0 || inboxServerHasMore);
        }
      } else {
        setHasMoreMessages(false);
      }
    } else {
      const filtered = getFilteredMessages();
      setTotalFilteredMessages(filtered.length);
      let initialMessages;
      if (inboxViewMode === 'pagination') {
        // For pagination mode, use the current page
        initialMessages = filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);
      } else {
        // For continuous mode
        if (reverseSort) {
          // reverseSort=true: newest at top, start from beginning
          initialMessages = filtered.slice(0, recordsPerPage);
        } else {
          // reverseSort=false: newest at bottom, start from end (show most recent messages)
          const startIndex = Math.max(0, filtered.length - recordsPerPage);
          initialMessages = filtered.slice(startIndex);
        }
      }
      setDesktopMessages(initialMessages);
      setDesktopCurrentPage(1);
      // For continuous mode, hasMore depends on sort order
      if (inboxViewMode === 'continuous') {
        if (reverseSort) {
          setHasMoreMessages(filtered.length > recordsPerPage || inboxServerHasMore);
        } else {
          const startIndex = Math.max(0, filtered.length - recordsPerPage);
          setHasMoreMessages(startIndex > 0 || inboxServerHasMore);
        }
      } else {
        setHasMoreMessages(false);
      }
    }
  }, [
    isMobile,
    getFilteredMessagesForMobile,
    getFilteredMessages,
    recordsPerPage,
    currentPage,
    inboxViewMode,
    reverseSort,
    inboxServerHasMore,
  ]);

  // Load more messages for continuous scroll (both mobile and desktop)
  const loadMoreMessages = useCallback(() => {
    if (inboxViewMode !== 'continuous') return;
    if (isLoadingMore || !hasMoreMessages) return;

    const slot = isMobile ? 'mobile' : 'desktop';
    const curPage = isMobile ? mobileCurrentPage : desktopCurrentPage;
    const filtered = isMobile ? getFilteredMessagesForMobile() : getFilteredMessages();

    let localHasMore;
    if (reverseSort) {
      localHasMore = curPage * recordsPerPage < filtered.length;
    } else {
      const startIdx = Math.max(0, filtered.length - curPage * recordsPerPage);
      localHasMore = startIdx > 0;
    }

    if (!localHasMore && inboxServerHasMore && typeof onFetchOlderInbox === 'function') {
      resumeContinuousLoadMoreRef.current = { slot, nextPage: curPage + 1 };
      setIsLoadingMore(true);
      void Promise.resolve(onFetchOlderInbox())
        .catch((err) => logger.error('onFetchOlderInbox:', err))
        .finally(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const pending = resumeContinuousLoadMoreRef.current;
              resumeContinuousLoadMoreRef.current = null;
              if (pending) {
                applyContinuousLoadMorePageRef.current(pending.slot, pending.nextPage);
              }
              setIsLoadingMore(false);
            });
          });
        });
      return;
    }

    if (!localHasMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      applyContinuousLoadMorePageRef.current(slot, curPage + 1);
      setIsLoadingMore(false);
    }, 0);
  }, [
    inboxViewMode,
    isLoadingMore,
    hasMoreMessages,
    isMobile,
    mobileCurrentPage,
    desktopCurrentPage,
    recordsPerPage,
    getFilteredMessagesForMobile,
    getFilteredMessages,
    reverseSort,
    inboxServerHasMore,
    onFetchOlderInbox,
  ]);

  const [branding, setBranding] = useState({
    organizationName: 'Boondock Edge',
    tagline: 'Justice in Motion',
    brandColors: { accent: 'var(--ui-accent)', primary: 'var(--ui-accent)', secondary: 'var(--ui-muted)' },
    font: 'Poppins',
    assets: { logo: null, favicon: null, loader: null }
  });
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.username || !edgeServerEndpoint) {
        return;
      }
      try {
        const response = await axios.get(`${edgeServerEndpoint}/users/${user.username}`);
        const role = response.data?.[user.username]?.role || 'member';
        setUserRole(role);
      } catch (error) {
        logger.error('Failed to fetch user role:', error);
        setUserRole('member');
      }
    };

    fetchUserRole();
  }, [user?.username, edgeServerEndpoint]);

  
  // Toggle sidebar and log state for debugging
  const toggleSidebar = (e) => {
    e.stopPropagation();
    logger.debug("Menu button clicked, current isSidebarOpen:", isSidebarOpen);
    setIsSidebarOpen(prev => {
      const newState = !prev;
      logger.debug("New sidebar state:", newState);
      return newState;
    });
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isMobile && isSidebarOpen && !e.target.closest('.sidebar-container')) {
        logger.debug("Clicked outside, closing sidebar");
        setIsSidebarOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isMobile, isSidebarOpen]);

   const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedMessages(new Set());
  };
  

  useEffect(() => {
    const fetchBrandingData = async () => {
      try {
        const response = await fetch(`${edgeServerEndpoint}/branding`);
        if (!response.ok) throw new Error('Failed to fetch branding data');
        const data = await response.json();
        setBranding({
          organizationName: data.organization_name || 'Boondock Edge',
          tagline: data.tagline || 'Justice in Motion',
          brandColors: {
            accent: data.brand_colors?.accent || 'var(--ui-accent)',
            primary: data.brand_colors?.primary || 'var(--ui-accent)',
            secondary: data.brand_colors?.secondary || 'var(--ui-muted)'
          },
          font: data.font || 'Poppins',
          assets: {
            logo: data.assets?.logo ? `data:image/jpeg;base64,${data.assets.logo}` : null,
            favicon: data.assets?.favicon ? `data:image/x-icon;base64,${data.assets.favicon}` : null,
            loader: data.assets?.loader ? `data:image/gif;base64,${data.assets.loader}` : null
          }
        });
      } catch (error) {
        logger.error('Error fetching branding data:', error);
      } finally {
        setBrandingLoaded(true);
      }
    };
    fetchBrandingData();
  }, [edgeServerEndpoint]);

  useEffect(() => {
    if (brandingLoaded && branding.assets.favicon) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = branding.assets.favicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [brandingLoaded, branding.assets.favicon]);

  const filterMessagesByTime = (messages) => {
    if (timeFilter === TIME_FILTERS.CUSTOM) {
      if (!startDate || !endDate) return messages;
      const localToUTC = (dateStr, timeStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours = 0, minutes = 0, seconds = 0] = timeStr ? timeStr.split(':').map(Number) : [0, 0, 0];
        const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
        return new Date(localDate.getTime());
      };
      let start;
      let end;
      if (startTime) start = localToUTC(startDate, startTime);
      else start = localToUTC(startDate, '00:00:00');
      if (endTime) {
        const [hours, minutes] = endTime.split(':').map(Number);
        end = localToUTC(endDate, `${hours}:${minutes}:59`);
        end.setMilliseconds(999);
      } else {
        end = localToUTC(endDate, '23:59:59');
        end.setMilliseconds(999);
      }
      return messages.filter((message) => {
        const messageTime = parseTimestamp(message.time);
        return messageTime >= start && messageTime <= end;
      });
    }
    if (timeFilter === TIME_FILTERS.ALL) return messages;
    const cutoffMs = getPresetCutoffMs(timeFilter);
    if (cutoffMs == null) return messages;
    const cutoffTime = new Date(cutoffMs);
    return messages.filter((message) => parseTimestamp(message.time) >= cutoffTime);
  };

  useEffect(() => {
    localStorage.setItem('timeFilter', timeFilter);
  }, [timeFilter]);

  useEffect(() => {
    if (skipInboxViewChangedEventRef.current) {
      skipInboxViewChangedEventRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('boondock:inbox-view-changed'));
    }, 350);
    return () => window.clearTimeout(t);
  }, [timeFilter, startDate, endDate, startTime, endTime]);

  useEffect(() => {
    const filteredMessages = filterMessagesByTime(messages);
    const counts = {};
    filteredMessages.forEach((message) => {
      counts[message.channel] = (counts[message.channel] || 0) + 1;
    });
    setChannelMessageCounts(counts);
  }, [messages, timeFilter, startDate, endDate, startTime, endTime]);

  const getTotalPages = (messagesCount) => Math.ceil(messagesCount / recordsPerPage);

  // Adjust current page when sort preference changes or when messages are first loaded (only for pagination mode)
  useEffect(() => {
    if (!paginationLoaded || inboxViewMode !== 'pagination' || messages.length === 0) return;

    const filtered = isMobile ? getFilteredMessagesForMobile() : getFilteredMessages();
    const totalPages = getTotalPages(filtered.length);

    if (totalPages === 0) return;

    // On first load in pagination mode, default to the "newest side" page:
    // - reverseSort=true  -> newest at top  -> page 1
    // - reverseSort=false -> newest at bottom -> last page
    if (!hasAppliedDefaultPage) {
      const defaultPage = reverseSort ? 1 : totalPages;
      if (currentPage !== defaultPage) {
        setCurrentPage(defaultPage);
        savePaginationPreferences(recordsPerPage, defaultPage, reverseSort);
      }
      setHasAppliedDefaultPage(true);
      return;
    }

    // If current page is beyond total pages (e.g., after filtering), go to the appropriate default page.
    // Do NOT override valid pages (like page 1) so users can view the true oldest records.
    if (currentPage > totalPages && totalPages > 0) {
      const targetPage = reverseSort ? 1 : totalPages;
      setCurrentPage(targetPage);
      savePaginationPreferences(recordsPerPage, targetPage, reverseSort);
    }
  }, [paginationLoaded, reverseSort, inboxViewMode, messages.length, isMobile, getFilteredMessagesForMobile, getFilteredMessages, recordsPerPage, currentPage, savePaginationPreferences, hasAppliedDefaultPage]);

  const handlePlayAudio = (url) => {
    if (playingAudio === url) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play();
      setPlayingAudio(url);
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const audioEl = audioRef.current;
    const handleEnded = () => {
      setIsPlaying(false);
      setPlayingAudio(null);
    };
    audioEl.addEventListener('ended', handleEnded);
    return () => audioEl.removeEventListener('ended', handleEnded);
  }, []);

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => setIconToggle(prev => !prev), 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (!keywords?.length) return;
    const filteredMessages = filterMessagesByTime(messages);
    const counts = {};
    keywords.forEach(keyword => {
      let count = 0;
      filteredMessages.forEach(msg => {
        const regex = new RegExp(keyword, 'gi');
        const matches = msg.message.match(regex);
        if (matches) count += matches.length;
      });
      if (count > 0) counts[keyword] = count;
    });
    setKeywordCounts(counts);
  }, [messages, keywords, timeFilter, startDate, endDate, startTime, endTime]);


  const AudioIcon = ({ url }) => {
    const isCurrentlyPlaying = playingAudio === url && isPlaying;
    return isCurrentlyPlaying ? (
      iconToggle ? (
        <Volume2 className="inline ml-2 text-blue-500 cursor-pointer" size={18} />
      ) : (
        <Volume1 className="inline ml-2 text-blue-500 cursor-pointer" size={18} />
      )
    ) : (
      <Volume1 className="inline ml-2 text-gray-400 cursor-pointer" size={18} />
    );
  };

  const toggleKeyword = (keywordId) => {
    setActiveKeywords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keywordId)) newSet.delete(keywordId);
      else newSet.add(keywordId);
      return newSet;
    });
  };

  const parseTimestamp = (timestamp) => {
    const year = parseInt(timestamp.substring(0, 4));
    const month = parseInt(timestamp.substring(4, 6)) - 1;
    const day = parseInt(timestamp.substring(6, 8));
    const hours = parseInt(timestamp.substring(9, 11));
    const minutes = parseInt(timestamp.substring(11, 13));
    const seconds = parseInt(timestamp.substring(13, 15));
    const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    return utcDate;
  };

  const formatTime = useCallback((timestamp, timezone = "America/Chicago") => {
    const date = parseTimestamp(timestamp);
    
    // If showFullTimestamps is enabled, return full timestamp respecting time format
    if (showFullTimestamps) {
      const options = { timeZone: timezone };
      const dateInTimezone = new Date(date.toLocaleString("en-US", options));
      
      const year = dateInTimezone.getFullYear();
      const month = String(dateInTimezone.getMonth() + 1).padStart(2, '0');
      const day = String(dateInTimezone.getDate()).padStart(2, '0');
      
      if (timeFormat === "12h") {
        // 12-hour format with AM/PM
        const hours = dateInTimezone.getHours();
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutes = String(dateInTimezone.getMinutes()).padStart(2, '0');
        const seconds = String(dateInTimezone.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${String(hour12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
      } else {
        // 24-hour format
        const hours = String(dateInTimezone.getHours()).padStart(2, '0');
        const minutes = String(dateInTimezone.getMinutes()).padStart(2, '0');
        const seconds = String(dateInTimezone.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
    }
    
    // Original format logic
    const options = { timeZone: timezone };
    const now = new Date();
    const todayInTimezone = new Date(now.toLocaleString("en-US", options));
    const yesterdayInTimezone = new Date(todayInTimezone);
    yesterdayInTimezone.setDate(yesterdayInTimezone.getDate() - 1);

    const timeFormatOptions = { 
      timeZone: timezone,
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      hour12: timeFormat === "12h"
    };
    
    const dateTimeFormatOptions = {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== todayInTimezone.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: timeFormat === "12h"
    };

    const dateInTimezone = new Date(date.toLocaleString("en-US", options));
    if (
      dateInTimezone.getDate() === todayInTimezone.getDate() &&
      dateInTimezone.getMonth() === todayInTimezone.getMonth() &&
      dateInTimezone.getFullYear() === todayInTimezone.getFullYear()
    ) {
      return date.toLocaleString("en-US", timeFormatOptions);
    } else if (
      dateInTimezone.getDate() === yesterdayInTimezone.getDate() &&
      dateInTimezone.getMonth() === yesterdayInTimezone.getMonth() &&
      dateInTimezone.getFullYear() === yesterdayInTimezone.getFullYear()
    ) {
      return `Yesterday ${date.toLocaleString("en-US", timeFormatOptions)}`;
    } else {
      return date.toLocaleString("en-US", dateTimeFormatOptions);
    }
  }, [showFullTimestamps, timeFormat]);

  /** Shown under channel badge: e.g. "Mar 10, 12:39:08" (respects full-timestamp mode). */
  const formatFeedRowSublineDate = useCallback(
    (timestamp, tz = "America/Chicago") => {
      if (!timestamp || String(timestamp).length < 15) return "—";
      if (showFullTimestamps) {
        return formatTime(timestamp, tz);
      }
      const date = parseTimestamp(timestamp);
      const options = { timeZone: tz };
      const dateInTz = new Date(date.toLocaleString("en-US", options));
      const todayInTz = new Date(new Date().toLocaleString("en-US", options));
      const includeYear = dateInTz.getFullYear() !== todayInTz.getFullYear();
      return date.toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        ...(includeYear ? { year: "numeric" } : {}),
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: timeFormat === "12h",
      });
    },
    [showFullTimestamps, formatTime, timeFormat]
  );

  const highlightText = (text, searchQuery) => {
    let characters = text.split('');
    let spans = Array(characters.length).fill(null);

    if (keywords?.length) {
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          for (let i = match.index; i < match.index + match[0].length; i++) {
            if (!spans[i]) spans[i] = { text: characters[i], isKeyword: true };
          }
        }
      });
    }

    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        for (let i = match.index; i < match.index + match[0].length; i++) {
          if (!spans[i]) spans[i] = { text: characters[i], isSearch: true };
          else spans[i] = { ...spans[i], isSearch: true };
        }
      }
    }

    let result = [];
    let currentSpan = null;

    for (let i = 0; i < characters.length; i++) {
      if (!spans[i]) {
        if (currentSpan) {
          result.push(currentSpan);
          currentSpan = null;
        }
        result.push(characters[i]);
        continue;
      }

      const { text, isKeyword, isSearch } = spans[i];
      const className = `${isKeyword ? 'underline font-bold' : ''} ${isSearch ? 'bg-yellow-200' : ''}`.trim();

      if (!currentSpan || currentSpan.props.className !== className) {
        if (currentSpan) result.push(currentSpan);
        currentSpan = <span key={`span-${i}`} className={className}>{text}</span>;
      } else {
        currentSpan = React.cloneElement(currentSpan, { children: currentSpan.props.children + text });
      }
    }

    if (currentSpan) result.push(currentSpan);
    return result;
  };

  const filteredMessages = messages.filter((message) => {
    const channelActive = activeChannels[message.channel];
    const matchesSearch = searchQuery
      ? message.message.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesKeywords =
      activeKeywords.size === 0 ||
      [...activeKeywords].some((keyword) =>
        message.message.toLowerCase().includes(keyword.toLowerCase())
      );
    return channelActive && matchesSearch && matchesKeywords;
  });

  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = messagesListRef.current;
    setIsAtBottom(scrollHeight - scrollTop === clientHeight);
  };

  const playQueuedPopupNotification = useCallback((popupItem) => {
    clearPopupDismissTimer();
    detachPopupAudioEndedListener();

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setNewMessagePopup(popupItem);
    audioRef.current.src = popupItem.url;
    audioRef.current.load();

    const hadTranscriptOnOpen = !popupTranscriptionStillPending(popupItem.message);

    const handleLoadedMetadata = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);

      const duration = audio.duration;
      if (hadTranscriptOnOpen && duration && isFinite(duration) && duration > 0) {
        schedulePopupDismissTimer(duration * 1000 + 500);
        return;
      }

      if (!hadTranscriptOnOpen) {
        schedulePopupDismissTimer(POPUP_NO_TRANSCRIPT_SAFETY_MS);
        const onEnded = () => {
          detachPopupAudioEndedListener();
          clearPopupDismissTimer();
          setNewMessagePopup(null);
        };
        audio.addEventListener('ended', onEnded);
        popupAudioEndedCleanupRef.current = () => {
          audio.removeEventListener('ended', onEnded);
        };
        return;
      }

      schedulePopupDismissTimer(POPUP_NO_TRANSCRIPT_SAFETY_MS);
    };

    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

    audioRef.current.play().then(() => {
      setPlayingAudio(popupItem.url);
      setIsPlaying(true);
      setLastPlayedMessageId(popupItem.id);
    }).catch((error) => {
      logger.error('Error auto-playing queued message:', error);
      schedulePopupDismissTimer(POPUP_NO_TRANSCRIPT_SAFETY_MS);
    });
  }, [clearPopupDismissTimer, detachPopupAudioEndedListener, schedulePopupDismissTimer]);

  useEffect(() => {
    if (isVolumeOn) return;
    setPopupQueue([]);
    closeNewMessagePopup();
  }, [isVolumeOn, closeNewMessagePopup]);

  useEffect(() => {
    if (!isVolumeOn || newMessagePopup || popupQueue.length === 0) return;
    const [nextPopup, ...remaining] = popupQueue;
    setPopupQueue(remaining);
    playQueuedPopupNotification(nextPopup);
  }, [isVolumeOn, newMessagePopup, popupQueue, playQueuedPopupNotification]);

  useEffect(() => {
    if (messages.length > previousMessages.length) {
      setNewMessages(true);
      if (!isVolumeOn) return;

      // Initialize session cursor from existing feed so old backlog does not pop.
      if (!livePopupCursorRef.current && messages.length > 0) {
        livePopupCursorRef.current = getMessageCursorTuple(messages[0]);
        return;
      }

      const previousIds = new Set(previousMessages.map((m) => m.id));
      const incoming = messages.filter(
        (m) => m.url && !previousIds.has(m.id) && m.id !== lastPlayedMessageId,
      );

      if (incoming.length === 0) return;

      const lastCursor = livePopupCursorRef.current;
      const trulyNewIncoming = incoming.filter((m) =>
        isCursorGreater(getMessageCursorTuple(m), lastCursor),
      );

      if (trulyNewIncoming.length === 0) return;

      // Process oldest-to-newest so playback order matches arrival sequence.
      const orderedIncoming = trulyNewIncoming.slice().sort((a, b) => {
        return String(a.time).localeCompare(String(b.time));
      });

      const popupItems = orderedIncoming.map((message) => ({
        id: message.id,
        message: message.message,
        channel: channels[message.channel]?.name || `Channel ${message.channel}`,
        time: formatTime(message.time, timezone),
        url: message.url,
      }));

      setPopupQueue((prevQueue) => {
        const dedupeIds = new Set(prevQueue.map((item) => item.id));
        if (activePopupMessageIdRef.current != null) {
          dedupeIds.add(activePopupMessageIdRef.current);
        }

        const merged = [...prevQueue];
        popupItems.forEach((item) => {
          if (!dedupeIds.has(item.id)) {
            merged.push(item);
            dedupeIds.add(item.id);
          }
        });

        // Keep only the latest burst to avoid overwhelming users/devices.
        return merged.slice(-LIVE_POPUP_QUEUE_LIMIT);
      });

      // Advance cursor to the newest message we accepted for popup playback.
      const newestAccepted = orderedIncoming[orderedIncoming.length - 1];
      if (newestAccepted) {
        const newestCursor = getMessageCursorTuple(newestAccepted);
        if (isCursorGreater(newestCursor, livePopupCursorRef.current)) {
          livePopupCursorRef.current = newestCursor;
        }
      }
    }
  }, [
    messages,
    previousMessages,
    isVolumeOn,
    channels,
    timezone,
    lastPlayedMessageId,
    formatTime,
  ]);

  useEffect(() => {
    setPreviousMessages(messages);
  }, [messages]);

  // Auto-scroll only on initial load or when user is at bottom
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      // On initial load, scroll to bottom
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      setIsInitialLoad(false);
    } else if (isAtBottom && newMessages && messagesEndRef.current) {
      // Only auto-scroll if user is at bottom and new messages arrive
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setNewMessages(false);
    }
  }, [messages, isAtBottom, newMessages, isInitialLoad]);

  const LOCAL_STORAGE_KEYS = {
    showTime: "showTime",
    showCar: "showCar",
    showChannel: "showChannel",
    showPerson: "showPerson",
    timeFilter: "timeFilter" 
  };

  const getInitialVisibilityState = (key, defaultValue) =>
    localStorage.getItem(key) === null
      ? defaultValue
      : JSON.parse(localStorage.getItem(key));

  // Visibility toggles for metadata in the inbox header row
  // Defaults: show timing and channel, hide tag and person
  const [showTime, setShowTime] = useState(() =>
    getInitialVisibilityState(LOCAL_STORAGE_KEYS.showTime, true)
  );
  const [showCar, setShowCar] = useState(() =>
    getInitialVisibilityState(LOCAL_STORAGE_KEYS.showCar, false)
  );
  const [showChannel, setShowChannel] = useState(() =>
    getInitialVisibilityState(LOCAL_STORAGE_KEYS.showChannel, true)
  );
  const [showPerson, setShowPerson] = useState(() =>
    getInitialVisibilityState(LOCAL_STORAGE_KEYS.showPerson, false)
  );

  useEffect(() => localStorage.setItem(LOCAL_STORAGE_KEYS.showTime, JSON.stringify(showTime)), [showTime]);
  useEffect(() => localStorage.setItem(LOCAL_STORAGE_KEYS.showCar, JSON.stringify(showCar)), [showCar]);
  useEffect(() => localStorage.setItem(LOCAL_STORAGE_KEYS.showChannel, JSON.stringify(showChannel)), [showChannel]);
  useEffect(() => localStorage.setItem(LOCAL_STORAGE_KEYS.showPerson, JSON.stringify(showPerson)), [showPerson]);
  
  useEffect(() => {
    if (!isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <div className={`flex h-screen flex-col md:flex-row overflow-hidden antialiased ${isDarkMode ? 'bg-slate-950' : 'bg-surface'}`}>
      {/* Mobile Header */}
      {isMobile && (
        <div className={`sticky top-0 z-20 flex items-center justify-between border-b p-2 transition-colors duration-300 ${
          isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-slate-50'
        }`}>
          <button 
            onClick={toggleSidebar}
            className={`rounded-lg p-2 transition-colors duration-200 ${
              isDarkMode 
                ? 'text-blue-400 hover:bg-slate-800' 
                : 'text-blue-900 hover:bg-slate-200/60'
            }`}
            type="button"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="material-symbols-outlined text-[26px] leading-none">
              {isSidebarOpen ? 'close' : 'menu'}
            </span>
          </button>
          <h1 className={`text-lg font-semibold ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>{branding.organizationName}</h1>
          <div className="w-8" /> {/* Spacer */}
        </div>
      )}

      {/* Sidebar — fixed rail on desktop (dashboard.html) */}
      <div
        className={`sidebar-container z-40 h-full w-72 transition-transform duration-300 ease-in-out
          ${isMobile 
            ? `fixed left-0 top-0 ${
                isDarkMode ? 'bg-slate-900' : 'bg-slate-50'
              } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'fixed left-0 top-0 hidden md:block'
          }
          ${isFullscreen ? 'hidden' : ''}`}
        >
        <TeamsSidebar
          isDarkMode={isDarkMode}
          timezone={timezone}
          toggleTheme={toggleTheme}
          setIsDarkMode={setIsDarkMode}
          channels={channels}
          setChannels={setChannels}
          channelColors={channelColors}
          activeChannels={activeChannels}
          setActiveChannels={setActiveChannels}
          activeKeywords={activeKeywords}
          toggleKeyword={toggleKeyword}
          isVolumeOn={isVolumeOn}
          setIsVolumeOn={setLiveMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          keywordCounts={keywordCounts}
          channelMessageCounts={channelMessageCounts}
          API_BASE_URL={edgeServerEndpoint}
          isMobile={isMobile}
          closeSidebar={() => setIsSidebarOpen(false)}
          onDocumentationClick={() => window.open('/user-guide', '_blank')}
        />
      </div>

      {/* Main workspace — offset for fixed sidebar on desktop */}
      <div
        className={`flex min-w-0 flex-1 flex-col overflow-hidden ${isFullscreen ? '' : 'md:ml-72'} ${
          isDarkMode ? 'bg-slate-950' : 'bg-white'
        }`}
      >
        <main
          id="dashboard-main"
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
          aria-label="Live dashboard"
        >
        <a
          href="#dashboard-feed"
          className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isDarkMode
              ? 'focus:bg-primary focus:text-white focus:ring-blue-400 focus:ring-offset-slate-950'
              : 'focus:bg-primary focus:text-on-primary focus:ring-primary focus:ring-offset-white'
          }`}
        >
          Skip to messages
        </a>
        {/* Top Bar */}
        {!isFullscreen && (
          <TopBar
          toggleMultiSelectMode={toggleMultiSelectMode}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          isMultiSelectMode={isMultiSelectMode}
          setIsMultiSelectMode={setIsMultiSelectMode}
            branding={branding}
            timezone={timezone}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            showTime={showTime}
            setShowTime={setShowTime}
            showCar={showCar}
            setShowCar={setShowCar}
            showChannel={showChannel}
            setShowChannel={setShowChannel}
            showPerson={showPerson}
            setShowPerson={setShowPerson}
            isMobile={isMobile}
            edgeServerEndpoint={edgeServerEndpoint}
            userRole={userRole}
            showFullTimestamps={showFullTimestamps}
            setShowFullTimestamps={setShowFullTimestamps}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            toggleTheme={toggleTheme}
            timeFormat={timeFormat}
            isVolumeOn={isVolumeOn}
            setIsVolumeOn={setLiveMode}
            inboxViewMode={inboxViewMode}
            onInboxViewModeChange={handleInboxViewModeChange}
          />
        )}

        {/* Notification Banner */}
        <NotificationBanner edgeServerEndpoint={edgeServerEndpoint} isDarkMode={isDarkMode} />

        <div id="dashboard-feed" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <FullscreenMessages
          toggleMultiSelectMode={toggleMultiSelectMode}
          setMessages={setMessages}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          isMultiSelectMode={isMultiSelectMode}
          setIsMultiSelectMode={setIsMultiSelectMode}
          edgeServerEndpoint={edgeServerEndpoint}
          isDarkMode={isDarkMode}
          messages={isMobile ? mobileMessages : desktopMessages}
          totalMessages={totalFilteredMessages}
          channels={channels}
          showTime={showTime}
          showCar={showCar}
          showChannel={showChannel}
          showPerson={showPerson}
          formatTime={formatTime}
          formatFeedRowSublineDate={formatFeedRowSublineDate}
          timezone={timezone}
          timeFormat={timeFormat}
          activeAudioUrl={activeAudioUrl}
          setActiveAudioUrl={setActiveAudioUrl}
          highlightText={highlightText}
          searchQuery={searchQuery}
          handlePlayAudio={handlePlayAudio}
          AudioIcon={AudioIcon}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          isMobile={isMobile}
          reverseSort={reverseSort}
          currentPage={currentPage}
          // Only enable infinite scroll in continuous mode
          onLoadMore={inboxViewMode === 'continuous' ? loadMoreMessages : null}
          hasMoreMessages={inboxViewMode === 'continuous' ? hasMoreMessages : false}
          isLoadingMore={inboxViewMode === 'continuous' ? isLoadingMore : false}
          inboxViewMode={inboxViewMode}
          isVolumeOn={isVolumeOn}
          setIsVolumeOn={setLiveMode}
        />

        {inboxViewMode === 'pagination' && (
          <FooterPagination
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            getFilteredMessages={isMobile ? getFilteredMessagesForMobile : getFilteredMessages}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            getTotalPages={getTotalPages}
            recordsPerPage={recordsPerPage}
            setRecordsPerPage={setRecordsPerPage}
            isMobile={isMobile}
            edgeServerEndpoint={edgeServerEndpoint}
            reverseSort={reverseSort}
            inboxServerHasMore={inboxServerHasMore}
            inboxServerTotal={inboxServerTotal}
            onFetchOlderInbox={fetchOlderForPagination}
            isFetchingOlderInbox={paginationFetchingOlder}
          />
        )}
        </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* MFA Reminder Modal */}
      <MFAReminderModal
        isOpen={showMfaReminder}
        onClose={() => {
          setShowMfaReminder(false);
          sessionStorage.setItem('mfa_reminder_dismissed', 'true');
        }}
        onSetup={() => {
          setShowMfaReminder(false);
          sessionStorage.removeItem('mfa_reminder_dismissed');
        }}
        edgeServerEndpoint={edgeServerEndpoint}
        isDarkMode={isDarkMode}
        user={user}
      />

      {/* New Message Full Card Popup */}
      {newMessagePopup && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.3s ease-in-out' }}
          onClick={closeNewMessagePopup}
        >
          <div 
            className={`relative w-full max-w-4xl rounded-lg shadow-2xl ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
            style={{ animation: 'slideUp 0.3s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeNewMessagePopup}
              className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
                isDarkMode 
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <X size={24} />
            </button>

            {/* Content */}
            <div className="p-8 md:p-12">
              {/* Channel and Time Header */}
              <div className={`mb-6 text-sm font-medium ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <span className="font-semibold">{newMessagePopup.channel}</span>
                <span className="mx-2">•</span>
                <span>{newMessagePopup.time}</span>
              </div>

              {/* Message Text - Large and Prominent */}
              <div className={`mb-8 text-2xl md:text-3xl lg:text-4xl font-normal leading-relaxed ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {newMessagePopup.message}
              </div>

              {/* Audio Playback Controls */}
              {newMessagePopup.url && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      if (audioRef.current && audioRef.current.src === newMessagePopup.url) {
                        if (isPlaying) {
                          audioRef.current.pause();
                          setIsPlaying(false);
                        } else {
                          audioRef.current.play().then(() => {
                            setIsPlaying(true);
                          }).catch((error) => {
                            logger.error('Error playing audio:', error);
                            setIsPlaying(false);
                          });
                        }
                      } else {
                        if (audioRef.current) {
                          audioRef.current.pause();
                        }
                        audioRef.current.src = newMessagePopup.url;
                        audioRef.current.load();
                        audioRef.current.play().then(() => {
                          setPlayingAudio(newMessagePopup.url);
                          setIsPlaying(true);
                        }).catch((error) => {
                          logger.error('Error playing audio:', error);
                          setIsPlaying(false);
                        });
                      }
                    }}
                    className={`flex items-center justify-center w-16 h-16 rounded-full transition-all ${
                      isPlaying && playingAudio === newMessagePopup.url
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isPlaying && playingAudio === newMessagePopup.url ? (
                      <Volume2 className="w-8 h-8" />
                    ) : (
                      <Volume1 className="w-8 h-8" />
                    )}
                  </button>
                  
                  {/* Audio Waveform Indicator */}
                  <div className="flex-1 flex items-center gap-1 h-12">
                    {[...Array(20)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          isPlaying && playingAudio === newMessagePopup.url
                            ? 'bg-blue-500 animate-pulse'
                            : isDarkMode
                            ? 'bg-gray-600'
                            : 'bg-gray-300'
                        }`}
                        style={{
                          height: `${Math.random() * 60 + 20}%`,
                          animationDelay: `${i * 50}ms`
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LiveCommunications;
