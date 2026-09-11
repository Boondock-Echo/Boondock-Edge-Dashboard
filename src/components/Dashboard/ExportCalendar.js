import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/apiClient';
import logger from '../../utils/logger';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import styles from './ExportCalendar.module.css';

const ExportCalendar = ({ onRecordingsSelected }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysWithRecordings, setDaysWithRecordings] = useState(new Set());
  const [selectedDay, setSelectedDay] = useState(null);
  const [hoursWithRecordings, setHoursWithRecordings] = useState([]);
  const [selectedHour, setSelectedHour] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const fetchDaysWithRecordings = async () => {
      try {
        const response = await api.get('/recordings/calendar/days', {
          params: { year, month: month + 1 },
        });
        setDaysWithRecordings(new Set(response.data.days || []));
      } catch (error) {
        logger.error('Failed to fetch days with recordings:', error);
      }
    };

    fetchDaysWithRecordings();
  }, [year, month]);

  useEffect(() => {
    if (!selectedDay) {
      setHoursWithRecordings([]);
      setSelectedHour(null);
      setRecordings([]);
      return;
    }

    const fetchHours = async () => {
      setLoading(true);
      try {
        const response = await api.get('/recordings/calendar/hours', {
          params: { year, month: month + 1, day: selectedDay },
        });
        setHoursWithRecordings(response.data.hours || []);
      } catch (error) {
        logger.error('Failed to fetch hours:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHours();
  }, [selectedDay, year, month]);

  useEffect(() => {
    if (!selectedDay || selectedHour === null) {
      setRecordings([]);
      return;
    }

    const fetchRecordings = async () => {
      setLoading(true);
      try {
        const response = await api.get('/recordings/calendar/recordings', {
          params: { year, month: month + 1, day: selectedDay, hour: selectedHour },
        });
        const nextRecordings = response.data.recordings || [];
        setRecordings(nextRecordings);
        onRecordingsSelected?.(nextRecordings);
      } catch (error) {
        logger.error('Failed to fetch recordings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
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

  const firstDayWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarDays = [
    ...Array(firstDayWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const selectedDateLabel = `${monthNames[month]} ${selectedDay}, ${year}`;

  return (
    <div className={`${cardStyles.card} ${styles.calendar}`}>
      <div className="rowBetween">
        <div className="row">
          <CalendarIcon className={styles.headerIcon} aria-hidden="true" />
          <h3 className={cardStyles.title}>
            {selectedDay ? selectedDateLabel : `${monthNames[month]} ${year}`}
          </h3>
        </div>

        <div className="row">
          {selectedDay ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={handleBackToCalendar}
              aria-label="Back to calendar"
              title="Back to calendar"
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleNextMonth}
                aria-label="Next month"
                title="Next month"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedDay && (
        <div className={styles.calendarGrid}>
          {weekDays.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className={styles.emptyDay} aria-hidden="true" />;
            }

            const hasRecordings = daysWithRecordings.has(day);

            return (
              <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={!hasRecordings}
                className={`${styles.day} ${hasRecordings ? styles.dayAvailable : ''}`}
                aria-label={`${monthNames[month]} ${day}, ${year}${hasRecordings ? ', recordings available' : ', no recordings'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <div className={styles.hoursPanel}>
          <h4 className={styles.hoursTitle}>Hours with recordings for {selectedDateLabel}</h4>

          {loading ? (
            <div className="centeredContent">
              <span className="spinner" role="status" aria-label="Loading recording hours" />
            </div>
          ) : hoursWithRecordings.length === 0 ? (
            <p className={styles.emptyMessage}>No hours found</p>
          ) : (
            <div className={styles.hoursGrid}>
              {hoursWithRecordings.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => setSelectedHour(hour)}
                  className={`${styles.hour} ${selectedHour === hour ? styles.hourSelected : ''}`}
                  aria-pressed={selectedHour === hour}
                >
                  {String(hour).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedHour !== null && recordings.length > 0 && (
        <p className={styles.recordingCount}>
          Found {recordings.length} recording{recordings.length !== 1 ? 's' : ''} for {selectedDateLabel} at {String(selectedHour).padStart(2, '0')}:00
        </p>
      )}
    </div>
  );
};

export default ExportCalendar;
