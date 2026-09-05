import { apiFetch } from '../../utils/apiClient';
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Repeat,
  Settings,
  X,
  Minimize2,
  Maximize2,
  Heart,
  Music,
} from "lucide-react";
import _ from "lodash";

// Lazy import Tone.js to prevent auto-initialization
let ToneModule = null;
const getTone = async () => {
  if (!ToneModule) {
    ToneModule = await import("tone");
  }
  // Return the default export or the module itself
  return ToneModule.default || ToneModule;
};

const GlobalAudioPlayer = ({ audioUrl, onClose, isDarkMode = false }) => {
  // Core audio states
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Advanced audio processing
  const [analyser, setAnalyser] = useState(null);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioContextRef = useRef(null);

  // Precise controls
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [equalizer, setEqualizer] = useState({
    bass: 0,
    mid: 0,
    treble: 0,
  });

  // EQ nodes
  const filtersRef = useRef({
    bass: null,
    mid: null,
    treble: null,
  });

  // Track info
  const [trackInfo, setTrackInfo] = useState({
    title: "Audio Track",
    artist: "Unknown Artist",
  });

  // Debounced audio operations
  const debouncedSeek = useRef(
    _.debounce((time) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    }, 50)
  ).current;

  // Stable ref so the cleanup useEffect never goes stale (HIGH-23)
  const cleanupAudioContextRef = useRef(null);
  useEffect(() => {
    cleanupAudioContextRef.current = cleanupAudioContext;
  }, [cleanupAudioContext]);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();

    return () => {
      // Cancel debounced seek to prevent post-unmount state updates (HIGH-20)
      debouncedSeek.cancel();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Close AudioContext to release system audio resources (HIGH-21)
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      if (cleanupAudioContextRef.current) {
        cleanupAudioContextRef.current();
      }
    };
  }, [debouncedSeek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up audio source when URL changes
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    // Clean up previous sources
    cleanupAudioContext();

    // Set new source only — volume/playbackRate are synced in their own effects (HIGH-22)
    audioRef.current.src = audioUrl;
    audioRef.current.loop = isLooping;

    // Extract track info from URL
    const fileName = audioUrl.split("/").pop();
    if (fileName) {
      const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      const parts = fileNameWithoutExt.split(" - ");
      setTrackInfo({
        title: parts.length > 1 ? parts[1] : fileNameWithoutExt,
        artist: parts.length > 1 ? parts[0] : "Unknown Artist",
      });
    }

    // Don't initialize audio context automatically - wait for user interaction
    // AudioContext will be initialized when user clicks play

    // Add event listeners
    const handleTimeUpdate = () => setCurrentTime(audioRef.current.currentTime);
    const handleLoadedMetadata = () => setDuration(audioRef.current.duration);
    const handleEnded = () => {
      if (!isLooping) {
        setIsPlaying(false);
        setCurrentTime(audioRef.current.duration);
      }
    };

    audioRef.current.addEventListener("timeupdate", handleTimeUpdate);
    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioRef.current.addEventListener("ended", handleEnded);

    // Load audio but don't auto-play (requires user interaction)
    audioRef.current.load();

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audioRef.current.removeEventListener("ended", handleEnded);
        audioRef.current.pause();
      }

      if (cleanupAudioContextRef.current) cleanupAudioContextRef.current();
    };
  }, [audioUrl, isLooping]); // volume/playbackRate removed — handled by dedicated effects (HIGH-22)

  // Sync volume without reloading audio source (HIGH-22)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync playback rate without reloading audio source (HIGH-22)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Initialize Web Audio API for processing (only after user interaction)
  const initializeAudioProcessing = useCallback(async () => {
    try {
      // Check if AudioContext is already initialized
      if (audioContextRef.current) {
        return;
      }

      // Lazy load Tone.js only when needed (after user interaction)
      const ToneLib = await getTone();
      
      // Start audio context - this requires user interaction
      await ToneLib.start();
      
      // Get the context after starting
      const ctx = ToneLib.getContext().rawContext;
      
      // Create or use existing context
      audioContextRef.current = ctx;

      // Create analyzer
      const newAnalyser = ctx.createAnalyser();
      newAnalyser.fftSize = 2048;
      newAnalyser.smoothingTimeConstant = 0.8;
      setAnalyser(newAnalyser);

      // Create audio source
      if (audioRef.current) {
        audioSourceRef.current = ctx.createMediaElementSource(audioRef.current);

        // Create EQ filters
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = "lowshelf";
        bassFilter.frequency.value = 200;
        bassFilter.gain.value = equalizer.bass;

        const midFilter = ctx.createBiquadFilter();
        midFilter.type = "peaking";
        midFilter.frequency.value = 1000;
        midFilter.Q.value = 1;
        midFilter.gain.value = equalizer.mid;

        const trebleFilter = ctx.createBiquadFilter();
        trebleFilter.type = "highshelf";
        trebleFilter.frequency.value = 3000;
        trebleFilter.gain.value = equalizer.treble;

        // Store filter references
        filtersRef.current = {
          bass: bassFilter,
          mid: midFilter,
          treble: trebleFilter,
        };

        // Connect audio chain
        audioSourceRef.current
          .connect(bassFilter)
          .connect(midFilter)
          .connect(trebleFilter)
          .connect(newAnalyser)
          .connect(ctx.destination);
      }
    } catch (error) {
      // Silently handle autoplay policy errors - they're expected
      if (error.name !== 'NotAllowedError' && error.name !== 'NotSupportedError') {
        console.error("Audio processing initialization error:", error);
      }
    }
  }, [equalizer]);

  // Clean up audio context and connections
  const cleanupAudioContext = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    Object.values(filtersRef.current).forEach((filter) => {
      if (filter) filter.disconnect();
    });

    if (analyser) {
      analyser.disconnect();
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [analyser]);

  // Update EQ settings when they change
  useEffect(() => {
    const filters = filtersRef.current;
    if (filters.bass) filters.bass.gain.value = equalizer.bass;
    if (filters.mid) filters.mid.gain.value = equalizer.mid;
    if (filters.treble) filters.treble.gain.value = equalizer.treble;
  }, [equalizer]);

  // Update loop state when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // Generate waveform visualization
  const generateWaveform = useCallback(() => {
    if (!waveformCanvasRef.current || !audioRef.current || !audioContextRef.current)
      return;

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!audioRef.current.src) {
      return;
    }

    // Show loading message
    ctx.fillStyle = isDarkMode ? "#9ca3af" : "#6b7280";
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Loading waveform...", canvas.width / 2, canvas.height / 2);

    apiFetch(audioRef.current.src)
      .then((response) => {
        if (!response.ok) throw new Error("Network response failed");
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => audioContextRef.current.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        const channelData = audioBuffer.getChannelData(0);
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Background
        ctx.fillStyle = isDarkMode
          ? "rgba(30, 41, 59, 0.4)"
          : "rgba(241, 245, 249, 0.4)";
        ctx.fillRect(0, 0, width, height);

        // Draw waveform
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDarkMode ? "#60a5fa" : "#3b82f6";
        ctx.fillStyle = isDarkMode
          ? "rgba(96, 165, 250, 0.2)"
          : "rgba(59, 130, 246, 0.2)";

        const step = Math.ceil(channelData.length / width);
        const amplitude = height / 2;

        ctx.beginPath();

        // Top half of waveform
        for (let i = 0; i < width; i++) {
          const index = Math.floor(i * step);

          // Calculate peak for this segment
          let max = 0;
          for (let j = 0; j < step && index + j < channelData.length; j++) {
            const abs = Math.abs(channelData[index + j]);
            if (abs > max) max = abs;
          }

          const y = amplitude - max * amplitude * 0.95;

          if (i === 0) {
            ctx.moveTo(i, y);
          } else {
            ctx.lineTo(i, y);
          }
        }

        // Bottom half (mirror)
        for (let i = width - 1; i >= 0; i--) {
          const index = Math.floor(i * step);

          let max = 0;
          for (let j = 0; j < step && index + j < channelData.length; j++) {
            const abs = Math.abs(channelData[index + j]);
            if (abs > max) max = abs;
          }

          const y = amplitude + max * amplitude * 0.95;
          ctx.lineTo(i, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      })
      .catch((err) => {
        console.error("Error generating waveform:", err);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isDarkMode ? "#ef4444" : "#dc2626";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("Could not load waveform", canvas.width / 2, canvas.height / 2);
      });
  }, [isDarkMode]);

  // Real-time visualization
  useEffect(() => {
    if (!canvasRef.current || !analyser || !isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = isDarkMode
        ? "rgba(30, 41, 59, 0.4)"
        : "rgba(241, 245, 249, 0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = isDarkMode
        ? "rgba(255, 255, 255, 0.05)"
        : "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 0.5;

      // Draw grid
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = (canvas.height / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      for (let i = 0; i <= 10; i++) {
        const x = (canvas.width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw frequency bars
      const barCount = Math.min(bufferLength / 4, 128); // Limit number of bars for performance
      const barWidth = canvas.width / barCount;

      for (let i = 0; i < barCount; i++) {
        // Use logarithmic scale for more natural frequency visualization
        const index = Math.floor((i / barCount) * (bufferLength / 2));
        const barHeight = (dataArray[index] / 255) * canvas.height * 0.9;

        // Gradient color based on frequency
        const hue = (i / barCount) * 220;
        const saturation = isDarkMode ? "70%" : "60%";
        const lightness = isDarkMode ? "60%" : "55%";
        ctx.fillStyle = `hsl(${hue}, ${saturation}, ${lightness})`;

        const x = i * barWidth;
        const y = canvas.height - barHeight;
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }

      // Playhead position
      if (duration > 0) {
        const playPosition = (currentTime / duration) * canvas.width;
        ctx.fillStyle = isDarkMode
          ? "rgba(244, 63, 94, 0.8)"
          : "rgba(236, 72, 153, 0.8)";
        ctx.fillRect(playPosition - 1, 0, 2, canvas.height);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [analyser, isPlaying, currentTime, duration, isDarkMode]);

  // Playback controls
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Initialize audio processing on first user interaction
      if (!audioContextRef.current) {
        try {
          await initializeAudioProcessing();
          // Generate waveform after audio context is initialized
          if (waveformCanvasRef.current && audioRef.current?.src) {
            generateWaveform();
          }
        } catch (error) {
          // Silently handle autoplay policy errors
          if (error.name !== 'NotAllowedError' && error.name !== 'NotSupportedError') {
            console.error("Audio context initialization error:", error);
          }
        }
      }

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Playback error:", err));
    }
  }, [isPlaying, initializeAudioProcessing]);

  const handleSeek = useCallback(
    (e) => {
      if (!audioRef.current || !duration) return;

      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
      debouncedSeek(newTime);
    },
    [debouncedSeek, duration]
  );

  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    const newTime = Math.min(
      audioRef.current.currentTime + 10,
      audioRef.current.duration || 0
    );
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    const newTime = Math.max(audioRef.current.currentTime - 10, 0);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }

    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume > 0 ? volume : 0.5;
      setVolume(volume > 0 ? volume : 0.5);
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handlePlaybackRateChange = useCallback((e) => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);

    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  }, []);

  const handleEQChange = useCallback((band, e) => {
    const newValue = parseFloat(e.target.value);

    setEqualizer((prev) => ({
      ...prev,
      [band]: newValue,
    }));

    // Apply EQ change immediately
    if (filtersRef.current[band]) {
      filtersRef.current[band].gain.value = newValue;
    }
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const toggleFavorite = useCallback(() => {
    setIsFavorite((prev) => !prev);
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds) || seconds === null) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  if (!audioUrl) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out rounded-t-lg shadow-xl ${
        isDarkMode ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Expanded view */}
      {isExpanded && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-full ${
                  isDarkMode ? "bg-slate-800" : "bg-slate-100"
                }`}
              >
                <Music
                  size={20}
                  className={isDarkMode ? "text-blue-400" : "text-blue-500"}
                />
              </div>
              <div>
                <h3 className="font-medium">{trackInfo.title}</h3>
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {trackInfo.artist}
                </p>
              </div>
            </div>

            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isFavorite
                  ? isDarkMode
                    ? "text-pink-400"
                    : "text-pink-500"
                  : isDarkMode
                  ? "text-slate-400"
                  : "text-slate-500"
              }`}
            >
              <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>

          {/* Waveform visualization */}
          <div
            className={`mb-4 overflow-hidden rounded-lg border ${
              isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            <div className="relative">
              <canvas
                ref={waveformCanvasRef}
                className="w-full h-32"
                width={600}
                height={128}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                  display: duration > 0 ? "block" : "none",
                }}
              />
            </div>
          </div>

          {/* Spectrum analyzer */}
          <div
            className={`mb-4 overflow-hidden rounded-lg border ${
              isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-32"
              width={600}
              height={128}
            />
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div
              className={`mb-4 rounded-lg border ${
                isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
              } p-4`}
            >
              <div className="space-y-6">
                {/* Playback rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="playback-rate"
                      className="text-sm font-medium"
                    >
                      Playback Speed
                    </label>
                    <span className="text-sm font-mono">
                      {playbackRate.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="playback-rate"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={playbackRate}
                    onChange={handlePlaybackRateChange}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: isDarkMode
                        ? `linear-gradient(to right, #3b82f6 ${
                            ((playbackRate - 0.5) / 1.5) * 100
                          }%, #4b5563 ${
                            ((playbackRate - 0.5) / 1.5) * 100
                          }%)`
                        : `linear-gradient(to right, #3b82f6 ${
                            ((playbackRate - 0.5) / 1.5) * 100
                          }%, #d1d5db ${
                            ((playbackRate - 0.5) / 1.5) * 100
                          }%)`,
                    }}
                  />
                </div>

                <div
                  className={`h-px ${
                    isDarkMode ? "bg-slate-700" : "bg-slate-200"
                  }`}
                />

                {/* Equalizer */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">Equalizer</label>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="loop-toggle"
                        className="text-sm cursor-pointer"
                      >
                        Loop
                      </label>
                      <input
                        id="loop-toggle"
                        type="checkbox"
                        checked={isLooping}
                        onChange={toggleLoop}
                        className="w-4 h-4 rounded bg-slate-200 border-slate-300 checked:bg-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bass */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label htmlFor="eq-bass" className="text-sm font-medium">
                          Bass
                        </label>
                        <span className="text-sm font-mono">
                          {equalizer.bass}dB
                        </span>
                      </div>
                      <input
                        id="eq-bass"
                        type="range"
                        min={-10}
                        max={10}
                        step={1}
                        value={equalizer.bass}
                        onChange={(e) => handleEQChange("bass", e)}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: isDarkMode
                            ? `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.bass + 10) / 20) * 100
                              }%, #4b5563 ${
                                ((equalizer.bass + 10) / 20) * 100
                              }%)`
                            : `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.bass + 10) / 20) * 100
                              }%, #d1d5db ${
                                ((equalizer.bass + 10) / 20) * 100
                              }%)`,
                        }}
                      />
                    </div>

                    {/* Mid */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label htmlFor="eq-mid" className="text-sm font-medium">
                          Mid
                        </label>
                        <span className="text-sm font-mono">
                          {equalizer.mid}dB
                        </span>
                      </div>
                      <input
                        id="eq-mid"
                        type="range"
                        min={-10}
                        max={10}
                        step={1}
                        value={equalizer.mid}
                        onChange={(e) => handleEQChange("mid", e)}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: isDarkMode
                            ? `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.mid + 10) / 20) * 100
                              }%, #4b5563 ${
                                ((equalizer.mid + 10) / 20) * 100
                              }%)`
                            : `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.mid + 10) / 20) * 100
                              }%, #d1d5db ${
                                ((equalizer.mid + 10) / 20) * 100
                              }%)`,
                        }}
                      />
                    </div>

                    {/* Treble */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label
                          htmlFor="eq-treble"
                          className="text-sm font-medium"
                        >
                          Treble
                        </label>
                        <span className="text-sm font-mono">
                          {equalizer.treble}dB
                        </span>
                      </div>
                      <input
                        id="eq-treble"
                        type="range"
                        min={-10}
                        max={10}
                        step={1}
                        value={equalizer.treble}
                        onChange={(e) => handleEQChange("treble", e)}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: isDarkMode
                            ? `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.treble + 10) / 20) * 100
                              }%, #4b5563 ${
                                ((equalizer.treble + 10) / 20) * 100
                              }%)`
                            : `linear-gradient(to right, #3b82f6 ${
                                ((equalizer.treble + 10) / 20) * 100
                              }%, #d1d5db ${
                                ((equalizer.treble + 10) / 20) * 100
                              }%)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main controls - always visible */}
      <div className="p-4">
        {/* Progress bar */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-xs font-mono w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            disabled={!duration}
            className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            style={{
              background: duration
                ? isDarkMode
                  ? `linear-gradient(to right, #3b82f6 ${
                      (currentTime / duration) * 100
                    }%, #4b5563 ${(currentTime / duration) * 100}%)`
                  : `linear-gradient(to right, #3b82f6 ${
                      (currentTime / duration) * 100
                    }%, #d1d5db ${(currentTime / duration) * 100}%)`
                : isDarkMode
                ? "#4b5563"
                : "#d1d5db",
            }}
          />
          <span className="text-xs font-mono w-10">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center">
            <div className="group relative">
              <button
                onClick={toggleSettings}
                className={`p-2 rounded-full hover:bg-slate-700/50 ${
                  showSettings
                    ? isDarkMode
                      ? "text-blue-400"
                      : "text-blue-500"
                    : isDarkMode
                    ? "text-slate-400"
                    : "text-slate-500"
                }`}
              >
                <Settings size={20} />
              </button>
              <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Settings
              </span>
            </div>

            <div className="group relative">
              <button
                onClick={toggleLoop}
                className={`p-2 rounded-full hover:bg-slate-700/50 ${
                  isLooping
                    ? isDarkMode
                      ? "text-blue-400"
                      : "text-blue-500"
                    : isDarkMode
                    ? "text-slate-400"
                    : "text-slate-500"
                }`}
              >
                <Repeat size={20} />
              </button>
              <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Toggle Loop
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={skipBackward}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <SkipBack size={20} />
            </button>

            <button
              onClick={togglePlay}
              className={`p-2 rounded-full ${
                isDarkMode
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white`}
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="ml-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <SkipForward size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            <div className="w-16 hidden sm:block">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: isDarkMode
                    ? `linear-gradient(to right, #3b82f6 ${
                        (isMuted ? 0 : volume) * 100
                      }%, #4b5563 ${(isMuted ? 0 : volume) * 100}%)`
                    : `linear-gradient(to right, #3b82f6 ${
                        (isMuted ? 0 : volume) * 100
                      }%, #d1d5db ${(isMuted ? 0 : volume) * 100}%)`,
                }}
              />
            </div>

            <button
              onClick={toggleExpand}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <button
              onClick={onClose}
              className={`p-2 rounded-full hover:bg-slate-700/50 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalAudioPlayer;