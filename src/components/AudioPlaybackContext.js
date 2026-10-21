import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../utils/apiClient';

const AudioPlaybackContext = createContext(null);
const MAX_AUDIO_CACHE_BYTES = 100 * 1024 * 1024;

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
  const audioCacheRef = useRef(new Map());
  const cacheGenerationRef = useRef(0);

  // LRU Map: oldest entries come first. A lease prevents eviction while a
  // component is using a blob URL (for example, the inline waveform/player).
  const trimAudioCache = useCallback(() => {
    const cache = audioCacheRef.current;
    let bytes = 0;
    for (const entry of cache.values()) bytes += entry.size || 0;
    if (bytes <= MAX_AUDIO_CACHE_BYTES) return;

    const mediaSrc = audioRef.current?.getAttribute('src');
    for (const [key, entry] of cache) {
      if (bytes <= MAX_AUDIO_CACHE_BYTES) break;
      if (!entry.url || entry.leases > 0 || entry.url === mediaSrc ||
          entry.url === activeTrackRef.current?.src) continue;
      cache.delete(key);
      URL.revokeObjectURL(entry.url);
      bytes -= entry.size;
    }
    // Soft limit: if all entries are protected, memory may temporarily exceed 100 MB.
  }, []);

  const retainAudio = useCallback((src) => {
    if (!src || src.startsWith('blob:')) return () => {};
    const cache = audioCacheRef.current;
    let entry = cache.get(src);
    if (!entry) {
      entry = { leases: 0, size: 0, url: null, promise: null };
      cache.set(src, entry);
    }
    entry.leases += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      entry.leases = Math.max(0, entry.leases - 1);
      trimAudioCache();
    };
  }, [trimAudioCache]);

  const getAudio = useCallback(async (src) => {
    if (!src) throw new Error('Audio URL is required');
    // Edited audio is already local. Never own/revoke URLs created elsewhere.
    if (src.startsWith('blob:')) {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Failed to read local audio');
      return { blob: await response.blob(), url: src };
    }

    const cache = audioCacheRef.current;
    let entry = cache.get(src);
    if (!entry) {
      entry = { leases: 0, size: 0, url: null, promise: null };
      cache.set(src, entry);
    }
    // Refresh the key's recency, including when awaiting an in-flight request.
    cache.delete(src);
    cache.set(src, entry);
    if (entry.promise) return entry.promise;

    const generation = cacheGenerationRef.current;
    const pending = (async () => {
      const response = await apiFetch(src);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('Audio file is empty');
      if (generation !== cacheGenerationRef.current) {
        throw new Error('Audio cache cleared during download');
      }
      const url = URL.createObjectURL(blob);
      entry.size = blob.size;
      entry.url = url;
      // Defer eviction until consumers awaiting the promise can attach the URL.
      setTimeout(trimAudioCache, 0);
      return { blob, url };
    })();
    entry.promise = pending;
    try {
      return await pending;
    } catch (error) {
      if (cache.get(src) === entry) cache.delete(src);
      throw error;
    }
  }, [trimAudioCache]);

  const clearAudioCache = useCallback(() => {
    cacheGenerationRef.current += 1;
    const audio = audioRef.current;
    audio?.pause();
    if (audio) { audio.removeAttribute('src'); audio.load(); }
    activeTrackRef.current = null;
    callbacksRef.current = {};
    positionsRef.current.clear();
    setActiveTrack(null);
    setStatus('idle');
    setCurrentTime(0);
    setDuration(0);
    for (const entry of audioCacheRef.current.values()) {
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    audioCacheRef.current.clear();
  }, []);

  useEffect(() => () => {
    // Unmount cleanup: revoke URLs including entries that are still leased.
    cacheGenerationRef.current += 1;
    for (const entry of audioCacheRef.current.values()) {
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    audioCacheRef.current.clear();
  }, []);

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
    audioRef,
    activeTrack,
    status,
    currentTime,
    duration,
    error,
    claim,
    play,
    pause,
    stop,
    seek,
    getAudio,
    retainAudio,
    clearAudioCache,
  }), [
    activeTrack,
    status,
    currentTime,
    duration,
    error,
    claim,
    play,
    pause,
    stop,
    seek,
    getAudio,
    retainAudio,
    clearAudioCache,
  ]);

  return <AudioPlaybackContext.Provider value={value}>{children}</AudioPlaybackContext.Provider>;
};

export const useAudioPlayback = () => {
  const context = useContext(AudioPlaybackContext);
  if (!context) throw new Error('useAudioPlayback must be used within AudioPlaybackProvider');
  return context;
};
