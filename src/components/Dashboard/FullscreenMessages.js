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
import logger from "../../utils/logger";
import IncidentReportModal from "./IncidentReportModal";
import { useAuth } from "../AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAudioPlayback } from "../AudioPlaybackContext";
import SharedInlineAudioPlayer from "../InlineAudioPlayer";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import buttonStyles from "../ui/Button.module.css";
import formStyles from "../ui/Form.module.css";
import styles from "../ui/FullscreenMessages.module.css";

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
  const msgActionBtnBase = buttonStyles.button;
  const msgActionIcon = "material-symbols-outlined";
  const msgActionDim = buttonStyles.icon;
  const msgActionFont = "";

  // State declarations - moved before useEffect that depends on them
  const [expandedPlayer, setExpandedPlayer] = useState(null); // Track which message has expanded player
  const { activeTrack, status: audioStatus } = useAudioPlayback();
  const [hallucinations, setHallucinations] = useState([]);
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
  };
  const showToast = useCallback(
    (message, type = "info", customOptions = {}) =>
      toast(
        <div className="rowBetween">
          <span>{message}</span>
          {customOptions.undo && (
            <button
              onClick={customOptions.undo.action}
              className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary}`}
            >
              Undo
            </button>
          )}
        </div>,
        { ...TOAST_CONFIG, type, ...customOptions }
      ),
    [isMobile]
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

  const togglePlayerExpand = (messageId) => {
    if (expandedPlayer === messageId) {
      setExpandedPlayer(null);
    } else {
      setExpandedPlayer(messageId);
    }
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

  const AudioIcon = ({ url, messageId }) => {
    const isCurrentlyPlaying = activeTrack?.ownerId === `inbox:${messageId}` && audioStatus === 'playing';
    const isExpanded = expandedPlayer === messageId;
    return (
      <button
        type="button"
        className={`${msgActionBtnBase} ${msgActionDim} ${
          isExpanded
            ? buttonStyles.primary
            : isCurrentlyPlaying
              ? buttonStyles.accent
              : buttonStyles.ghost
        }`}
        onClick={(e) => {
          e.stopPropagation();
          togglePlayerExpand(messageId, url);
        }}
        title={isExpanded ? "Close player" : "Open player"}
        aria-label={isExpanded ? "Close player" : "Open player"}
      >
        <span className={`${msgActionIcon} ${msgActionFont}`}>
          {isCurrentlyPlaying ? "graphic_eq" : "audio_file"}
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
      className={`${styles.root} ${isFullscreen ? styles.fullscreen : styles.embedded}`}
    >
      {/* Multi-select toolbar */}
      {isMultiSelectMode && (
        <div className={styles.multiSelectToolbar}>
          <div className="rowBetween">
            <div className="row">
              <span className="pill pillAccent">
                {selectedMessages.size} selected
              </span>
              {selectedMessages.size > 0 && (
                <button
                  onClick={clearSelection}
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.ghost}`}
                >
                  Clear
                </button>
              )}
              {messages.filter((m) => !hiddenMessages.has(m.id)).length > 0 && (
                <button
                  onClick={selectAllMessages}
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.accent}`}
                >
                  Select All
                </button>
              )}
            </div>
          <div className={styles.toolbarActions}>
  {/* Tag dropdown */}
  <div className="row">
    <select
      value={selectedTag}
      onChange={(e) => setSelectedTag(e.target.value)}
      className={`${formStyles.select} ${formStyles.selectInline}`}
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
      className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.accent}`}
    >
      {isProcessing ? (
        <span className={`material-symbols-outlined spin`}>
          progress_activity
        </span>
      ) : (
        <span className={`material-symbols-outlined`}>label</span>
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
  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary}`}
>
  {isProcessing ? (
    <span className={`material-symbols-outlined spin`}>
      progress_activity
    </span>
  ) : (
    <span className={`material-symbols-outlined`}>download</span>
  )}
  Download Audio as ZIP
</button>
 
  {/* Incident */}
  {canCreateReports && (
    <button
      onClick={createIncidentReport}
      disabled={isProcessing}
      className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.warning}`}
    >
      {isProcessing ? (
        <span className={`material-symbols-outlined spin`}>
          progress_activity
        </span>
      ) : (
        <span className={`material-symbols-outlined`}>assignment</span>
      )}
      Create Incident
    </button>
  )}
  {/* Delete */}
  {canDeleteAudio && (
    <button
      onClick={deleteSelectedMessages}
      disabled={isProcessing}
      className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.danger}`}
    >
      {isProcessing ? (
        <span className={`material-symbols-outlined spin`}>
          progress_activity
        </span>
      ) : (
        <span className={`material-symbols-outlined`}>delete</span>
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
        className={`${styles.scroller} ${isFullscreen ? styles.scrollerFullscreen : styles.scrollerEmbedded}`}
      >
        <div className="stack stackCompact">
          <div ref={messagesTopRef} className={styles.scrollAnchor} />
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
      className="pill pillAccent"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className={`${msgActionIcon} spin`}
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
      className={`pill ${styles.channelBadge}`}
      title={channelLabel}
    >
      <span className={styles.truncate}>{channelLabel}</span>
    </span>
  );

  const durationBadge =
    item.duration > 0 ? (
      <span className={styles.duration}>
        {formatDuration(item.duration)}
      </span>
    ) : null;

  const feedLeftColumn = (
    <div className={styles.feedLeft}>
      {channelBadge}
      {feedSubline ? (
        <span
          className={styles.feedSubline}
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
      className={`${styles.item} ${isMobile ? styles.itemMobile : styles.itemDesktop} ${
        isMultiSelectMode ? styles.selectable : ""
      } ${selectedMessages.has(item.id) ? styles.selected : ""}`}
      onClick={isMultiSelectMode ? () => toggleMessageSelection(item.id) : undefined}
    >
      {isMobile ? (
        <>
          <div className={styles.headerRow}>
            {isMultiSelectMode && (
              <div
                className={`${styles.selectionBox} ${selectedMessages.has(item.id) ? styles.selectionBoxSelected : ""}`}
              >
                {selectedMessages.has(item.id) && (
                  <span className={`material-symbols-outlined ${styles.selectionCheck}`}>check</span>
                )}
              </div>
            )}
            <div className={styles.contentStack}>
              <div className={styles.headerRow}>
                {feedLeftColumn}
                <div className={styles.bodyRow}>
                  <div
                    className={`${styles.transcript} ${bodyExpanded || !transcriptLong ? "" : styles.clampTwo} ${styles.clickable}`}
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
                        className="pill pillWarning"
                      >
                        queued
                      </span>
                    ) : showProcessingSpinner ? (
                      processingIndicator
                    ) : (
                      <span
                        className="pill pillWarning"
                      >
                        .....
                      </span>
                    )}
                    {regex && (
                      <span
                        className={`pill pillAccent ${styles.inlineBadge}`}
                      >
                        Hallucination
                      </span>
                    )}
                  </div>
                  {transcriptLong ? (
                    <button
                      type="button"
                      className={styles.transcriptToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMessageBodyExpanded(item.id);
                      }}
                    >
                      {bodyExpanded ? "Less" : "More"}
                    </button>
                  ) : null}
                  {/* TO-DO FiX this -- Show re-transcribe button only for failed jobs (.....) as the left-most action */}
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
                      className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.success}`}
                      title="Re-transcribe"
                      disabled={!!retranscribeLoading[item.id]}
                    >
                      {retranscribeLoading[item.id] ? (
                        <>
                          <span className={`${msgActionIcon} spin`}>
                            progress_activity
                          </span>
                          {isMobile ? "Trans..." : "Transcribing..."}
                        </>
                      ) : (
                        <>
                          <span className={`${msgActionIcon}`}>transcribe</span>
                          {isMobile ? "Re-trans" : "Re-transcribe"}
                        </>
                      )}
                    </button>
                  )}
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
                className={`${buttonStyles.button} ${buttonStyles.icon} ${expandedPlayer === item.id ? buttonStyles.primary : buttonStyles.secondary}`}
              >
                <span className={`${msgActionIcon}`}>
                  {activeTrack?.ownerId === `inbox:${item.id}` && audioStatus === 'playing' ? "pause_circle" : "play_circle"}
                </span>
              </button>
            )}
          </div>
          
          {/* Expanded mobile actions */}
          {expandedMobileActions === item.id && !isMultiSelectMode && (
            <div className={`rowWrap ${styles.mobileActions}`}>
              {canPlayAudio && item.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAudio(item.url, `audio_${item.id}.mp3`, item.id);
                  }}
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary}`}
                >
                  <span className={`${msgActionIcon}`}>download_2</span>
                  Download
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagDropdown(showTagDropdown === item.id ? null : item.id);
                  setSelectedTag('');
                }}
                className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary}`}
              >
                <span className={`${msgActionIcon}`}>new_label</span>
                Tag
              </button>
              {canAccessAdvancedPlayer && item.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToAdvancedPlayer(item);
                  }}
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary}`}
                >
                  <span className={`${msgActionIcon}`}>tune</span>
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
                  className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.danger}`}
                >
                  {deletingIds.has(item.id) ? (
                    <span className={`${msgActionIcon} spin`}>progress_activity</span>
                  ) : (
                    <span className={`${msgActionIcon}`}>delete_forever</span>
                  )}
                  Delete
                </button>
              )}
            </div>
          )}
          
          {/* Tag dropdown for mobile */}
          {showTagDropdown === item.id && expandedMobileActions === item.id && (
            <div className={styles.tagPanel}>
              <div className="rowWrap">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      addTagToMessage(item.id, tag);
                      setShowTagDropdown(null);
                    }}
                    className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.secondary}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Audio Player for mobile - full width */}
          {expandedPlayer === item.id && item.url && canPlayAudio && (
            <div className={styles.inlinePlayer}>
              <SharedInlineAudioPlayer
                ownerId={`inbox:${item.id}`}
                src={item.url}
                autoPlay
                stopOnUnmount
                showWaveform
                showTransport
                timestamp={item.time}
                formatTimestamp={formatTimestampWithMillis}
                onClose={() => togglePlayerExpand(item.id)}
              />
            </div>
          )}
        </>
      ) : (
        <>
          {isMultiSelectMode && (
            <div className={styles.desktopSelection}>
              <div
                className={`${styles.selectionBox} ${selectedMessages.has(item.id) ? styles.selectionBoxSelected : ""}`}
              >
                {selectedMessages.has(item.id) && (
                  <span className={`material-symbols-outlined ${styles.selectionCheck}`}>check</span>
                )}
              </div>
            </div>
          )}

          <div className={styles.desktopContent}>
            <div className={styles.headerRow}>
              {feedLeftColumn}
              <div className={styles.bodyRow}>
                <div
                  className={`${styles.transcript} ${styles.transcriptDesktop} ${bodyExpanded || !transcriptLong ? "" : styles.clampOne} ${canPlayAudio && item.url ? styles.clickable : ""}`}
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
                      className="pill pillDanger"
                    >
                      ....
                    </span>
                  ) : item.status === "queued" ? (
                    <span
                      className="pill pillWarning"
                    >
                      queued
                    </span>
                  ) : showProcessingSpinner ? (
                    processingIndicator
                  ) : (
                    <span
                      className="pill pillWarning"
                    >
                      No transcription available
                    </span>
                  )}

                  {regex && (
                    <span
                      className={`pill pillAccent ${styles.inlineBadge}`}
                    >
                      Hallucination
                    </span>
                  )}
                </div>
                {transcriptLong ? (
                  <button
                    type="button"
                    className={styles.transcriptToggle}
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
          <div className={styles.inlinePlayer}>
            <SharedInlineAudioPlayer
              ownerId={`inbox:${item.id}`}
              src={item.url}
              autoPlay
              stopOnUnmount
              showWaveform
              showTransport
              timestamp={item.time}
              formatTimestamp={formatTimestampWithMillis}
              onClose={() => togglePlayerExpand(item.id)}
            />
          </div>
        )}

        {/* Existing tags — only when expanded or short message keeps the bar one line */}
        {showTagsRow ? (
        <div className={`rowWrap ${styles.tagsRow}`}>
          <div className="rowWrap">
              {(tagsByMessage[item.id] || []).map((t) => (
                <span
                  key={t}
                  className="pill"
                >
                  {t}
                  {!isMultiSelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTagFromMessage(item.id, t);
                      }}
                      className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.ghost}`}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </span>
              ))}
          </div>
        </div>
        ) : null}

        {/* Per-message tag dropdown */}
        {!isMultiSelectMode && showTagDropdown === item.id && (
          <div className={`rowWrap ${styles.tagDropdown}`}>
            <select
              value={selectedTag}
              onChange={(e) => {
                const t = e.target.value;
                setSelectedTag(t);
                if (t) addTagToMessage(item.id, t);
              }}
              className={`${formStyles.select} ${formStyles.selectInline}`}
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
              className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.ghost}`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Per-message actions */}
      {!isMultiSelectMode && (
        <div
          className={`rowWrap ${isMobile ? "" : styles.desktopActions}`}
        >
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
              className={`${msgActionBtnBase} ${msgActionDim} ${buttonStyles.ghost}`}
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
              className={`${msgActionBtnBase} ${msgActionDim} ${buttonStyles.accent}`}
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
            className={`${msgActionBtnBase} ${msgActionDim} ${buttonStyles.accent}`}
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
              className={`${msgActionBtnBase} ${msgActionDim} ${buttonStyles.danger}`}
              disabled={deletingIds.has(item.id)}
            >
              {deletingIds.has(item.id) ? (
                <span className={`${msgActionIcon} ${msgActionFont} spin`}>progress_activity</span>
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
            <div className={styles.countBar}>
              <div className="row">
                <span>
                  Showing {messages.length} of {totalMessages} messages
                </span>
                {hasMoreMessages && (
                  <span className="pill pillAccent">
                    {totalMessages - messages.length} more available
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Loading indicator for infinite scroll - only show in continuous mode */}
          {inboxViewMode === 'continuous' && isLoadingMore && (
            <div className="centeredContent">
              <span className="material-symbols-outlined spin">
                progress_activity
              </span>
            </div>
          )}
          {inboxViewMode === 'continuous' && !hasMoreMessages && messages.length > 0 && (
            <div className={styles.allLoaded}>
              All messages loaded
            </div>
          )}
          <div ref={messagesEndRef} className={styles.scrollAnchor} />
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
          tagsByMessage={tagsByMessage}
        />
      )}

      {/* Floating scroll-to-newest button for all devices */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className={`${buttonStyles.button} ${buttonStyles.primary} ${newMessageCount > 0 ? buttonStyles.medium : buttonStyles.icon} ${styles.scrollNewest} ${!reverseSort ? styles.scrollNewestDown : ""}`}
          title={reverseSort ? "Scroll to newest messages (top)" : "Scroll to newest messages (bottom)"}
        >
          {newMessageCount > 0 ? (
            <div className="row">
              <MessageSquare size={18} />
              <span>{newMessageCount}</span>
              {reverseSort ? <ArrowUp size={18} /> : <ArrowUp size={18} />}
            </div>
          ) : (
            reverseSort ? <ArrowUp size={22} /> : <ArrowUp size={22} className={styles.arrowDown} />
          )}
        </button>
      )}

    </div>
  );
};

export default FullscreenMessages;
