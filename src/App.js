import { API_BASE_URL } from './utils/apiClient';
import React, { useEffect, useState, useMemo, useRef, useCallback, Component } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import LiveCommunications from "./components/Dashboard/LiveCommunications";
import AdvancedAudioPlayer from './components/Dashboard/AdvancedAudioPlayer';
import SettingsPage from "./components/Settings/SettingsPage";
import UserManagement from "./components/Users/index";
import LogsPage from "./components/Logs/LogsPage";
import ReportPage from "./components/ReportPage";
import UserProfile from "./components/UserProfile";
import UserGuidePage from "./components/Documentation/UserGuidePage";
import ReleasePage from "./components/ReleasePage";
import VersionPage from "./components/Version/VersionPage";
import LicenseSubscriptionPage from "./components/Licensing/LicenseSubscriptionPage";
// import FloatingDocumentationIcon from "./components/Documentation/FloatingDocumentationIcon"; // Hidden from apps
import api from './utils/apiClient';
import "./App.css";
import { useAuth } from './components/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import LoginPage from './components/LoginPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logger from './utils/logger';
import {
  readInboxViewWindowPrefs,
  filterMessagesToInboxViewWindow,
  getMessageTimeMs,
  getRecordingTimestampFromFilename,
  TIME_FILTERS,
  getPresetCutoffMs,
} from './utils/inboxViewWindow';

// MEDIUM-30: ErrorBoundary wraps Router to prevent the full app from crashing on unhandled errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: '#888' }}>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 16, padding: '8px 20px', cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CACHE_KEYS = {
  CHANNELS: 'cached_channels',
  MESSAGES: 'cached_messages',
  KEYWORDS: 'cached_keywords',
  TIMEZONE: 'cached_timezone',
  TIME_FORMAT: 'cached_time_format',
  LAST_FETCH: 'last_fetch_time'
};

// API endpoints configuration
const API_ENDPOINTS = {
  MESSAGES_INBOX: '/recordings/inbox',
  /** Chunked / "load more" fetches (same server handler as MESSAGES_INBOX; separate path for explicit lazy loads). */
  MESSAGES_INBOX_RANGE: '/recordings/inbox/range',
  /** Total count for the current inbox time window — used by the footer "X-Y of TOTAL". */
  MESSAGES_INBOX_COUNT: '/recordings/inbox/count',
  CHANNELS: '/channels',
  SETTINGS: '/settings'
};

const CACHE_DURATION = 50 * 60 * 1000; // 50 minutes in milliseconds
const INITIAL_INBOX_FETCH_LIMIT = 15000;
const PERIODIC_INBOX_FETCH_LIMIT = 500;
/** Baseline merge cap; presets can raise maxMessagesInMemory (see getInboxLoadPlan). */
const MAX_MESSAGES_IN_MEMORY = 50000;
/** Max rows per inbox API request (matches backend clamp). */
const BACKEND_INBOX_MAX_LIMIT = 5000;
/** Rows per "load older" request when user scrolls / pagination asks for more. */
const INBOX_LOAD_MORE_CHUNK = 15000;

/** Dispatched by LiveCommunications when the View time range changes so App refetches with the right window. */
const INBOX_VIEW_CHANGED_EVENT = 'boondock:inbox-view-changed';

function inboxViewPrefsFingerprint(prefs) {
  if (!prefs) return '';
  return JSON.stringify({
    timeFilter: prefs.timeFilter,
    startDate: prefs.startDate || '',
    endDate: prefs.endDate || '',
    startTime: prefs.startTime || '',
    endTime: prefs.endTime || '',
  });
}

/**
 * Per-request chunk sizes and merge caps. Default view is last 7 days — small first fetch.
 * Wider presets fetch one chunk first; user loads the rest via scroll (continuous) or OLD/NEW (pagination).
 */
function getInboxLoadPlan(inboxPrefs) {
  const tf = inboxPrefs?.timeFilter ?? TIME_FILTERS.DAYS7;

  if (!tf || tf === TIME_FILTERS.ALL) {
    return {
      replaceFetchLimit: INITIAL_INBOX_FETCH_LIMIT,
      maxMessagesInMemory: MAX_MESSAGES_IN_MEMORY,
      periodicLimit: PERIODIC_INBOX_FETCH_LIMIT,
    };
  }

  const byPreset = {
    [TIME_FILTERS.HR1]: { replaceFetchLimit: 1500, maxMessagesInMemory: 6000 },
    [TIME_FILTERS.DAY1]: { replaceFetchLimit: 1500, maxMessagesInMemory: 7000 },
    [TIME_FILTERS.DAYS7]: { replaceFetchLimit: 1500, maxMessagesInMemory: 9000 },
    [TIME_FILTERS.DAYS30]: { replaceFetchLimit: 2000, maxMessagesInMemory: 15000 },
    [TIME_FILTERS.MONTHS6]: { replaceFetchLimit: 2000, maxMessagesInMemory: 25000 },
    [TIME_FILTERS.MONTHS12]: { replaceFetchLimit: 2000, maxMessagesInMemory: 30000 },
    [TIME_FILTERS.CUSTOM]: { replaceFetchLimit: 2000, maxMessagesInMemory: 30000 },
  };

  const p = byPreset[tf] || {
    replaceFetchLimit: INITIAL_INBOX_FETCH_LIMIT,
    maxMessagesInMemory: MAX_MESSAGES_IN_MEMORY,
  };

  return {
    replaceFetchLimit: Math.min(Math.max(1, p.replaceFetchLimit), BACKEND_INBOX_MAX_LIMIT),
    maxMessagesInMemory: Math.max(MAX_MESSAGES_IN_MEMORY, p.maxMessagesInMemory),
    periodicLimit: PERIODIC_INBOX_FETCH_LIMIT,
  };
}

function parseInboxPayload(data) {
  if (Array.isArray(data)) {
    return { rows: data, meta: { has_more: false } };
  }
  if (data && Array.isArray(data.recordings)) {
    return { rows: data.recordings, meta: data.meta || {} };
  }
  if (data && Array.isArray(data.messages)) {
    return { rows: data.messages, meta: data.meta || {} };
  }
  return { rows: null, meta: {} };
}

// Cache management utilities
const getCacheSize = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? new Blob([data]).size : 0;
  } catch (error) {
    return 0;
  }
};

const getTotalCacheSize = () => {
  try {
    let totalSize = 0;
    Object.values(CACHE_KEYS).forEach(key => {
      totalSize += getCacheSize(key);
    });
    return totalSize;
  } catch (error) {
    return 0;
  }
};

const clearOldCache = () => {
  try {
    const lastFetch = getCachedData(CACHE_KEYS.LAST_FETCH);
    if (lastFetch && (Date.now() - lastFetch > CACHE_DURATION * 2)) {
      // Clear cache if it's older than 2x the cache duration
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      logger.debug('Cleared old cache data');
    }
  } catch (error) {
    logger.error('Error clearing old cache:', error);
  }
};

const validateTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
};

// Move cache functions here, before they're used
const cacheData = (key, data) => {
  try {
    // For messages, ensure they're properly ordered before caching
    if (key === CACHE_KEYS.MESSAGES && Array.isArray(data)) {
      data = sortMessagesByTime(data);
      logger.debug(`Messages sorted and ready for caching (latest to oldest): ${data.length} messages`);
    }
    
    // Check if data is too large for localStorage
    const dataString = JSON.stringify(data);
    const dataSize = new Blob([dataString]).size;
    const maxSize = 4 * 1024 * 1024; // 4MB limit to be safe
    
    if (dataSize > maxSize) {
      logger.warn(`Data for ${key} is too large (${(dataSize / 1024 / 1024).toFixed(2)}MB), implementing size reduction`);
      
      // For messages, keep only the most recent ones (first in array since they're sorted latest to oldest)
      if (key === CACHE_KEYS.MESSAGES && Array.isArray(data)) {
        const maxMessages = 1000; // Keep only first 1000 messages (most recent)
        const reducedData = data.slice(0, maxMessages);
        const reducedString = JSON.stringify(reducedData);
        const reducedSize = new Blob([reducedString]).size;
        
        if (reducedSize <= maxSize) {
          localStorage.setItem(key, reducedString);
          logger.debug(`Successfully cached ${reducedData.length} most recent messages (reduced from ${data.length})`);
        } else {
          // If still too large, keep even fewer messages
          const furtherReduced = data.slice(0, 500);
          localStorage.setItem(key, JSON.stringify(furtherReduced));
          logger.debug(`Successfully cached ${furtherReduced.length} most recent messages (further reduced)`);
        }
      } else {
        // For other data types, try to store a subset or skip caching
        logger.warn(`Skipping cache for ${key} due to size constraints`);
        return false;
      }
    } else {
      localStorage.setItem(key, dataString);
    }
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      logger.warn(`Storage quota exceeded for ${key}, attempting cleanup`);
      
      // Try to clear some old cache entries
      try {
        const keysToClear = [CACHE_KEYS.MESSAGES, CACHE_KEYS.CHANNELS, CACHE_KEYS.KEYWORDS];
        keysToClear.forEach(cacheKey => {
          if (cacheKey !== key) {
            localStorage.removeItem(cacheKey);
          }
        });
        
        // Try caching again with reduced data
        if (key === CACHE_KEYS.MESSAGES && Array.isArray(data)) {
          const reducedData = data.slice(0, 500); // Keep first 500 (most recent)
          localStorage.setItem(key, JSON.stringify(reducedData));
          logger.debug(`Successfully cached ${reducedData.length} most recent messages after cleanup`);
          return true;
        }
      } catch (cleanupError) {
        logger.error(`Failed to cleanup and retry caching for ${key}:`, cleanupError);
      }
    }
    logger.error(`Error caching ${key}:`, error);
    return false;
  }
};

const getCachedData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error retrieving ${key} from cache:`, error);
    return null;
  }
};

// Function to log cache usage for debugging
const logCacheUsage = () => {
  try {
    const totalSize = getTotalCacheSize();
    logger.debug(`Total cache size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    Object.entries(CACHE_KEYS).forEach(([name, key]) => {
      const size = getCacheSize(key);
      if (size > 0) {
        logger.debug(`${name}: ${(size / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  } catch (error) {
    logger.error('Error logging cache usage:', error);
  }
};

// Function to get cache statistics
const getCacheStats = () => {
  try {
    const stats = {};
    Object.entries(CACHE_KEYS).forEach(([name, key]) => {
      const data = getCachedData(key);
      if (data) {
        if (Array.isArray(data)) {
          stats[name] = { count: data.length, size: getCacheSize(key) };
        } else if (typeof data === 'object') {
          stats[name] = { count: Object.keys(data).length, size: getCacheSize(key) };
        } else {
          stats[name] = { count: 1, size: getCacheSize(key) };
        }
      }
    });
    return stats;
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    return {};
  }
};

// Function to check if cache is healthy
const isCacheHealthy = () => {
  try {
    const stats = getCacheStats();
    const totalSize = getTotalCacheSize();
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    
    return {
      healthy: totalSize < maxSize,
      totalSize,
      maxSize,
      stats
    };
  } catch (error) {
    logger.error('Error checking cache health:', error);
    return { healthy: false, error: error.message };
  }
};

// Function to sort messages by time (latest to oldest)
const sortMessagesByTime = (messages) => {
  if (!Array.isArray(messages)) return messages;

  return messages.sort((a, b) => {
    const timeA = getMessageTimeMs(a);
    const timeB = getMessageTimeMs(b);
    return timeB - timeA; // Most recent first (latest to oldest)
  });
};

// Function to process and order messages from API response
const processMessagesFromAPI = (apiData, timezone) => {
  if (!Array.isArray(apiData)) return [];
  
  const processedMessages = apiData.map(item => {
    return {
      channel: item.channel_id.toString(),
      team: `Channel ${item.channel_id}`,
      // The recording filename is the source of truth for when audio began.
      time: getRecordingTimestampFromFilename(item.filename, item.timestamp),
      timezone,
      status: item.hasOwnProperty("status") ? item.status : "new",
      id: item.id,
      url: `${API_BASE_URL}${item.filename}`,
      message: item.transcription || "No transcription available",
      duration: item.duration,
      isNew: true,
    };
  });
  
  // Sort messages by time (latest to oldest)
  return sortMessagesByTime(processedMessages);
};

const formatUtcTimestampCompact = (ms) => {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const resolveInboxSinceTimestamp = (prefs) => {
  if (!prefs) return null;
  const { timeFilter, startDate, endDate, startTime } = prefs;

  if (!timeFilter || timeFilter === TIME_FILTERS.ALL) return null;

  if (timeFilter === TIME_FILTERS.CUSTOM) {
    if (!startDate || !endDate) return null;
    const [year, month, day] = startDate.split('-').map(Number);
    const [hours = 0, minutes = 0, seconds = 0] = startTime
      ? startTime.split(':').map(Number)
      : [0, 0, 0];
    const startMs = new Date(year, month - 1, day, hours, minutes, seconds).getTime();
    return Number.isFinite(startMs) ? formatUtcTimestampCompact(startMs) : null;
  }

  const cutoff = getPresetCutoffMs(timeFilter);
  if (cutoff == null) return null;
  return formatUtcTimestampCompact(cutoff);
};

const mergeMessagesById = (existingMessages, incomingMessages, maxCap = MAX_MESSAGES_IN_MEMORY) => {
  if (!Array.isArray(existingMessages) || existingMessages.length === 0) {
    return sortMessagesByTime(Array.isArray(incomingMessages) ? [...incomingMessages] : []).slice(
      0,
      maxCap,
    );
  }
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return sortMessagesByTime([...existingMessages]).slice(0, maxCap);
  }

  const byId = new Map();
  existingMessages.forEach((msg) => byId.set(msg.id, msg));
  incomingMessages.forEach((msg) => byId.set(msg.id, msg));

  return sortMessagesByTime(Array.from(byId.values())).slice(0, maxCap);
};

/** Detect in-place inbox updates (status/transcription) when list length and endpoints are unchanged. */
function inboxMessagesFingerprint(msgs) {
  if (!Array.isArray(msgs)) return "";
  return msgs
    .map((m) => `${m.id}\u001f${m.status ?? ""}\u001f${m.message ?? ""}`)
    .join("\u001e");
}

const App = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState({});
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  /** When inbox time preset / custom range changes in localStorage, replace inbox from a fresh apiFetch(not only the periodic newest slice). */
  const inboxPrefsFingerprintRef = useRef(null);
  /** Server keyset cursor for “load older” chunks (updated on full replace + each older fetch; not overwritten by periodic newest-only polls). */
  const inboxKeysetRef = useRef({
    prefsFp: '',
    has_more: false,
    next_before_timestamp: null,
    next_before_id: null,
  });
  const [inboxServerHasMore, setInboxServerHasMore] = useState(false);
  /** Real total rows on the server for the current inbox time window (or null if unknown / not loaded yet). */
  const [inboxServerTotal, setInboxServerTotal] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showServerErrorModal, setShowServerErrorModal] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  
  // Add cache debugging to window object for development (LOW-02: inside useEffect)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.debugCache = {
        getStats: getCacheStats,
        isHealthy: isCacheHealthy,
        clearCache: () => {
          Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
          logger.debug('Cache cleared');
        },
        logUsage: logCacheUsage,
        getLatestMessages: (count = 10) => {
          const messages = getCachedData(CACHE_KEYS.MESSAGES) || [];
          return messages.slice(0, count);
        },
        getMessageCount: () => {
          const messages = getCachedData(CACHE_KEYS.MESSAGES) || [];
          return messages.length;
        },
        sortMessages: sortMessagesByTime
      };
      return () => { delete window.debugCache; };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return JSON.parse(localStorage.getItem("isDarkMode")) || false;
  });
  
  const [timezone, setTimezone] = useState(() => {
    const cachedTimezone = getCachedData(CACHE_KEYS.TIMEZONE);
    return cachedTimezone && validateTimezone(cachedTimezone) ? cachedTimezone : "Etc/UTC";
  });

  const [timeFormat, setTimeFormat] = useState(() => {
    const cachedTimeFormat = getCachedData(CACHE_KEYS.TIME_FORMAT);
    return cachedTimeFormat || "24h"; // Default to 24-hour format
  });

  const [branding, setBranding] = useState({
    organization_name: 'Boondock Edge Server'
  });

  const [reverseSort, setReverseSort] = useState(false);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const setTimezoneWithLogging = (newTz) => {
    logger.debug(`Timezone changed from ${timezone} to ${newTz}`);
    setTimezone(newTz);
  };

  const setTimeFormatWithLogging = (newFormat) => {
    logger.debug(`Time format changed from ${timeFormat} to ${newFormat}`);
    setTimeFormat(newFormat);
    cacheData(CACHE_KEYS.TIME_FORMAT, newFormat);
  };

  // Fetch branding data and update document title
  const fetchBrandingData = async () => {
    try {
      const response = await api.get('/branding');
      const brandingData = response.data;
      setBranding(brandingData);
      
      // Update document title with organization name
      if (brandingData.organization_name) {
        document.title = brandingData.organization_name;
      } else {
        // Fallback to default title
        document.title = 'Boondock Edge Server';
      }
    } catch (error) {
      logger.error('Error fetching branding data:', error);
      // Keep default title if fetch fails
      document.title = 'Boondock Edge Server';
    }
  };

  useEffect(() => {
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
    const root = document.documentElement;
    root.dataset.uiTheme = isDarkMode ? "night-ops" : "ember-command";
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // Update document title when branding changes
  useEffect(() => {
    if (branding.organization_name) {
      document.title = branding.organization_name;
    }
  }, [branding.organization_name]);

  // Memoized processed messages
  const processedMessages = useMemo(() => {
    return messages.map(message => ({
      ...message,
      localTime: new Date(message.time).toLocaleString('en-US', { 
        timeZone: timezone,
        hour12: timeFormat === "12h"
      })
    }));
  }, [messages, timezone, timeFormat]);

  // Check if there's any cached data available
  const hasCachedData = () => {
    const cachedMessages = getCachedData(CACHE_KEYS.MESSAGES);
    const cachedChannels = getCachedData(CACHE_KEYS.CHANNELS);
    // Return true if we have at least messages or channels cached
    return (cachedMessages && cachedMessages.length > 0) || (cachedChannels && Object.keys(cachedChannels).length > 0);
  };

  // Clear all cache
  const clearAllCache = async () => {
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      logger.debug('All cache cleared');
      // Also clear messages and channels from state
      setMessages([]);
      setChannels({});
      setKeywords([]);
      
      // The inbox request doubles as the server connection health check.
      const isServerHealthy = await fetchInboxData(false);
      if (!isServerHealthy) {
        setShowServerErrorModal(true);
      }
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  };

  // Initial load
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setChannels({});
      setKeywords([]);
      return;
    }

    const initialize = async () => {
      setLoading(true);

      try {
        // Always fetch fresh data in background, regardless of cache validity
        // This ensures we have the most up-to-date information
        await fetchAllData(true); // Show loading on initial load only
        // Always fetch branding data to update title
        await fetchBrandingData();
        setShowServerErrorModal(false); // Hide error modal if initialization succeeds
      } catch (error) {
        logger.error("Initialization error:", error);
        setShowServerErrorModal(true);
        setError("Failed to initialize application");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [user]);

  const fetchInboxTotal = useCallback(async () => {
    try {
      const inboxPrefs = readInboxViewWindowPrefs();
      const sinceTimestamp = resolveInboxSinceTimestamp(inboxPrefs);
      const res = await api.get(API_ENDPOINTS.MESSAGES_INBOX_COUNT, {
        params: { ...(sinceTimestamp ? { since_timestamp: sinceTimestamp } : {}) },
      });
      const total = Number(res.data?.total);
      setInboxServerTotal(Number.isFinite(total) ? total : null);
    } catch (err) {
      logger.warn('Inbox total fetch failed:', err);
    }
  }, []);

  const fetchOlderInboxChunk = useCallback(async () => {
    const k = inboxKeysetRef.current;
    if (!k.has_more || k.next_before_timestamp == null) {
      setInboxServerHasMore(false);
      return false;
    }

    const inboxPrefs = readInboxViewWindowPrefs();
    const prefsFp = inboxViewPrefsFingerprint(inboxPrefs);
    if (prefsFp !== k.prefsFp) return false;

    const sinceTimestamp = resolveInboxSinceTimestamp(inboxPrefs);
    const plan = getInboxLoadPlan(inboxPrefs);
    const maxCap = plan.maxMessagesInMemory;

    try {
      const params = {
        limit: Math.min(INBOX_LOAD_MORE_CHUNK, BACKEND_INBOX_MAX_LIMIT),
        before_timestamp: k.next_before_timestamp,
        ...(k.next_before_id != null ? { before_id: k.next_before_id } : {}),
        ...(sinceTimestamp ? { since_timestamp: sinceTimestamp } : {}),
      };
      const res = await api.get(API_ENDPOINTS.MESSAGES_INBOX_RANGE, { params });
      const { rows, meta } = parseInboxPayload(res.data);
      if (!Array.isArray(rows) || rows.length === 0) {
        inboxKeysetRef.current = { ...k, has_more: false };
        setInboxServerHasMore(false);
        return false;
      }

      const processed = processMessagesFromAPI(rows, timezone);
      setMessages((prev) => mergeMessagesById(prev, processed, maxCap));

      const next = {
        prefsFp,
        has_more: meta.has_more === true,
        next_before_timestamp: meta.next_before_timestamp ?? null,
        next_before_id: meta.next_before_id ?? null,
      };
      inboxKeysetRef.current = next;
      setInboxServerHasMore(next.has_more);
      return true;
    } catch (error) {
      logger.error('Older inbox fetch failed:', error);
      return false;
    }
  }, [timezone]);

  // Data fetching. Channels and settings are static unless explicitly refreshed;
  // the five-second update only needs the inbox.
  const fetchAllData = async (showLoading = false, includeStaticData = true) => {
    try {
      const inboxPrefs = readInboxViewWindowPrefs();
      const prefsFp = inboxViewPrefsFingerprint(inboxPrefs);
      const prefsJustChanged = prefsFp !== inboxPrefsFingerprintRef.current;
      const replaceInboxMessages = showLoading || prefsJustChanged;

      if (showLoading) {
        setLoading(true);
      }

      const sinceTimestamp = (!replaceInboxMessages && messagesRef.current[0]?.time)
        || resolveInboxSinceTimestamp(inboxPrefs);
      const plan = getInboxLoadPlan(inboxPrefs);
      const maxCap = plan.maxMessagesInMemory;

      const [channelsRes, keywordsRes] = includeStaticData
        ? await Promise.all([
            api.get(API_ENDPOINTS.CHANNELS),
            api.get(API_ENDPOINTS.SETTINGS),
          ])
        : [null, null];

      if (channelsRes) logger.debug('Channels response type:', typeof channelsRes.data, 'Is array:', Array.isArray(channelsRes.data));
      if (keywordsRes) logger.debug('Keywords response type:', typeof keywordsRes.data);

      // Validate that data is in expected format
      if (channelsRes && !Array.isArray(channelsRes.data)) {
        logger.warn('Channels data is not an array:', channelsRes.data);
        // If it's an object with a channels property, use that
        if (typeof channelsRes.data === 'object' && channelsRes.data.channels && Array.isArray(channelsRes.data.channels)) {
          channelsRes.data = channelsRes.data.channels;
        } else {
          throw new Error(`Invalid channels data format - expected array, got ${typeof channelsRes.data}`);
        }
      }

      const inboxLimit = replaceInboxMessages
        ? sinceTimestamp
          ? plan.replaceFetchLimit
          : INITIAL_INBOX_FETCH_LIMIT
        : plan.periodicLimit;

      const messagesRes = await api.get(API_ENDPOINTS.MESSAGES_INBOX, {
        params: {
          limit: inboxLimit,
          ...(sinceTimestamp ? { since_timestamp: sinceTimestamp } : {}),
        },
      });
      const parsed = parseInboxPayload(messagesRes.data);
      const inboxRows = parsed.rows;
      const inboxMeta = parsed.meta || {};

      if (replaceInboxMessages) {
        inboxKeysetRef.current = {
          prefsFp,
          has_more: inboxMeta.has_more === true,
          next_before_timestamp: inboxMeta.next_before_timestamp ?? null,
          next_before_id: inboxMeta.next_before_id ?? null,
        };
        setInboxServerHasMore(inboxMeta.has_more === true);
        // Refresh true total for the new window so footer shows real "of N" instead of loaded-so-far.
        void fetchInboxTotal();
      }

      logger.debug(
        'Inbox fetch rows:',
        Array.isArray(inboxRows) ? inboxRows.length : 0,
        'limit:',
        inboxLimit,
        'replace:',
        replaceInboxMessages,
      );

      if (!Array.isArray(inboxRows)) {
        throw new Error(`Invalid inbox recordings format - expected recordings array`);
      }

      if (keywordsRes && (!keywordsRes.data || typeof keywordsRes.data !== 'object')) {
        logger.warn('Settings data format invalid:', keywordsRes.data);
        throw new Error('Invalid settings data format - expected object');
      }

      // Process channels
      const channelsData = channelsRes?.data.reduce((acc, channel) => {
        if (channel.status !== 'disabled') {
          acc[channel.id] = {
            name: channel.name,
            status: channel.status,
            id: channel.id,
            driver: channel.driver,
            person: channel.person,
            car: channel.car,
            color: channel.color,
            background_color: channel.background_color,
            team_color: channel.team_color,
            silence: channel.silence,
            mac: channel.mac,
            threshold: channel.threshold,
            min_rec: channel.min_rec,
            max_rec: channel.max_rec,
            audio_gain: channel.audio_gain,
            tag: channel.tag,
            isActive: true,
          };
        }
        return acc;
      }, {});

      // Process new inbox window rows and merge into current in-memory list.
      const fetchedWindow = processMessagesFromAPI(inboxRows, timezone);

      // Only update state if data has actually changed to prevent unnecessary re-renders
      if (channelsData) setChannels(prevChannels => {
        const prevKeys = Object.keys(prevChannels).sort().join(',');
        const newKeys = Object.keys(channelsData).sort().join(',');
        if (prevKeys !== newKeys) return channelsData;
        // Deep compare channel objects
        for (const key in channelsData) {
          if (JSON.stringify(prevChannels[key]) !== JSON.stringify(channelsData[key])) {
            return channelsData;
          }
        }
        return prevChannels; // No changes, return previous to prevent re-render
      });

      setMessages((prevMessages) => {
        const nextMessages = replaceInboxMessages
          ? fetchedWindow.slice(0, maxCap)
          : mergeMessagesById(prevMessages, fetchedWindow, maxCap);

        if (prevMessages.length !== nextMessages.length) return nextMessages;
        if (inboxMessagesFingerprint(prevMessages) !== inboxMessagesFingerprint(nextMessages)) {
          return nextMessages;
        }
        return prevMessages;
      });

      if (keywordsRes) setKeywords(prevKeywords => {
        const prevStr = JSON.stringify(prevKeywords);
        const newStr = JSON.stringify(keywordsRes.data.keywords);
        if (prevStr !== newStr) return keywordsRes.data.keywords;
        return prevKeywords; // No changes, return previous to prevent re-render
      });

      // Handle timezone
      const newTimezone = keywordsRes?.data.global_timezone || timezone || "Etc/UTC";
        if (validateTimezone(newTimezone)) {
        setTimezoneWithLogging(newTimezone);
        cacheData(CACHE_KEYS.TIMEZONE, newTimezone);
      } else {
        logger.warn(`Invalid timezone received: ${newTimezone}, falling back to UTC`);
        setTimezoneWithLogging("Etc/UTC");
        cacheData(CACHE_KEYS.TIMEZONE, "Etc/UTC");
      }

      // Cache only messages inside the user's inbox view window (default: last 7 days)
      const messagesForCache = filterMessagesToInboxViewWindow(
        replaceInboxMessages ? fetchedWindow : mergeMessagesById(messagesRef.current, fetchedWindow, maxCap),
        inboxPrefs,
      );

      // Update cache with fresh data
      const cacheResults = {
        channels: channelsData ? cacheData(CACHE_KEYS.CHANNELS, channelsData) : true,
        messages: cacheData(CACHE_KEYS.MESSAGES, messagesForCache),
        keywords: keywordsRes ? cacheData(CACHE_KEYS.KEYWORDS, keywordsRes.data.keywords) : true,
        timestamp: cacheData(CACHE_KEYS.LAST_FETCH, Date.now())
      };
      
      // Log cache update results
      logger.debug('Cache update results:', {
        channels: cacheResults.channels ? 'success' : 'failed',
        messages: cacheResults.messages ? 'success' : 'failed',
        keywords: cacheResults.keywords ? 'success' : 'failed',
        timestamp: cacheResults.timestamp ? 'success' : 'failed',
        messageCount: messagesForCache.length,
        messageCountFetched: fetchedWindow.length
      });
      
      // Log cache usage for debugging
      logCacheUsage();

      inboxPrefsFingerprintRef.current = prefsFp;

      setError(null);
    } catch (error) {
      logger.error("Data fetching error:", error);
      setError("Failed to fetch data");
      throw error;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchAllDataRef = useRef(fetchAllData);
  fetchAllDataRef.current = fetchAllData;

  const fetchInboxData = async (showLoading = false) => {
    try {
      await fetchAllData(showLoading, false);
      setShowServerErrorModal(false);
      return true;
    } catch (error) {
      if (!hasCachedData()) setShowServerErrorModal(true);
      return false;
    }
  };

  useEffect(() => {
    const onViewChanged = () => {
      // View change forces a replace fetch + count refresh.
      inboxPrefsFingerprintRef.current = null;
      setInboxServerTotal(null);
      void fetchAllDataRef.current(false, false);
    };
    // TO-DO Look at how often is INBOX_VIEW_CHANGED_EVENT
    window.addEventListener(INBOX_VIEW_CHANGED_EVENT, onViewChanged);
    return () => window.removeEventListener(INBOX_VIEW_CHANGED_EVENT, onViewChanged);
  }, []);

  // Inbox success/failure is the server health signal used by the periodic update below.

  // Track if filters are active (to pause auto-updates)
  const [areFiltersActive, setAreFiltersActive] = useState(false);

  // Periodic updates
  useEffect(() => {

    const updateInterval = setInterval(async () => {
      // Skip update if audio is currently playing to prevent screen flicker
      const audioIsPlaying = localStorage.getItem('audioIsPlaying') === 'true';
      if (audioIsPlaying) {
        return; // Skip this update cycle
      }

      // Skip periodic refresh when filters are active — unless something may still be transcribing
      if (areFiltersActive) {
        const pending = messagesRef.current.some(
          (m) => m.status === "processing" || m.status === "queued"
        );
        if (!pending) {
          return;
        }
      }

      try {
        // Check cache health before fetching new data
        const cacheHealth = isCacheHealthy();
        if (!cacheHealth.healthy) {
          logger.warn('Cache health check failed:', cacheHealth);
          // Clear cache if it's too large
          if (cacheHealth.totalSize > cacheHealth.maxSize) {
            logger.debug('Clearing cache due to size limit');
            Object.values(CACHE_KEYS).forEach(key => {
              localStorage.removeItem(key);
            });
          }
        }
        
        // Clear old cache before fetching new data
        clearOldCache();
        await fetchAllData(false, false); // Inbox response is also the health check.
        setShowServerErrorModal(false); // Hide error modal if fetch succeeds
      } catch (error) {
        logger.error("Update error:", error);
        if (!hasCachedData()) setShowServerErrorModal(true);
      }
    }, 5000);

    return () => clearInterval(updateInterval);
  }, [areFiltersActive]);

  if (loading && !Object.keys(channels).length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {showServerErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className={`w-full max-w-md mx-4 rounded-xl shadow-2xl border overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {/* Header with icon */}
            <div className={`px-6 py-4 border-b transition-colors duration-300 ${
              isDarkMode ? 'bg-red-900/30 border-red-800/50' : 'bg-red-50 border-red-100'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isDarkMode ? 'bg-red-900/50' : 'bg-red-100'
                  }`}>
                    <svg className={`w-6 h-6 transition-colors duration-300 ${
                      isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h2 className={`text-xl font-bold transition-colors duration-300 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Server Connection Error
                  </h2>
                  <p className={`text-sm mt-0.5 transition-colors duration-300 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Unable to reach the server
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <div className="mb-6">
                <p className={`text-sm leading-relaxed transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Please check your server connection or connect to admin. The server may be temporarily unavailable or experiencing issues.
                </p>
              </div>

              {/* Cache info */}
              <div className={`mb-6 p-3 rounded-lg border transition-colors duration-300 ${
                isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className={`w-4 h-4 transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <span className={`text-xs font-medium transition-colors duration-300 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>Cache Status</span>
                  </div>
                  <span className={`text-xs transition-colors duration-300 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {getCachedData(CACHE_KEYS.MESSAGES)?.length || 0} messages cached
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const isHealthy = await fetchInboxData(false);
                    if (isHealthy) {
                      setShowServerErrorModal(false);
                    }
                  }}
                  className="w-full px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Retry Connection</span>
                </button>
                
                <button
                  onClick={async () => {
                    await clearAllCache();
                    setCacheCleared(true);
                    setTimeout(() => {
                      setCacheCleared(false);
                    }, 2000);
                  }}
                  className={`w-full px-4 py-3 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-2 ${
                    cacheCleared 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                      : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
                  }`}
                >
                  {cacheCleared ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Cache Cleared!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear Cache</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ErrorBoundary>
        <Router>
          <Routes>
            <Route path="/login" element={
              <LoginPage
                toggleTheme={toggleTheme}
                isDarkMode={isDarkMode}
                setIsDarkMode={setIsDarkMode}
              />
            } />
            <Route element={<PrivateRoute />}>
              <Route path="/" element={
                  <LiveCommunications
                    timezone={timezone}
                    timeFormat={timeFormat}
                    isDarkMode={isDarkMode}
                    setMessages={setMessages}
                    setIsDarkMode={setIsDarkMode}
                    toggleTheme={toggleTheme}
                    channels={channels}
                    messages={processedMessages}
                    keywords={keywords}
                    reverseSort={reverseSort}
                    setReverseSort={setReverseSort}
                    onFiltersActiveChange={setAreFiltersActive}
                    inboxServerHasMore={inboxServerHasMore}
                    inboxServerTotal={inboxServerTotal}
                    onFetchOlderInbox={fetchOlderInboxChunk}
                  />
              } />
              <Route path="/settings" element={
                  <SettingsPage
                    isDarkMode={isDarkMode}
                    timezone={timezone}
                    timeFormat={timeFormat}
                    setTimeFormat={setTimeFormatWithLogging}
                    reverseSort={reverseSort}
                    setReverseSort={setReverseSort}
                    onSettingsChange={() => fetchAllData()}
                  />
              } />
              <Route path="/users" element={
                  <UserManagement isDarkMode={isDarkMode} />
              } />
              <Route path="/profile" element={
                  <UserProfile
                    isDarkMode={isDarkMode}
                  />
              } />

              <Route path="/advanced-player" element={
                  <AdvancedAudioPlayer isDarkMode={isDarkMode} timeFormat={timeFormat} />
              } />
              <Route path="/logs" element={
                  <LogsPage timezone={timezone} timeFormat={timeFormat} />
              } />
              <Route path="/report" element={
                  <ReportPage isDarkMode={isDarkMode} timeFormat={timeFormat} />
              } />
              <Route path="/user-guide" element={
                  <UserGuidePage isDarkMode={isDarkMode} />
              } />
              <Route path="/release" element={
                  <ReleasePage isDarkMode={isDarkMode} />
              } />
              <Route path="/version" element={
                  <VersionPage isDarkMode={isDarkMode} />
              } />
              <Route path="/license" element={
                  <LicenseSubscriptionPage isDarkMode={isDarkMode} />
              } />
            </Route>
          </Routes>
        </Router>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          limit={3}
          enableMultiContainer={false}
        />
      </ErrorBoundary>
    </>
  );
};
export default App;
