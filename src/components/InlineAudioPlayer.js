import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { useAudioPlayback } from './AudioPlaybackContext';
import Button from './ui/Button';
import styles from './ui/AudioPlayer.module.css';

const formatAudioTime = (time) => {
  if (!Number.isFinite(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const InlineAudioPlayer = ({
  ownerId,
  src,
  autoPlay = false,
  stopOnUnmount = false,
  onEnded,
  onError,
  onClose,
  timestamp,
  formatTimestamp,
  showWaveform = false,
  showTransport = false,
  className = '',
  children,
}) => {
  const { audioRef, activeTrack, status, currentTime, duration, play, pause, stop, seek } = useAudioPlayback();
  const [waveform, setWaveform] = useState([]);
  const canvasRef = useRef(null);
  const isActive = activeTrack?.ownerId === ownerId;
  const isPlaying = isActive && status === 'playing';
  const playbackTime = isActive ? currentTime : 0;
  const playbackDuration = isActive ? duration : 0;

  useEffect(() => {
    if (autoPlay && src) play({ ownerId, src, onEnded, onError });
  }, [autoPlay, ownerId, src, onEnded, onError, play]);

  useEffect(() => () => {
    if (stopOnUnmount) stop(ownerId);
  }, [ownerId, stop, stopOnUnmount]);

  useEffect(() => {
    if (!showWaveform || !src) {
      setWaveform([]);
      return undefined;
    }

    let cancelled = false;
    let context;
    const loadWaveform = async () => {
      try {
        const response = await apiFetch(src);
        const data = await response.arrayBuffer();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
        const buffer = await context.decodeAudioData(data);
        const channel = buffer.getChannelData(0);
        const sampleCount = 200;
        const blockSize = Math.max(1, Math.floor(channel.length / sampleCount));
        const samples = Array.from({ length: sampleCount }, (_, index) => {
          const start = index * blockSize;
          const end = Math.min(start + blockSize, channel.length);
          let sum = 0;
          for (let offset = start; offset < end; offset += 1) sum += Math.abs(channel[offset]);
          return end > start ? sum / (end - start) : 0;
        });
        const peak = Math.max(...samples, 0);
        if (!cancelled) setWaveform(samples.map((sample) => (peak ? sample / peak : 0)));
      } catch (error) {
        if (!cancelled) {
          setWaveform([]);
          onError?.(error);
        }
      }
    };
    loadWaveform();
    return () => {
      cancelled = true;
      context?.close().catch(() => {});
    };
  }, [onError, showWaveform, src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return undefined;
    const draw = () => {
      const width = Math.max(canvas.parentElement?.clientWidth || 0, 1);
      const height = 32;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const progress = playbackDuration ? playbackTime / playbackDuration : 0;
      const barWidth = width / waveform.length;
      const themeStyles = getComputedStyle(document.documentElement);
      const played = themeStyles.getPropertyValue('--ui-accent').trim() || '#2563eb';
      const unplayed = themeStyles.getPropertyValue('--ui-muted').trim() || '#94a3b8';
      ctx.clearRect(0, 0, width, height);
      waveform.forEach((value, index) => {
        const barHeight = Math.max(2, value * height * 0.8);
        ctx.fillStyle = index / waveform.length <= progress ? played : unplayed;
        ctx.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 1), barHeight);
      });
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [playbackDuration, playbackTime, waveform]);

  const start = () => play({ ownerId, src, onEnded, onError });
  const toggle = () => (isPlaying ? pause() : start());
  const skip = (seconds) => seek(playbackTime + seconds);
  const seekFromPointer = (event) => {
    if (!playbackDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    seek(((event.clientX - rect.left) / rect.width) * playbackDuration);
  };

  if (typeof children === 'function') {
    return children({
      audioRef, isActive, isPlaying, status: isActive ? status : 'idle',
      currentTime: playbackTime, duration: playbackDuration,
      play: start, pause, stop: () => stop(ownerId), seek, toggle,
    });
  }

  if (showTransport || showWaveform) {
    const displayedTimestamp = formatTimestamp?.(timestamp, playbackTime);
    const progress = playbackDuration ? (playbackTime / playbackDuration) * 100 : 0;
    return (
      <div className={`${styles.player} ${className}`} onClick={(event) => event.stopPropagation()}>
        {displayedTimestamp && (
          <div className={styles.timestamp}>
            <span className="font-semibold">Timestamp: </span><span className="ml-1">{displayedTimestamp}</span>
          </div>
        )}
        <div className={styles.controls}>
          {showTransport && <Button size="icon" onClick={() => skip(-5)} aria-label="Back 5 seconds"><span className="material-symbols-outlined text-[18px]">replay_5</span></Button>}
          <button type="button" onClick={toggle} className={styles.playToggle} aria-label={isPlaying ? 'Pause audio' : 'Play audio'}>
            <span className="material-symbols-outlined text-[22px] text-white">{isPlaying ? 'pause_circle' : 'play_circle'}</span>
          </button>
          {showTransport && <Button size="icon" onClick={() => skip(5)} aria-label="Forward 5 seconds"><span className="material-symbols-outlined text-[18px]">forward_5</span></Button>}
          <span className={styles.time}>{formatAudioTime(playbackTime)}</span>
          <div className={styles.timeline}>
            {showWaveform && waveform.length > 0 && <div className={styles.waveform} onClick={seekFromPointer}><canvas ref={canvasRef} className={styles.waveformCanvas} /></div>}
            <div className={styles.progressTrack} onClick={seekFromPointer}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className={styles.time}>{formatAudioTime(playbackDuration)}</span>
          {onClose && <Button size="icon" onClick={onClose} aria-label="Close player"><span className="material-symbols-outlined text-[18px]">close</span></Button>}
        </div>
      </div>
    );
  }

  return <button type="button" onClick={toggle} className={`${styles.playToggle} ${className}`} aria-label={isPlaying ? 'Pause audio' : 'Play audio'}>{isPlaying ? <Pause /> : <Play />}</button>;
};

export default InlineAudioPlayer;
