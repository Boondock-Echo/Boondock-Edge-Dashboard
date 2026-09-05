import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import api from '../../utils/apiClient';
import logger from '../../utils/logger';

const ExportCalendar = ({ isDarkMode, onRecordingsSelected, selectedRecordings, setSelectedRecordings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysWithRecordings, setDaysWithRecordings] = useState(new Set());
  const [selectedDay, setSelectedDay] = useState(null);
  const [hoursWithRecordings, setHoursWithRecordings] = useState([]);
  const [selectedHour, setSelectedHour] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch days with recordings for the current month
  useEffect(() => {
    const fetchDaysWithRecordings = async () => {
      try {
        const response = await api.get(`/recordings/calendar/days`, {
          params: { year, month: month + 1 }
        });
        const days = response.data.days || [];
        setDaysWithRecordings(new Set(days));
      } catch (error) {
        logger.error('Failed to fetch days with recordings:', error);
      }
    };

    fetchDaysWithRecordings();
  }, [year, month]);

  // Fetch hours when a day is selected
  useEffect(() => {
    if (selectedDay) {
      const fetchHours = async () => {
        setLoading(true);
        try {
          const response = await api.get(`/recordings/calendar/hours`, {
            params: { year, month: month + 1, day: selectedDay }
          });
          const hours = response.data.hours || [];
          setHoursWithRecordings(hours);
        } catch (error) {
          logger.error('Failed to fetch hours:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchHours();
    } else {
      setHoursWithRecordings([]);
      setSelectedHour(null);
      setRecordings([]);
    }
  }, [selectedDay, year, month]);

  // Fetch recordings when an hour is selected
  useEffect(() => {
    if (selectedDay && selectedHour !== null) {
      const fetchRecordings = async () => {
        setLoading(true);
        try {
          const response = await api.get(`/recordings/calendar/recordings`, {
            params: { year, month: month + 1, day: selectedDay, hour: selectedHour }
          });
          const recs = response.data.recordings || [];
          setRecordings(recs);
          if (onRecordingsSelected) {
            onRecordingsSelected(recs);
          }
        } catch (error) {
          logger.error('Failed to fetch recordings:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchRecordings();
    } else {
      setRecordings([]);
    }
  }, [selectedDay, selectedHour, year, month, onRecordingsSelected]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
    setSelectedHour(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
    setSelectedHour(null);
  };

  const handleDayClick = (day) => {
    if (daysWithRecordings.has(day)) {
      setSelectedDay(day);
      setSelectedHour(null);
    }
  };

  const handleBackToCalendar = () => {
    setSelectedDay(null);
    setSelectedHour(null);
    setRecordings([]);
  };

  const handleHourClick = (hour) => {
    setSelectedHour(hour);
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CalendarIcon className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
          {selectedDay ? (
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {monthNames[month]} {selectedDay}, {year}
            </h3>
          ) : (
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {monthNames[month]} {year}
            </h3>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {selectedDay && (
            <button
              onClick={handleBackToCalendar}
              className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              title="Back to calendar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {!selectedDay && (
            <>
              <button
                onClick={handlePrevMonth}
                className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Calendar Grid - Only show when no day is selected */}
      {!selectedDay && (
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map((day) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            >
              {day}
            </div>
          ))}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-10" />;
            }
            
            const hasRecordings = daysWithRecordings.has(day);
            const isSelected = selectedDay === day;
            
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={!hasRecordings}
                className={`h-10 rounded-md text-sm transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : hasRecordings
                    ? isDarkMode
                      ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-800/50'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : isDarkMode
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      )}

      {/* Hours Selection */}
      {selectedDay && (
        <div className={`${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
          <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Hours with recordings for {monthNames[month]} {selectedDay}, {year}
          </h4>
          {loading ? (
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</div>
          ) : hoursWithRecordings.length === 0 ? (
            <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No hours found</div>
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {hoursWithRecordings.map((hour) => (
                <button
                  key={hour}
                  onClick={() => handleHourClick(hour)}
                  className={`px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedHour === hour
                      ? 'bg-blue-600 text-white'
                      : isDarkMode
                      ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {String(hour).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recordings Count */}
      {selectedHour !== null && recordings.length > 0 && (
        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Found {recordings.length} recording{recordings.length !== 1 ? 's' : ''} for {monthNames[month]} {selectedDay}, {year} at {String(selectedHour).padStart(2, '0')}:00
        </div>
      )}
    </div>
  );
};

export default ExportCalendar;

