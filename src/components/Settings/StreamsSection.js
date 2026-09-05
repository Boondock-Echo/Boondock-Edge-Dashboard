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

const StreamsSection = ({ isDarkMode}) => {
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
      <div
        key={stream.channel_id}
        className={`p-4 rounded-lg border-2 transition-all ${
          isDarkMode
            ? `border-gray-700 bg-gray-800 hover:bg-gray-750`
            : `border-gray-300 bg-gray-50 hover:bg-gray-100`
        }`}
      >
        {/* Header with channel info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold">Channel {stream.channel_id}</h3>
          </div>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" title="Connected" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" title="Disconnected" />
            )}
          </div>
        </div>

        {/* Device info */}
        {isConnected && stream.device_ip ? (
          <div className="text-sm mb-3 space-y-1">
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              <span className="font-medium">Device:</span> {stream.device_ip}:{stream.device_port}
            </p>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              <span className="font-medium">Packets:</span> {stream.packet_count.toLocaleString()}
            </p>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              <span className="font-medium">Data:</span> {(stream.byte_count / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-3 p-2 bg-opacity-50 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>No device connected</span>
            </div>
          </div>
        )}

        {/* Buffer Timeline (when playing) */}
        {isPlaying && bufferInfo && bufferInfo.has_data && (
          <div className="mb-4 space-y-3 p-3 rounded bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20">
            {/* Mode indicator and time display */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {playbackMode === 'live' ? (
                  <div className="flex items-center gap-1 text-red-400">
                    <Zap className="w-3 h-3" />
                    <span>LIVE MODE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-blue-400">
                    <Clock className="w-3 h-3" />
                    <span>PLAYBACK</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  {getPlayingTimestamp(stream.channel_id)}
                </div>
                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Buffer: {bufferPercentage.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Duration info */}
            <div className="text-xs space-y-1">
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Available: {formatTime(bufferInfo.buffer_duration_ms / 1000)} 
                {' / '} Max: 30:00
              </p>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                From: {new Date(bufferInfo.oldest_timestamp).toLocaleTimeString()}
              </p>
            </div>

            {/* Playback bar with buffer visualization */}
            <div className="space-y-1">
              <div
                className={`relative h-3 rounded-full cursor-pointer group overflow-hidden ${
                  isDarkMode ? 'bg-gray-700 bg-opacity-50' : 'bg-gray-200 bg-opacity-50'
                }`}
                onClick={(e) => {
                  if (!bufferInfo) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const offsetSeconds = (bufferInfo.buffer_duration_ms / 1000) * percent;
                  seekToTime(offsetSeconds);
                }}
              >
                {/* Buffer fill background */}
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-green-400 to-blue-500 opacity-60 transition-all"
                  style={{ width: `${bufferPercentage}%` }}
                />
                
                {/* Playback position indicator */}
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white shadow-lg transition-all hover:scale-125 border-2 border-blue-500 z-10"
                  style={{ 
                    left: `${playbackPosition}%`,
                    // Clamp to prevent overflow
                    maxWidth: 'calc(100% - 4px)',
                    minWidth: 'calc(100% - 4px)'
                  }}
                />
              </div>
              {/* Timeline labels */}
              <div className="flex justify-between text-xs opacity-60">
                <span>{formatTime(bufferInfo.buffer_duration_ms / 1000 * (playbackPosition / 100))}</span>
                <span>{formatTime(bufferInfo.buffer_duration_ms / 1000)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex gap-2 justify-between flex-wrap">
              <div className="flex gap-2">
                {!isPlaying || isPaused ? (
                  <button
                    onClick={resumeStream}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isDarkMode
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseStream}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                      isDarkMode
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    }`}
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </button>
                )}
              </div>

              <button
                onClick={() => seekToTime(Math.max(0, (bufferInfo.buffer_duration_ms / 1000) - 60))}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  isDarkMode
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                }`}
              >
                <SkipBack className="w-3 h-3" />
                Back 1m
              </button>
              
              <button
                onClick={switchToLiveMode}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  playbackMode === 'live'
                    ? isDarkMode
                      ? 'bg-red-600 text-white'
                      : 'bg-red-500 text-white'
                    : isDarkMode
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                Live
              </button>
              
              <button
                onClick={() => seekToTime((bufferInfo.buffer_duration_ms / 1000) - 10)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  isDarkMode
                    ? 'bg-gray-600 hover:bg-gray-500 text-white'
                    : 'bg-gray-400 hover:bg-gray-500 text-white'
                }`}
              >
                <SkipForward className="w-3 h-3" />
                Latest
              </button>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex gap-2 flex-wrap">
          {isConnected && stream.buffer_packets > 0 ? (
            <>
              {!isPlaying ? (
                <button
                  onClick={() => playStream(stream.channel_id)}
                  disabled={!isConnected}
                  className={`flex items-center gap-2 px-3 py-2 rounded font-medium transition-all text-sm ${
                    isDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                    : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Play (Live)
                </button>
              ) : (
                <>
                  <button
                    onClick={stopStream}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-medium transition-all text-sm ${
                      isDarkMode
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    <X className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}

              <button
                onClick={() => clearStreamBuffer(stream.channel_id)}
                className={`flex items-center gap-2 px-3 py-2 rounded font-medium transition-all text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            </>
          ) : (
            <button
              disabled
              className={`flex-1 py-2 rounded font-medium text-sm opacity-50 cursor-not-allowed ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              No Audio Data
            </button>
          )}
        </div>

        {/* Connection time */}
        {stream.first_connection_time && (
          <div className="text-xs mt-3 pt-3 border-t border-gray-600 flex items-center gap-2">
            <Headphones className="w-3 h-3" />
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
              Connected {new Date(stream.first_connection_time).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Volume2 className="w-6 h-6 text-blue-500" />
        <h2 className="text-2xl font-bold">UDP Audio Streams</h2>
      </div>

      {/* Description */}
      <p
        className={`text-sm ${
          isDarkMode ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        Monitor and play live or historical audio from connected devices. Buffer keeps last 30 minutes in memory.
      </p>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Loading stream status...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          className={`p-4 rounded-lg border-2 flex items-center gap-3 ${
            isDarkMode
              ? 'bg-red-900 border-red-700 text-red-100'
              : 'bg-red-100 border-red-300 text-red-800'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Stream cards grid */}
      {!loading && streams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {streams.map((stream) => renderStreamCard(stream))}
        </div>
      )}

      {/* Empty state */}
      {!loading && streams.length === 0 && !error && (
        <div
          className={`p-6 rounded-lg border-2 text-center ${
            isDarkMode
              ? 'border-gray-700 bg-gray-800'
              : 'border-gray-300 bg-gray-100'
          }`}
        >
          <Volume2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
            No streams configured. Configure UDP streaming in system settings.
          </p>
        </div>
      )}

      {/* Info box */}
      <div
        className={`p-4 rounded-lg border-l-4 ${
          isDarkMode
            ? 'bg-blue-900 border-blue-600 text-blue-100'
            : 'bg-blue-100 border-blue-500 text-blue-900'
        }`}
      >
        <p className="text-sm font-medium mb-2">30-Minute Rolling Buffer:</p>
        <ul className="text-sm space-y-1 ml-4">
          <li>• Real-time audio via WebSocket connection</li>
          <li>• Last 30 minutes automatically kept in memory</li>
          <li>• Click timeline to seek to past moments</li>
          <li>• Switch between live and playback modes</li>
          <li>• Client-side audio buffering for smooth playback</li>
        </ul>
      </div>
    </div>
  );
};

export default StreamsSection;
