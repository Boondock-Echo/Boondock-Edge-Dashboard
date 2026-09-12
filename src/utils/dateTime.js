/** The dashboard always presents API UTC timestamps in the viewer's device timezone. */
export const getBrowserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Parse API timestamps as UTC, including compact recording filenames and ISO strings without a suffix. */
export const parseUtcTimestamp = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{8}_\d{6}$/.test(value)) {
    return new Date(Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
      Number(value.slice(9, 11)),
      Number(value.slice(11, 13)),
      Number(value.slice(13, 15)),
    ));
  }
  const normalized = typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value}Z`
    : value;
  return new Date(normalized);
};

/** Format a Date for a datetime-local control using browser-local components. */
export const toLocalDateTimeInputValue = (value) => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** Convert a browser-local datetime control value to the UTC representation expected by the API. */
export const localDateTimeInputToUtc = (value) => value ? new Date(value).toISOString() : '';

export const formatLocalDateTime = (value, options = {}) => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString('en-US', options);
};

export const formatLocalDate = (value, options = {}) => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', options);
};

export const formatLocalTime = (value, timeFormat = '24h', options = {}) => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12h',
    ...options,
  });
};

export const getLocalTimeZoneAbbreviation = (value) => {
  const date = parseUtcTimestamp(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(date)
    .find(({ type }) => type === 'timeZoneName');
  return part?.value || getBrowserTimeZone();
};
