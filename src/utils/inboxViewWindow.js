/**
 * Inbox view time presets (TopBar + LiveCommunications + cache).
 * Default: last 7 days. "Custom" uses from/to date + optional time (local).
 */
export const TIME_FILTERS = {
  HR1: 'Last 1 hr',
  DAY1: 'Last 1 day',
  DAYS7: 'Last 7 days',
  DAYS30: 'Last 30 days',
  MONTHS6: 'Last 6 months',
  MONTHS12: 'Last 12 months',
  ALL: 'All',
  CUSTOM: 'Custom',
};

export const DEFAULT_INBOX_TIME_FILTER = TIME_FILTERS.DAYS7;

/** @deprecated use TIME_FILTERS.CUSTOM */
export const INBOX_TIME_CUSTOM_SENTINEL = TIME_FILTERS.CUSTOM;

export const INBOX_TIME_RANGE_DROPDOWN_ORDER = [
  TIME_FILTERS.HR1,
  TIME_FILTERS.DAY1,
  TIME_FILTERS.DAYS7,
  TIME_FILTERS.DAYS30,
  TIME_FILTERS.MONTHS6,
  TIME_FILTERS.MONTHS12,
  TIME_FILTERS.ALL,
  TIME_FILTERS.CUSTOM,
];

const LS_TIME_FILTER = 'timeFilter';

/** Map legacy / old labels to current preset strings. */
const LEGACY_TIME_FILTER_TO_CANONICAL = {
  'Last 1 Day': TIME_FILTERS.DAY1,
  'Last 24 hours': TIME_FILTERS.DAY1,
  'Last Week': TIME_FILTERS.DAYS7,
  'Last 7 day': TIME_FILTERS.DAYS7,
  'Last 2 days': TIME_FILTERS.DAYS7,
  'Last 2 Days': TIME_FILTERS.DAYS7,
  'Last 30 mins': TIME_FILTERS.HR1,
  'Last 1 hour': TIME_FILTERS.HR1,
  'Last 2 hours': TIME_FILTERS.HR1,
  'Last 4 hours': TIME_FILTERS.HR1,
  'Last 8 hours': TIME_FILTERS.DAY1,
  'Last 30 days': TIME_FILTERS.DAYS30,
  'Last 1 hr': TIME_FILTERS.HR1,
  'Last 1 day': TIME_FILTERS.DAY1,
  __custom__: TIME_FILTERS.CUSTOM,
};

const ALL_CANONICAL = new Set(Object.values(TIME_FILTERS));

export const INBOX_CUSTOM_DATE_STORAGE_KEYS = {
  startDate: 'inbox_startDate',
  endDate: 'inbox_endDate',
  startTime: 'inbox_startTime',
  endTime: 'inbox_endTime',
};

export function normalizeStoredTimeFilter(stored) {
  if (!stored) return DEFAULT_INBOX_TIME_FILTER;
  if (Object.prototype.hasOwnProperty.call(LEGACY_TIME_FILTER_TO_CANONICAL, stored)) {
    const canon = LEGACY_TIME_FILTER_TO_CANONICAL[stored];
    try {
      if (localStorage.getItem(LS_TIME_FILTER) === stored) {
        localStorage.setItem(LS_TIME_FILTER, canon);
      }
    } catch {
      /* ignore */
    }
    return canon;
  }
  if (ALL_CANONICAL.has(stored)) return stored;
  return DEFAULT_INBOX_TIME_FILTER;
}

/** Rolling cutoff (ms); null = no cutoff (all). Custom uses date fields, not this. */
export function getPresetCutoffMs(timeFilter) {
  if (!timeFilter || timeFilter === TIME_FILTERS.ALL || timeFilter === TIME_FILTERS.CUSTOM) {
    return null;
  }
  const now = Date.now();
  switch (timeFilter) {
    case TIME_FILTERS.HR1:
      return now - 60 * 60 * 1000;
    case TIME_FILTERS.DAY1:
      return now - 24 * 60 * 60 * 1000;
    case TIME_FILTERS.DAYS7:
      return now - 7 * 24 * 60 * 60 * 1000;
    case TIME_FILTERS.DAYS30:
      return now - 30 * 24 * 60 * 60 * 1000;
    case TIME_FILTERS.MONTHS6: {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d.getTime();
    }
    case TIME_FILTERS.MONTHS12: {
      const d = new Date();
      d.setMonth(d.getMonth() - 12);
      return d.getTime();
    }
    default:
      return null;
  }
}

export function getMessageTimeMs(message) {
  const raw = message?.time ?? message?.timestamp;
  if (raw == null) return 0;
  const s = String(raw);
  if (s.length >= 15 && /^\d{8}_\d{2}/.test(s)) {
    const year = parseInt(s.substring(0, 4), 10);
    const month = parseInt(s.substring(4, 6), 10) - 1;
    const day = parseInt(s.substring(6, 8), 10);
    const hours = parseInt(s.substring(9, 11), 10);
    const minutes = parseInt(s.substring(11, 13), 10);
    const seconds = parseInt(s.substring(13, 15), 10);
    return Date.UTC(year, month, day, hours, minutes, seconds);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Extract the recording's UTC date/time from its filename and return the
 * compact timestamp format used by the dashboard (YYYYMMDD_HHMMSS).
 *
 * Recorders currently produce either `YYYY-MM-DD-HH-MM-SS.wav` or legacy
 * names such as `audio_YYYYMMDD_HHMMSS.wav`. Invalid or unrecognized names
 * return null rather than producing a misleading dashboard date.
 */
export function getRecordingTimestampFromFilename(filename, timestamp) {
  if (!filename) return timestamp;

  const basename = String(filename).replace(/\\/g, '/').split('/').pop().split(/[?#]/)[0];
  const stem = basename.replace(/\.[^.]+$/, '');
  const dashedParts = stem.split('-');
  let dateTimeParts;

  if (dashedParts.length === 6) {
    dateTimeParts = dashedParts;
  } else {
    dateTimeParts = [
      stem.slice(-15, -11),
      stem.slice(-11, -9),
      stem.slice(-9, -7),
      stem.slice(-6, -4),
      stem.slice(-4, -2),
      stem.slice(-2),
    ];
  }

  const [y, m, d, h, min, s] = dateTimeParts.map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d, h, min, s));
  const isValid =
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d &&
    parsed.getUTCHours() === h &&
    parsed.getUTCMinutes() === min &&
    parsed.getUTCSeconds() === s;

  if (isValid) {
    return `${dateTimeParts[0]}${dateTimeParts[1]}${dateTimeParts[2]}_${dateTimeParts[3]}${dateTimeParts[4]}${dateTimeParts[5]}`;
  } else {
    // console.error('Time invalid from filename: ' + filename);
    // console.log(parsed);
    return timestamp;
  }
}

function localDateToUtcMs(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timeStr
    ? timeStr.split(':').map(Number)
    : [0, 0, 0];
  return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
}

export function readInboxViewWindowPrefs() {
  try {
    const raw = localStorage.getItem(LS_TIME_FILTER);
    const timeFilter = normalizeStoredTimeFilter(raw);
    return {
      timeFilter,
      startDate: localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startDate) || '',
      endDate: localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endDate) || '',
      startTime: localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.startTime) || '',
      endTime: localStorage.getItem(INBOX_CUSTOM_DATE_STORAGE_KEYS.endTime) || '',
    };
  } catch {
    return {
      timeFilter: DEFAULT_INBOX_TIME_FILTER,
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
    };
  }
}

export function filterMessagesToInboxViewWindow(messages, prefs) {
  if (!Array.isArray(messages) || messages.length === 0) return messages || [];
  const { timeFilter, startDate, endDate, startTime, endTime } = prefs;

  if (timeFilter === TIME_FILTERS.CUSTOM && startDate && endDate) {
    let startMs;
    if (startTime) startMs = localDateToUtcMs(startDate, startTime);
    else startMs = localDateToUtcMs(startDate, '00:00:00');

    let endMs;
    if (endTime) {
      const [hours, minutes] = endTime.split(':').map(Number);
      endMs = localDateToUtcMs(endDate, `${hours}:${minutes}:59`) + 999;
    } else {
      endMs = localDateToUtcMs(endDate, '23:59:59') + 999;
    }

    return messages.filter((m) => {
      const t = getMessageTimeMs(m);
      return t >= startMs && t <= endMs;
    });
  }

  if (!timeFilter || timeFilter === TIME_FILTERS.ALL || timeFilter === TIME_FILTERS.CUSTOM) {
    return messages;
  }

  const cutoff = getPresetCutoffMs(timeFilter);
  if (cutoff == null) return messages;

  return messages.filter((m) => getMessageTimeMs(m) >= cutoff);
}

/** Default custom range when switching to Custom (local calendar dates). */
export function getDefaultCustomRangeDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const toYmd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: toYmd(start), endDate: toYmd(end) };
}
