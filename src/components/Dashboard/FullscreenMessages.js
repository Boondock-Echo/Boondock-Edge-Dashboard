import { api, apiFetch } from '../../utils/apiClient';
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { ArrowUp, MessageSquare } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import logger from "../../utils/logger";
import IncidentReportModal from "./IncidentReportModal";
import { useAuth } from "../AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import JSZip from "jszip";
import { saveAs } from "file-saver";

/** Longer transcripts collapse to one line until the user clicks More. */
const MESSAGE_BODY_PREVIEW_CHAR_THRESHOLD = 110;

const FullscreenMessages = ({
  messages: messagesProp,
  totalMessages = 0,
  channels,
  showTime,
  showCar,
  showChannel,
  showPerson,
  formatTime,
  formatFeedRowSublineDate,
  timezone,
  timeFormat = "24h",
  highlightText,
  searchQuery,
  setActiveAudioUrl,
  isFullscreen,
  onToggleFullscreen,
  isDarkMode,
  setMessages: setMessagesProp,
  isMobile,
  isMultiSelectMode,
  setIsMultiSelectMode,
  setSelectedMessages,
  selectedMessages,
  toggleMultiSelectMode,
  reverseSort,
  currentPage,
  onLoadMore,
  hasMoreMessages,
  isLoadingMore,
  inboxViewMode = 'continuous', // 'pagination' or 'continuous'
  isVolumeOn,
  setIsVolumeOn,
}) => {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const messages = messagesProp;
  
  const setMessages = useCallback(
    (newMessages) => setMessagesProp(newMessages),
    [setMessagesProp]
  );

  const { logout, user } = useAuth();
  const { hasPermission } = usePermissions();

  // Permission checks
  const canPlayAudio = user?.role === 'admin' || hasPermission('play_audio');
  const canDeleteAudio = user?.role === 'admin' || hasPermission('delete_audio');
  const canAccessAdvancedPlayer = user?.role === 'admin' || hasPermission('access_advanced_player');
  const canCreateReports = user?.role === 'admin' || hasPermission('create_reports');

  /** Message row toolbar: aligned hit targets + readable Material Symbols */
  const msgActionBtnBase =
    "inline-flex shrink-0 items-center justify-center rounded-lg transition active:scale-[0.97]";
  const msgActionIcon =
    "material-symbols-outlined pointer-events-none select-none leading-none [font-variation-settings:'FILL'0,'wght'500,'GRAD'0,'opsz'24]";
  const msgActionDim = isMobile ? "h-8 w-8" : "h-9 w-9";
  const msgActionFont = isMobile ? "text-[18px]" : "text-[20px]";

  // State declarations - moved before useEffect that depends on them
  const [playingAudio, setPlayingAudio] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null); // Track which message has expanded player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());
  const [iconToggle, setIconToggle] = useState(false);
  const [hallucinations, setHallucinations] = useState([]);
  const [waveformData, setWaveformData] = useState(null); // Store waveform data for current audio
  const audioContextRef = useRef(null);
  const waveformAnimationRef = useRef(null);
  // UI state
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);
  const [previousFirstMessageId, setPreviousFirstMessageId] = useState(null);
  const [previousLastMessageId, setPreviousLastMessageId] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [hiddenMessages, setHiddenMessages] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [tagsByMessage, setTagsByMessage] = useState({});
  const [checkedMessageIds, setCheckedMessageIds] = useState(new Set());
  const [refreshingTags, setRefreshingTags] = useState(new Set());
  const [fetchedPages, setFetchedPages] = useState(new Set());
  const [selectedTag, setSelectedTag] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [isHallucinationEnabled, setIsHallucinationEnabled] = useState(true); // Default to true
  const [expandedMobileActions, setExpandedMobileActions] = useState(null); // Track which message has expanded actions on mobile
  /** Expanded full transcript body (per message id) */
  const [expandedMessageIds, setExpandedMessageIds] = useState(() => new Set());
  const [showScrollToTop, setShowScrollToTop] = useState(false); // Show floating scroll button on mobile
  const [newMessageCount, setNewMessageCount] = useState(0); // Count of new messages received
  const [lastSeenMessageId, setLastSeenMessageId] = useState(null); // Track last seen message for new count

  // Scroll to newest messages function (handles both sort orientations)
  const toggleMessageBodyExpanded = useCallback((messageId) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const scrollToTop = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      if (reverseSort) {
        // Reverse sort: newest messages are at the top, scroll to top
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Normal sort: newest messages are at the bottom, scroll to bottom
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
      setNewMessageCount(0);
      if (messages.length > 0) {
        // Set last seen to the newest message (first in array for reverse sort, last for normal sort)
        const newestMessageId = reverseSort ? messages[0]?.id : messages[messages.length - 1]?.id;
        setLastSeenMessageId(newestMessageId);
      }
    }
  }, [messages, reverseSort]);

  // Reset checked message IDs and page cache when messages change significantly (pagination, filtering, etc.)
  useEffect(() => {
    const currentMessageIds = new Set(messages.map(m => m.id));
    const checkedIds = Array.from(checkedMessageIds);
    
    // If any checked IDs are no longer in current messages, reset the checked set and page cache
    const hasStaleIds = checkedIds.some(id => !currentMessageIds.has(id));
    
    if (hasStaleIds) {
      setCheckedMessageIds(new Set());
      setFetchedPages(new Set()); // Clear page cache when messages change significantly
      // Also clear tags for messages that are no longer present
      setTagsByMessage(prev => {
        const newTags = {};
        Object.keys(prev).forEach(id => {
          if (currentMessageIds.has(parseInt(id))) {
            newTags[id] = prev[id];
          }
        });
        return newTags;
      });
    }
  }, [messages, checkedMessageIds]);

  // Fetch user role from API
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      try {
        const response = await api.get(`/users/${user.username}`);
        setUserRole(response.data[user.username]?.role || 'member');
      } catch (error) {
        logger.error('Error fetching user role:', error);
        setUserRole('member');
      }
    };
    fetchUserRole();
  }, [user]);

  // Available tags and fetched tags

  // Toast wrapper
  const TOAST_CONFIG = {
    position: isMobile ? "bottom-center" : "top-right",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: true,
    theme: isDarkMode ? "dark" : "light",
    style: {
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgb(var(--ui-text-rgb) / 0.1)",
      minWidth: "300px",
    },
    progressStyle: {
      background: "var(--ui-muted)",
    },
  };
  const showToast = useCallback(
    (message, type = "info", customOptions = {}) =>
      toast(
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium">{message}</span>
          {customOptions.undo && (
            <button
              onClick={customOptions.undo.action}
              className="ml-4 px-2 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Undo
            </button>
          )}
        </div>,
        { ...TOAST_CONFIG, type, ...customOptions }
      ),
    [isDarkMode, isMobile]
  );

  // Function to replace hallucination words with "....." in the text
  const replaceHallucinationWords = (text, hallucinations) => {
    // Safety check: ensure hallucinations is an array
    if (!Array.isArray(hallucinations) || hallucinations.length === 0) {
      return text;
    }

    let filteredText = text;

    hallucinations.forEach(({ text: pattern, type }) => {
      try {
        let regexPattern;
        const typeArr = Array.isArray(type) ? type : (typeof type === 'string' ? [type] : []);

        if (typeArr.includes('regex')) {
          // Check if pattern contains regex special characters
          const hasRegexSpecialChars = /[.+*?^${}()|[\]\\]/.test(pattern);
          
          if (hasRegexSpecialChars) {
            // User provided a regex pattern, use it as-is
            regexPattern = pattern;
          } else {
            // Plain word - escape it and match anywhere (not just whole words)
            // This allows matching "This" in "This is a test" or "somethingThis"
            const escapedPattern = pattern.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
            regexPattern = escapedPattern;
          }
        } else if (typeArr.includes('wildcard')) {
          // Convert wildcard to regex
          const hasWildcardChars = pattern.includes('*') || pattern.includes('?');
          let escapedPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*') // Convert * to .*
            .replace(/\?/g, '.'); // Convert ? to .
          
          if (hasWildcardChars) {
            regexPattern = escapedPattern;
          } else {
            // Plain word with wildcard type - match anywhere
            regexPattern = escapedPattern;
          }
        } else {
          // Unknown type, skip
          return;
        }
        
        const regex = new RegExp(regexPattern, 'gi'); // Global, case-insensitive
        filteredText = filteredText.replace(regex, '.....');
      } catch (err) {
        logger.error(`Error processing hallucination pattern "${pattern}":`, err);
      }
    });

    return filteredText;
  };

  const checkPatternMatches = (text, hallucinations) => {
  const matches = { regex: false, wildcard: false };

  // Safety check: ensure hallucinations is an array
  if (!Array.isArray(hallucinations) || hallucinations.length === 0) {
    return matches;
  }

  hallucinations.forEach(({ text: pattern, type }) => {
    const typeArr = Array.isArray(type) ? type : (typeof type === 'string' ? [type] : []);
    if (typeArr.includes('regex')) {
      try {
        // Check if pattern contains regex special characters
        // If it's a plain word, escape it and search anywhere in text
        // If it contains regex chars, use it as-is (user knows what they're doing)
        const hasRegexSpecialChars = /[.+*?^${}()|[\]\\]/.test(pattern);
        let regexPattern;
        
        if (hasRegexSpecialChars) {
          // User provided a regex pattern, use it as-is
          regexPattern = pattern;
        } else {
          // Plain word - escape it and search anywhere in text
          const escapedPattern = pattern.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
          regexPattern = escapedPattern;
        }
        
        const regex = new RegExp(regexPattern, 'i'); // Case-insensitive regex
        if (regex.test(text)) {
          matches.regex = true;
        }
      } catch (err) {
        logger.error(`Invalid regex pattern: ${pattern}`, err);
      }
    }
    if (typeArr.includes('wildcard')) {
      // Convert wildcard to regex (e.g., *test* -> .*test.*)
      // If pattern doesn't contain * or ?, treat it as a word that can appear anywhere
      const hasWildcardChars = pattern.includes('*') || pattern.includes('?');
      let escapedPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*/g, '.*') // Convert * to .*
        .replace(/\?/g, '.'); // Convert ? to .
      
      try {
        // If no wildcard chars, check if pattern appears anywhere in text
        // Otherwise, check if entire text matches the pattern
        const wildcardRegex = hasWildcardChars 
          ? new RegExp(`^${escapedPattern}$`, 'i') // Case-insensitive, full match
          : new RegExp(escapedPattern, 'i'); // Case-insensitive, anywhere in text
        if (wildcardRegex.test(text)) {
          matches.wildcard = true;
        }
      } catch (err) {
        logger.error(`Invalid wildcard pattern: ${pattern}`, err);
      }
    }
  });

  return matches;
};

  const handlePlayAudio = async (url, messageId) => {
    // If this is the currently loaded audio
    if (playingAudio === url) {
      if (isPlaying) {
        // Pause the audio
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        // Resume playing
        try {
          if (audioRef.current) {
            await audioRef.current.play();
            setIsPlaying(true);
          }
        } catch (error) {
          logger.error('Error playing audio:', error);
          setIsPlaying(false);
        }
      }
    } else {
      // Switch to a different audio file
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current.src = url;
      audioRef.current.load(); // Load the audio first
      try {
        await audioRef.current.play();
        setPlayingAudio(url);
        setIsPlaying(true);
        setExpandedPlayer(messageId); // Expand the player for this message
      } catch (error) {
        logger.error('Error playing audio:', error);
        logger.error('Error audio:', audioRef.current.src);
        setIsPlaying(false);
      }
    }
  };

  const togglePlayerExpand = (messageId, url) => {
    if (expandedPlayer === messageId) {
      // Collapse player and stop audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setExpandedPlayer(null);
      setPlayingAudio(null);
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      // Expand player for this message and auto-play
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current.src = url;
      audioRef.current.load();
      setPlayingAudio(url);
      setExpandedPlayer(messageId);
      setCurrentTime(0);
      // Auto-play the audio when player expands
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        logger.error('Error auto-playing audio:', error);
        logger.error('Error audio:', audioRef.current.src);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const skipTime = (seconds) => {
    const newTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Parse timestamp from YYYYMMDD_HHMMSS format
  const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    
    // Handle YYYYMMDD_HHMMSS format
    if (/^\d{8}_\d{6}$/.test(timestamp)) {
      const year = parseInt(timestamp.substring(0, 4));
      const month = parseInt(timestamp.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(timestamp.substring(6, 8));
      const hours = parseInt(timestamp.substring(9, 11));
      const minutes = parseInt(timestamp.substring(11, 13));
      const seconds = parseInt(timestamp.substring(13, 15));
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }
    
    // Try to parse as ISO string or other formats
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  };

  // Format timestamp with milliseconds: HH:MM:SS:Millis (respects 12h/24h format)
  const formatTimestampWithMillis = (timestamp, playbackOffset = 0) => {
    if (!timestamp) return timeFormat === '12h' ? '00:00:00:000 AM' : '00:00:00:000';
    
    try {
      const startDate = parseTimestamp(timestamp);
      if (!startDate) return timeFormat === '12h' ? '00:00:00:000 AM' : '00:00:00:000';
      
      // Add playback offset in milliseconds
      const actualTime = new Date(startDate.getTime() + playbackOffset * 1000);
      
      // Get time components in local browser timezone
      const hours24 = actualTime.getHours();
      const minutes = String(actualTime.getMinutes()).padStart(2, '0');
      const seconds = String(actualTime.getSeconds()).padStart(2, '0');
      const milliseconds = String(actualTime.getMilliseconds()).padStart(3, '0');
      
      if (timeFormat === '12h') {
        // 12-hour format: HH:MM:SS:Millis AM/PM
        const hour12 = hours24 % 12 || 12;
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        return `${String(hour12).padStart(2, '0')}:${minutes}:${seconds}:${milliseconds} ${ampm}`;
      } else {
        // 24-hour format: HH:MM:SS:Millis
        const hours = String(hours24).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}:${milliseconds}`;
      }
    } catch (error) {
      logger.error('Error formatting timestamp:', error);
      return timeFormat === '12h' ? '00:00:00:000 AM' : '00:00:00:000';
    }
  };

  // Generate waveform data from audio
  const generateWaveform = useCallback(async (audioUrl) => {
    try {
      if (!audioUrl) {
        setWaveformData(null);
        return;
      }

      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const response = await apiFetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Get channel data (use first channel)
      const channelData = audioBuffer.getChannelData(0);
      const samples = 200; // Number of waveform bars
      const blockSize = Math.floor(channelData.length / samples);
      const waveform = [];

      // Sample the audio data
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        const end = Math.min(start + blockSize, channelData.length);
        
        for (let j = start; j < end; j++) {
          sum += Math.abs(channelData[j]);
        }
        
        const average = sum / (end - start);
        waveform.push(average);
      }

      // Normalize waveform data
      const max = Math.max(...waveform);
      const normalizedWaveform = waveform.map(value => max > 0 ? value / max : 0);
      
      setWaveformData(normalizedWaveform);
    } catch (error) {
      logger.error('Error generating waveform:', error);
      setWaveformData(null);
    }
  }, []);

  // Generate waveform when audio URL changes
  useEffect(() => {
    if (playingAudio) {
      generateWaveform(playingAudio);
    } else {
      setWaveformData(null);
    }
    return () => {
      // HIGH-29: close AudioContext when waveform is torn down to release system resources
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [playingAudio, generateWaveform]);

  // Cancel any outstanding rAF animation loop on unmount (HIGH-28)
  useEffect(() => {
    return () => {
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
        waveformAnimationRef.current = null;
      }
    };
  }, []);

  // Handle audio ended and time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Clear audio playing flag when audio ends
      localStorage.removeItem('audioIsPlaying');
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      localStorage.setItem('audioIsPlaying', 'true');
    };

    const handlePause = () => {
      setIsPlaying(false);
      localStorage.removeItem('audioIsPlaying');
    };

    const handleError = (e) => {
      logger.error('Audio error:', e);
      setIsPlaying(false);
      localStorage.removeItem('audioIsPlaying');
    };

    // Add event listeners
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      // Remove event listeners
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      // Clear audio playing flag on cleanup
      localStorage.removeItem('audioIsPlaying');
    };
  }, []);

  // Track audio playing state in localStorage to pause screen refreshes
  useEffect(() => {
    if (isPlaying) {
      localStorage.setItem('audioIsPlaying', 'true');
    } else {
      localStorage.removeItem('audioIsPlaying');
    }
  }, [isPlaying]);

  // Icon animation effect
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setIconToggle(prev => !prev);
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Infinite scroll for all devices
  useEffect(() => {
    if (!onLoadMore) return;
    
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when user scrolls near the bottom (within 200px)
      const nearBottom = scrollHeight - scrollTop - clientHeight < 200;
      
      if (nearBottom && hasMoreMessages && !isLoadingMore) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, hasMoreMessages, isLoadingMore]);

  // Auto-scroll logic and scroll-to-newest button visibility
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      if (reverseSort) {
        // For reverse sorting, we check if we're at the top (newest messages)
        setIsAtBottom(scrollTop < 10);
        // Show button when scrolled down from top
        setShowScrollToTop(scrollTop > 200);
        // Reset new message count when at top (newest messages)
        if (scrollTop < 50) {
          setNewMessageCount(0);
          if (messages.length > 0) {
            setLastSeenMessageId(messages[0]?.id);
          }
        }
      } else {
        // For normal sorting, we check if we're at the bottom (newest messages)
        setIsAtBottom(distanceFromBottom < 10);
        // Show button when scrolled up from bottom
        setShowScrollToTop(distanceFromBottom > 200);
        // Reset new message count when at bottom (newest messages)
        if (distanceFromBottom < 50) {
          setNewMessageCount(0);
          if (messages.length > 0) {
            setLastSeenMessageId(messages[messages.length - 1]?.id);
          }
        }
      }
    };
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [reverseSort, messages]);

  // Track new messages on mobile
  useEffect(() => {
    if (!isMobile || !messages.length) return;
    
    // Initialize last seen message ID
    if (!lastSeenMessageId && messages.length > 0) {
      setLastSeenMessageId(messages[0]?.id);
      return;
    }
    
    // Count new messages since last seen
    if (lastSeenMessageId && showScrollToTop) {
      const lastSeenIndex = messages.findIndex(m => m.id === lastSeenMessageId);
      if (lastSeenIndex > 0) {
        setNewMessageCount(lastSeenIndex);
      }
    }
  }, [messages, isMobile, lastSeenMessageId, showScrollToTop]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isInitialLoad && messages.length > 0) {
      // On initial load, scroll to appropriate position based on sort order
      if (reverseSort) {
        // Scroll to top (newest messages)
        container.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Scroll to bottom (newest messages)
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
      setIsInitialLoad(false);
      setPreviousMessageCount(messages.length);
      setPreviousFirstMessageId(messages[0]?.id || null);
      setPreviousLastMessageId(messages[messages.length - 1]?.id || null);
    } else if (messages.length > 0) {
      // Check if new messages were actually added (not just filtered/reordered)
      const hasNewMessages = messages.length > previousMessageCount;
      const firstMessageChanged = reverseSort && messages[0]?.id !== previousFirstMessageId;
      const lastMessageChanged = !reverseSort && messages[messages.length - 1]?.id !== previousLastMessageId;
      
      // Only auto-scroll if:
      // 1. User is at the newest messages position (isAtBottom)
      // 2. New messages were actually added (not just a filter change)
      if (isAtBottom && (hasNewMessages || firstMessageChanged || lastMessageChanged)) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          if (reverseSort) {
            // For reverse sort: new messages appear at top, maintain scroll at top
            container.scrollTo({ top: 0, behavior: "auto" });
          } else {
            // For normal sort: new messages appear at bottom, maintain scroll at bottom
            container.scrollTo({ top: container.scrollHeight, behavior: "auto" });
          }
        });
      }
      
      // Update tracking state
      setPreviousMessageCount(messages.length);
      setPreviousFirstMessageId(messages[0]?.id || null);
      setPreviousLastMessageId(messages[messages.length - 1]?.id || null);
    }
  }, [messages, isAtBottom, reverseSort, isInitialLoad, previousMessageCount, previousFirstMessageId, previousLastMessageId]);

  // Reset isInitialLoad when currentPage changes to trigger auto-scroll for new page
  useEffect(() => {
    setIsInitialLoad(true);
  }, [currentPage]);

  // Fetch all available tags
  useEffect(() => {
    (async () => {
      try {
        const resp = await api.get(`/tags`);
        setAllTags(resp.data.map((t) => t.name));
      } catch (err) {
        logger.error("Failed to load tags:", err);
        showToast("Failed to load available tags", "error");
      }
    })();
  }, [showToast]);

  // Fetch global settings to check if hallucination filtering is enabled
  useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const response = await api.get(`/settings`);
        const hallucinationSetting = response.data?.global_hallucination || "True";
        setIsHallucinationEnabled(hallucinationSetting === "True");
      } catch (err) {
        logger.error('Error fetching global settings:', err);
        // Default to enabled if fetch fails
        setIsHallucinationEnabled(true);
      }
    };
    fetchGlobalSettings();
  }, []);

   useEffect(() => {
      const fetchHallucinations = async () => {
        // Only fetch hallucinations if the feature is enabled
        if (!isHallucinationEnabled) {
          setHallucinations([]);
          return;
        }

        try {
          const response = await apiFetch(`/hallucinations`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch hallucinations: ${response.status} ${response.statusText}`);
          }
          
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            const text = await response.text();
            logger.error('Non-JSON response (first 200 chars):', text.substring(0, 200));
            throw new Error('Server returned non-JSON response. Check if endpoint is correct.');
          }
          
          const data = await response.json();
          logger.debug('Fetched hallucinations:', data);
          setHallucinations(data);
        } catch (err) {
          logger.error('Error fetching hallucinations:', err);
          // setError('Failed to load hallucinations');
        }
      };
      fetchHallucinations();
    }, [isHallucinationEnabled]);
  // Fetch tags for messages using batch endpoint with page-based caching
  useEffect(() => {
    const fetchTagsBatch = async () => {
      try {
        // Check if we've already fetched tags for this page
        if (fetchedPages.has(currentPage)) {
          return; // Already fetched for this page
        }

        // Filter out messages that have already been checked
        const uncheckedMessages = messages.filter(message => !checkedMessageIds.has(message.id));
        
        if (uncheckedMessages.length === 0) {
          // Mark page as fetched even if no messages to check
          setFetchedPages(prev => new Set(prev).add(currentPage));
          return;
        }

        // Use batch endpoint to fetch tags for all unchecked messages at once
        const recordingIds = uncheckedMessages.map(message => message.id);
        
        const response = await api.post(`/recordings_tag/batch/tags`,
          { recording_ids: recordingIds }
        );
        
        const batchTags = response.data;
        const newTagsByMessage = { ...tagsByMessage };
        const newCheckedIds = new Set(checkedMessageIds);
        
        // Update tags for all messages in the batch
        uncheckedMessages.forEach(message => {
          newTagsByMessage[message.id] = batchTags[message.id] || [];
          newCheckedIds.add(message.id);
        });
        
        setTagsByMessage(newTagsByMessage);
        setCheckedMessageIds(newCheckedIds);
        
        // Mark this page as fetched
        setFetchedPages(prev => new Set(prev).add(currentPage));
      } catch (err) {
        logger.error("Error fetching tags for messages:", err);
        showToast("Failed to load message tags", "error");
      }
    };

    if (messages.length > 0) {
      fetchTagsBatch();
    }
  }, [messages, showToast, checkedMessageIds, tagsByMessage, currentPage]);



  // Helpers to manage multi-select
  const toggleMessageSelection = (messageId) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      next.has(messageId) ? next.delete(messageId) : next.add(messageId);
      return next;
    });
  };
  const selectAllMessages = () => {
    const ids = messages
      .filter((m) => !hiddenMessages.has(m.id))
      .map((m) => m.id);
    setSelectedMessages(new Set(ids));
  };
  const clearSelection = () => setSelectedMessages(new Set());

  // Tag management with API
  const addTagToMessage = async (messageId, tag) => {
    if (!tag || tagsByMessage[messageId]?.includes(tag)) return;
    
    // Set refreshing state to show loading indicator
    setRefreshingTags(prev => new Set(prev).add(messageId));
    
    try {
      await api.post(`/recordings_tag/${messageId}/tags`, {
        tag,
      });
      setTagsByMessage((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), tag],
      }));
      // Remove from checked IDs to allow re-fetching if needed
      setCheckedMessageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      showToast(`Tag "${tag}" added`, "success");
    } catch (err) {
      logger.error(`Failed to add tag ${tag} to message ${messageId}:`, err);
      showToast(`Failed to add tag "${tag}"`, "error");
    } finally {
      // Clear refreshing state
      setRefreshingTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
    setSelectedTag("");
    setShowTagDropdown(null);
  };

  const addTagToSelectedMessages = async () => {
    if (selectedMessages.size === 0 || !selectedTag) {
      return showToast("Please select messages and a tag", "warning");
    }
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedMessages).map(async (id) => {
          if (!tagsByMessage[id]?.includes(selectedTag)) {
            await api.post(`/recordings_tag/${id}/tags`, {
              tag: selectedTag,
            });
          }
        })
      );
      setTagsByMessage((prev) => {
        const updated = { ...prev };
        selectedMessages.forEach((id) => {
          if (!updated[id]?.includes(selectedTag)) {
            updated[id] = [...(updated[id] || []), selectedTag];
          }
        });
        return updated;
      });
      showToast(
        `Tag “${selectedTag}” added to ${selectedMessages.size} messages`,
        "success"
      );
    } catch (err) {
      logger.error("Failed to add tags to selected messages:", err);
      showToast("Failed to add tag to selected messages", "error");
    } finally {
      setIsProcessing(false);
      setSelectedTag("");
      setIsMultiSelectMode(false);
      clearSelection();
    }
  };

  const removeTagFromMessage = async (messageId, tag) => {
    // Set refreshing state to show loading indicator
    setRefreshingTags(prev => new Set(prev).add(messageId));
    
    try {
      await api.delete(
        `/recordings_tag/${messageId}/tags/${tag}`
      );
      setTagsByMessage((prev) => ({
        ...prev,
        [messageId]: prev[messageId].filter((t) => t !== tag),
      }));
      showToast(`Tag "${tag}" removed`, "success");
    } catch (err) {
      logger.error(`Failed to remove tag ${tag} from message ${messageId}:`, err);
      showToast(`Failed to remove tag "${tag}"`, "error");
    } finally {
      // Clear refreshing state
      setRefreshingTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Clear all tag cache and re-fetch
  const clearTagCache = () => {
    setCheckedMessageIds(new Set());
    setFetchedPages(new Set());
    setTagsByMessage({});
    setRefreshingTags(new Set()); // Clear any stuck refreshing states
  };

  // Clear any stuck refreshing states
  const clearRefreshingStates = () => {
    setRefreshingTags(new Set());
  };

  // Add timeout to clear refreshing states after 10 seconds
  useEffect(() => {
    if (refreshingTags.size > 0) {
      const timeout = setTimeout(() => {
        logger.warn('Clearing stuck refreshing states after timeout');
        setRefreshingTags(new Set());
      }, 10000); // 10 seconds timeout

      return () => clearTimeout(timeout);
    }
  }, [refreshingTags]);

  // Manual refresh tags for a specific message
  const refreshTagsForMessage = async (messageId) => {
    try {
      // Set refreshing state
      setRefreshingTags(prev => new Set(prev).add(messageId));
      
      // Remove from checked IDs to force re-fetch
      setCheckedMessageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      
      // Fetch tags for this specific message
      const response = await api.get(`/recordings_tag/${messageId}/tags`);
      
      setTagsByMessage((prev) => ({
        ...prev,
        [messageId]: response.data,
      }));
      
      // Mark as checked
      setCheckedMessageIds(prev => {
        const newSet = new Set(prev);
        newSet.add(messageId);
        return newSet;
      });
      
      showToast("Tags refreshed", "success");
    } catch (err) {
      logger.error(`Failed to refresh tags for message ${messageId}:`, err);
      showToast("Failed to refresh tags", "error");
    } finally {
      // Clear refreshing state
      setRefreshingTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  // Merge logic
  const mergeSelectedMessages = async () => {
    if (selectedMessages.size < 2) {
      return showToast("Please select at least 2 messages to merge", "warning");
    }
    setIsProcessing(true);
    try {
      const toMerge = messages
        .filter((m) => selectedMessages.has(m.id))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const mergedText = toMerge.map((m) => m.message).join(" ");
      const base = toMerge[0];
      const newMsg = {
        id: `merged_${Date.now()}`,
        time: base.time,
        message: mergedText,
        channel: base.channel,
        status: "merged",
      };
      // Replace in state
      setMessages((prev) => {
        const remaining = prev.filter((m) => !selectedMessages.has(m.id));
        return [...remaining, newMsg].sort(
          (a, b) => new Date(a.time) - new Date(b.time)
        );
      });
      // Merge tags
      const mergedTags = [
        ...new Set(toMerge.flatMap((m) => tagsByMessage[m.id] || [])),
      ];
      if (mergedTags.length) {
        try {
          await Promise.all(
            mergedTags.map((tag) =>
              api.post(`/recordings_tag/${newMsg.id}/tags`, {
                tag,
              })
            )
          );
          setTagsByMessage((prev) => ({
            ...prev,
            [newMsg.id]: mergedTags,
          }));
        } catch (err) {
          logger.error("Failed to add merged tags:", err);
          showToast("Failed to add tags to merged message", "error");
        }
      }
      showToast(`Successfully merged ${selectedMessages.size} messages`, "success");
      setIsMultiSelectMode(false);
      clearSelection();
    } catch (err) {
      logger.error("Failed to merge messages:", err);
      showToast("Failed to merge messages", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Incident report
  const createIncidentReport = () => {
    if (selectedMessages.size === 0) {
      return showToast(
        "Please select messages to include in the incident report",
        "warning"
      );
    }
    // Check if any selected messages are in the current filtered messages
    const visibleSelectedMessages = messages.filter((msg) => selectedMessages.has(msg.id));
    if (visibleSelectedMessages.length === 0) {
      return showToast(
        "No selected messages are visible in the current filter. Please select messages from the visible list.",
        "warning"
      );
    }
    // Warn if some selected messages are not visible
    if (visibleSelectedMessages.length < selectedMessages.size) {
      showToast(
        `${visibleSelectedMessages.length} of ${selectedMessages.size} selected messages are visible. Only visible messages will be included.`,
        "info"
      );
    }
    setShowIncidentModal(true);
  };
  const handleIncidentSubmit = async (reportData) => {
    setIsProcessing(true);
    try {
      const { data } = await api.post(
        `/incident-reports`,
        reportData
      );
      showToast(`Incident report created: ${data.report_id}`, "success");
      clearSelection();
      setIsMultiSelectMode(false);
      setShowIncidentModal(false);
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Failed to submit report",
        "error"
      );
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete helpers
  const deleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) {
      return showToast("Please select messages to delete", "warning");
    }
    if (!window.confirm(`Delete ${selectedMessages.size} messages?`)) return;
    setIsProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedMessages).map((id) =>
          api.delete(`/recordings/${id}`)
        )
      );
      setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
      setTagsByMessage((prev) => {
        const upd = { ...prev };
        selectedMessages.forEach((id) => delete upd[id]);
        return upd;
      });
      showToast(`Deleted ${selectedMessages.size} messages`, "success");
      setIsMultiSelectMode(false);
      clearSelection();
    } catch (err) {
      logger.error("Failed to delete messages:", err);
      showToast("Failed to delete some messages", "error");
    } finally {
      setIsProcessing(false);
    }
  };
  const deleteMessage = async (id) => {
    setHiddenMessages((prev) => new Set(prev).add(id));
    setDeletingIds((prev) => new Set(prev).add(id));
    let shouldDelete = true;
    let tid;
    const undo = () => {
      shouldDelete = false;
      setHiddenMessages((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      setDeletingIds((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      toast.dismiss(tid);
    };
    try {
      tid = showToast("Message deleted", "success", {
        undo: { action: undo },
        onClose: async () => {
          if (!shouldDelete) return;
          try {
            await api.delete(`/recordings/${id}`);
            setMessages((p) => p.filter((m) => m.id !== id));
            setTagsByMessage((p) => {
              const n = { ...p };
              delete n[id];
              return n;
            });
          } catch (err) {
            logger.error("Failed to delete message:", err);
            showToast("Failed to delete message", "error");
            undo();
          }
        },
      });
    } catch (err) {
      logger.error("Failed to initiate delete:", err);
      showToast("Failed to delete", "error");
    }
  };

  // Navigation helper
  const navigateToAdvancedPlayer = (message) =>
    navigate(`/advanced-player?messageId=${message.id}`, {
      state: {
        message: {
          ...message,
          channelName: channels?.[message.channel]?.name || message.team,
        },
        userTimezone: timezone,
      },
    });

// const AudioIcon = ({ url, messageId, isDarkMode = false, isMobile = false }) => {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [audio] = useState(new Audio(url)); // Create Audio instance

//   // Toggle play/pause for the audio
//   const handlePlayClick = (e) => {
//     e.stopPropagation();

//     if (isPlaying) {
//       audio.pause();
//       setIsPlaying(false);
//     } else {
//       audio.play().catch((err) => console.error("Audio playback error:", err));
//       setIsPlaying(true);
//     }
//   };

//   // Navigate to advanced player (keeping your original logic)
//   const navigateToAdvancedPlayer = (url, messageId) => {
//     // console.log("Navigating to advanced player:", { url, messageId });
//    navigate(
//       `/advanced-player?audioUrl=${encodeURIComponent(url)}&messageId=${messageId}`
//     );

//   };

//   // Ensure audio stops when component unmounts
//   useEffect(() => {
//     return () => {
//       audio.pause();
//       audio.currentTime = 0;
//     };
//   }, [audio]);

//   return (
//     <div className="inline-flex items-center">
//       <span
//         onClick={handlePlayClick}
//         className="cursor-pointer"
//         title={isPlaying ? "Pause" : "Play mini"}
//       >
//         <Volume1
//           className={`inline ${
//             isDarkMode ? "text-gray-400 hover:text-blue-400" : "text-gray-500 hover:text-blue-600"
//           } ${isPlaying ? "text-blue-600" : ""}`}
//           size={isMobile ? 16 : 18}
//         />
//       </span>
//       <span
//         onClick={(e) => {
//           e.stopPropagation();
//           navigateToAdvancedPlayer(url, messageId);
//         }}
//         className={`ml-2 ${isMobile ? "text-[10px]" : "text-xs"} ${
//           isDarkMode ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-800"
//         } hover:underline cursor-pointer`}
//         title="Open advanced"
//       >
//         <ExternalLink size={isMobile ? 12 : 14} className="inline mr-1" />
//         Adv
//       </span>
//    </div>
//   );
// };
  const AudioIcon = ({ url, messageId }) => {
    const isCurrentlyPlaying = playingAudio === url && isPlaying;
    const isExpanded = expandedPlayer === messageId;
    return (
      <button
        type="button"
        className={`${msgActionBtnBase} ${msgActionDim} ${
          isExpanded
            ? isDarkMode
              ? "text-sky-400 bg-sky-500/15 ring-1 ring-sky-500/30"
              : "text-primary bg-primary/10 ring-1 ring-primary/25"
            : isCurrentlyPlaying
              ? isDarkMode
                ? "text-sky-400 hover:bg-slate-800"
                : "text-primary hover:bg-slate-100"
              : isDarkMode
                ? "text-slate-400 hover:bg-slate-800 hover:text-sky-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-primary"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          togglePlayerExpand(messageId, url);
        }}
        title={isExpanded ? "Close player" : "Open player"}
        aria-label={isExpanded ? "Close player" : "Open player"}
      >
        <span className={`${msgActionIcon} ${msgActionFont}`}>
          {isCurrentlyPlaying ? (iconToggle ? "equalizer" : "graphic_eq") : "audio_file"}
        </span>
      </button>
    );
  };

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Inline Audio Player Component - Full width below transcription
  const InlineAudioPlayer = ({ url, messageId }) => {
    const isThisPlaying = playingAudio === url && isPlaying;
    const progressPercent = duration ? ((playingAudio === url ? currentTime : 0) / duration) * 100 : 0;
    const localWaveformCanvasRef = useRef(null);
    
    // Find the message to get its timestamp
    const message = messages.find(m => m.id === messageId);
    const playbackTime = playingAudio === url ? currentTime : 0;
    const actualTimestamp = message ? formatTimestampWithMillis(message.time, playbackTime) : '00:00:00:000';
    
    // Draw waveform on canvas for this specific player
    useEffect(() => {
      if (!localWaveformCanvasRef.current || !waveformData || waveformData.length === 0 || playingAudio !== url) {
        // Cancel animation if conditions not met
        if (waveformAnimationRef.current) {
          cancelAnimationFrame(waveformAnimationRef.current);
          waveformAnimationRef.current = null;
        }
        return;
      }

      const canvas = localWaveformCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = canvas.parentElement;
      
      if (!container) return;

      // Set canvas size to match container (only once, not on every update)
      const rect = container.getBoundingClientRect();
      const containerWidth = Math.max(rect.width, 1); // Ensure minimum width of 1
      const canvasHeight = 32;
      
      if (canvas.width !== containerWidth || canvas.height !== canvasHeight) {
        canvas.width = containerWidth;
        canvas.height = canvasHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      
      // Validate canvas dimensions before proceeding
      if (width <= 0 || height <= 0) {
        console.warn('Canvas has invalid dimensions, skipping waveform draw', { width, height });
        return;
      }
      
      const barCount = waveformData.length;
      if (barCount === 0) return;
      
      const barWidth = width / barCount;
      const centerY = height / 2;

      // Cache colors
      const rootStyles = getComputedStyle(document.documentElement);
      const playedColor = rootStyles.getPropertyValue('--ui-accent').trim();
      const unplayedColor = rootStyles.getPropertyValue('--ui-muted').trim();

      // Create offscreen canvas for base waveform (drawn once, never cleared)
      const baseCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      const baseCtx = baseCanvas.getContext('2d');
      
      // Validate baseCanvas dimensions before drawing
      if (baseCanvas.width <= 0 || baseCanvas.height <= 0) {
        console.warn('Base canvas has invalid dimensions, skipping waveform draw', { 
          width: baseCanvas.width, 
          height: baseCanvas.height 
        });
        return;
      }
      
      // Draw base waveform once on offscreen canvas
      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const barHeight = value * (height * 0.8);
        baseCtx.fillStyle = unplayedColor;
        baseCtx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
      });

      // Create offscreen canvas for progress layer (double buffering)
      const progressCanvas = document.createElement('canvas');
      progressCanvas.width = width;
      progressCanvas.height = height;
      const progressCtx = progressCanvas.getContext('2d');
      
      // Validate progressCanvas dimensions before drawing
      if (progressCanvas.width <= 0 || progressCanvas.height <= 0) {
        console.warn('Progress canvas has invalid dimensions, skipping waveform draw', { 
          width: progressCanvas.width, 
          height: progressCanvas.height 
        });
        return;
      }

      // Draw base waveform to main canvas once
      ctx.drawImage(baseCanvas, 0, 0);

      // Track last drawn progress to only update changed bars
      let lastDrawnBarIndex = -1;
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100; // Update every 100ms (~10fps) to significantly reduce flickering

      // Draw full waveform with progress using double buffering
      const drawWaveformWithProgress = (progressTime) => {
        // Validate canvas dimensions before drawing
        if (width <= 0 || height <= 0 || baseCanvas.width <= 0 || baseCanvas.height <= 0) {
          return;
        }
        
        if (!duration) {
          // Just draw base waveform
          ctx.clearRect(0, 0, width, height);
          if (baseCanvas.width > 0 && baseCanvas.height > 0) {
            ctx.drawImage(baseCanvas, 0, 0);
          }
          return;
        }
        
        const currentProgressPercent = (progressTime / duration) * 100;
        const progressPosition = currentProgressPercent / 100 * width;
        const currentBarIndex = Math.floor((progressPosition / width) * barCount);
        
        // Only redraw if we've moved to a new bar (throttle updates)
        if (currentBarIndex !== lastDrawnBarIndex) {
          // Validate progressCanvas dimensions
          if (progressCanvas.width <= 0 || progressCanvas.height <= 0) {
            return;
          }
          
          // Clear and redraw progress layer on offscreen canvas
          progressCtx.clearRect(0, 0, width, height);
          
          // Draw played portion on progress canvas
          progressCtx.fillStyle = playedColor;
          for (let i = 0; i <= currentBarIndex && i < barCount; i++) {
            const x = i * barWidth;
            const barHeight = waveformData[i] * (height * 0.8);
            progressCtx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
          }
          
          // Composite both canvases to main canvas in one operation (no flicker)
          ctx.clearRect(0, 0, width, height);
          if (baseCanvas.width > 0 && baseCanvas.height > 0) {
            ctx.drawImage(baseCanvas, 0, 0);
          }
          if (progressCanvas.width > 0 && progressCanvas.height > 0) {
            ctx.drawImage(progressCanvas, 0, 0);
          }
          
          lastDrawnBarIndex = currentBarIndex;
        }
      };

      // Initial draw
      drawWaveformWithProgress(isThisPlaying && duration ? currentTime : 0);

      // Animation loop - throttled to reduce flickering
      const animate = (timestamp) => {
        if (isThisPlaying && playingAudio === url && duration && audioRef.current) {
          // Throttle updates to reduce flickering
          if (timestamp - lastUpdateTime >= UPDATE_INTERVAL) {
            const currentProgressTime = audioRef.current.currentTime || 0;
            drawWaveformWithProgress(currentProgressTime);
            lastUpdateTime = timestamp;
          }
          waveformAnimationRef.current = requestAnimationFrame(animate);
        }
      };

      if (isThisPlaying) {
        waveformAnimationRef.current = requestAnimationFrame(animate);
      }

      // Redraw on window resize
      const handleResize = () => {
        const newRect = container.getBoundingClientRect();
        canvas.width = newRect.width;
        canvas.height = 32;
        const newWidth = canvas.width;
        const newBarWidth = newWidth / barCount;
        
        // Recreate base canvas with new dimensions
        baseCanvas.width = newWidth;
        baseCanvas.height = height;
        
        // Recreate progress canvas with new dimensions
        progressCanvas.width = newWidth;
        progressCanvas.height = height;
        
        // Redraw base waveform
        baseCtx.clearRect(0, 0, newWidth, height);
        waveformData.forEach((value, index) => {
          const x = index * newBarWidth;
          const barHeight = value * (height * 0.8);
          baseCtx.fillStyle = unplayedColor;
          baseCtx.fillRect(x, centerY - barHeight / 2, newBarWidth - 1, barHeight);
        });
        
        // Redraw everything
        lastDrawnBarIndex = -1;
        const progressTime = isThisPlaying && audioRef.current ? audioRef.current.currentTime : 0;
        drawWaveformWithProgress(progressTime);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (waveformAnimationRef.current) {
          cancelAnimationFrame(waveformAnimationRef.current);
          waveformAnimationRef.current = null;
        }
      };
    }, [waveformData, playingAudio, url, isDarkMode, isThisPlaying]);
    
    return (
      <div 
        className={`flex flex-col gap-2 px-3 py-2 rounded-lg ${
          isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timestamp Display */}
        <div className={`flex items-center justify-center text-xs font-mono ${
          isDarkMode ? 'text-blue-400' : 'text-blue-600'
        }`}>
          <span className="font-semibold">Timestamp: </span>
          <span className="ml-1">{actualTimestamp}</span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-3">
          {/* Skip Back */}
          <button
            onClick={() => skipTime(-5)}
            className={`flex-shrink-0 p-1 rounded hover:bg-opacity-50 ${
              isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
            }`}
            title="Back 5s"
          >
            <span className={`${msgActionIcon} text-[18px]`}>replay_5</span>
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => handlePlayAudio(url, messageId)}
            className={`flex-shrink-0 p-2 rounded-full ${
              isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            <span className={`${msgActionIcon} text-[22px] text-white`}>
              {isThisPlaying ? "pause_circle" : "play_circle"}
            </span>
          </button>

          {/* Skip Forward */}
          <button
            onClick={() => skipTime(5)}
            className={`flex-shrink-0 p-1 rounded hover:bg-opacity-50 ${
              isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
            }`}
            title="Forward 5s"
          >
            <span className={`${msgActionIcon} text-[18px]`}>forward_5</span>
          </button>

          {/* Current Time */}
          <span className={`flex-shrink-0 text-xs font-mono ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {formatAudioTime(playbackTime)}
          </span>

          {/* Waveform and Progress Bar Container */}
          <div className="flex-grow flex flex-col gap-1">
            {/* Waveform Visualization */}
            {waveformData && waveformData.length > 0 && playingAudio === url && (
              <div 
                className="relative w-full h-8 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const newTime = percent * (duration || 0);
                  audioRef.current.currentTime = newTime;
                  setCurrentTime(newTime);
                }}
              >
                <canvas
                  ref={localWaveformCanvasRef}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}
            
            {/* Progress Bar - Full width */}
            <div 
              className={`relative w-full h-2 rounded-full cursor-pointer ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              }`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const newTime = percent * (duration || 0);
                audioRef.current.currentTime = newTime;
                setCurrentTime(newTime);
              }}
            >
              <div 
                className={`absolute left-0 top-0 h-full rounded-full ${
                  isDarkMode ? 'bg-blue-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
              {/* Thumb indicator */}
              <div 
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow ${
                  isDarkMode ? 'bg-gray-200 border border-gray-500' : 'bg-white border border-gray-300'
                }`}
                style={{ left: `calc(${progressPercent}% - 6px)` }}
              />
            </div>
          </div>

          {/* Duration */}
          <span className={`flex-shrink-0 text-xs font-mono ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {formatAudioTime(playingAudio === url ? duration : 0)}
          </span>

          {/* Close Button */}
          <button
            onClick={() => togglePlayerExpand(messageId, url)}
            className={`flex-shrink-0 p-1 rounded hover:bg-opacity-50 ${
              isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
            }`}
            title="Close player"
          >
            <span className={`${msgActionIcon} text-[18px]`}>close</span>
          </button>
        </div>
      </div>
    );
  };



  const downloadAudio = async (url, filename, messageId) => {
  try {
    // If messageId is provided, fetch the formatted filename from the API
    // Format respects user's time format preference (12h or 24h)
    let downloadFilename = filename;
    if (messageId) {
      try {
        const res = await api.get(`/audio_url/${messageId}?time_format=${timeFormat}`);
        // Use formatted filename from API response, fallback to provided filename
        downloadFilename = res.data.utc_filename || filename;
      } catch (err) {
        console.warn("Could not fetch formatted filename from API, using provided filename:", err);
        // Continue with the provided filename if API call fails
      }
    }
    
    const response = await apiFetch(url);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast(`Downloaded ${downloadFilename}`, "success");
  } catch (err) {
    logger.error("Failed to download audio:", err);
    showToast("Failed to download audio", "error");
  }
};

  // Track loading state for re-transcribe per message
  const [retranscribeLoading, setRetranscribeLoading] = useState({});

  // Render
  return (
    <div
      className={`relative flex min-h-0 flex-col ${
        isDarkMode ? "bg-slate-950" : "bg-white"
      } ${isFullscreen ? "fixed inset-0 z-50 h-screen" : "min-h-0 flex-1"}`}
    >
      {/* Multi-select toolbar */}
      {isMultiSelectMode && (
        <div
          className={`sticky top-0 z-10 border-b px-3 py-3 md:px-4 ${
            isDarkMode ? "border-slate-700 bg-slate-900/95" : "border-slate-200/90 bg-surface-container-low/90"
          } backdrop-blur-sm`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {selectedMessages.size} selected
              </span>
              {selectedMessages.size > 0 && (
                <button
                  onClick={clearSelection}
                  className={`text-sm ${
                    isDarkMode
                      ? "text-gray-400 hover:text-gray-200"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Clear
                </button>
              )}
              {messages.filter((m) => !hiddenMessages.has(m.id)).length > 0 && (
                <button
                  onClick={selectAllMessages}
                  className={`text-sm ${
                    isDarkMode
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-blue-600 hover:text-blue-800"
                  }`}
                >
                  Select All
                </button>
              )}
            </div>
          <div className="flex items-center space-x-2">
  {/* Tag dropdown */}
  <div className="flex items-center">
    <select
      value={selectedTag}
      onChange={(e) => setSelectedTag(e.target.value)}
      className={`px-2 py-1 rounded-md text-sm border ${
        isDarkMode
          ? "bg-gray-700 border-gray-600 text-white"
          : "bg-white border-gray-300"
      }`}
    >
      <option value="">Select a tag</option>
      {allTags.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
    <button
      onClick={addTagToSelectedMessages}
      disabled={isProcessing || !selectedTag}
      className={`ml-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isProcessing || !selectedTag
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-purple-600 hover:bg-purple-700 text-white"
      }`}
    >
      {isProcessing ? (
        <span className="material-symbols-outlined mr-2 inline-block animate-spin text-[18px] leading-none">
          progress_activity
        </span>
      ) : (
        <span className="material-symbols-outlined mr-2 inline-block text-[18px] leading-none">label</span>
      )}
      Add Tag
    </button>
  </div>
  {/* Download selected audio */}
<button
  onClick={async () => {
    // Filter to only include selected messages that are in the current filtered messages
    const visibleSelectedMessages = messages.filter((m) => selectedMessages.has(m.id));
    const messagesWithAudio = visibleSelectedMessages.filter((m) => m.url);
    
    if (visibleSelectedMessages.length === 0) {
      return showToast("No selected messages are visible in the current filter. Please select messages from the visible list.", "warning");
    }
    
    if (messagesWithAudio.length === 0) {
      return showToast("No audio available for selected messages", "warning");
    }
    
    // Warn if some selected messages are not visible or don't have audio
    if (visibleSelectedMessages.length < selectedMessages.size) {
      showToast(
        `${visibleSelectedMessages.length} of ${selectedMessages.size} selected messages are visible. Only visible messages will be downloaded.`,
        "info"
      );
    }
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      // Fetch and add each audio file to the ZIP with proper naming
      for (const msg of messagesWithAudio) {
        try {
          // Fetch the formatted filename from the API (same as downloadAudio)
          // This ensures ZIP files use the same naming convention as individual downloads
          // Format respects user's time format preference (12h or 24h)
          let filename = `audio_${msg.id}.wav`; // Fallback filename
          if (msg.id) {
            try {
              const res = await api.get(`/audio_url/${msg.id}?time_format=${timeFormat}`);
              // Use formatted filename from API response
              filename = res.data.utc_filename || filename;
            } catch (err) {
              console.warn(`Could not fetch UTC filename for message ${msg.id}, using fallback:`, err);
              // Continue with fallback filename if API call fails
            }
          }
          
          // Fetch the audio file
          const response = await apiFetch(msg.url);
          const blob = await response.blob();
          // Use the proper filename format (respects time format preference)
          zip.file(filename, blob);
        } catch (err) {
          logger.error(`Failed to add message ${msg.id} to ZIP:`, err);
          // Continue with other files even if one fails
        }
      }
      // Generate the ZIP file and trigger download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "audio_files.zip");
      showToast(
        `Downloaded ${messagesWithAudio.length} audio file(s) as ZIP`,
        "success"
      );
    } catch (err) {
      logger.error("Failed to create ZIP file:", err);
      showToast("Failed to create ZIP file", "error");
    } finally {
      setIsProcessing(false);
    }
  }}
  disabled={isProcessing || selectedMessages.size === 0}
  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isProcessing || selectedMessages.size === 0
      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
      : "bg-blue-600 hover:bg-blue-700 text-white"
  }`}
>
  {isProcessing ? (
    <span className="material-symbols-outlined mr-2 inline-block animate-spin text-[18px] leading-none">
      progress_activity
    </span>
  ) : (
    <span className="material-symbols-outlined mr-2 inline-block text-[18px] leading-none">download</span>
  )}
  Download Audio as ZIP
</button>
 
  {/* Incident */}
  {canCreateReports && (
    <button
      onClick={createIncidentReport}
      disabled={isProcessing}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isProcessing
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-orange-600 hover:bg-orange-700 text-white"
      }`}
    >
      {isProcessing ? (
        <span className="material-symbols-outlined mr-2 inline-block animate-spin text-[18px] leading-none">
          progress_activity
        </span>
      ) : (
        <span className="material-symbols-outlined mr-2 inline-block text-[18px] leading-none">assignment</span>
      )}
      Create Incident
    </button>
  )}
  {/* Delete */}
  {canDeleteAudio && (
    <button
      onClick={deleteSelectedMessages}
      disabled={isProcessing}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isProcessing
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-red-600 hover:bg-red-700 text-white"
      }`}
    >
      {isProcessing ? (
        <span className="material-symbols-outlined mr-2 inline-block animate-spin text-[18px] leading-none">
          progress_activity
        </span>
      ) : (
        <span className="material-symbols-outlined mr-2 inline-block text-[18px] leading-none">delete</span>
      )}
      Delete ({selectedMessages.size})
    </button>
  )}
</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={`overflow-y-auto ${
          isDarkMode ? "dark-mode-scrollbar" : ""
        } ${
          isFullscreen
            ? "h-screen p-4 sm:p-6"
            : "min-h-0 flex-1 space-y-1 px-4 py-3 pb-24 md:px-8"
        }`}
      >
        <div className="w-full space-y-1">
          <div ref={messagesTopRef} className="h-px" />
          {messages.map((item) => {
  if (hiddenMessages.has(item.id)) return null;

  // Check for regex and wildcard matches (for indicators) - only if hallucination filtering is enabled
  const { regex, wildcard } = isHallucinationEnabled 
    ? checkPatternMatches(item.message, hallucinations)
    : { regex: false, wildcard: false };
  
  // Replace hallucination words with "....." in the message text - only if enabled
  const filteredMessage = item.message !== 'No transcription available' 
    ? (isHallucinationEnabled 
        ? replaceHallucinationWords(item.message, hallucinations)
        : item.message)
    : item.message;

  const bodyExpanded = expandedMessageIds.has(item.id);
  const isTranscript =
    item.message &&
    item.message !== "No transcription available" &&
    item.message !== "....";
  const transcriptLong =
    isTranscript && String(filteredMessage).length > MESSAGE_BODY_PREVIEW_CHAR_THRESHOLD;

  // Only show "processing" affordances when we truly have no transcript yet (avoids stale spinner if API lags status)
  const showProcessingSpinner = item.status === "processing" && !isTranscript;

  const processingIndicator = showProcessingSpinner ? (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
        isDarkMode ? "bg-blue-900/40 text-blue-200" : "bg-blue-50 text-blue-700"
      }`}
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className={`${msgActionIcon} shrink-0 animate-spin ${msgActionFont} !text-[14px] text-primary`}
        aria-hidden
      >
        progress_activity
      </span>
      Transcribing…
    </span>
  ) : null;

  const channelLabel = (() => {
    const parts = [
      showCar && channels[item.channel]?.tag,
      showChannel && channels[item.channel]?.name,
      showPerson && channels[item.channel]?.person
        ? `(${channels[item.channel]?.person})`
        : "",
    ].filter(Boolean);
    if (parts.length === 0) {
      return channels[item.channel]?.name || "—";
    }
    return parts.join(" · ");
  })();

  const showTagsRow =
    (tagsByMessage[item.id] || []).length > 0 && (bodyExpanded || !transcriptLong);

  const feedSubline = showTime
    ? formatFeedRowSublineDate
      ? formatFeedRowSublineDate(item.time, timezone)
      : formatTime(item.time, timezone)
    : null;

  const channelBadge = (
    <span
      className={`inline-flex max-w-[13.5rem] shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight tracking-tight ${
        isDarkMode
          ? "border-slate-600/85 bg-slate-800/90 text-slate-100"
          : "border-slate-200/95 bg-slate-100/95 text-slate-800"
      }`}
      title={channelLabel}
    >
      <span className="truncate">{channelLabel}</span>
    </span>
  );

  const durationBadge =
    item.duration > 0 ? (
      <span className="shrink-0 self-center text-sm font-medium tabular-nums tracking-tight text-blue-500 dark:text-blue-400">
        {formatDuration(item.duration)}
      </span>
    ) : null;

  const feedLeftColumn = (
    <div className="flex max-w-[13.5rem] shrink-0 flex-col gap-0.5">
      {channelBadge}
      {feedSubline ? (
        <span
          className={`text-[11px] leading-tight tabular-nums ${
            isDarkMode ? "text-slate-500" : "text-slate-500"
          }`}
          title={feedSubline}
        >
          {feedSubline}
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      key={item.id}
      className={`group relative min-w-0 rounded-lg border transition-colors duration-200 ${
        isMobile ? "flex flex-col px-2.5 py-1.5" : "flex items-start gap-2.5 px-2.5 py-1.5 md:gap-2.5"
      } ${
        isDarkMode
          ? "border-slate-700/70 bg-slate-900/25 hover:border-slate-600 hover:bg-slate-800/40"
          : "border-slate-200/90 bg-surface-container-low/80 hover:border-slate-300/90 hover:bg-surface-container-high/90"
      } ${
        isMultiSelectMode ? "cursor-pointer" : ""
      } ${
        selectedMessages.has(item.id)
          ? isDarkMode
            ? "!border-blue-500/50 bg-blue-950/35 ring-2 ring-blue-500/90"
            : "!border-blue-300/80 bg-blue-50/95 ring-2 ring-blue-500/70"
          : ""
      }`}
      onClick={isMultiSelectMode ? () => toggleMessageSelection(item.id) : undefined}
    >
      {isMobile ? (
        <>
          <div className="flex min-w-0 items-start gap-2">
            {isMultiSelectMode && (
              <div
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                  selectedMessages.has(item.id)
                    ? "border-blue-600 bg-blue-600"
                    : isDarkMode
                      ? "border-gray-600"
                      : "border-gray-300"
                }`}
              >
                {selectedMessages.has(item.id) && (
                  <span className="material-symbols-outlined !text-[14px] leading-none text-white">check</span>
                )}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 items-start gap-2">
                {feedLeftColumn}
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <div
                    className={`min-w-0 flex-1 text-[15px] font-normal leading-[1.45] antialiased ${
                      bodyExpanded || !transcriptLong ? "" : "line-clamp-2"
                    } ${
                      canPlayAudio && item.url ? "cursor-pointer" : isMultiSelectMode ? "" : "cursor-pointer"
                    } ${isDarkMode ? "text-slate-100" : "text-on-surface"}`}
                    onClick={(e) => {
                      if (!isMultiSelectMode) {
                        e.stopPropagation();
                        if (canPlayAudio && item.url) {
                          togglePlayerExpand(item.id, item.url);
                        } else {
                          setExpandedMobileActions(
                            expandedMobileActions === item.id ? null : item.id
                          );
                        }
                      }
                    }}
                  >
                    {item.message !== "No transcription available" ? (
                      highlightText(filteredMessage, searchQuery)
                    ) : item.status === "queued" ? (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isDarkMode ? "bg-yellow-900/50 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        queued
                      </span>
                    ) : showProcessingSpinner ? (
                      processingIndicator
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isDarkMode ? "bg-yellow-900/50 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        .....
                      </span>
                    )}
                    {regex && (
                      <span
                        className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                          isDarkMode ? "bg-blue-700 text-blue-200" : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        Hallucination
                      </span>
                    )}
                  </div>
                  {transcriptLong ? (
                    <button
                      type="button"
                      className={`mt-0.5 shrink-0 self-start rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                        isDarkMode
                          ? "text-blue-300 hover:bg-blue-500/15"
                          : "text-primary hover:bg-primary/10"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMessageBodyExpanded(item.id);
                      }}
                    >
                      {bodyExpanded ? "Less" : "More"}
                    </button>
                  ) : null}
                  {durationBadge}
                </div>
              </div>
            </div>
            {canPlayAudio && item.url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayerExpand(item.id, item.url);
                }}
                className={`${msgActionBtnBase} mt-0.5 h-9 w-9 shrink-0 ring-1 transition-colors ${
                  expandedPlayer === item.id
                    ? "bg-primary text-white ring-primary/40"
                    : isDarkMode
                      ? "bg-slate-800 text-slate-200 ring-slate-600 hover:bg-slate-700/90"
                      : "bg-white text-slate-700 ring-slate-200/90 shadow-sm hover:bg-slate-50"
                }`}
              >
                <span className={`${msgActionIcon} text-[20px]`}>
                  {playingAudio === item.url && isPlaying ? "pause_circle" : "play_circle"}
                </span>
              </button>
            )}
          </div>
          
          {/* Expanded mobile actions */}
          {expandedMobileActions === item.id && !isMultiSelectMode && (
            <div className={`mt-2 flex flex-wrap items-center gap-2 pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {canPlayAudio && item.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAudio(item.url, `audio_${item.id}.mp3`, item.id);
                  }}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${
                    isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className={`${msgActionIcon} text-[18px]`}>download_2</span>
                  Download
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagDropdown(showTagDropdown === item.id ? null : item.id);
                  setSelectedTag('');
                }}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${
                  isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <span className={`${msgActionIcon} text-[18px]`}>new_label</span>
                Tag
              </button>
              {canAccessAdvancedPlayer && item.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToAdvancedPlayer(item);
                  }}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${
                    isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className={`${msgActionIcon} text-[18px]`}>tune</span>
                  Advanced
                </button>
              )}
              {canDeleteAudio && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMessage(item.id);
                  }}
                  disabled={deletingIds.has(item.id)}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${
                    isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {deletingIds.has(item.id) ? (
                    <span className={`${msgActionIcon} animate-spin text-[18px]`}>progress_activity</span>
                  ) : (
                    <span className={`${msgActionIcon} text-[18px]`}>delete_forever</span>
                  )}
                  Delete
                </button>
              )}
            </div>
          )}
          
          {/* Tag dropdown for mobile */}
          {showTagDropdown === item.id && expandedMobileActions === item.id && (
            <div className={`mt-2 p-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="flex flex-wrap gap-1">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      addTagToMessage(item.id, tag);
                      setShowTagDropdown(null);
                    }}
                    className={`px-2 py-1 text-xs rounded-full ${
                      isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Audio Player for mobile - full width */}
          {expandedPlayer === item.id && item.url && canPlayAudio && (
            <div className="mt-2">
              <InlineAudioPlayer url={item.url} messageId={item.id} />
            </div>
          )}
        </>
      ) : (
        <>
          {isMultiSelectMode && (
            <div className="flex flex-shrink-0 items-center justify-center self-start pt-0.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                  selectedMessages.has(item.id)
                    ? "border-blue-600 bg-blue-600"
                    : isDarkMode
                      ? "border-gray-600"
                      : "border-gray-300"
                }`}
              >
                {selectedMessages.has(item.id) && (
                  <span className="material-symbols-outlined !text-[14px] leading-none text-white">check</span>
                )}
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 items-start gap-2">
              {feedLeftColumn}
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <div
                  className={`min-w-0 flex-1 break-words text-[15px] font-normal leading-[1.45] antialiased ${
                    bodyExpanded || !transcriptLong ? "" : "line-clamp-1"
                  } ${canPlayAudio && item.url ? "cursor-pointer" : ""} ${
                    isDarkMode ? "text-slate-100" : "text-on-surface"
                  }`}
                  onClick={(e) => {
                    if (canPlayAudio && item.url && !isMultiSelectMode) {
                      e.stopPropagation();
                      togglePlayerExpand(item.id, item.url);
                    }
                  }}
                >
                  {item.message &&
                  item.message !== "No transcription available" &&
                  item.message !== "...." ? (
                    highlightText(filteredMessage, searchQuery)
                  ) : item.message === "...." ? (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        isDarkMode ? "bg-red-900/50 text-red-200" : "bg-red-100 text-red-800"
                      }`}
                    >
                      ....
                    </span>
                  ) : item.status === "queued" ? (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        isDarkMode ? "bg-yellow-900/50 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      queued
                    </span>
                  ) : showProcessingSpinner ? (
                    processingIndicator
                  ) : (
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        isDarkMode ? "bg-yellow-900/50 text-yellow-200" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      No transcription available
                    </span>
                  )}

                  {regex && (
                    <span
                      className={`ml-1.5 inline-flex px-2 py-0.5 align-middle text-xs font-medium rounded-full ${
                        isDarkMode ? "bg-blue-700 text-blue-200" : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      Hallucination
                    </span>
                  )}
                </div>
                {transcriptLong ? (
                  <button
                    type="button"
                    className={`mt-0.5 shrink-0 self-start rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      isDarkMode
                        ? "text-blue-300 hover:bg-blue-500/15"
                        : "text-primary hover:bg-primary/10"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMessageBodyExpanded(item.id);
                    }}
                  >
                    {bodyExpanded ? "Less" : "More"}
                  </button>
                ) : null}
                {durationBadge}
              </div>
            </div>

        {/* Audio Player - shows below transcription when expanded */}
        {expandedPlayer === item.id && item.url && canPlayAudio && (
          <div className="mt-2">
            <InlineAudioPlayer url={item.url} messageId={item.id} />
          </div>
        )}

        {/* Existing tags — only when expanded or short message keeps the bar one line */}
        {showTagsRow ? (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
              {(tagsByMessage[item.id] || []).map((t) => (
                <span
                  key={t}
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${
                    isDarkMode
                      ? "bg-slate-800/80 text-slate-200 ring-slate-600/80"
                      : "bg-surface-variant/80 text-slate-800 ring-slate-200/90"
                  }`}
                >
                  {t}
                  {!isMultiSelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTagFromMessage(item.id, t);
                      }}
                      className="ml-1 text-red-500 hover:text-red-700"
                    >
                      <span className={`${msgActionIcon} !text-[14px]`}>close</span>
                    </button>
                  )}
                </span>
              ))}
          </div>
          
          {/* Tag refresh button */}
          {/* {!isMultiSelectMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                refreshTagsForMessage(item.id);
              }}
              className={`p-1 rounded-full transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Refresh tags"
              disabled={refreshingTags.has(item.id)}
            >
              {refreshingTags.has(item.id) ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <TagIcon size={14} />
              )}
            </button>
          )} */}
          
          {/* Loading indicator for tags */}
          {/* {(!checkedMessageIds.has(item.id) || refreshingTags.has(item.id)) && (
            <div className="flex items-center text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              {refreshingTags.has(item.id) ? 'Refreshing tags...' : 'Loading tags...'}
            </div>
          )} */}
        </div>
        ) : null}

        {/* Per-message tag dropdown */}
        {!isMultiSelectMode && showTagDropdown === item.id && (
          <div className="mt-1 flex items-center">
            <select
              value={selectedTag}
              onChange={(e) => {
                const t = e.target.value;
                setSelectedTag(t);
                if (t) addTagToMessage(item.id, t);
              }}
              className={`px-2 py-1 rounded-md text-sm border ${
                isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            >
              <option value="">Select a tag</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowTagDropdown(null)}
              className={`ml-2 text-sm ${
                isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Per-message actions */}
      {!isMultiSelectMode && (
        <div
          className={`flex flex-wrap items-center ${isMobile ? "gap-0.5" : "gap-0.5 self-start pt-0.5 opacity-0 transition-opacity group-hover:opacity-100"}`}
        >
          {/* Show re-transcribe button only for failed jobs (.....) as the left-most action */}
          {item.message === 'No transcription available' && item.status !== 'queued' && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!item.id) return;
                setRetranscribeLoading((prev) => ({ ...prev, [item.id]: true }));
                showToast('Transcribing...', 'info');
                try {
                  const response = await api.post(`/transcribe/${item.id}`);
                  if (response.data && response.data.transcription) {
                    setMessages((prev) => prev.map((m) => m.id === item.id ? { ...m, message: response.data.transcription } : m));
                    showToast('Transcription updated!', 'success');
                  } else {
                    showToast('No transcription returned', 'warning');
                  }
                } catch (err) {
                  showToast('Transcription failed', 'error');
                } finally {
                  setRetranscribeLoading((prev) => ({ ...prev, [item.id]: false }));
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors ${isMobile ? "min-h-8 px-2 py-1 text-xs" : "min-h-9 px-3 py-1.5 text-xs"} ${isDarkMode ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-green-100 text-green-800 hover:bg-green-200'} ${isMobile ? 'mr-0.5' : 'mr-1'}`}
              title="Re-transcribe"
              disabled={!!retranscribeLoading[item.id]}
            >
              {retranscribeLoading[item.id] ? (
                <>
                  <span className={`${msgActionIcon} ${isMobile ? "text-[16px]" : "text-[18px]"} animate-spin`}>
                    progress_activity
                  </span>
                  {isMobile ? "Trans..." : "Transcribing..."}
                </>
              ) : (
                <>
                  <span className={`${msgActionIcon} ${isMobile ? "text-[16px]" : "text-[18px]"}`}>transcribe</span>
                  {isMobile ? "Re-trans" : "Re-transcribe"}
                </>
              )}
            </button>
          )}

          {canPlayAudio && item.url && (
            <AudioIcon url={item.url} messageId={item.id} />
          )}

          {canPlayAudio && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (item.url) {
                  downloadAudio(item.url, `audio_${item.id}.mp3`, item.id);
                } else {
                  showToast("No audio available for download", "warning");
                }
              }}
              className={`${msgActionBtnBase} ${msgActionDim} ${
                isDarkMode
                  ? "text-slate-400 hover:bg-slate-800 hover:text-sky-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-primary"
              }`}
              title="Download Audio"
              disabled={!item.url}
            >
              <span className={`${msgActionIcon} ${msgActionFont}`}>download_2</span>
            </button>
          )}

          {canAccessAdvancedPlayer && (
            <button
              type="button"
              onClick={() => navigateToAdvancedPlayer(item)}
              className={`${msgActionBtnBase} ${msgActionDim} ${
                isDarkMode
                  ? "text-sky-400 hover:bg-slate-800 hover:text-sky-300"
                  : "text-primary hover:bg-primary/10"
              }`}
              title="Open in Advanced Player"
            >
              <span className={`${msgActionIcon} ${msgActionFont}`}>tune</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTagDropdown(showTagDropdown === item.id ? null : item.id);
              setSelectedTag('');
            }}
            className={`${msgActionBtnBase} ${msgActionDim} ${
              isDarkMode
                ? "text-slate-400 hover:bg-slate-800 hover:text-violet-400"
                : "text-slate-600 hover:bg-violet-100 hover:text-violet-700"
            }`}
            title="Add Tag"
          >
            <span className={`${msgActionIcon} ${msgActionFont}`}>new_label</span>
          </button>

         {canDeleteAudio && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteMessage(item.id);
              }}
              className={`${msgActionBtnBase} ${msgActionDim} ${
                isDarkMode ? "text-slate-400 hover:bg-red-950/50 hover:text-red-400" : "text-red-600 hover:bg-red-50"
              }`}
              disabled={deletingIds.has(item.id)}
            >
              {deletingIds.has(item.id) ? (
                <span className={`${msgActionIcon} ${msgActionFont} animate-spin`}>progress_activity</span>
              ) : (
                <span className={`${msgActionIcon} ${msgActionFont}`}>delete_forever</span>
              )}
            </button>
          )}

        </div>
      )}
        </> 
      )}
    </div>
  );
})}
{/* Message count indicator - only show in continuous scrolling mode */}
          {inboxViewMode === 'continuous' && messages.length > 0 && (
            <div className={`sticky bottom-0 left-0 right-0 z-10 py-2 px-4 text-center text-xs font-medium ${
              isDarkMode 
                ? 'bg-gray-900/95 backdrop-blur-sm text-gray-300 border-t border-gray-700' 
                : 'bg-white/95 backdrop-blur-sm text-gray-600 border-t border-gray-200'
            }`}>
              <div className="flex items-center justify-center gap-2">
                <span>
                  Showing {messages.length} of {totalMessages} messages
                </span>
                {hasMoreMessages && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/50 text-blue-300">
                    {totalMessages - messages.length} more available
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Loading indicator for infinite scroll - only show in continuous mode */}
          {inboxViewMode === 'continuous' && isLoadingMore && (
            <div className="flex justify-center py-4">
              <span className="material-symbols-outlined animate-spin text-3xl leading-none text-blue-500">
                progress_activity
              </span>
            </div>
          )}
          {inboxViewMode === 'continuous' && !hasMoreMessages && messages.length > 0 && (
            <div className={`text-center py-4 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              All messages loaded
            </div>
          )}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      {/* Incident Report Modal */}
      {showIncidentModal && (
        <IncidentReportModal
          isOpen={showIncidentModal}
          selectedMessages={selectedMessages}
          messages={messages}
          formatTime={formatTime}
          timezone={timezone}
          timeFormat={timeFormat}
          onClose={() => setShowIncidentModal(false)}
          onSubmit={handleIncidentSubmit}
          isDarkMode={isDarkMode}
          tagsByMessage={tagsByMessage}
        />
      )}

      {/* Floating scroll-to-newest button for all devices */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-4 z-50 flex items-center justify-center bg-primary text-on-primary shadow-lg transition-all duration-300 hover:brightness-110 ${
            newMessageCount > 0 
              ? 'rounded-full px-4 py-3' 
              : 'rounded-full w-12 h-12'
          }`}
          style={{ boxShadow: '0 4px 14px rgb(var(--ui-accent-rgb) / 0.35)' }}
          title={reverseSort ? "Scroll to newest messages (top)" : "Scroll to newest messages (bottom)"}
        >
          {newMessageCount > 0 ? (
            <div className="flex items-center gap-2">
              <MessageSquare size={18} />
              <span className="text-sm font-semibold">{newMessageCount}</span>
              {reverseSort ? <ArrowUp size={18} /> : <ArrowUp size={18} className="rotate-180" />}
            </div>
          ) : (
            reverseSort ? <ArrowUp size={22} /> : <ArrowUp size={22} className="rotate-180" />
          )}
        </button>
      )}

    </div>
  );
};

export default FullscreenMessages;
