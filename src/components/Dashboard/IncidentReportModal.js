import React, { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle, Calendar, Clock, FileText, User } from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const IncidentReportModal = ({
  isOpen,
  onClose,
  selectedMessages,
  messages,
  formatTime,
  timeFormat = "24h",
  timezone,
  onSubmit,
  isDarkMode = false,
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

  // Toast configuration
  const TOAST_CONFIG = {
    position: "top-right",
    autoClose: 2000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    theme: isDarkMode ? "dark" : "light",
    style: {
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      minWidth: "300px",
    },
    progressStyle: {
      background: isDarkMode ? "#4B5563" : "#D1D5DB",
    },
    onClose: () => {
      // Safe cleanup
    },
    onOpen: () => {
      // Safe initialization
    }
  };

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
    { value: "low", label: "Low", color: "text-green-600", bgColor: "bg-green-200" },
    { value: "medium", label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-200" },
    { value: "high", label: "High", color: "text-orange-600", bgColor: "bg-orange-200" },
    { value: "critical", label: "Critical", color: "text-red-700", bgColor: "bg-red-200" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-lg shadow-xl ${
          isDarkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? "bg-orange-900 bg-opacity-20" : "bg-orange-100"}`}>
              <FileText className={`w-6 h-6 ${isDarkMode ? "text-orange-400" : "text-orange-600"}`} />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                Create Incident Report
              </h2>
              <p className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                Document incident with selected messages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
          <div>
            <label
              className={`flex items-center space-x-2 text-sm font-medium mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Incident Name *</span>
            </label>
        
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Enter incident name..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className={`flex items-center space-x-2 text-sm font-medium mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Start Time</span>
              </label>
              
         <input
  type="datetime-local"
  name="startTime"
  value={formData.startTime}
  step="1"
  onChange={(e) =>
    setFormData((prev) => ({ ...prev, startTime: e.target.value }))
  }
  className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
    isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
  }`}
/>

            </div>
            <div>
              <label
                className={`flex items-center space-x-2 text-sm font-medium mb-1 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>End Time</span>
              </label>
             
             <input
  type="datetime-local"
  name="endTime"
  value={formData.endTime}
  step="1"
  onChange={handleInputChange}
  className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
    isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
  }`}
/>
            </div>
          </div>
          
          {/* Time Information Display */}
          {oldestMessageTime && latestMessageTime && (
            <div className={`p-3 rounded-md border ${
              isDarkMode ? "bg-gray-800 border-gray-600" : "bg-blue-50 border-blue-200"
            }`}>
              <div className={`text-xs font-medium mb-2 ${
                isDarkMode ? "text-blue-400" : "text-blue-700"
              }`}>
                📅 Calculated from selected audio messages ({timezone}):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                    Start Time (Oldest): 
                  </span>
                  <span className={`ml-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {formatTimeWithDate(oldestMessageTime, timezone)}
                  </span>
                </div>
                <div>
                  <span className={`font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                    End Time (Latest): 
                  </span>
                  <span className={`ml-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                    {formatTimeWithDate(latestMessageTime, timezone)}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div>
            <label
              className={`flex items-center space-x-2 text-sm font-medium mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Messages</span>
            </label>
            <div
              className={`px-3 py-2 border rounded-md text-sm ${
                isDarkMode ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-gray-50 border-gray-300 text-gray-700"
              }`}
            >
              {selectedMessages?.size} message{selectedMessages.size !== 1 ? "s" : ""} selected
            </div>
          </div>
          <div>
            <label
              className={`flex items-center space-x-2 text-sm font-medium mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Severity</span>
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
              }`}
            >
              {severityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2">
              {severityOptions.map(
                (option) =>
                  formData.severity === option.value && (
                    <span
                      key={option.value}
                      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        isDarkMode ? option.color : `${option.color} ${option.bgColor}`
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {option.label} Severity
                    </span>
                  )
              )}
            </div>
          </div>
          <div>
            <label
              className={`flex items-center space-x-2 text-sm font-medium mb-2 ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Description</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Describe the incident, its impact, and any relevant details..."
              className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-vertical ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
            />
          </div>
          <div>
            <label
              className={`text-sm font-medium mb-2 block ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              Selected Messages Preview
            </label>
            <div
              className={`max-h-32 overflow-y-auto border rounded-md p-3 space-y-2 ${
                isDarkMode ? "border-gray-600 bg-gray-700" : "border-gray-200 bg-gray-50"
              }`}
            >
              {sortedSelectedMessages.slice(0, 3).map((msg) => (
                <div key={msg.id} className={`text-xs ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                  <span className="font-mono">[{formatTime(msg.time, timezone)}]</span> {msg.message}
                  {(tagsByMessage[msg.id] || []).length > 0 && (
                    <span className="ml-2">
                      {tagsByMessage[msg.id].map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex items-center px-1 py-0.5 ml-1 text-xs rounded-full ${
                            isDarkMode ? "bg-gray-600 text-gray-200" : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
              {selectedMessages.size > 3 && (
                <div className={`text-xs italic ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                  ... and {selectedMessages.size - 3} more messages
                </div>
              )}
            </div>
          </div>
        </form>
        <div
          className={`flex items-center justify-end space-x-3 p-6 border-t ${
            isDarkMode ? "border-gray-600" : "border-gray-200"
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isDarkMode
                ? "text-gray-300 hover:text-gray-100 hover:bg-gray-700"
                : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim()}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              isSubmitting || !formData.name.trim()
                ? `${isDarkMode ? "bg-gray-400 text-gray-600" : "bg-gray-200 text-gray-400"} cursor-not-allowed`
                : `${isDarkMode ? "bg-orange-600 hover:bg-orange-700" : "bg-orange-600 hover:bg-orange-700"} text-white`
            }`}
          >
            {isSubmitting ? "Creating..." : "Create Report"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncidentReportModal;