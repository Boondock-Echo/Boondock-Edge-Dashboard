import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../utils/apiClient';
import { io } from 'socket.io-client';
import {
  Volume2,
  Pause,
  Play,
  Radio,
  Wifi,
  WifiOff,
  RotateCcw,
  AlertCircle,
  Headphones,
  SkipBack,
  SkipForward,
  Clock,
  Zap,
  X,
} from 'lucide-react';
import logger from '../../utils/logger';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import noticeStyles from '../ui/Notice.module.css';
import styles from '../ui/StreamsSection.module.css';

const StreamsSection = () => {
  const SOCKET_URL = window.location.origin;
  
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingStream, setPlayingStream] = useState(null);
  const [playbackMode, setPlaybackMode] = useState('live'); // 'live' or 'playback'
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPlayingTime, setCurrentPlayingTime] = useState(0);
  
  const audioContextRef = useRef(null);
  const socketRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const playbackStateRef = useRef({});  // {channelId: {isPlaying, audioContext, buffer[], bufferIndex}}
  const bufferInfoRef = useRef({});    // {channelId: bufferInfo}
  const playingStartTimeRef = useRef({});  // {channelId: { audioContextStartTime, actualStartTime }}

  // Fetch stream status
  const fetchStreamStatus = useCallback(async () => {
    try {
      const response = await api.get(`/streams/status`, {
        timeout: 5000
      });

      if (response.data.success && response.data.data) {
        setStreams(response.data.data);
        setError(null);
      }
    } catch (err) {
      logger.error('Error fetching stream status:', err);
      setError('Failed to fetch stream status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch buffer info periodically
  const fetchBufferInfo = useCallback(async (channelId) => {
    try {
      const response = await api.get(`/streams/${channelId}/buffer/info`);
      if (response.data.success) {
        bufferInfoRef.current[channelId] = response.data.data;
      }
    } catch (err) {
      logger.error(`Error fetching buffer info for channel ${channelId}:`, err);
    }
  }, []);

  // Poll stream status periodically
  useEffect(() => {
    fetchStreamStatus();
    pollingIntervalRef.current = setInterval(() => {
      fetchStreamStatus();
      // Update buffer info for playing stream
      if (playingStream !== null) {
        fetchBufferInfo(playingStream);
      }
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchStreamStatus, fetchBufferInfo, playingStream]);

  // Initialize audio context and WebSocket
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        if (!audioContextRef.current) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
          logger.info('Audio context initialized');
        }
      } catch (err) {
        logger.error('Error initializing audio context:', err);
        setError('Failed to initialize audio playback');
      }
    };

    const initWebSocket = async () => {
      try {
        socketRef.current = io(SOCKET_URL, {
          transports: ['websocket'],
          reconnectionDelay: 1000,
          reconnection: true,
        });

        socketRef.current.on('connect', () => {
          logger.info('WebSocket connected');
        });

        socketRef.current.on('audio_chunk', (data) => {
          handleAudioChunk(data);
        });

        socketRef.current.on('buffer_info', (data) => {
          bufferInfoRef.current[data.channel_id] = data.buffer_info;
        });

        socketRef.current.on('stream_error', (data) => {
          logger.error('Stream error:', data.message);
          toast.error(`Stream error: ${data.message}`, {
            position: 'bottom-right',
            autoClose: 3000,
          });
        });

        socketRef.current.on('seek_error', (data) => {
          logger.error('Seek error:', data.message);
          toast.error(`Seek error: ${data.message}`, {
            position: 'bottom-right',
            autoClose: 3000,
          });
          // Switch back to live mode on seek error
          setPlaybackMode('live');
        });

        socketRef.current.on('disconnect', () => {
          logger.warn('WebSocket disconnected');
        });
      } catch (err) {
        logger.error('Error initializing WebSocket:', err);
      }
    };

    initAudioContext();
    initWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [SOCKET_URL]);

  const handleAudioChunk = (data) => {
    try {
      const { channel_id, data: audioB64 } = data;
      const playState = playbackStateRef.current[channel_id];

      if (!playState || !playState.isPlaying) return;

      // Decode base64 audio data
      const binaryString = atob(audioB64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create audio buffer (16-bit PCM at 8kHz from ESP32)
      const audioContext = playState.audioContext;
      const audioBuffer = audioContext.createBuffer(
        1, // mono
        bytes.length / 2, // frames
        8000 // sample rate (ESP32 sends 8kHz audio)
      );

      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < bytes.length; i += 2) {
        // Convert byte pair to signed 16-bit integer
        const sample = new Int16Array(new Uint8Array([bytes[i], bytes[i + 1]]).buffer)[0];
        channelData[i / 2] = sample / 32768;
      }

      // Initialize buffering if needed
      if (!playState.bufferMode) {
        playState.bufferMode = true;
        playState.bufferedDuration = 0;
        playState.pendingBuffers = [];
      }

      // Add buffer duration to track how much we've buffered
      const bufferDuration = audioBuffer.duration;
      playState.bufferedDuration += bufferDuration;

      // If we're still buffering (less than 2 seconds), accumulate chunks
      if (playState.bufferMode && playState.bufferedDuration < 2.0) {
        playState.pendingBuffers.push(audioBuffer);
        return; // Don't schedule yet, keep buffering
      }

      // If we just reached 2 seconds of buffer, start playback
      if (playState.bufferMode && playState.pendingBuffers.length > 0) {
        // Switch from buffering to playback mode
        playState.bufferMode = false;
        const currentTime = audioContext.currentTime;
        playState.scheduledUntil = currentTime + 0.05; // Small offset for playback to start

        // Schedule all pending buffers
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

      // Now schedule the current buffer
      if (!playState.bufferMode) {
        // Check if we're falling behind - if current time is past scheduled time, jump ahead
        const currentTime = audioContext.currentTime;
        if (currentTime > playState.scheduledUntil + 1.0) {
          // We've fallen more than 1 second behind, skip ahead to prevent huge backlog
          playState.scheduledUntil = currentTime + 0.05;
        }

        // Create and schedule the source node
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.7;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Schedule this specific buffer to play at the correct time
        source.start(playState.scheduledUntil);
        
        // Update when the next buffer should be scheduled to start
        playState.scheduledUntil += audioBuffer.duration;
      }
    } catch (err) {
      logger.error('Error handling audio chunk:', err);
    }
  };

  const playStream = async (channelId, fromTimestamp = null) => {
    try {
      setPlayingStream(channelId);
      setIsPaused(false);
      setCurrentPlayingTime(0);

      const audioContext = audioContextRef.current;
      if (!audioContext) {
        throw new Error('Audio context not initialized');
      }

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Initialize playback state
      playbackStateRef.current[channelId] = {
        isPlaying: true,
        audioContext,
        scheduledUntil: null,  // Will be set on first chunk
      };

      // Fetch buffer info
      await fetchBufferInfo(channelId);

      // Connect to stream via WebSocket
      if (socketRef.current) {
        socketRef.current.emit('stream_connect', { channel_id: channelId });
        
        if (fromTimestamp) {
          // Start from specific timestamp
          setPlaybackMode('playback');
          setSelectedTimestamp(fromTimestamp);
          socketRef.current.emit('stream_seek', { 
            channel_id: channelId,
            timestamp: fromTimestamp
          });
        } else {
          // Live mode - start from current time minus 1 second for buffer
          setPlaybackMode('live');
          setSelectedTimestamp(null);
          
          // Get the current buffer info and seek to current time - 1 second
          const bufferInfo = bufferInfoRef.current[channelId];
          if (bufferInfo && bufferInfo.newest_timestamp) {
            const newestTime = new Date(bufferInfo.newest_timestamp);
            const seekTime = new Date(newestTime.getTime() - 1000); // 1 second earlier
            socketRef.current.emit('stream_seek', { 
              channel_id: channelId,
              timestamp: seekTime.toISOString()
            });
            // Track when we started playing for timestamp display
            playingStartTimeRef.current[channelId] = {
              audioContextStartTime: audioContext.currentTime,
              actualStartTime: seekTime.getTime()
            };
          } else {
            socketRef.current.emit('stream_play', { channel_id: channelId });
          }
        }
      }

      const modeText = fromTimestamp ? 'from past' : 'live';
      toast.success(`Playing stream from channel ${channelId} (${modeText})`, {
        position: 'bottom-right',
        autoClose: 2000,
      });
    } catch (err) {
      logger.error(`Error playing stream ${channelId}:`, err);
      toast.error(`Failed to play stream: ${err.message}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
      setPlayingStream(null);
    }
  };

  const stopStream = () => {
    try {
      if (playingStream !== null) {
        const playState = playbackStateRef.current[playingStream];
        if (playState) {
          playState.isPlaying = false;
          playState.bufferMode = false;
          playState.bufferedDuration = 0;
          playState.pendingBuffers = [];
        }

        if (socketRef.current) {
          socketRef.current.emit('stream_stop', { channel_id: playingStream });
        }

        delete playbackStateRef.current[playingStream];
        delete playingStartTimeRef.current[playingStream];
      }
      setPlayingStream(null);
      setPlaybackMode('live');
      setSelectedTimestamp(null);
      setIsPaused(false);
      setCurrentPlayingTime(0);
    } catch (err) {
      logger.error('Error stopping playback:', err);
    }
  };

  const pauseStream = () => {
    try {
      if (playingStream !== null) {
        const playState = playbackStateRef.current[playingStream];
        if (playState && playState.audioContext) {
          // Pause the audio context to stop all scheduled playback
          playState.audioContext.suspend();
          playState.isPlaying = false; // Stop receiving new chunks
          
          // Save the current audio context time for resume
          if (!playState.pausedAtContextTime) {
            playState.pausedAtContextTime = playState.audioContext.currentTime;
          }
        }
      }
      setIsPaused(true);
    } catch (err) {
      logger.error('Error pausing playback:', err);
    }
  };

  const resumeStream = () => {
    try {
      if (playingStream !== null) {
        const playState = playbackStateRef.current[playingStream];
        if (playState && playState.audioContext) {
          // Resume the audio context
          playState.audioContext.resume();
          playState.isPlaying = true; // Resume receiving chunks
          
          // Clear the paused time marker
          delete playState.pausedAtContextTime;
        }
        
        if (socketRef.current) {
          socketRef.current.emit('stream_play', { channel_id: playingStream });
        }
      }
      setIsPaused(false);
    } catch (err) {
      logger.error('Error resuming playback:', err);
    }
  };

  const switchToLiveMode = async () => {
    if (playingStream !== null) {
      stopStream();
      // Play live
      setTimeout(() => playStream(playingStream), 100);
    }
  };

  const seekToTime = async (offsetSeconds) => {
    if (playingStream === null) return;

    const bufferInfo = bufferInfoRef.current[playingStream];
    if (!bufferInfo || !bufferInfo.oldest_timestamp) {
      toast.error('No buffer data available', {
        position: 'bottom-right',
        autoClose: 2000,
      });
      return;
    }

    // Calculate target timestamp
    const oldestTime = new Date(bufferInfo.oldest_timestamp);
    const targetTime = new Date(oldestTime.getTime() + offsetSeconds * 1000);

    stopStream();
    setTimeout(() => playStream(playingStream, targetTime.toISOString()), 100);
  };

  const clearStreamBuffer = async (channelId) => {
    try {
      const response = await api.post(`/streams/${channelId}/clear`);

      if (response.data.success) {
        toast.success(`Cleared buffer for channel ${channelId}`, {
          position: 'bottom-right',
          autoClose: 2000,
        });
        fetchStreamStatus();
        await fetchBufferInfo(channelId);
      }
    } catch (err) {
      logger.error(`Error clearing stream ${channelId}:`, err);
      toast.error('Failed to clear stream buffer', {
        position: 'bottom-right',
        autoClose: 3000,
      });
    }
  };

  const getBufferPercentage = (channelId) => {
    const bufferInfo = bufferInfoRef.current[channelId];
    if (!bufferInfo || !bufferInfo.buffer_duration_ms || bufferInfo.buffer_duration_ms === 0) {
      return 0;
    }
    // Buffer is already full at 30 minutes, so show 100%
    return Math.min(100, (bufferInfo.buffer_duration_ms / (30 * 60 * 1000)) * 100);
  };

  const getPlaybackPosition = (channelId) => {
    const bufferInfo = bufferInfoRef.current[channelId];
    if (!bufferInfo || !bufferInfo.buffer_duration_ms) return 0;
    
    const startTimeData = playingStartTimeRef.current[channelId];
    if (!startTimeData) return 0;
    
    const { audioContextStartTime, actualStartTime } = startTimeData;
    const audioContext = audioContextRef.current;
    if (!audioContext) return 0;
    
    const elapsedAudioTime = (audioContext.currentTime - audioContextStartTime) * 1000; // ms
    const currentTime = actualStartTime + elapsedAudioTime;
    const oldestTime = new Date(bufferInfo.oldest_timestamp).getTime();
    const newestTime = new Date(bufferInfo.newest_timestamp).getTime();
    
    const bufferDurationMs = newestTime - oldestTime;
    if (bufferDurationMs <= 0) return 0;
    
    const offsetFromOldest = currentTime - oldestTime;
    return Math.min(100, Math.max(0, (offsetFromOldest / bufferDurationMs) * 100));
  };

  const getPlayingTimestamp = (channelId) => {
    const bufferInfo = bufferInfoRef.current[channelId];
    if (!bufferInfo) return '';
    
    const startTimeData = playingStartTimeRef.current[channelId];
    if (!startTimeData) return '';
    
    const { audioContextStartTime, actualStartTime } = startTimeData;
    const audioContext = audioContextRef.current;
    if (!audioContext) return '';
    
    const elapsedAudioTime = (audioContext.currentTime - audioContextStartTime) * 1000; // ms
    const currentTime = new Date(actualStartTime + elapsedAudioTime);
    return currentTime.toLocaleTimeString();
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const renderStreamCard = (stream) => {
    const isPlaying = playingStream === stream.channel_id;
    const isConnected = stream.connected;
    const bufferPercentage = getBufferPercentage(stream.channel_id);
    const playbackPosition = getPlaybackPosition(stream.channel_id);
    const bufferInfo = bufferInfoRef.current[stream.channel_id];

    return (
      <div key={stream.channel_id} className={`${cardStyles.card} ${cardStyles.compact} stack`}>
        {/* Header with channel info */}
        <div className="rowBetween">
          <div className="row">
            <Radio size={20} />
            <h3 className={cardStyles.title}>Channel {stream.channel_id}</h3>
          </div>
          <span className={`pill ${isConnected ? 'pillSuccess' : 'pillDanger'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Device info */}
        {isConnected && stream.device_ip ? (
          <div className="stack stackCompact">
            <p className={cardStyles.description}><strong>Device:</strong> {stream.device_ip}:{stream.device_port}</p>
            <p className={cardStyles.description}><strong>Packets:</strong> {stream.packet_count.toLocaleString()}</p>
            <p className={cardStyles.description}><strong>Data:</strong> {(stream.byte_count / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
            <AlertCircle size={16} className={noticeStyles.icon} />
            <div className={noticeStyles.body}><p>No device connected</p></div>
          </div>
        )}

        {/* Buffer Timeline (when playing) */}
        {isPlaying && bufferInfo && bufferInfo.has_data && (
          <div className={`${styles.timeline} stack stackCompact`}>
            {/* Mode indicator and time display */}
            <div className="rowBetween">
              <span className={`pill ${playbackMode === 'live' ? 'pillDanger' : 'pillAccent'}`}>
                {playbackMode === 'live' ? <Zap size={12} /> : <Clock size={12} />}
                {playbackMode === 'live' ? 'LIVE MODE' : 'PLAYBACK'}
              </span>
              <div className={styles.timelineMeta}>
                <div className={styles.timestamp}>{getPlayingTimestamp(stream.channel_id)}</div>
                <span>Buffer: {bufferPercentage.toFixed(0)}%</span>
              </div>
            </div>

            {/* Duration info */}
            <div className="stack stackCompact">
              <p className={cardStyles.description}>
                Available: {formatTime(bufferInfo.buffer_duration_ms / 1000)} {' / '} Max: 30:00
              </p>
              <p className={cardStyles.description}>
                From: {new Date(bufferInfo.oldest_timestamp).toLocaleTimeString()}
              </p>
            </div>

            {/* Playback bar with buffer visualization */}
            <div className="stack stackCompact">
              <div
                className={styles.timelineTrack}
                onClick={(e) => {
                  if (!bufferInfo) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const offsetSeconds = (bufferInfo.buffer_duration_ms / 1000) * percent;
                  seekToTime(offsetSeconds);
                }}
              >
                {/* Buffer fill background */}
                <div className={styles.bufferFill} style={{ width: `${bufferPercentage}%` }} />

                {/* Playback position indicator */}
                <div
                  className={styles.playhead}
                  style={{
                    left: `${playbackPosition}%`,
                    // Clamp to prevent overflow
                    maxWidth: 'calc(100% - 4px)',
                    minWidth: 'calc(100% - 4px)'
                  }}
                />
              </div>
              {/* Timeline labels */}
              <div className={styles.timelineLabels}>
                <span>{formatTime(bufferInfo.buffer_duration_ms / 1000 * (playbackPosition / 100))}</span>
                <span>{formatTime(bufferInfo.buffer_duration_ms / 1000)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="rowWrap">
              {!isPlaying || isPaused ? (
                <Button size="small" variant="success" onClick={resumeStream}><Play size={12} />Resume</Button>
              ) : (
                <Button size="small" variant="warning" onClick={pauseStream}><Pause size={12} />Pause</Button>
              )}
              <Button size="small" onClick={() => seekToTime(Math.max(0, (bufferInfo.buffer_duration_ms / 1000) - 60))}>
                <SkipBack size={12} />Back 1m
              </Button>
              <Button size="small" variant={playbackMode === 'live' ? 'danger' : 'secondary'} onClick={switchToLiveMode}>
                <Zap size={12} />Live
              </Button>
              <Button size="small" onClick={() => seekToTime((bufferInfo.buffer_duration_ms / 1000) - 10)}>
                <SkipForward size={12} />Latest
              </Button>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="rowWrap">
          {isConnected && stream.buffer_packets > 0 ? (
            <>
              {!isPlaying ? (
                <Button variant="primary" onClick={() => playStream(stream.channel_id)} disabled={!isConnected}>
                  <Play size={16} />Play (Live)
                </Button>
              ) : (
                <Button variant="danger" onClick={stopStream}><X size={16} />Stop</Button>
              )}
              <Button onClick={() => clearStreamBuffer(stream.channel_id)}><RotateCcw size={16} />Clear</Button>
            </>
          ) : (
            <Button disabled>No Audio Data</Button>
          )}
        </div>

        {/* Connection time */}
        {stream.first_connection_time && (
          <div className={styles.connectionTime}>
            <Headphones size={12} />
            <span>Connected {new Date(stream.first_connection_time).toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="stack stackLarge">
      {/* Header */}
      <div className="row">
        <Volume2 size={24} />
        <h2>UDP Audio Streams</h2>
      </div>

      {/* Description */}
      <p className={cardStyles.description}>
        Monitor and play live or historical audio from connected devices. Buffer keeps last 30 minutes in memory.
      </p>

      {/* Loading state */}
      {loading && (
        <div className="centeredContent">
          <div className="stack stackCompact">
            <span className="spinner spinnerLarge" aria-hidden="true" />
            <p>Loading stream status...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
          <AlertCircle size={20} className={noticeStyles.icon} />
          <div className={noticeStyles.body}><p>{error}</p></div>
        </div>
      )}

      {/* Stream cards grid */}
      {!loading && streams.length > 0 && (
        <div className="gridTwo">{streams.map((stream) => renderStreamCard(stream))}</div>
      )}

      {/* Empty state */}
      {!loading && streams.length === 0 && !error && (
        <div className={`${cardStyles.card} centeredContent`}>
          <div className="stack stackCompact">
            <Volume2 size={36} />
            <p className={cardStyles.description}>No streams configured. Configure UDP streaming in system settings.</p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
        <div className={noticeStyles.body}>
          <p><strong>30-Minute Rolling Buffer:</strong></p>
          <ul>
            <li>Real-time audio via WebSocket connection</li>
            <li>Last 30 minutes automatically kept in memory</li>
            <li>Click timeline to seek to past moments</li>
            <li>Switch between live and playback modes</li>
            <li>Client-side audio buffering for smooth playback</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StreamsSection;
