import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AudioPlaybackContext = createContext(null);

export const AudioPlaybackProvider = ({ children }) => {
  const audioRef = useRef(null);
  const positionsRef = useRef(new Map());
  const callbacksRef = useRef({});
  const activeTrackRef = useRef(null);
  const [activeTrack, setActiveTrack] = useState(null);
  const [status, setStatus] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const notify = (name, value) => callbacksRef.current[name]?.(value);
    const onPlay = () => { setStatus('playing'); setError(null); notify('onPlay'); };
    const onPause = () => { setStatus(activeTrackRef.current ? 'paused' : 'idle'); notify('onPause'); };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onDurationChange = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      const endedTrack = activeTrackRef.current;
      if (endedTrack) positionsRef.current.delete(endedTrack.src);
      setStatus('ended');
      setCurrentTime(0);
      notify('onEnded');
    };
    const onError = () => {
      const playbackError = new Error('Unable to play this audio file.');
      setError(playbackError);
      setStatus('error');
      notify('onError', playbackError);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const pause = useCallback(() => audioRef.current?.pause(), []);

  const claim = useCallback(({ ownerId, src, onEnded, onError, onPlay, onPause }) => {
    const audio = audioRef.current;
    if (!audio || !src) return false;

    const previous = activeTrackRef.current;
    if (previous && previous.src !== src && Number.isFinite(audio.currentTime)) {
      positionsRef.current.set(previous.src, audio.currentTime);
    }

    audio.pause();
    callbacksRef.current = { onEnded, onError, onPlay, onPause };
    const nextTrack = { ownerId, src };
    activeTrackRef.current = nextTrack;
    setActiveTrack(nextTrack);
    setError(null);

    if (audio.getAttribute('src') !== src) {
      audio.src = src;
      audio.load();
    }
    return true;
  }, []);

  const play = useCallback(async ({ ownerId, src, onEnded, onError, onPlay, onPause }) => {
    const audio = audioRef.current;
    if (!audio || !src) return false;

    const previous = activeTrackRef.current;
    if (previous && previous.src !== src && Number.isFinite(audio.currentTime)) {
      positionsRef.current.set(previous.src, audio.currentTime);
    }

    callbacksRef.current = { onEnded, onError, onPlay, onPause };
    const nextTrack = { ownerId, src };
    activeTrackRef.current = nextTrack;
    setActiveTrack(nextTrack);
    setError(null);

    if (audio.getAttribute('src') !== src) {
      audio.pause();
      audio.src = src;
      audio.load();
      const savedPosition = positionsRef.current.get(src);
      if (savedPosition) {
        const restorePosition = () => {
          audio.currentTime = Math.min(savedPosition, Number.isFinite(audio.duration) ? audio.duration : savedPosition);
          audio.removeEventListener('loadedmetadata', restorePosition);
        };
        audio.addEventListener('loadedmetadata', restorePosition);
      }
    }

    try {
      await audio.play();
      return true;
    } catch (playbackError) {
      setError(playbackError);
      setStatus('error');
      onError?.(playbackError);
      return false;
    }
  }, []);

  const stop = useCallback((ownerId) => {
    const audio = audioRef.current;
    if (!audio || (ownerId && activeTrackRef.current?.ownerId !== ownerId)) return;
    audio.pause();
    audio.currentTime = 0;
    if (activeTrackRef.current) positionsRef.current.delete(activeTrackRef.current.src);
    activeTrackRef.current = null;
    callbacksRef.current = {};
    setActiveTrack(null);
    setCurrentTime(0);
    setStatus('idle');
  }, []);

  const seek = useCallback((time) => {
    if (!audioRef.current || !Number.isFinite(time)) return;
    audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || time));
  }, []);

  const value = useMemo(() => ({
    audioRef, activeTrack, status, currentTime, duration, error, claim, play, pause, stop, seek,
  }), [activeTrack, status, currentTime, duration, error, claim, play, pause, stop, seek]);

  return <AudioPlaybackContext.Provider value={value}>{children}</AudioPlaybackContext.Provider>;
};

export const useAudioPlayback = () => {
  const context = useContext(AudioPlaybackContext);
  if (!context) throw new Error('useAudioPlayback must be used within AudioPlaybackProvider');
  return context;
};
