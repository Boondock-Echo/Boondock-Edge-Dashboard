import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, AlertTriangle, Calendar, Clock, FileText, User } from "lucide-react";
import { toast } from "react-toastify";
import Button from "../ui/Button";
import formStyles from "../ui/Form.module.css";
import listStyles from "../ui/List.module.css";
import modalStyles from "../ui/Modal.module.css";
import noticeStyles from "../ui/Notice.module.css";
import { formatLocalDateTime, localDateTimeInputToUtc, parseUtcTimestamp, toLocalDateTimeInputValue } from "../../utils/dateTime";

const IncidentReportModal = ({
  isOpen,
  onClose,
  selectedMessages,
  messages,
  formatTime,
  timeFormat = "24h",
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


  // Memoized sorted messages to avoid redundant sorting
  // Sorted by time ascending (oldest first, latest last)
  const sortedSelectedMessages = useMemo(() => {
    return messages
      .filter((msg) => selectedMessages.has(msg.id))
      .sort((a, b) => {
        const dateA = parseUtcTimestamp(a.time);
        const dateB = parseUtcTimestamp(b.time);
        return dateA.getTime() - dateB.getTime(); // Ascending: oldest first
      });
  }, [messages, selectedMessages]);

  // Calculate start and end times from selected messages with browser-local time handling
  useEffect(() => {
    if (selectedMessages.size > 0 && sortedSelectedMessages.length > 0) {
      const startTime = sortedSelectedMessages[0]?.time;
      const endTime = sortedSelectedMessages[sortedSelectedMessages.length - 1]?.time;

      const convertToLocalDateTime = (timestamp) =>
        toLocalDateTimeInputValue(parseUtcTimestamp(timestamp));

      // Only set initial values if they haven't been manually modified
      setFormData((prev) => ({
        ...prev,
        startTime: prev.startTime || convertToLocalDateTime(startTime),
        endTime: prev.endTime || convertToLocalDateTime(endTime),
      }));
    }
  }, [sortedSelectedMessages, selectedMessages.size]);


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
      const reportData = {
        ...formData,
        startTime: localDateTimeInputToUtc(formData.startTime),
        endTime: localDateTimeInputToUtc(formData.endTime),
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
  const formatTimeWithDate = (timestamp) => {
    const date = parseUtcTimestamp(timestamp);
    if (Number.isNaN(date.getTime())) return "N/A";
    return formatLocalDateTime(date, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: timeFormat === '12h',
    });
  };

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
              <p>Calculated from selected audio messages:</p>
              <div className="gridTwo">
                <p>
                  <strong>Start Time (Oldest):</strong>{" "}
                  {formatTimeWithDate(oldestMessageTime)}
                </p>
                <p>
                  <strong>End Time (Latest):</strong>{" "}
                  {formatTimeWithDate(latestMessageTime)}
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
                    <span className={listStyles.identifier}>[{formatTime(msg.time)}]</span>{" "}
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