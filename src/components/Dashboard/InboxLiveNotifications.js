import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import InlineAudioPlayer from '../InlineAudioPlayer';
import { useAudioPlayback } from '../AudioPlaybackContext';
import { useInboxMessages, useInboxChannels, useInboxLive, useInboxPreferences } from '../InboxContext';
import styles from '../ui/LiveCommunications.module.css';
import { parseUtcTimestamp } from '../../utils/dateTime';

const LIVE_POPUP_QUEUE_LIMIT = 10;

const transcriptionPending = (messageText) => {
  if (messageText == null) return true;
  const value = String(messageText).trim();
  return !value || value === 'No transcription available' || value === '....';
};

const cursorFor = (message) => {
  if (!message) return [0, 0];
  const timestamp = Number(String(message.time || '').replace(/[^0-9]/g, '')) || 0;
  return [timestamp, Number(message.id) || 0];
};

const cursorGreater = (a, b) => {
  if (!a) return false;
  if (!b) return true;
  if (a[0] !== b[0]) return a[0] > b[0];
  return a[1] > b[1];
};

const InboxLiveNotifications = () => {
  const { messageList } = useInboxMessages();
  const { channels } = useInboxChannels();
  const { isVolumeOn } = useInboxLive();
  const { timeFormat } = useInboxPreferences();
  const { stop: stopSharedAudio } = useAudioPlayback();

  const [popup, setPopup] = useState(null);
  const [queue, setQueue] = useState([]);
  const previousIdsRef = useRef(new Set());
  const cursorRef = useRef(null);
  const initializedRef = useRef(false);

  const formatTime = useCallback((timestamp) => {
    const date = parseUtcTimestamp(timestamp);
    if (!date || Number.isNaN(date.getTime())) return String(timestamp || '');
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: timeFormat === '12h',
    });
  }, [timeFormat]);

  const closePopup = useCallback(() => {
    if (popup?.id != null) stopSharedAudio(`popup:${popup.id}`);
    setPopup(null);
  }, [popup?.id, stopSharedAudio]);

  useEffect(() => {
    if (!isVolumeOn) {
      setQueue([]);
      closePopup();
    }
  }, [closePopup, isVolumeOn]);

  useEffect(() => {
    if (!isVolumeOn) {
      previousIdsRef.current = new Set(messageList.map((message) => String(message.id)));
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      previousIdsRef.current = new Set(messageList.map((message) => String(message.id)));
      const newest = messageList[0];
      cursorRef.current = cursorFor(newest);
      return;
    }

    const previousIds = previousIdsRef.current;
    const incoming = messageList.filter((message) => !previousIds.has(String(message.id)) && message.url);
    previousIdsRef.current = new Set(messageList.map((message) => String(message.id)));

    if (!incoming.length) return;

    const trulyNew = incoming
      .filter((message) => cursorGreater(cursorFor(message), cursorRef.current))
      .slice()
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (!trulyNew.length) return;

    const popupItems = trulyNew.map((message) => ({
      id: message.id,
      message: message.message,
      channel: channels[String(message.channel)]?.name || `Channel ${message.channel}`,
      time: formatTime(message.time),
      url: message.url,
    }));

    const newest = trulyNew[trulyNew.length - 1];
    cursorRef.current = cursorFor(newest);

    setQueue((previous) => {
      const existing = new Set(previous.map((item) => String(item.id)));
      if (popup?.id != null) existing.add(String(popup.id));
      const next = [...previous];
      for (const item of popupItems) {
        if (!existing.has(String(item.id))) {
          next.push(item);
          existing.add(String(item.id));
        }
      }
      return next.slice(-LIVE_POPUP_QUEUE_LIMIT);
    });
  }, [channels, formatTime, isVolumeOn, messageList, popup?.id]);

  useEffect(() => {
    if (!isVolumeOn || popup || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setPopup(next);
  }, [isVolumeOn, popup, queue]);

  useEffect(() => {
    if (!popup?.id || !transcriptionPending(popup.message)) return;

    const updated = messageList.find(
      (message) => String(message.id) === String(popup.id)
    );

    if (!updated || transcriptionPending(updated.message)) return;

    setPopup((previous) => previous && String(previous.id) === String(updated.id)
      ? { ...previous, message: updated.message }
      : previous);
  }, [messageList, popup?.id, popup?.message]);

  if (!popup) return null;

  return (
    <div className={styles.popupOverlay} onClick={closePopup}>
      <div className={styles.popupCard} onClick={(event) => event.stopPropagation()}>
        <Button
          onClick={closePopup}
          variant="ghost"
          size="icon"
          aria-label="Close new message"
          style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)' }}
        >
          <X size={24} aria-hidden="true" />
        </Button>

        <div className={styles.popupBody}>
          <div className={styles.popupMeta}>
            <strong>{popup.channel}</strong>
            <span> • </span>
            <span>{popup.time}</span>
          </div>

          <div className={styles.popupMessage}>{popup.message}</div>

          {popup.url && (
            <InlineAudioPlayer
              ownerId={`popup:${popup.id}`}
              src={popup.url}
              autoPlay
              showWaveform
              onEnded={() => setPopup(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxLiveNotifications;
