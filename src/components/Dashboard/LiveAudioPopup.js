import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import api from '../../utils/apiClient';
import { io } from 'socket.io-client';
import logger from '../../utils/logger';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';

const LiveAudioPopup = ({ channel, onClose}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bufferInfo, setBufferInfo] = useState(null);

  const audioContextRef = useRef(null);
  const playbackStateRef = useRef(null);
  const socketRef = useRef(null);

  const SOCKET_URL = window.location.origin;

  const handleAudioChunk = useCallback((data) => {
    try {
      const { channel_id, data: audioB64 } = data;
      
      if (channel_id !== channel.id || !playbackStateRef.current?.isPlaying) {
        return;
      }

      const playState = playbackStateRef.current;

      // Decode base64 audio data
      const binaryString = atob(audioB64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio buffer (16-bit PCM at 8kHz)
      const audioContext = playState.audioContext;
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        bytes.length / 2, // frames
        8000 // sample rate
      );

      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < bytes.length; i += 2) {
        const sample = new Int16Array(new Uint8Array([bytes[i], bytes[i + 1]]).buffer)[0];
        channelData[i / 2] = sample / 32768;
      }

      // Buffer management
      if (!playState.bufferMode) {
        playState.bufferMode = true;
        playState.bufferedDuration = 0;
        playState.pendingBuffers = [];
      }

      const bufferDuration = audioBuffer.duration;
      playState.bufferedDuration += bufferDuration;

      if (playState.bufferMode && playState.bufferedDuration < 2.0) {
        playState.pendingBuffers.push(audioBuffer);
        return;
      }

      if (playState.bufferMode && playState.pendingBuffers.length > 0) {
        playState.bufferMode = false;
        const currentTime = audioContext.currentTime;
        playState.scheduledUntil = currentTime + 0.05;

        for (const pendingBuffer of playState.pendingBuffers) {
          const source = audioContext.createBufferSource();
          source.buffer = pendingBuffer;

          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0.7;
          source.connect(gainNode);
          gainNode.connect(audioContext.destination);

          source.start(playState.scheduledUntil);
          playState.scheduledUntil += pendingBuffer.duration;
        }
        playState.pendingBuffers = [];
      }

      if (!playState.bufferMode) {
        const currentTime = audioContext.currentTime;
        if (currentTime > playState.scheduledUntil + 1.0) {
          playState.scheduledUntil = currentTime + 0.05;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.7;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start(playState.scheduledUntil);
        playState.scheduledUntil += audioBuffer.duration;
      }
    } catch (err) {
      logger.error('Error handling audio chunk:', err);
    }
  }, [channel.id]);

  const stopStream = () => {
    try {
      if (playbackStateRef.current) {
        playbackStateRef.current.isPlaying = false;
        playbackStateRef.current.bufferMode = false;
        playbackStateRef.current.bufferedDuration = 0;
        playbackStateRef.current.pendingBuffers = [];
      }

      if (socketRef.current) {
        socketRef.current.emit('stream_stop', { channel_id: channel.id });
      }

      setIsPlaying(false);
      setBufferInfo(null);
    } catch (err) {
      logger.error('Error stopping stream:', err);
    }
  };

  // Initialize socket connection
  useEffect(() => {
    try {
      socketRef.current = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        setError(null);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        if (playbackStateRef.current?.isPlaying) {
          setIsPlaying(false);
        }
      });

      socketRef.current.on('stream_audio_chunk', (data) => {
        handleAudioChunk(data);
      });

      socketRef.current.on('connect_error', (err) => {
        // MEDIUM-22: surface socket errors via state instead of only console
        setError(`WebSocket connection error: ${err.message}`);
        logger.error('Socket connect_error:', err);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        // HIGH-24: close AudioContext on unmount to release system audio resources
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
      };
    } catch (err) {
      logger.error('Error initializing socket:', err);
      setError('Failed to initialize WebSocket connection');
    }
  }, [handleAudioChunk, channel.id]);

  // Fetch buffer info periodically
  useEffect(() => {
    if (!isPlaying) return;

    const fetchBufferInfo = async () => {
      try {
        const response = await api.get(`/streams/${channel.id}/buffer/info`);
        if (response.data?.data) {
          setBufferInfo(response.data.data);
        }
      } catch (err) {
        logger.warn(`Error fetching buffer info for channel ${channel.id}:`, err);
      }
    };

    const interval = setInterval(fetchBufferInfo, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, channel.id]);

  const playStream = async () => {
    if (!channel.audio_stream_enabled) {
      setError('Audio streaming is not enabled for this channel');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      audioContextRef.current = audioContext;
      playbackStateRef.current = {
        isPlaying: true,
        audioContext,
        scheduledUntil: null,
        bufferMode: false,
        bufferedDuration: 0,
        pendingBuffers: [],
      };

      // Fetch buffer info
      try {
        const response = await api.get(`/streams/${channel.id}/buffer/info`);
        if (response.data?.data) {
          setBufferInfo(response.data.data);
        }
      } catch (err) {
        logger.warn(`Error fetching buffer info:`, err);
      }

      // Connect to stream via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('stream_connect', { channel_id: channel.id });
        socketRef.current.emit('stream_play', { channel_id: channel.id });
      }

      setIsPlaying(true);
    } catch (err) {
      logger.error('Error playing stream:', err);
      setError('Failed to start playback: ' + err.message);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <dialog
      ref={(dialog) => {
        if (!dialog) return;
        if (!dialog.open) dialog.showModal();
      }}
      className={modalStyles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className={modalStyles.header}>
        <div className="row">
          <Volume2 size={20} aria-hidden="true" />
          <h3 className={modalStyles.title}>Live Audio: {channel.name}</h3>
        </div>
        <Button
          onClick={onClose}
          size="icon"
          variant="ghost"
          aria-label={`Close live audio for ${channel.name}`}
        >
          <X size={20} />
        </Button>
      </div>

      {/* Body */}
      <div className={`${modalStyles.body} stack`}>
        {/* Connection Status */}
        <div>
          {isConnected ? (
            <span className="pill pillSuccess">
              <Wifi size={16} aria-hidden="true" />
              Connected
            </span>
          ) : (
            <span className="pill pillDanger">
              <WifiOff size={16} aria-hidden="true" />
              Disconnected
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
            <AlertCircle className={noticeStyles.icon} size={16} aria-hidden="true" />
            <div className={noticeStyles.body}>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Buffer Info */}
        {bufferInfo && isPlaying && (
          <div className={`${cardStyles.card} ${cardStyles.compact} ${cardStyles.surface} stack stackCompact`}>
            <div className="rowBetween">
              <span>Buffer Duration:</span>
              <strong>{Math.round(bufferInfo.buffer_duration_ms / 1000)}s</strong>
            </div>
            <div className="rowBetween">
              <span>Packets:</span>
              <strong>{bufferInfo.buffer_packets || 0}</strong>
            </div>
          </div>
        )}

        {/* Channel Info */}
        <div className={`${cardStyles.card} ${cardStyles.compact} ${cardStyles.surface} stack stackCompact`}>
          <div className="rowBetween">
            <span>Channel ID:</span>
            <strong>{channel.id}</strong>
          </div>
          <div className="rowBetween">
            <span>Audio Port:</span>
            <strong>{channel.audio_stream_port || 'N/A'}</strong>
          </div>
          <div className="rowBetween">
            <span>Sample Rate:</span>
            <strong>8 kHz</strong>
          </div>
        </div>
      </div>

      {/* Footer - Control Buttons */}
      <div className={modalStyles.actionsBetween}>
        {!isPlaying ? (
          <Button
            onClick={playStream}
            disabled={isLoading || !isConnected}
            variant="primary"
            className="grow"
          >
            <Play size={16} />
            {isLoading ? 'Starting...' : 'Play'}
          </Button>
        ) : (
          <Button
            onClick={stopStream}
            variant="danger"
            className="grow"
          >
            <Pause size={16} />
            Stop
          </Button>
        )}

        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      </div>
    </dialog>
  );
};

export default LiveAudioPopup;
