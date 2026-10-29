import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, { API_BASE_URL } from "../utils/apiClient";
import { useAuth } from "./AuthContext";
import {
  DEFAULT_INBOX_TIME_FILTER,
  TIME_FILTERS,
  getPresetCutoffMs,
  getRecordingTimestampFromFilename,
} from "../utils/inboxViewWindow";
import {
  normalizeKeyword,
} from "../utils/inboxKeywords";

const InboxMessagesContext = createContext(null);
const InboxChannelsContext = createContext(null);
const InboxKeywordsContext = createContext(null);
const InboxFiltersContext = createContext(null);
const InboxPreferencesContext = createContext(null);
const InboxLayoutContext = createContext(null);
const InboxSelectionContext = createContext(null);
const InboxLiveContext = createContext(null);

const INBOX_ENDPOINT = "/recordings/inbox";
const CHANNELS_ENDPOINT = "/channels";
const DEFAULT_LIMIT = 100;
const POLL_LIMIT = 500;
const RETENTION_LIMIT = 150;
const POLL_INTERVAL_MS = 5000;

const EMPTY_MESSAGES = {
  byId: {},
  orderedIds: [],
  total: null,
};

const defaultInboxPreferences = {
  time_format: "24h",
  records_per_page: 20,
  sort_direction: "newest_first",
  show_full_timestamps: false,
  show_time: true,
  show_car: false,
  show_channel: true,
  show_person: false,
  show_duplicate_recordings: false,
  show_hallucinations: false,
};


const toUiMessage = (message) => ({
  ...message,
  channel: String(message.channel_id ?? message.channel ?? ""),
  team: message.team || `Channel ${message.channel_id ?? message.channel ?? ""}`,
  time: message.time || getRecordingTimestampFromFilename(message.filename, message.timestamp),
  message: message.message ?? message.transcription ?? "No transcription available",
  url: message.url ?? (message.filename ? `${API_BASE_URL}/${message.filename}` : null),
  isNew: message.isNew ?? true,
});

const normalizeBatch = (rows, onRow = null) => {
  const byId = {};
  const orderedIds = [];

  for (const row of rows) {
    onRow?.(row);
    const message = toUiMessage(row);
    const id = String(message.id);
    byId[id] = message;
    orderedIds.push(id);
  }

  return { byId, orderedIds };
};

const latestUpdatedAt = (rows, fallback = null) => {
  let latest = fallback;
  for (const row of rows) {
    const value = Number(row.updated_at);
    if (Number.isFinite(value) && (latest == null || value > latest)) latest = value;
  }
  return latest;
};

const buildParams = (filters, extra = {}) => {
  const params = {
    limit: filters.limit,
    sort_direction: filters.sortDirection,
    ...extra,
  };

  if (Array.isArray(filters.channelIds) && filters.channelIds.length) {
    params.channel_ids = filters.channelIds.join(",");
  }
  if (filters.startAt != null) params.start_at = filters.startAt;
  if (filters.endAt != null) params.end_at = filters.endAt;

  return params;
};

const localDateTimeToMs = (date, time, endOfDay = false) => {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;

  if (!time) {
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0,
    ).getTime();
  }

  const [hour = 0, minute = 0, second = 0] = time.split(":").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    endOfDay ? 999 : 0,
  ).getTime();
};

const readStoredActiveChannels = (channels) => {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("activeChannels"));
  } catch {
    localStorage.removeItem("activeChannels");
  }

  const ids = Object.keys(channels);
  const result = {};
  for (const id of ids) {
    result[id] = stored?.[id] !== false;
  }

  // When channels exist, the sidebar must always keep at least one selected.
  if (ids.length && !ids.some((id) => result[id])) {
    result[ids[0]] = true;
  }

  return result;
};

const selectedChannelFilter = (activeChannels) => {
  const ids = Object.keys(activeChannels);
  const selectedIds = ids
    .filter((id) => activeChannels[id] !== false)
    .map(Number)
    .filter(Number.isFinite);

  // Omit channel_ids when all known channels are selected. That keeps the
  // inbox open to recordings from channels created after the last refresh.
  return ids.length === 0 || selectedIds.length === ids.length
    ? null
    : selectedIds;
};

const getPrincipal = (user) => user?.user ?? user ?? null;

export const InboxProvider = ({ children }) => {
  const { user, updatePreferences } = useAuth();
  const principal = useMemo(() => getPrincipal(user), [user]);

  const principalPreferences = principal?.preferences || {};
  const preferences = useMemo(() => ({
    ...defaultInboxPreferences,
    ...(principalPreferences.inbox || {}),
  }), [principalPreferences.inbox]);


  const [messages, setMessages] = useState(EMPTY_MESSAGES);
  const [channels, setChannels] = useState({});
  const [activeChannels, setActiveChannels] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeKeywordIds, setActiveKeywordIds] = useState(() => new Set());

  const [timeFilter, setTimeFilter] = useState(DEFAULT_INBOX_TIME_FILTER);
  const [appliedCustomRange, setAppliedCustomRange] = useState({
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });

  const initialSortDirection = principalPreferences.inbox?.sort_direction || "newest_first";
  const initialRecordsPerPage = Number(principalPreferences.inbox?.records_per_page);
  const [filters, setFilters] = useState({
    channelIds: null,
    startAt: DEFAULT_INBOX_TIME_FILTER === TIME_FILTERS.ALL
      ? null
      : getPresetCutoffMs(DEFAULT_INBOX_TIME_FILTER),
    endAt: null,
    sortDirection: initialSortDirection,
    limit: initialRecordsPerPage > 0 ? Math.min(500, initialRecordsPerPage) : DEFAULT_LIMIT,
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [initialError, setInitialError] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [olderError, setOlderError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [continuousHistory, setContinuousHistory] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(() => new Set());
  const [isVolumeOn, setIsVolumeOn] = useState(() => {
    try {
      return localStorage.getItem("inboxLiveMode") === "true";
    } catch {
      return false;
    }
  });

  const mountedRef = useRef(true);
  const initialAbortRef = useRef(null);
  const olderAbortRef = useRef(null);
  const pollAbortRef = useRef(null);
  const olderCursorRef = useRef({ timestamp: null, id: null });
  const pollBoundaryRef = useRef(null);
  const pollRunningRef = useRef(false);
  const hasMoreRef = useRef(false);
  const filtersRef = useRef(filters);
  const channelsRef = useRef(channels);
  const channelRefreshRef = useRef(false);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);


  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("inboxLiveMode", String(isVolumeOn));
    } catch {
      // Browser storage is optional.
    }
  }, [isVolumeOn]);

  useEffect(() => {
    // React.StrictMode intentionally runs effect setup/cleanup/setup in
    // development. Reset this flag on every setup so the second setup is
    // considered mounted and inbox responses can initialize polling.
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      initialAbortRef.current?.abort();
      olderAbortRef.current?.abort();
      pollAbortRef.current?.abort();
    };
  }, []);

  const isMobile = windowWidth < 768;

  const messageList = useMemo(
    () => messages.orderedIds.map((id) => messages.byId[id]).filter(Boolean),
    [messages],
  );

  const keywords = useMemo(() => {
    const byId = new Map();
    for (const message of messageList) {
      for (const keyword of message.matched_keywords || []) {
        byId.set(String(keyword.id), normalizeKeyword(keyword));
      }
    }
    return [...byId.values()].sort((a, b) => a.pattern.localeCompare(b.pattern));
  }, [messageList]);

  useEffect(() => {
    const available = new Set(keywords.map((keyword) => String(keyword.id)));
    setActiveKeywordIds((previous) => {
      const next = new Set([...previous].filter((id) => available.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [keywords]);

  const inboxViewMode = Number(preferences.records_per_page) === 0
    ? "continuous"
    : "pagination";
  const recordsPerPage = Number(preferences.records_per_page) > 0
    ? Number(preferences.records_per_page)
    : 20;
  const reverseSort = filters.sortDirection === "newest_first";
  const timeFormat = preferences.time_format || "24h";
  const showFullTimestamps = preferences.show_full_timestamps === true;
  const showTime = preferences.show_time !== false;
  const showCar = preferences.show_car === true;
  const showChannel = preferences.show_channel !== false;
  const showPerson = preferences.show_person === true;
  const isAdmin = principal?.role === "admin";
  const showDuplicateRecordings = isAdmin && preferences.show_duplicate_recordings === true;
  const showHallucinations = isAdmin && preferences.show_hallucinations === true;

  const updatePreference = useCallback((key, value) => {
    if (!isAdmin && ["show_duplicate_recordings", "show_hallucinations"].includes(key)) {
      return Promise.resolve(false);
    }
    return updatePreferences("inbox", { [key]: value }).then(() => true).catch((error) => {
      console.error("Failed to save inbox preference:", error);
      return false;
    });
  }, [isAdmin, updatePreferences]);

  const updateNotifications = useCallback((data) => {
    setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
  }, []);

  const refreshChannels = useCallback(async () => {
    if (channelRefreshRef.current) return;
    channelRefreshRef.current = true;

    try {
      const response = await api.get(CHANNELS_ENDPOINT);
      const rows = Array.isArray(response.data) ? response.data : [];
      const nextChannels = {};
      for (const channel of rows) {
        if (channel.status !== "disabled") {
          nextChannels[String(channel.id)] = { ...channel, isActive: true };
        }
      }

      if (!mountedRef.current) return;

      channelsRef.current = nextChannels;
      setChannels(nextChannels);
      setActiveChannels((previous) => {
        const next = {};
        for (const id of Object.keys(nextChannels)) {
          // Preserve existing choices; newly discovered channels start selected.
          next[id] = Object.prototype.hasOwnProperty.call(previous, id)
            ? previous[id] !== false
            : true;
        }

        const ids = Object.keys(next);
        if (ids.length && !ids.some((id) => next[id])) {
          next[ids[0]] = true;
        }

        try {
          localStorage.setItem("activeChannels", JSON.stringify(next));
        } catch {
          // Browser storage is optional.
        }

        return next;
      });
    } catch (error) {
      console.error("Failed to refresh inbox channels:", error);
    } finally {
      channelRefreshRef.current = false;
    }
  }, []);

  const checkRecordingChannel = useCallback((row) => {
    const channelId = String(row?.channel_id ?? row?.channel ?? "");
    if (channelId && !channelsRef.current[channelId]) {
      void refreshChannels();
    }
  }, [refreshChannels]);

  const replaceMessages = useCallback((rows, meta) => {
    const normalized = normalizeBatch(rows, checkRecordingChannel);
    const orderedIds = normalized.orderedIds.slice(0, RETENTION_LIMIT);
    const byId = {};
    for (const id of orderedIds) byId[id] = normalized.byId[id];

    setMessages({
      byId,
      orderedIds,
      total: Number.isFinite(Number(meta?.total)) ? Number(meta.total) : 0,
    });

    const more = meta?.has_more === true;
    setHasMore(more);
    hasMoreRef.current = more;
    olderCursorRef.current = {
      timestamp: meta?.next_before_timestamp ?? null,
      id: meta?.next_before_id ?? null,
    };
    pollBoundaryRef.current = latestUpdatedAt(rows, null) ?? Date.now();
  }, [checkRecordingChannel]);

  const runReplacement = useCallback(async (nextFilters) => {
    initialAbortRef.current?.abort();
    const controller = new AbortController();
    initialAbortRef.current = controller;

    setInitialLoading(true);
    setInitialError(null);
    setPollError(null);
    setOlderError(null);
    setContinuousHistory(false);
    setCurrentPage(1);
    setMessages(EMPTY_MESSAGES);

    try {
      const response = await api.get(INBOX_ENDPOINT, {
        params: buildParams(nextFilters),
        signal: controller.signal,
      });
      if (!mountedRef.current) return;
      const rows = Array.isArray(response.data?.messages) ? response.data.messages : [];
      updateNotifications(response.data);
      replaceMessages(rows, response.data?.meta || {});
    } catch (error) {
      if (error?.cause?.name === "AbortError" || error?.name === "CanceledError") return;
      if (mountedRef.current) setInitialError(error.message || "Failed to load inbox");
    } finally {
      if (mountedRef.current && initialAbortRef.current === controller) {
        setInitialLoading(false);
      }
    }
  }, [replaceMessages, updateNotifications]);

  const bootstrap = useCallback(async () => {
    initialAbortRef.current?.abort();
    const controller = new AbortController();
    initialAbortRef.current = controller;

    setInitialLoading(true);
    setInitialError(null);

    let nextFilters = filtersRef.current;

    try {
      const channelResponse = await api.get(CHANNELS_ENDPOINT, { signal: controller.signal });
      const rows = Array.isArray(channelResponse.data) ? channelResponse.data : [];
      const nextChannels = {};
      for (const channel of rows) {
        if (channel.status !== "disabled") {
          nextChannels[String(channel.id)] = { ...channel, isActive: true };
        }
      }

      if (!mountedRef.current) return;

      const nextActiveChannels = readStoredActiveChannels(nextChannels);
      channelsRef.current = nextChannels;
      setChannels(nextChannels);
      setActiveChannels(nextActiveChannels);

      nextFilters = {
        ...filtersRef.current,
        channelIds: selectedChannelFilter(nextActiveChannels),
      };
      setFilters(nextFilters);
      filtersRef.current = nextFilters;
    } catch (error) {
      if (error?.cause?.name === "AbortError" || error?.name === "CanceledError") return;
      // Channel metadata should not prevent the inbox itself from loading.
      console.error("Failed to load inbox channels:", error);
    }

    try {
      const inboxResponse = await api.get(INBOX_ENDPOINT, {
        params: buildParams(nextFilters),
        signal: controller.signal,
      });
      const inboxRows = Array.isArray(inboxResponse.data?.messages)
        ? inboxResponse.data.messages
        : [];
      if (mountedRef.current) {
        updateNotifications(inboxResponse.data);
        replaceMessages(inboxRows, inboxResponse.data?.meta || {});
      }
    } catch (error) {
      if (error?.cause?.name === "AbortError" || error?.name === "CanceledError") return;
      if (mountedRef.current) setInitialError(error.message || "Failed to load inbox");
    } finally {
      if (mountedRef.current && initialAbortRef.current === controller) {
        setInitialLoading(false);
      }
    }
  }, [replaceMessages]);

  useEffect(() => {
    if (!principal) {
      setMessages(EMPTY_MESSAGES);
      setChannels({});
      setActiveChannels({});
      setNotifications([]);
      setInitialLoading(false);
      return;
    }
    void bootstrap();
  }, [principal?.id, bootstrap]);

  const applyFilters = useCallback((updates) => {
    const next = { ...filtersRef.current, ...updates };
    filtersRef.current = next;
    setFilters(next);
    void runReplacement(next);
  }, [runReplacement]);

  const applyTimeView = useCallback((nextView) => {
    const nextTimeFilter = nextView.timeFilter || TIME_FILTERS.ALL;
    let startAt = null;
    let endAt = null;

    if (nextTimeFilter === TIME_FILTERS.CUSTOM) {
      startAt = localDateTimeToMs(nextView.startDate, nextView.startTime, false);
      endAt = localDateTimeToMs(nextView.endDate, nextView.endTime, true);
      if (startAt == null || endAt == null || startAt > endAt) return false;
      setAppliedCustomRange({
        startDate: nextView.startDate || "",
        startTime: nextView.startTime || "",
        endDate: nextView.endDate || "",
        endTime: nextView.endTime || "",
      });
    } else if (nextTimeFilter !== TIME_FILTERS.ALL) {
      startAt = getPresetCutoffMs(nextTimeFilter);
      setAppliedCustomRange({ startDate: "", startTime: "", endDate: "", endTime: "" });
    } else {
      setAppliedCustomRange({ startDate: "", startTime: "", endDate: "", endTime: "" });
    }

    setTimeFilter(nextTimeFilter);
    applyFilters({ startAt, endAt });
    return true;
  }, [applyFilters]);

  const toggleChannel = useCallback((channelId) => {
    const id = String(channelId);
    setActiveChannels((previous) => {
      const currentlySelected = previous[id] !== false;

      // Keep at least one channel selected in the sidebar.
      if (currentlySelected) {
        const selectedCount = Object.keys(previous)
          .filter((candidate) => previous[candidate] !== false)
          .length;
        if (selectedCount <= 1) return previous;
      }

      const next = { ...previous, [id]: !currentlySelected };
      try {
        localStorage.setItem("activeChannels", JSON.stringify(next));
      } catch {
        // Browser storage is optional.
      }

      applyFilters({ channelIds: selectedChannelFilter(next) });
      return next;
    });
  }, [applyFilters]);

  const replaceChannel = useCallback((channelId, updates) => {
    const id = String(channelId);
    setChannels((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...updates },
    }));
  }, []);

  const toggleKeyword = useCallback((keywordId) => {
    const id = String(keywordId);
    setActiveKeywordIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setCurrentPage(1);
  }, []);

  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return messageList.filter((message) => {
      const text = String(message.message ?? "");
      if (query && !text.toLowerCase().includes(query)) return false;
      if (activeKeywordIds.size && !(message.matched_keywords || []).some(
        (keyword) => activeKeywordIds.has(String(keyword.id))
      )) return false;
      return true;
    });
  }, [activeKeywordIds, messageList, searchQuery]);

  const keywordCounts = useMemo(() => {
    const counts = {};
    for (const message of messageList) {
      for (const keyword of message.matched_keywords || []) {
        const id = String(keyword.id);
        counts[id] = (counts[id] || 0) + keyword.count;
      }
    }
    return counts;
  }, [messageList]);

  const channelMessageCounts = useMemo(() => {
    const counts = {};
    for (const message of messageList) {
      const id = String(message.channel);
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [messageList]);

  const displayMessages = useMemo(() => {
    if (inboxViewMode === "continuous") return visibleMessages;
    const start = (currentPage - 1) * recordsPerPage;
    return visibleMessages.slice(start, start + recordsPerPage);
  }, [currentPage, inboxViewMode, recordsPerPage, visibleMessages]);

  const browserFilterActive = searchQuery.trim() !== "" || activeKeywordIds.size > 0;
  const displayTotal = browserFilterActive
    ? visibleMessages.length
    : (Number.isFinite(Number(messages.total)) ? Number(messages.total) : visibleMessages.length);

  const loadOlder = useCallback(async () => {
    const cursor = olderCursorRef.current;
    if (
      olderLoading ||
      !hasMoreRef.current ||
      cursor.timestamp == null ||
      cursor.id == null
    ) {
      return false;
    }

    olderAbortRef.current?.abort();
    const controller = new AbortController();
    olderAbortRef.current = controller;
    setOlderLoading(true);
    setOlderError(null);

    try {
      const response = await api.get(INBOX_ENDPOINT, {
        params: buildParams(filtersRef.current, {
          before_timestamp: cursor.timestamp,
          before_id: cursor.id,
        }),
        signal: controller.signal,
      });

      const rows = Array.isArray(response.data?.messages) ? response.data.messages : [];
      const normalized = normalizeBatch(rows, checkRecordingChannel);

      setMessages((previous) => {
        const byId = { ...previous.byId, ...normalized.byId };
        const seen = new Set(previous.orderedIds);
        const appended = normalized.orderedIds.filter((id) => !seen.has(id));
        let orderedIds = [...previous.orderedIds, ...appended];

        if (orderedIds.length > RETENTION_LIMIT) {
          let evicted;
          if (filtersRef.current.sortDirection === "newest_first") {
            evicted = orderedIds.slice(RETENTION_LIMIT);
            orderedIds = orderedIds.slice(0, RETENTION_LIMIT);
          } else {
            const trim = orderedIds.length - RETENTION_LIMIT;
            evicted = orderedIds.slice(0, trim);
            orderedIds = orderedIds.slice(trim);
          }
          for (const id of evicted) delete byId[id];
        }

        return {
          byId,
          orderedIds,
          total: Number.isFinite(Number(response.data?.meta?.total))
            ? Number(response.data.meta.total)
            : previous.total,
        };
      });

      const more = response.data?.meta?.has_more === true;
      setHasMore(more);
      hasMoreRef.current = more;
      olderCursorRef.current = {
        timestamp: response.data?.meta?.next_before_timestamp ?? null,
        id: response.data?.meta?.next_before_id ?? null,
      };
      if (inboxViewMode === "continuous") setContinuousHistory(true);
      return rows.length > 0;
    } catch (error) {
      if (error?.cause?.name === "AbortError" || error?.name === "CanceledError") return false;
      if (mountedRef.current) setOlderError(error.message || "Failed to load older messages");
      return false;
    } finally {
      if (mountedRef.current && olderAbortRef.current === controller) {
        setOlderLoading(false);
      }
    }
  }, [checkRecordingChannel, inboxViewMode, olderLoading]);

  const mergePollRows = useCallback((rows, meta, removedIds = []) => {
    const total = Number(meta?.total);
    const removed = new Set(removedIds.map(String));
    if (removed.size) {
      setSelectedMessages((previous) => new Set(
        [...previous].filter((id) => !removed.has(String(id))),
      ));
    }

    if (!rows.length && !removed.size) {
      if (Number.isFinite(total)) {
        setMessages((previous) => total === previous.total ? previous : { ...previous, total });
      }
      return;
    }

    setMessages((previous) => {
      const byId = { ...previous.byId };
      const newIds = [];
      for (const id of removed) delete byId[id];
      const retainedIds = previous.orderedIds.filter((id) => !removed.has(id));

      for (const row of rows) {
        checkRecordingChannel(row);
        const incoming = toUiMessage(row);
        const id = String(incoming.id);
        if (removed.has(id)) continue;
        const existing = byId[id];

        if (existing) {
          if ((Number(incoming.updated_at) || 0) >= (Number(existing.updated_at) || 0)) {
            byId[id] = incoming;
          }
          continue;
        }

        byId[id] = incoming;
        newIds.push(id);
      }

      let orderedIds = filtersRef.current.sortDirection === "newest_first"
        ? [...newIds.reverse(), ...retainedIds]
        : [...retainedIds, ...newIds];

      if (orderedIds.length > RETENTION_LIMIT) {
        let evicted;
        if (filtersRef.current.sortDirection === "newest_first") {
          evicted = orderedIds.slice(RETENTION_LIMIT);
          orderedIds = orderedIds.slice(0, RETENTION_LIMIT);
        } else {
          const trim = orderedIds.length - RETENTION_LIMIT;
          evicted = orderedIds.slice(0, trim);
          orderedIds = orderedIds.slice(trim);
        }
        for (const id of evicted) delete byId[id];
      }

      return {
        byId,
        orderedIds,
        total: Number.isFinite(total) ? total : previous.total,
      };
    });
  }, [checkRecordingChannel]);

  const pollingAllowed =
    principal &&
    filters.endAt == null &&
    (inboxViewMode === "pagination" ? currentPage === 1 : !continuousHistory);

  const poll = useCallback(async () => {
    if (!pollingAllowed || pollRunningRef.current || pollBoundaryRef.current == null) return;

    pollRunningRef.current = true;
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    setPollError(null);

    const boundary = pollBoundaryRef.current;
    let offset = 0;
    let newestBoundary = boundary;

    try {
      while (true) {
        const response = await api.get(INBOX_ENDPOINT, {
          params: buildParams(
            { ...filtersRef.current, limit: POLL_LIMIT, endAt: null },
            { updated_since: boundary, offset },
          ),
          signal: controller.signal,
        });
        const rows = Array.isArray(response.data?.messages) ? response.data.messages : [];
        const removedIds = Array.isArray(response.data?.removed_ids) ? response.data.removed_ids : [];
        if (offset === 0) updateNotifications(response.data);
        mergePollRows(rows, response.data?.meta || {}, removedIds);
        newestBoundary = latestUpdatedAt(rows, newestBoundary);
        const pageBoundary = Number(response.data?.meta?.latest_updated_at);
        if (Number.isFinite(pageBoundary)) newestBoundary = Math.max(newestBoundary, pageBoundary);

        const nextOffset = response.data?.meta?.next_offset;
        if (response.data?.meta?.has_more !== true || nextOffset == null) break;
        offset = nextOffset;
      }
      pollBoundaryRef.current = newestBoundary ?? Date.now();
    } catch (error) {
      if (error?.cause?.name !== "AbortError" && error?.name !== "CanceledError" && mountedRef.current) {
        setPollError(error.message || "Inbox update failed");
      }
    } finally {
      pollRunningRef.current = false;
    }
  }, [mergePollRows, pollingAllowed, updateNotifications]);

  useEffect(() => {
    if (!pollingAllowed) return undefined;
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      pollAbortRef.current?.abort();
    };
  }, [poll, pollingAllowed]);

  const patchMessage = useCallback((messageId, updates) => {
    const id = String(messageId);
    setMessages((previous) => {
      const existing = previous.byId[id];
      if (!existing) return previous;
      const next = { ...existing, ...updates };
      if (Object.prototype.hasOwnProperty.call(updates, "transcription") && !Object.prototype.hasOwnProperty.call(updates, "message")) {
        next.message = updates.transcription || "No transcription available";
      }
      return {
        ...previous,
        byId: { ...previous.byId, [id]: next },
      };
    });
  }, []);

  const replaceMessage = useCallback((message) => {
    if (message?.id == null) return;
    const normalized = toUiMessage(message);
    const id = String(normalized.id);
    setMessages((previous) => previous.byId[id] ? {
      ...previous,
      byId: { ...previous.byId, [id]: normalized },
    } : previous);
  }, []);

  const removeMessages = useCallback((messageIds) => {
    const ids = new Set([...messageIds].map(String));
    if (!ids.size) return;
    setMessages((previous) => {
      const byId = { ...previous.byId };
      let removed = 0;
      for (const id of ids) {
        if (byId[id]) {
          delete byId[id];
          removed += 1;
        }
      }
      return {
        byId,
        orderedIds: previous.orderedIds.filter((id) => !ids.has(id)),
        total: previous.total == null ? null : Math.max(0, previous.total - removed),
      };
    });
  }, []);

  const removeMessage = useCallback((messageId) => {
    removeMessages([messageId]);
  }, [removeMessages]);

  const removeNotification = useCallback((notificationId) => {
    setNotifications((previous) =>
      previous.filter((notification) => notification.id !== notificationId)
    );
  }, []);


  const toggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode((previous) => !previous);
    setSelectedMessages(new Set());
  }, []);

  const setInboxViewMode = useCallback((mode) => {
    const nextRecords = mode === "continuous" ? 0 : (recordsPerPage || 20);
    updatePreference("records_per_page", nextRecords);
    setCurrentPage(1);
    setContinuousHistory(false);
  }, [recordsPerPage, updatePreference]);

  const setRecordsPerPage = useCallback((value) => {
    const next = Math.max(1, Math.min(500, Number(value) || 20));
    updatePreference("records_per_page", next);
    setCurrentPage(1);
    applyFilters({ limit: next });
  }, [applyFilters, updatePreference]);

  const setReverseSort = useCallback((newestFirst) => {
    const sortDirection = newestFirst ? "newest_first" : "oldest_first";
    updatePreference("sort_direction", sortDirection);
    applyFilters({ sortDirection });
  }, [applyFilters, updatePreference]);

  const totalPages = Math.max(1, Math.ceil(displayTotal / recordsPerPage));

  const goToPage = useCallback(async (requestedPage) => {
    const target = Math.max(1, Number(requestedPage) || 1);
    const needed = target * recordsPerPage;

    if (
      !browserFilterActive &&
      visibleMessages.length < needed &&
      hasMoreRef.current
    ) {
      await loadOlder();
    }

    setCurrentPage(target);
  }, [browserFilterActive, loadOlder, recordsPerPage, visibleMessages.length]);

  const refresh = useCallback(() => {
    void runReplacement(filtersRef.current);
  }, [runReplacement]);

  const messagesValue = useMemo(() => ({
    messages,
    messageList,
    visibleMessages,
    displayMessages,
    displayTotal,
    initialLoading,
    olderLoading,
    initialError,
    pollError,
    olderError,
    hasMore,
    loadOlder,
    refresh,
    patchMessage,
    replaceMessage,
    removeMessage,
    removeMessages,
  }), [
    displayMessages,
    displayTotal,
    hasMore,
    initialError,
    initialLoading,
    loadOlder,
    messageList,
    messages,
    olderError,
    olderLoading,
    patchMessage,
    pollError,
    refresh,
    removeMessage,
    removeMessages,
    replaceMessage,
    visibleMessages,
  ]);

  const channelsValue = useMemo(() => ({
    channels,
    activeChannels,
    channelMessageCounts,
    toggleChannel,
    replaceChannel,
  }), [activeChannels, channelMessageCounts, channels, replaceChannel, toggleChannel]);

  const keywordsValue = useMemo(() => ({
    keywords,
    activeKeywordIds,
    keywordCounts,
    toggleKeyword,
    searchQuery,
    setSearchQuery,
  }), [activeKeywordIds, keywordCounts, keywords, searchQuery, toggleKeyword]);

  const filtersValue = useMemo(() => ({
    filters,
    timeFilter,
    appliedCustomRange,
    applyTimeView,
    applyFilters,
  }), [appliedCustomRange, applyFilters, applyTimeView, filters, timeFilter]);

  const preferencesValue = useMemo(() => ({
    principal,
    preferences,
    timeFormat,
    showFullTimestamps,
    showTime,
    showCar,
    showChannel,
    showPerson,
    showDuplicateRecordings,
    showHallucinations,
    updatePreference,
    inboxViewMode,
    setInboxViewMode,
    recordsPerPage,
    setRecordsPerPage,
    reverseSort,
    setReverseSort,
    currentPage,
    setCurrentPage,
    goToPage,
    totalPages,
  }), [
    currentPage,
    goToPage,
    inboxViewMode,
    preferences,
    principal,
    recordsPerPage,
    reverseSort,
    setInboxViewMode,
    setRecordsPerPage,
    setReverseSort,
    showCar,
    showChannel,
    showFullTimestamps,
    showDuplicateRecordings,
    showHallucinations,
    showPerson,
    showTime,
    timeFormat,
    totalPages,
    updatePreference,
  ]);

  const layoutValue = useMemo(() => ({
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    isFullscreen,
    setIsFullscreen,
  }), [isFullscreen, isMobile, isSidebarOpen]);

  const selectionValue = useMemo(() => ({
    isMultiSelectMode,
    setIsMultiSelectMode,
    toggleMultiSelectMode,
    selectedMessages,
    setSelectedMessages,
  }), [isMultiSelectMode, selectedMessages, toggleMultiSelectMode]);

  const liveValue = useMemo(() => ({
    isVolumeOn,
    setIsVolumeOn,
    notifications,
    removeNotification,
  }), [isVolumeOn, notifications, removeNotification]);

  return (
    <InboxMessagesContext.Provider value={messagesValue}>
      <InboxChannelsContext.Provider value={channelsValue}>
        <InboxKeywordsContext.Provider value={keywordsValue}>
          <InboxFiltersContext.Provider value={filtersValue}>
            <InboxPreferencesContext.Provider value={preferencesValue}>
              <InboxLayoutContext.Provider value={layoutValue}>
                <InboxSelectionContext.Provider value={selectionValue}>
                  <InboxLiveContext.Provider value={liveValue}>
                    {children}
                  </InboxLiveContext.Provider>
                </InboxSelectionContext.Provider>
              </InboxLayoutContext.Provider>
            </InboxPreferencesContext.Provider>
          </InboxFiltersContext.Provider>
        </InboxKeywordsContext.Provider>
      </InboxChannelsContext.Provider>
    </InboxMessagesContext.Provider>
  );
};

const useRequiredContext = (context, name) => {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used within an InboxProvider`);
  return value;
};

export const useInboxMessages = () => useRequiredContext(InboxMessagesContext, 'useInboxMessages');
export const useInboxChannels = () => useRequiredContext(InboxChannelsContext, 'useInboxChannels');
export const useInboxKeywords = () => useRequiredContext(InboxKeywordsContext, 'useInboxKeywords');
export const useInboxFilters = () => useRequiredContext(InboxFiltersContext, 'useInboxFilters');
export const useInboxPreferences = () => useRequiredContext(InboxPreferencesContext, 'useInboxPreferences');
export const useInboxLayout = () => useRequiredContext(InboxLayoutContext, 'useInboxLayout');
export const useInboxSelection = () => useRequiredContext(InboxSelectionContext, 'useInboxSelection');
export const useInboxLive = () => useRequiredContext(InboxLiveContext, 'useInboxLive');

