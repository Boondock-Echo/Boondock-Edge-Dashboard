import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, AlertTriangle, Calendar, Clock, FileText, User } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import formStyles from "../ui/Form.module.css";
import listStyles from "../ui/List.module.css";
import modalStyles from "../ui/Modal.module.css";
import noticeStyles from "../ui/Notice.module.css";

const IncidentReportModal = ({
  isOpen,
  onClose,
  selectedMessages,
  messages,
  formatTime,
  timeFormat = "24h",
  timezone,
  onSubmit,
  tagsByMessage,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    startTime: "",
    endTime: "",
    description: "",
    severity: "medium",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef(null);

  // Toast configuration
  const TOAST_CONFIG = {
    position: "top-right",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    onClose: () => {
      // Safe cleanup
    },
    onOpen: () => {
      // Safe initialization
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Helper function to parse YYYYMMDD_HHMMSS format to Date
  const parseTimestamp = (timestamp) => {
    if (!timestamp) return new Date(0);
    
    // Handle YYYYMMDD_HHMMSS format
    if (/^\d{8}_\d{6}$/.test(timestamp)) {
      const year = parseInt(timestamp.substring(0, 4));
      const month = parseInt(timestamp.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(timestamp.substring(6, 8));
      const hours = parseInt(timestamp.substring(9, 11));
      const minutes = parseInt(timestamp.substring(11, 13));
      const seconds = parseInt(timestamp.substring(13, 15));
      
      // Create UTC date
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }
    
    // Fallback to standard date parsing
    return new Date(timestamp);
  };

  // Memoized sorted messages to avoid redundant sorting
  // Sorted by time ascending (oldest first, latest last)
  const sortedSelectedMessages = useMemo(() => {
    return messages
      .filter((msg) => selectedMessages.has(msg.id))
      .sort((a, b) => {
        const dateA = parseTimestamp(a.time);
        const dateB = parseTimestamp(b.time);
        return dateA.getTime() - dateB.getTime(); // Ascending: oldest first
      });
  }, [messages, selectedMessages]);

  // Calculate start and end times from selected messages with proper timezone handling
  useEffect(() => {
    if (selectedMessages.size > 0 && sortedSelectedMessages.length > 0) {
      const startTime = sortedSelectedMessages[0]?.time;
      const endTime = sortedSelectedMessages[sortedSelectedMessages.length - 1]?.time;

      // Convert UTC timestamp to user's timezone for datetime-local input
      const convertToLocalDateTime = (timestamp) => {
        if (!timestamp) return "";
        
        // Parse the UTC timestamp (format: YYYYMMDD_HHMMSS)
        const year = parseInt(timestamp.substring(0, 4));
        const month = parseInt(timestamp.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(timestamp.substring(6, 8));
        const hours = parseInt(timestamp.substring(9, 11));
        const minutes = parseInt(timestamp.substring(11, 13));
        const seconds = parseInt(timestamp.substring(13, 15));
        
        // Create UTC date
        const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
        
        // Validate timezone
        const validateAndFixTimezone = (tz) => {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: tz });
            return tz;
          } catch (error) {
            console.warn(`Invalid timezone "${tz}", falling back to Etc/UTC`);
            return 'Etc/UTC';
          }
        };
        
        const validTimezone = validateAndFixTimezone(timezone);
        
        // Use Intl.DateTimeFormat to get parts in the target timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: validTimezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        
        const parts = formatter.formatToParts(utcDate);
        const tzYear = parts.find(p => p.type === 'year')?.value || '';
        const tzMonth = parts.find(p => p.type === 'month')?.value || '';
        const tzDay = parts.find(p => p.type === 'day')?.value || '';
        const tzHour = parts.find(p => p.type === 'hour')?.value || '';
        const tzMinute = parts.find(p => p.type === 'minute')?.value || '';
        const tzSecond = parts.find(p => p.type === 'second')?.value || '';
        
        // Format for datetime-local input (YYYY-MM-DDTHH:MM:SS)
        return `${tzYear}-${tzMonth}-${tzDay}T${tzHour}:${tzMinute}:${tzSecond}`;
      };

      // Only set initial values if they haven't been manually modified
      setFormData((prev) => ({
        ...prev,
        startTime: prev.startTime || convertToLocalDateTime(startTime),
        endTime: prev.endTime || convertToLocalDateTime(endTime),
      }));
    }
  }, [sortedSelectedMessages, selectedMessages.size, timezone]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Incident name is required", TOAST_CONFIG);
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert a datetime-local string that is intended in a specific IANA timezone to UTC ISO
      const convertLocalTzToUTC = (localDateTime, tz) => {
        if (!localDateTime) return "";
        // Parse components from 'YYYY-MM-DDTHH:mm:ss'
        const [datePart, timePart = "00:00:00"] = localDateTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);

        // Helper: get timezone offset (in minutes) for a given UTC date in a timezone
        const getTimeZoneOffset = (utcDate, timeZone) => {
          try {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone,
              hour12: false,
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            }).formatToParts(utcDate);

            const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
            const tzY = Number(lookup.year);
            const tzM = Number(lookup.month);
            const tzD = Number(lookup.day);
            const tzH = Number(lookup.hour);
            const tzMin = Number(lookup.minute);
            const tzS = Number(lookup.second);
            // This is the wall time in TZ that corresponds to the provided UTC instant
            const asUTCFromTZ = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, tzS);
            // Offset = (wallTimeInTZ as UTC) - (actual UTC)
            return (asUTCFromTZ - utcDate.getTime()) / 60000; // minutes
          } catch {
            return 0;
          }
        };

        // First guess: interpret the provided components as UTC
        const utcGuess = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, second || 0);
        const offsetMin = getTimeZoneOffset(new Date(utcGuess), tz || 'Etc/UTC');
        const trueUtcMs = utcGuess - offsetMin * 60000; // subtract offset to get real UTC
        return new Date(trueUtcMs).toISOString();
      };

      const reportData = {
        ...formData,
        startTime: convertLocalTzToUTC(formData.startTime, timezone),
        endTime: convertLocalTzToUTC(formData.endTime, timezone),
        messages: sortedSelectedMessages.map(({ id, time, message, channel, url }) => ({
          id,
          time,
          message,
          channel,
          url: url || "",
        })),
        messageCount: selectedMessages.size,
        channels_involved: [...new Set(sortedSelectedMessages.map((msg) => msg.channel))],
        created_at: new Date().toISOString(),
        tags: tagsByMessage || {},
      };

      await onSubmit(reportData);
      toast.success("Incident report created successfully", TOAST_CONFIG);
      onClose();
      setFormData({
        name: "",
        startTime: "",
        endTime: "",
        description: "",
        severity: "medium",
      });
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || "Failed to create incident report";
      toast.error(errorMessage, TOAST_CONFIG);
      console.error("Error submitting incident report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const severityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
  ];

  // Format start (oldest/earliest) and end (latest) message times for display
  const oldestMessageTime = sortedSelectedMessages[0]?.time; // This is the start time
  const latestMessageTime = sortedSelectedMessages[sortedSelectedMessages.length - 1]?.time; // This is the end time

  // Format time with full date format (always shows date, not just time)
  // Format: "Oct 10, 08:40:26"
  const formatTimeWithDate = (timestamp, tz) => {
    if (!timestamp) return "N/A";
    
    try {
      // Parse timestamp (format: YYYYMMDD_HHMMSS)
      const year = parseInt(timestamp.substring(0, 4));
      const month = parseInt(timestamp.substring(4, 6)) - 1;
      const day = parseInt(timestamp.substring(6, 8));
      const hours = parseInt(timestamp.substring(9, 11));
      const minutes = parseInt(timestamp.substring(11, 13));
      const seconds = parseInt(timestamp.substring(13, 15));
      
      // Create UTC date
      const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      
      // Validate timezone
      const validateAndFixTimezone = (tzStr) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tzStr });
          return tzStr;
        } catch (error) {
          return 'Etc/UTC';
        }
      };
      
      const validTimezone = validateAndFixTimezone(tz || 'Etc/UTC');
      
      // Use Intl.DateTimeFormat to get parts for consistent formatting
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: validTimezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: timeFormat === '12h'
      });
      
      const parts = formatter.formatToParts(utcDate);
      const monthPart = parts.find(p => p.type === 'month')?.value || '';
      const dayPart = parts.find(p => p.type === 'day')?.value || '';
      const hourPart = parts.find(p => p.type === 'hour')?.value || '';
      const minutePart = parts.find(p => p.type === 'minute')?.value || '';
      const secondPart = parts.find(p => p.type === 'second')?.value || '';
      
      // Format: "Oct 10, 08:40:26"
      return `${monthPart} ${dayPart}, ${hourPart}:${minutePart}:${secondPart}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'N/A';
    }
  };

  console.log("Oldest Message Time (Start):", oldestMessageTime);
  console.log("Latest Message Time (End):", latestMessageTime);
  console.log("Current Timezone:", timezone);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${modalStyles.dialog} ${modalStyles.wide}`}
      aria-labelledby="incident-report-title"
      aria-describedby="incident-report-description"
      onCancel={onClose}
    >
      <div className={modalStyles.header}>
        <div className="row">
          <FileText size={24} aria-hidden="true" />
          <div>
            <h2 id="incident-report-title" className={modalStyles.title}>
              Create Incident Report
            </h2>
            <p id="incident-report-description" className={modalStyles.subtitle}>
              Document incident with selected messages
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Close incident report"
        >
          <X />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className={`${modalStyles.body} ${formStyles.form}`}>
        <div className={formStyles.field}>
          <label className={`${formStyles.label} row`} htmlFor="incident-name">
            <User size={16} aria-hidden="true" />
            <span>Incident Name *</span>
          </label>
          <input
            id="incident-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter incident name..."
            className={formStyles.input}
          />
        </div>

        <div className="gridTwo">
          <div className={formStyles.field}>
            <label className={`${formStyles.label} row`} htmlFor="incident-start-time">
              <Calendar size={16} aria-hidden="true" />
              <span>Start Time</span>
            </label>
            <input
              id="incident-start-time"
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              step="1"
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, startTime: e.target.value }))
              }
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.field}>
            <label className={`${formStyles.label} row`} htmlFor="incident-end-time">
              <Clock size={16} aria-hidden="true" />
              <span>End Time</span>
            </label>
            <input
              id="incident-end-time"
              type="datetime-local"
              name="endTime"
              value={formData.endTime}
              step="1"
              onChange={handleInputChange}
              className={formStyles.input}
            />
          </div>
        </div>

        {/* Time Information Display */}
        {oldestMessageTime && latestMessageTime && (
          <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
            <Calendar size={18} className={noticeStyles.icon} aria-hidden="true" />
            <div className={`${noticeStyles.body} grow`}>
              <p>Calculated from selected audio messages ({timezone}):</p>
              <div className="gridTwo">
                <p>
                  <strong>Start Time (Oldest):</strong>{" "}
                  {formatTimeWithDate(oldestMessageTime, timezone)}
                </p>
                <p>
                  <strong>End Time (Latest):</strong>{" "}
                  {formatTimeWithDate(latestMessageTime, timezone)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={formStyles.field}>
          <label className={`${formStyles.label} row`}>
            <FileText size={16} aria-hidden="true" />
            <span>Messages</span>
          </label>
          <div className={formStyles.input}>
            {selectedMessages?.size} message{selectedMessages.size !== 1 ? "s" : ""} selected
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={`${formStyles.label} row`} htmlFor="incident-severity">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Severity</span>
          </label>
          <select
            id="incident-severity"
            name="severity"
            value={formData.severity}
            onChange={handleInputChange}
            className={formStyles.select}
          >
            {severityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div>
            {severityOptions.map(
              (option) =>
                formData.severity === option.value && (
                  <span
                    key={option.value}
                    className={`pill ${
                      option.value === "low"
                        ? "pillSuccess"
                        : option.value === "medium"
                          ? "pillAccent"
                          : option.value === "high"
                            ? "pillWarning"
                            : "pillDanger"
                    }`}
                  >
                    <AlertTriangle size={12} aria-hidden="true" />
                    {option.label} Severity
                  </span>
                )
            )}
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={`${formStyles.label} row`} htmlFor="incident-description">
            <FileText size={16} aria-hidden="true" />
            <span>Description</span>
          </label>
          <textarea
            id="incident-description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            placeholder="Describe the incident, its impact, and any relevant details..."
            className={formStyles.input}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Selected Messages Preview</label>
          <div className='preview'>
            <ul className={listStyles.list}>
              {sortedSelectedMessages.slice(0, 3).map((msg) => (
                <li key={msg.id} className={listStyles.item}>
                  <div className={listStyles.content}>
                    <span className={listStyles.identifier}>[{formatTime(msg.time, timezone)}]</span>{" "}
                    {msg.message}
                    {(tagsByMessage[msg.id] || []).length > 0 && (
                      <span className="rowWrap">
                        {tagsByMessage[msg.id].map((tag) => (
                          <span key={tag} className="pill">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {selectedMessages.size > 3 && (
              <p className={formStyles.helpText}>
                ... and {selectedMessages.size - 3} more messages
              </p>
            )}
          </div>
        </div>
      </form>

      <div className={modalStyles.actionsBetween}>
        <div />
        <div className={modalStyles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Report"}
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default IncidentReportModal;