import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import InlineAudioPlayer from '../InlineAudioPlayer';
import { useAudioPlayback } from '../AudioPlaybackContext';
import { useInboxMessages, useInboxChannels, useInboxLive, useInboxPreferences } from '../InboxContext';
import modalStyles from '../ui/Modal.module.css';
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
  const { messageList, initialLoading, initialError } = useInboxMessages();
  const { channels } = useInboxChannels();
  const { isVolumeOn } = useInboxLive();
  const { timeFormat } = useInboxPreferences();
  const { stop: stopSharedAudio } = useAudioPlayback();

  const [popup, setPopup] = useState(null);
  const [queue, setQueue] = useState([]);
  const previousIdsRef = useRef(new Set());
  const cursorRef = useRef(null);
  const initializedRef = useRef(false);
  const seenKeywordActionsRef = useRef(new Set());

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
      setQueue((previous) => previous.filter((item) => item.trigger === 'keyword'));
      if (popup?.trigger === 'live') closePopup();
    }
  }, [closePopup, isVolumeOn, popup?.trigger]);

  useEffect(() => {
    if (initialLoading || initialError) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousIdsRef.current = new Set(messageList.map((message) => String(message.id)));
      for (const message of messageList) {
        for (const action of message.keyword_actions || []) seenKeywordActionsRef.current.add(String(action.id));
        const cursor = cursorFor(message);
        if (cursorGreater(cursor, cursorRef.current)) cursorRef.current = cursor;
      }
      return;
    }

    const previousIds = previousIdsRef.current;
    const popupItems = [];
    for (const message of messageList) {
      const wasLoaded = previousIds.has(String(message.id));
      const isNewer = cursorGreater(cursorFor(message), cursorRef.current);
      const newActions = (message.keyword_actions || []).filter(
        (action) => !seenKeywordActionsRef.current.has(String(action.id))
      );
      for (const action of message.keyword_actions || []) seenKeywordActionsRef.current.add(String(action.id));
      const keywordTrigger = newActions.length > 0 && (wasLoaded || isNewer);
      const liveTrigger = isVolumeOn && !wasLoaded && isNewer && message.url;
      if (!keywordTrigger && !liveTrigger) continue;
      popupItems.push({
        id: message.id, message: message.message,
        channel: channels[String(message.channel)]?.name || `Channel ${message.channel}`,
        time: formatTime(message.time), url: message.url,
        trigger: keywordTrigger ? 'keyword' : 'live',
        actionNames: newActions.map((action) => action.name).join(', '),
        autoplay: keywordTrigger ? newActions.some((action) => action.autoplay) : true,
      });
    }
    previousIdsRef.current = new Set(messageList.map((message) => String(message.id)));
    for (const message of messageList) {
      const cursor = cursorFor(message);
      if (cursorGreater(cursor, cursorRef.current)) cursorRef.current = cursor;
    }
    if (!popupItems.length) return;
    popupItems.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const currentUpdate = popupItems.find((item) => String(item.id) === String(popup?.id));
    if (currentUpdate) setPopup((previous) => previous ? { ...previous, ...currentUpdate } : previous);
    setQueue((previous) => {
      const next = [...previous];
      for (const item of popupItems) {
        if (String(item.id) === String(popup?.id)) continue;
        const index = next.findIndex((queued) => String(queued.id) === String(item.id));
        if (index >= 0) next[index] = item;
        else next.push(item);
      }
      return next.slice(-LIVE_POPUP_QUEUE_LIMIT);
    });
  }, [channels, formatTime, initialError, initialLoading, isVolumeOn, messageList, popup?.id]);

  useEffect(() => {
    if (popup || !queue.length) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    if (next.trigger === 'keyword' || isVolumeOn) setPopup(next);
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
    <div className={`${modalStyles.overlay} ${styles.popupOverlay}`} onClick={closePopup}>
      <div role="dialog" aria-label={popup.trigger === 'keyword' ? 'Keyword alert' : 'New recording'} className={`${modalStyles.panel} ${modalStyles.wide}`} onClick={(event) => event.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className={styles.popupMeta}>
            {popup.trigger === 'keyword' && <strong>{popup.actionNames} · </strong>}
            <strong>{popup.channel}</strong>
            <span> • </span>
            <span>{popup.time}</span>
          </div>
          <Button
            onClick={closePopup}
            variant="ghost"
            size="icon"
            aria-label="Close new message"
          >
            <X size={24} aria-hidden="true" />
          </Button>
        </div>

        <div className={modalStyles.body}>
          <div className={styles.popupMessage}>{popup.message}</div>

          {popup.url && (
            <InlineAudioPlayer
              ownerId={`popup:${popup.id}`}
              src={popup.url}
              autoPlay={popup.autoplay}
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
