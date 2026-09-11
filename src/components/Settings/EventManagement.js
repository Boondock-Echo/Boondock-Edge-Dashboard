import React from 'react';
import { 
  Calendar, 
  Clock, 
  Download, 
  Trash2, 
  XCircle, 
  CalendarDays,
  Activity,
  FileMusic,
  Timer,
  ChevronRight,
  Users,
  ArrowUpRight,
  Shield
} from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';

const EventManagement = () => {
  const events = [
    {
      id: 1,
      name: "Tech Conference 2025",
      startTime: "2025-02-11T09:00:00",
      endTime: null,
      status: "current",
      participants: 234
    },
    {
      id: 2,
      name: "Workshop Series",
      startTime: "2025-01-15T10:00:00",
      endTime: "2025-01-20T16:00:00",
      status: "ended",
      participants: 156
    }
  ];

  const formatDateTime = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="stackLarge">
      {/* Header Section */}
      <div className={cardStyles.card}>
        <div className="rowBetweenStart">
          <div className="row">
            <Shield size={40} />
            <div>
              <h2>Event Management</h2>
              <p className={cardStyles.description}>Monitor and manage your active and past events</p>
            </div>
          </div>
          <span className="pill pillAccent">
            <Activity size={16} />
            {events.filter(e => e.status === 'current').length} Active Events
          </span>
        </div>
      </div>

      {/* Events Grid */}
      <div className="gridTwo">
        {events.map((event) => (
          <div key={event.id} className={`${cardStyles.card} ${cardStyles.interactive}`}>
            {/* Status Header */}
            <div className="rowBetween">
              <span className={`pill ${event.status === 'current' ? 'pillSuccess' : ''}`}>
                {event.status === 'current' ? <Timer size={16} /> : <Clock size={16} />}
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
              <span className="pill">
                <FileMusic size={16} />
                {event.participants} Recordings
              </span>
            </div>

            {/* Event Title */}
            <div className="rowBetween">
              <h3>{event.name}</h3>
              <ArrowUpRight size={20} />
            </div>

            {/* Event Details */}
            <div className="stackCompact">
              <div className="row">
                <Calendar size={20} />
                <span>Started: {formatDateTime(event.startTime)}</span>
              </div>
              {event.endTime && (
                <div className="row">
                  <Clock size={20} />
                  <span>Ended: {formatDateTime(event.endTime)}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="rowBetween">
              <div />
              <div className="row">
                {event.status === 'current' && (
                  <Button variant="danger">
                    <XCircle size={16} />
                    End Event
                  </Button>
                )}
                {event.status === 'ended' && (
                  <>
                    <Button variant="accent">
                      <Download size={16} />
                      Download
                    </Button>
                    <Button variant="danger">
                      <Trash2 size={16} />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventManagement;