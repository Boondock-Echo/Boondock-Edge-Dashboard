import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Play, Pause, Volume2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import api from '../../utils/apiClient';
import { io } from 'socket.io-client';
import logger from '../../utils/logger';

const LiveAudioPopup = ({ channel, isDarkMode, onClose}) => {
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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } rounded-lg shadow-2xl border max-w-md w-full max-h-96 overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${
            isDarkMode ? 'bg-gray-900 border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'
          } px-6 py-4 flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <Volume2 className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Live Audio: {channel.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg hover:bg-gray-700 transition-colors ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div
          className={`${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } px-6 py-4 flex-1 overflow-y-auto`}
        >
          {/* Connection Status */}
          <div className="mb-4 p-3 rounded-lg bg-opacity-50 flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  Connected
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className={`text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  Disconnected
                </span>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                isDarkMode
                  ? 'bg-red-900/30 border border-red-700/50'
                  : 'bg-red-100/50 border border-red-200'
              }`}
            >
              <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
              <span className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>
                {error}
              </span>
            </div>
          )}

          {/* Buffer Info */}
          {bufferInfo && isPlaying && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm space-y-2 ${
                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
              }`}
            >
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Buffer Duration:
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                  {Math.round(bufferInfo.buffer_duration_ms / 1000)}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  Packets:
                </span>
                <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                  {bufferInfo.buffer_packets || 0}
                </span>
              </div>
            </div>
          )}

          {/* Channel Info */}
          <div
            className={`p-3 rounded-lg text-sm space-y-2 ${
              isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
            }`}
          >
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Channel ID:</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{channel.id}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Audio Port:</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                {channel.audio_stream_port || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Sample Rate:</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>8 kHz</span>
            </div>
          </div>
        </div>

        {/* Footer - Control Buttons */}
        <div
          className={`${
            isDarkMode ? 'bg-gray-900 border-t border-gray-700' : 'bg-gray-50 border-t border-gray-200'
          } px-6 py-4 flex gap-3`}
        >
          {!isPlaying ? (
            <button
              onClick={playStream}
              disabled={isLoading || !isConnected}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                  : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50'
              }`}
            >
              <Play size={16} />
              {isLoading ? 'Starting...' : 'Play'}
            </button>
          ) : (
            <button
              onClick={stopStream}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              <Pause size={16} />
              Stop
            </button>
          )}

          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveAudioPopup;
