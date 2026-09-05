import { api, apiFetch } from '../../utils/apiClient';
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, ChevronLeft, X, RotateCcw, Scissors, Save, Download, Plus, History, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { useLocation, useNavigate } from 'react-router-dom';
import ContentEditable from "react-contenteditable";


// Debounce utility to prevent rapid transcription requests
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const formatUtcRecordingTime = (value) => {
  const compact = String(value || '').match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  const date = compact
    ? new Date(Date.UTC(...compact.slice(1).map(Number).map((part, index) => index === 1 ? part - 1 : part)))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
};

const getRecordingTimes = (startTime, duration) => {
  const formattedStart = formatUtcRecordingTime(startTime);
  const durationSeconds = Number(duration);
  if (!formattedStart || !Number.isFinite(durationSeconds)) {
    return { recordingStartTime: 'Unknown', recordingEndTime: 'Unknown' };
  }

  const startMs = new Date(formattedStart.replace(' UTC', 'Z').replace(' ', 'T')).getTime();
  return {
    recordingStartTime: formattedStart,
    recordingEndTime: formatUtcRecordingTime(startMs + durationSeconds * 1000),
  };
};

const ProfessionalAudioEditor = ({
  isDarkMode = false,
  timeFormat = "24h",
  transcription = [],
  messageId = null,
  onClose = () => console.log("Close clicked"),
}) => {
  const queryParams = new URLSearchParams(window.location.search);
  const location = useLocation();
  const navigationMessage = location.state?.message;



  // const initialAudioUrl = queryParams.get("audioUrl") || "/audio/bell-ringing-05.wav";
  
  //  const messageId = queryParams.get("messageId");

  
  const urlMessageId = queryParams.get("messageId");
  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const wavesurferRef = useRef(null);
  const waveformRef = useRef(null);
  const workerRef = useRef(null);
 const [error, setError] = useState(null);
  const isMounted = useRef(true);
  
  const [originalAudioBuffer, setOriginalAudioBuffer] = useState(null);
  const [processedAudioBuffer, setProcessedAudioBuffer] = useState(null);
  const [croppedAudioWav, setCroppedAudioWav] = useState(null); // Store cropped audio for saving
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [transcriptionText, setTranscriptionText] = useState(navigationMessage?.message || "");
  const [waveformKey, setWaveformKey] = useState(0); // Force re-render of waveform
  const navigate = useNavigate();
  // TO-DO Why do we need to variables?
  const [audioUrl, setAudioUrl] = useState(navigationMessage?.url || "");
  const [initialAudioUrl, setInitialAudioUrl] = useState(navigationMessage?.url || "");

  const [loading, setLoading] = useState(true);
  
const [recordingTimes] = useState(() => getRecordingTimes(
  navigationMessage?.time,
  navigationMessage?.duration,
));
const userTimezone = location.state?.userTimezone || 'UTC';

// later in your component
const { recordingStartTime, recordingEndTime } = recordingTimes;

// console.log("audioUrl:", audioUrl);

const [channelName, setChannelName] = useState(navigationMessage?.channelName || "");

// Show toast notification
const showToast = useCallback((message, type = 'success') => {
  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isInfo = type === 'info';
  
  toast.className = `fixed top-4 right-4 z-[9999] px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full ${
    isDarkMode 
      ? (isSuccess ? 'bg-green-600 text-white' : isError ? 'bg-red-600 text-white' : 'bg-blue-600 text-white')
      : (isSuccess ? 'bg-green-100 text-green-800 border border-green-200' : isError ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200')
  }`;
  
  const icon = isSuccess ? 
    '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' :
    isError ? 
    '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>' :
    '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 100-16 8 8 0 000 16zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
  
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      ${icon}
      <span class="font-medium">${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);
  
  // Remove toast after 3 seconds (5 for errors)
  const duration = isError ? 5000 : 3000;
  setTimeout(() => {
    toast.classList.add('translate-x-full');
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}, [isDarkMode]);

  // Fetch audio URL based on messageId

 
 // Fetch audio URL based on messageId
  useEffect(() => {
    const effectiveMessageId = messageId || urlMessageId;
    if (navigationMessage?.url) {
      setIsLoading(false);
      return;
    }
    if (!effectiveMessageId) {
      setError('No messageId provided');
      setIsLoading(false);
      return;
    }

    // Commented out because it doesn't work with apiUrl
    // TO-DO: Handle fallback better -- maybe pass in the inbox in arg instead of state.
    // const fetchAudioUrl = async () => {
    //   setIsLoading(true);
    //   try {
    //     const response = await api.get(`/audio_url/${effectiveMessageId}`, {
    //       timeout: 10000
    //     });
    //     if (!isMounted.current) return;
    //     if (response.data?.download_url) {
    //      setInitialAudioUrl(response.data.download_url);
    //      setAudioUrl(response.data.download_url);
    //     // console.log("Fetched audio URL:", response.data.download_url);
    //       setError(null);
    //     } else {
    //       setError('No audio file found for this message ID');
    //     }
    //   } catch (error) {
    //     if (!isMounted.current) return;
    //     setError(`Failed to fetch audio URL: ${error.message}`);
    //   } finally {
    //     if (isMounted.current) {
    //       setIsLoading(false);
    //     }
    //   }
    // };

    // fetchAudioUrl();
  }, [messageId, urlMessageId, navigationMessage?.url]);



  // Parse audioUrl to extract channelId and audioName
  const parseAudioUrl = useCallback((url) => {
  const absoluteUrl = new URL(url, window.location.origin); // Fix for relative URLs
  const urlParts = absoluteUrl.pathname.split("/");
  const audioName = urlParts.pop();
  const channelId = urlParts.pop();
  return { channelId, audioName };
}, []);

const datefillter = useCallback((url) => {
  if (!url) return "Unknown";

  try {
    const absoluteUrl = new URL(url, window.location.origin); // Fix for relative URLs
    const urlParts = absoluteUrl.pathname.split("/");
    const audioName = urlParts.pop(); // e.g., '2026-01-21-12-54-27.wav' or 'audio_20250702_051214.wav'
    if (!audioName) return "Unknown";

    let year, month, day;

    // New format: YYYY-MM-DD-HH-MM-SS.wav
    const newFormatMatch = audioName.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (newFormatMatch) {
      year = parseInt(newFormatMatch[1], 10);
      month = parseInt(newFormatMatch[2], 10) - 1; // 0-based month
      day = parseInt(newFormatMatch[3], 10);
    } else {
      // Legacy format: look for 8 consecutive digits (YYYYMMDD)
      const legacyMatch = audioName.match(/(\d{8})/);
      if (!legacyMatch) return "Unknown";

      const dateStr = legacyMatch[0];
      year = parseInt(dateStr.slice(0, 4), 10);
      month = parseInt(dateStr.slice(4, 6), 10) - 1;
      day = parseInt(dateStr.slice(6, 8), 10);
    }

    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    console.error("Failed to parse recording date from URL:", e);
    return "Unknown";
  }
}, []);

// Prefer recording date from backend start_time, fall back to filename parsing
const formatRecordingDate = useCallback(() => {
  // recordingStartTime format example: "2026-01-21 12:54:27 IST"
  if (typeof recordingStartTime === "string" && recordingStartTime.includes(" ")) {
    try {
      const [datePart] = recordingStartTime.split(" "); // "2026-01-21"
      const date = new Date(datePart);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    } catch (e) {
      console.error("Failed to format recording date from start_time:", e);
    }
  }

  // Fallback to parsing from filename if start_time not available
  return datefillter(audioUrl);
}, [recordingStartTime, audioUrl, datefillter]);





// getting start timing & end timing of audio
// Utility function to format time safely with timezone conversion
const format_Time = (time) => {
  console.log("format_Time called with:", time);
  
  if (!time) {
    console.log("No time provided");
    return "N/A";
  }
  
  try {
    // The backend provides timestamps in format like "2025-08-07 17:19:42 IST"
    // We need to remove the timezone suffix before parsing
    let cleanTime = time;
    if (typeof time === 'string' && time.includes(' ')) {
      // Try multiple approaches to clean the timestamp
      // First, try to remove common timezone abbreviations including CEST
      // cleanTime = time.replace(/\s+(IST|UTC|GMT|EST|PST|CST|MST|EDT|PDT|CDT|MDT|CET|CEST|JST|BST|WET|WEST|EET|EEST)\s*$/i, '');
      
      // If that didn't work, try a more general approach for any timezone abbreviation
      if (cleanTime === time) {
        cleanTime = time.replace(/\s+[A-Z]{2,6}\s*$/i, '');
      }
      
      console.log("Cleaned time:", cleanTime);
    }
    
    // Try to parse the date more explicitly
    let date;
    if (cleanTime.includes('-') && cleanTime.includes(':')) {
      // Format: "2025-08-07 16:05:30"
      const [datePart, timePart] = cleanTime.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute, second] = timePart.split(':');
      
      // Create date in ISO format for better parsing
      const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}.000Z`;
      date = new Date(isoString);
      console.log("Created ISO string:", isoString);
    } else {
      date = new Date(cleanTime);
    }
    
    console.log("Parsed date:", date.toISOString());
    
    // Validate the parsed date
    if (isNaN(date.getTime())) {
      console.log("Invalid date after parsing:", date);
      return "N/A";
    }
    
    // Format only the time in a user-friendly format using the user's timezone
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: timeFormat === "12h", // Use time format preference
      timeZone: userTimezone // Use the fetched timezone
    });
    
    console.log("Formatted time:", formattedTime);
    return formattedTime;
  } catch (error) {
    console.error("Error formatting time:", error);
    return "N/A";
  }
};

// Function to format recording times to match waveform timing format (HH:MM:SS.000)
const formatRecordingTime = (time) => {
  if (!time) return "N/A";
  
  try {
    // The backend provides timestamps in format like "2025-08-07 17:19:42 IST"
    // We need to extract just the time part and format it
    if (typeof time === 'string' && time.includes(' ')) {
      // Split by space to separate date and time
      const parts = time.split(' ');
      if (parts.length >= 2) {
        const timePart = parts[1]; // Get the time part (HH:MM:SS)
        
        // Parse the time components
        const timeComponents = timePart.split(':');
        if (timeComponents.length >= 3) {
          const [hours, minutes, seconds] = timeComponents;
          
          // Convert to Date object for proper time formatting
          const date = new Date();
          date.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds));
          
          // Format according to user's time format preference
          const formattedTime = date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: timeFormat === "12h"
          });
          
          // For 12-hour format, we need to move AM/PM to the end after milliseconds
          if (timeFormat === "12h") {
            // Split the formatted time to separate time and AM/PM
            const timeParts = formattedTime.split(' ');
            const timeOnly = timeParts[0]; // "05:18:24"
            const ampm = timeParts[1]; // "AM" or "PM"
            return `${timeOnly}.000 ${ampm}`;
          } else {
            return `${formattedTime}.000`;
          }
        }
      }
    }
    
    return "N/A";
  } catch (error) {
    console.error("Error formatting recording time:", error);
    return "N/A";
  }
};



useEffect(() => {
  const effectiveMessageId = messageId || urlMessageId;
  if (!effectiveMessageId || navigationMessage?.channelName) return;

  // TO-DO Same as fetchAudio
  // const fetchChannel = async () => {
  //   try {
  //     const res = await api.get(`/channel_by_message/${effectiveMessageId}`);
  //     if (res.data && res.data.name) {
  //       setChannelName(res.data.name);
  //     } else {
  //       setChannelName("Unknown");
  //     }
  //   } catch (err) {
  //     console.error("Failed to fetch channel data:", err);
  //     setChannelName("Unknown");
  //   }
  // };

  // fetchChannel();
}, [messageId, urlMessageId, navigationMessage?.channelName]);


  // Format time function
const formatTime = useCallback((time) => {
  if (isNaN(time)) return "0:00.000";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time % 1) * 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}, []);

// Format actual recording time (recording start time + current position)
const formatActualTime = useCallback((timeOffset) => {
  if (!recordingStartTime || isNaN(timeOffset)) return "00:00:00.000";
  
  try {
    // The backend already provides the time in the correct timezone
    // We just need to extract the time part and add the offset
    if (typeof recordingStartTime === 'string' && recordingStartTime.includes(' ')) {
      // Format: "2025-08-07 17:19:42 IST" or "2025-08-07 17:19:42"
      const parts = recordingStartTime.split(' ');
      const timePart = parts[1]; // "17:19:42"
      
      // Parse the time components
      const timeComponents = timePart.split(':');
      if (timeComponents.length >= 3) {
        const [hours, minutes, seconds] = timeComponents;
        
        // Convert to total seconds
        const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
        
        // Add the time offset
        const newTotalSeconds = totalSeconds + timeOffset;
        
        // Convert back to Date object for proper time formatting
        const newHours = Math.floor(newTotalSeconds / 3600);
        const newMinutes = Math.floor((newTotalSeconds % 3600) / 60);
        const newSeconds = newTotalSeconds % 60;
        
        // Create a date object with the calculated time
        const date = new Date();
        date.setHours(newHours, newMinutes, Math.floor(newSeconds));
        
        // Format according to user's time format preference
        const formattedTime = date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: timeFormat === "12h"
        });
        
        // Add milliseconds
        const milliseconds = Math.floor((newSeconds % 1) * 1000);
        const formattedMilliseconds = milliseconds.toString().padStart(3, '0');
        
        // For 12-hour format, we need to move AM/PM to the end after milliseconds
        if (timeFormat === "12h") {
          // Split the formatted time to separate time and AM/PM
          const timeParts = formattedTime.split(' ');
          const timeOnly = timeParts[0]; // "05:18:24"
          const ampm = timeParts[1]; // "AM" or "PM"
          const result = `${timeOnly}.${formattedMilliseconds} ${ampm}`;
          console.log(`formatActualTime: ${recordingStartTime} + ${timeOffset}s = ${result}`);
          return result;
        } else {
          const result = `${formattedTime}.${formattedMilliseconds}`;
          console.log(`formatActualTime: ${recordingStartTime} + ${timeOffset}s = ${result}`);
          return result;
        }
      }
    }
    
    // Fallback: if the above parsing fails, use a simpler approach
    // Just add the offset to the current time display
    const currentTimeDisplay = formatTime(timeOffset);
    console.log(`formatActualTime fallback: ${timeOffset}s = ${currentTimeDisplay}`);
    return currentTimeDisplay;
  } catch (error) {
    console.error("Error formatting recording time:", error);
    return "00:00:00.000";
  }
}, [recordingStartTime, formatTime, timeFormat]);


  // Fetch default transcription from API
  useEffect(() => {
    const effectiveMessageId = messageId || urlMessageId;
    if (!effectiveMessageId || transcriptionText) return;

    // TO-DO Same as FetchAudio
    // const fetchTranscription = async () => {
    //   setIsLoading(true);
    //   try {
    //     const response = await apiFetch(`/transcribe_save/${effectiveMessageId}`);
    //     if (!response.ok) {
    //       throw new Error(`Failed to fetch transcription: ${response.statusText}`);
    //     }
    //     const result = await response.json();
    //     console.log("Fetched transcription:", result);

    //     if (result.transcription) {
    //       setTranscriptionText(result.transcription);
    //     } else {
    //       setTranscriptionText("No transcription found for this message ID.");
    //     }
    //   } catch (error) {
    //     console.error("Error fetching transcription:", error);
    //     setTranscriptionText(`Error: Failed to fetch transcription - ${error.message}`);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };

    // fetchTranscription();
  }, [messageId, urlMessageId, transcriptionText]);

  // Reinitialize WaveSurfer when waveformKey changes or audio changes
  const initializeWaveSurfer = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    if (!waveformRef.current) return;

    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: isDarkMode ? "#4B5563" : "#E5E7EB",
      progressColor: "#9333EA",
      cursorColor: "#9333EA",
      barWidth: 2,
      barRadius: 2,
      height: 100,
      responsive: true,
      normalize: true,
      interact: true,
      dragToSeek: true,
      media: audioRef.current,
    });

    wavesurferRef.current.on("ready", () => {
      setDuration(wavesurferRef.current.getDuration());
      setIsLoading(false);
      if (zoomLevel !== 1) {
        wavesurferRef.current.zoom(zoomLevel);
      }
    });

    wavesurferRef.current.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    wavesurferRef.current.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    wavesurferRef.current.on("play", () => {
      setIsPlaying(true);
    });

    wavesurferRef.current.on("pause", () => {
      setIsPlaying(false);
    });

    wavesurferRef.current.on("error", (error) => {
      console.error("WaveSurfer error:", error);
      setTranscriptionText(`WaveSurfer error: ${error}`);
    });

    if (audioUrl) {
      wavesurferRef.current.load(audioUrl);
    }
  }, [isDarkMode, audioUrl, zoomLevel]);

  // Initialize AudioContext and Worker
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

    workerRef.current = new Worker(
      URL.createObjectURL(
        new Blob(
          [`
            function audioBufferToWav(bufferData, sampleRate, numberOfChannels) {
              const length = bufferData[0].length;
              const bytesPerSample = 2;
              const blockAlign = numberOfChannels * bytesPerSample;
              const byteRate = sampleRate * blockAlign;
              const dataSize = length * blockAlign;
              const bufferSize = 44 + dataSize;
              
              const arrayBuffer = new ArrayBuffer(bufferSize);
              const view = new DataView(arrayBuffer);
              
              const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                  view.setUint8(offset + i, string.charCodeAt(i));
                }
              };
              
              writeString(0, 'RIFF');
              view.setUint32(4, bufferSize - 8, true);
              writeString(8, 'WAVE');
              writeString(12, 'fmt ');
              view.setUint32(16, 16, true);
              view.setUint16(20, 1, true);
              view.setUint16(22, numberOfChannels, true);
              view.setUint32(24, sampleRate, true);
              view.setUint32(28, byteRate, true);
              view.setUint16(32, blockAlign, true);
              view.setUint16(34, bytesPerSample * 8, true);
              writeString(36, 'data');
              view.setUint32(40, dataSize, true);
              
              let offset = 44;
              for (let i = 0; i < length; i++) {
                for (let channel = 0; channel < numberOfChannels; channel++) {
                  const sample = Math.max(-1, Math.min(1, bufferData[channel][i]));
                  view.setInt16(offset, sample * 0x7FFF, true);
                  offset += 2;
                }
              }
              
              return arrayBuffer;
            }

            self.onmessage = async (e) => {
              const { type, bufferData, startSample, endSample, sampleRate, channels } = e.data;
              if (type === 'convertToWav') {
                const wav = audioBufferToWav(bufferData, sampleRate, channels);
                self.postMessage({ wav, duration: bufferData[0].length / sampleRate });
              } else if (type === 'trim') {
                const newLength = endSample - startSample;
                const trimmedData = bufferData.map(channel => channel.subarray(startSample, endSample));
                const wav = audioBufferToWav(trimmedData, sampleRate, channels);
                self.postMessage({ wav, duration: newLength / sampleRate });
              }
            };
          `],
          { type: "application/javascript" }
        )
      )
    );

    workerRef.current.onmessage = (e) => {
      const { wav, duration: newDuration } = e.data;
      const newUrl = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
      
      if (audioUrl !== initialAudioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      if (wavesurferRef.current) {
        wavesurferRef.current.pause();
        wavesurferRef.current.seekTo(0);
      }
      setIsPlaying(false);
      
      setAudioUrl(newUrl);
      setDuration(newDuration);
      setCurrentTime(0);
      setCroppedAudioWav(wav);
      
      setWaveformKey(prev => prev + 1);
      
      setIsProcessing(false);
      setProcessProgress(100);
      setTimeout(() => setProcessProgress(0), 1000);
      
      // Show success toast for audio processing
      showToast('Audio processing completed successfully!', 'success');
    };

    return () => {
      if (audioContextRef.current?.state !== "closed") audioContextRef.current.close();
      if (wavesurferRef.current) wavesurferRef.current.destroy();
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [audioUrl, initialAudioUrl]);

  // Initialize WaveSurfer
  useEffect(() => {
    initializeWaveSurfer();
  }, [initializeWaveSurfer, waveformKey]);

  // Initialize transcription text from prop
  useEffect(() => {
    if (transcriptionText) return;
    let formatted = "";
    if (Array.isArray(transcription)) {
      formatted = transcription
        .map(({ text, start, end }) =>
          start !== undefined && end !== undefined
            ? `[${formatTime(start)} - ${formatTime(end)}] ${text}`
            : text
        )
        .join("\n");
    } else if (typeof transcription === "string") {
      formatted = transcription;
    }
    console.log("Initializing transcriptionText from prop:", formatted);
    setTranscriptionText(formatted);
  }, [transcription, formatTime, transcriptionText]);

  // Debug transcriptionText updates
  useEffect(() => {
    console.log("transcriptionText updated:", transcriptionText);
  }, [transcriptionText]);

  // Load and decode audio
  const loadAudioBuffer = useCallback(
    async (url) => {
      try {
        setIsLoading(true);
        const response = await apiFetch(url, { mode: "cors" });
        if (!response.ok) throw new Error("Failed to fetch audio");
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        setOriginalAudioBuffer(audioBuffer);
        setProcessedAudioBuffer(audioBuffer);
        return audioBuffer;
      } catch (error) {
        console.error("Error loading audio:", error);
        setTranscriptionText(`Error: Failed to load audio - ${error.message}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Serialize AudioBuffer for Web Worker
  const serializeAudioBuffer = (audioBuffer) => {
    const channels = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i).slice());
    }
    return {
      bufferData: channels,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    };
  };

  // Delete Before
  const handleDeleteBefore = useCallback(async () => {
    if (!processedAudioBuffer || isProcessing) return;

    setIsProcessing(true);
    setProcessProgress(10);
    const sampleRate = processedAudioBuffer.sampleRate;
    const startSample = Math.floor(currentTime * sampleRate);
    const newLength = processedAudioBuffer.length - startSample;

    if (newLength <= 0) {
      showToast("Cannot delete - would result in empty audio", "error");
      setIsProcessing(false);
      setProcessProgress(0);
      return;
    }

    showToast("Deleting audio before current position...", "info");
    workerRef.current.postMessage({
      type: "trim",
      ...serializeAudioBuffer(processedAudioBuffer),
      startSample,
      endSample: processedAudioBuffer.length,
    });
    setProcessProgress(50);
  }, [currentTime, processedAudioBuffer, isProcessing, showToast]);

  // Delete After
  const handleDeleteAfter = useCallback(async () => {
    if (!processedAudioBuffer || isProcessing) return;

    setIsProcessing(true);
    setProcessProgress(10);
    const sampleRate = processedAudioBuffer.sampleRate;
    const endSample = Math.floor(currentTime * sampleRate);
    const newLength = endSample;

    if (newLength <= 0) {
      showToast("Cannot delete - would result in empty audio", "error");
      setIsProcessing(false);
      setProcessProgress(0);
      return;
    }

    showToast("Deleting audio after current position...", "info");
    workerRef.current.postMessage({
      type: "trim",
      ...serializeAudioBuffer(processedAudioBuffer),
      startSample: 0,
      endSample,
    });
    setProcessProgress(50);
  }, [currentTime, processedAudioBuffer, isProcessing, showToast]);

const handledownloadaudio = async () => {
  // TO-DO Doubt if this works -- why do we need this?
  try {
    showToast('Starting download...', 'info');
    const res = await api.get(`/audio_url/${messageId || urlMessageId}?time_format=${timeFormat}`);
    let downloadUrl = res.data.download_url; // e.g., "/recordings/channel_3/audio_20250707_120747.wav"

    if (downloadUrl) {
      // Prepend the correct API base URL if downloadUrl is relative
      if (downloadUrl.startsWith('/')) {
        downloadUrl = new URL(downloadUrl, window.location.origin).href;
      }
      const fullDownloadUrl = new URL(downloadUrl, window.location.origin).href; // Ensure valid absolute URL
      console.log(fullDownloadUrl);
      // Use formatted filename from API response (respects time format preference), fallback to "audio.wav"
      const filename = res.data.utc_filename || res.data.filename || "audio.wav";

      const a = document.createElement("a");
      a.href = fullDownloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast('Download started successfully!', 'success');
    } else {
      console.error("No download URL provided in the response");
      showToast('No download URL available', 'error');
    }
  } catch (error) {
    console.error("Failed to download audio:", error.message);
    showToast(`Download failed: ${error.message}`, 'error');
  }
};


  // Reload page
  const handleReload = useCallback(() => {
    showToast('Page reloaded successfully', 'info');
    window.location.reload();
  }, [showToast]);

  // Handle transcription with improved error handling
  const handleTranscribe = useCallback(
    debounce(async () => {
      if (!audioUrl || isProcessing || isLoading) {
        console.log('Transcription blocked: ', { audioUrl, isProcessing, isLoading });
        return;
      }

      setIsProcessing(true);
      setProcessProgress(10);
      setTranscriptionText('Transcribing...');
      showToast('Starting transcription...', 'info');

      try {
        // TO-DO why are we calling audio for transription
        console.log('Fetching audio from:', audioUrl);
        const response = await apiFetch( audioUrl, { mode: 'cors' });
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        console.log('Audio blob fetched:', {
          size: audioBlob.size,
          type: audioBlob.type,
        });

        if (audioBlob.size === 0) {
          throw new Error('Audio file is empty');
        }

        const wavBlob = audioBlob.type === 'audio/wav' ? audioBlob : new Blob([audioBlob], { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');

        for (let [key, value] of formData.entries()) {
          console.log(`FormData ${key}:`, value);
        }

        // console.log('Sending transcription request to: http://localhost:3999/transcribe');
        const transcribeResponse = await apiFetch('/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (!transcribeResponse.ok) {
          const errorText = await transcribeResponse.text().catch(() => 'No error details available');
          throw new Error(`Transcription API failed: ${transcribeResponse.status} ${transcribeResponse.statusText} - ${errorText}`);
        }

        const result = await transcribeResponse.json();
        console.log('Transcription response:', result);

        let formatted = '';
        if (result.status === 'success') {
          if (Array.isArray(result.segments)) {
            formatted = result.segments
              .map(({ text, start, end }) =>
                start !== undefined && end !== undefined
                  ? `[${formatTime(start)} - ${formatTime(end)}] ${text}`
                  : text
              )
              .join('\n');
          } else if (result.transcription) {
            formatted = result.transcription;
          } else if (result.text) {
            formatted = result.text;
          } else {
            throw new Error('Invalid transcription response format');
          }
          console.log('Transcription formatted:', formatted);
          setTranscriptionText(formatted);
          showToast('Transcription completed successfully!', 'success');
        } else {
          throw new Error(`Transcription request failed: ${result.error || 'Unknown error'}`);
        }

        setProcessProgress(80);
      } catch (error) {
        console.error('Transcription error:', error);
        setTranscriptionText(`Error: Transcription service is currently unavailable - ${error.message}. Please try again later.`);
        showToast(`Transcription failed: ${error.message}`, 'error');
      } finally {
        setIsProcessing(false);
        setProcessProgress(100);
        setTimeout(() => setProcessProgress(0), 1000);
      }
    }, 500),
    [audioUrl, isProcessing, isLoading, formatTime]
  );




  // Function to reload audio after revert
  const reloadAudioAfterRevert = useCallback(async () => {
    if (!audioUrl) return;
    
    try {
      // Stop current playback
      if (wavesurferRef.current) {
        wavesurferRef.current.pause();
        wavesurferRef.current.seekTo(0);
      }
      
      // Reload the audio file - WaveSurfer will handle this when audioUrl changes
      
      // Reload audio buffer for processing
      await loadAudioBuffer(audioUrl);
      
      // Reset playback state
      setIsPlaying(false);
      setCurrentTime(0);
      
    } catch (error) {
      console.error('Failed to reload audio after revert:', error);
    }
  }, [audioUrl, loadAudioBuffer]);

  // History management functions
  const fetchHistory = useCallback(async () => {
    const effectiveMessageId = messageId || urlMessageId;
    if (!effectiveMessageId) return;

    setIsLoadingHistory(true);
    try {
      const response = await api.get(`/recording/${effectiveMessageId}/history`);
      setHistoryVersions(response.data.history || []);
      
      // Store timezone info if available
      if (response.data.timezone) {
        console.log('History timezone:', response.data.timezone);
        setHistoryTimezone(response.data.timezone);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [messageId, urlMessageId]);

  const revertToVersion = useCallback(async (versionNumber) => {
    const effectiveMessageId = messageId || urlMessageId;
    if (!effectiveMessageId) return;

    setIsProcessing(true);
    showToast('Reverting to version...', 'info');
    
    try {
      const response = await api.post(`/recording/${effectiveMessageId}/history/${versionNumber}/revert`);
      
      if (response.data.data && response.data.data.transcription) {
        setTranscriptionText(response.data.data.transcription);
      }
      
      // If audio was restored, reload the audio
      if (response.data.audio_restored) {
        showToast('Audio and transcription reverted successfully!', 'success');
        
        // Force reload the audio by updating the audio URL
        try {
          const audioResponse = await api.get(`/audio_url/${effectiveMessageId}`);
          if (audioResponse.data?.download_url) {
            const fullAudioUrl = audioResponse.data.download_url;
            setAudioUrl(fullAudioUrl);
            setInitialAudioUrl(fullAudioUrl);
            
            // Force re-render of waveform
            setWaveformKey(prev => prev + 1);
            
            // Reload audio buffer and reset state
            await reloadAudioAfterRevert();
          }
        } catch (audioError) {
          console.error('Failed to reload audio after revert:', audioError);
          showToast('Audio reverted but failed to reload in player', 'error');
        }
      } else {
        showToast('Transcription reverted successfully!', 'success');
      }
      
      // Refresh history after revert
      await fetchHistory();
      
      setShowHistory(false);
      setSelectedVersion(null);
    } catch (error) {
      console.error('Failed to revert to version:', error);
      setTranscriptionText(`Error: Failed to revert to version - ${error.message}`);
      showToast(`Failed to revert: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [messageId, urlMessageId, fetchHistory, showToast, reloadAudioAfterRevert]);

  const deleteVersion = useCallback(async (versionNumber) => {
    const effectiveMessageId = messageId || urlMessageId;
    if (!effectiveMessageId) return;

    try {
      await api.delete(`/recording/${effectiveMessageId}/history/${versionNumber}`);
      await fetchHistory(); // Refresh history
      showToast('Version deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete version:', error);
      if (error.response?.status === 403) {
        showToast('Cannot delete the original version', 'error');
      } else {
        showToast(`Failed to delete version: ${error.message}`, 'error');
      }
    }
  }, [messageId, urlMessageId, fetchHistory, showToast]);

  // Save transcription and cropped audio
  const handleSaveTranscription = useCallback(async () => {
    const effectiveMessageId = messageId || urlMessageId;
    if (!effectiveMessageId) {
      setTranscriptionText("Error: No message ID provided for saving transcription");
      return;
    }
    if (!transcriptionText.trim()) {
      setTranscriptionText("Error: Transcription is empty");
      return;
    }
    if (isProcessing || isLoading) return;

    setIsProcessing(true);
    setProcessProgress(10);
    console.log("Saving transcription and cropped audio for message_id:", effectiveMessageId);

    try {
      const formData = new FormData();
      formData.append("transcription", transcriptionText);

      if (croppedAudioWav) {
        const { channelId, audioName } = parseAudioUrl(audioUrl);
        let safeAudioName = audioName || "cropped_audio.wav";
        
        if (!safeAudioName.toLowerCase().endsWith('.wav')) {
          safeAudioName = safeAudioName.replace(/\.[^.]*$/, '') + '.wav';
        }
        
        const wavBlob = new Blob([croppedAudioWav], { type: "audio/wav" });
        
        console.log("Cropped audio blob size:", wavBlob.size);
        console.log("Cropped audio blob type:", wavBlob.type);
        console.log("Safe audio name:", safeAudioName);
        
        formData.append("croppedAudio", wavBlob, safeAudioName);
        formData.append("channelId", channelId || "");

        try {
          const originalResponse = await apiFetch(initialAudioUrl);
          const originalBlob = await originalResponse.blob();
          let backupAudioName = safeAudioName.replace(/\.wav$/i, "_bakp.wav");
          
          if (!backupAudioName.toLowerCase().endsWith('.wav')) {
            backupAudioName += '.wav';
          }
          
          formData.append("originalAudio", originalBlob, backupAudioName);
        } catch (originalError) {
          console.warn("Could not fetch original audio for backup:", originalError);
        }
      }

      for (let [key, value] of formData.entries()) {
        if (value instanceof File || value instanceof Blob) {
          console.log(`FormData ${key}:`, {
            name: value.name || 'unnamed',
            size: value.size,
            type: value.type
          });
        } else {
          console.log(`FormData ${key}:`, value);
        }
      }

      const response = await apiFetch(`/transcribe_save/${effectiveMessageId}`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      console.log("Save transcription response:", result);

      if (response.ok) {
        showToast('Transcription saved successfully!', 'success');
        
        // Log timezone info if available
        if (result.timezone) {
          console.log('Save timezone:', result.timezone);
        }
        
        // Refresh history after successful save
        await fetchHistory();
      } else {
        throw new Error(result.error || `Server error: ${response.status} ${response.statusText}`);
      }

      setProcessProgress(80);
    } catch (error) {
      console.error("Save transcription error:", error);
      showToast(`Failed to save transcription: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setProcessProgress(100);
      setTimeout(() => setProcessProgress(0), 1000);
    }
  }, [transcriptionText, messageId, urlMessageId, isProcessing, isLoading, croppedAudioWav, audioUrl, initialAudioUrl, parseAudioUrl, fetchHistory]);

  // Save current state to undo stack
  const saveToUndoStack = (text) => {
    setUndoStack((prev) => [...prev, text]);
    setRedoStack([]); // Clear redo stack when new change is made
  };

  // Handle text changes (typing)
  const handleChange = (e) => {
    const newText = e.target.value;
    saveToUndoStack(transcriptionText); // Save current state before updating
    setTranscriptionText(newText);
  };

  // Append new text at cursor or end
  const appendText = (newText) => {
    saveToUndoStack(transcriptionText); // Save current state before appending
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && contentEditableRef.current) {
      const range = selection.getRangeAt(0);
      range.deleteContents(); // Remove any selected text
      range.insertNode(document.createTextNode(newText));

      // Move cursor to the end of inserted text
      range.setStartAfter(range.startContainer);
      range.setEndAfter(range.startContainer);
      selection.removeAllRanges();
      selection.addRange(range);

      // Update state with the current content
      setTranscriptionText(contentEditableRef.current.innerHTML);
    } else {
      // Append to the end if no cursor
      setTranscriptionText((prev) => prev + newText);
    }
  };

  // Handle undo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousText = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, transcriptionText]); // Save current state to redo stack
    setUndoStack((prev) => prev.slice(0, -1)); // Remove last state from undo stack
    setTranscriptionText(previousText);

    // Restore cursor to the end
    if (contentEditableRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false); // Move cursor to the end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextText = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, transcriptionText]); // Save current state to undo stack
    setRedoStack((prev) => prev.slice(0, -1)); // Remove last state from redo stack
    setTranscriptionText(nextText);

    // Restore cursor to the end
    if (contentEditableRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false); // Move cursor to the end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };



const [undoStack, setUndoStack] = useState([]);
const [redoStack, setRedoStack] = useState([]);

// History management state
const [historyVersions, setHistoryVersions] = useState([]);
const [showHistory, setShowHistory] = useState(false);
const [historyLoaded, setHistoryLoaded] = useState(false);
const [selectedVersion, setSelectedVersion] = useState(null);
const [isLoadingHistory, setIsLoadingHistory] = useState(false);
const [historyTimezone, setHistoryTimezone] = useState('IST');

// edit transcription text
const contentEditableRef = useRef(null);

  // Load audio and handle playback
  useEffect(() => {
    if (!audioUrl) return;

    audioRef.current.src = audioUrl;
    audioRef.current.volume = volume;

    const handleLoadedMetadata = () => {
      setDuration(audioRef.current.duration);
      if (audioUrl === initialAudioUrl) {
        loadAudioBuffer(audioUrl);
      }
    };

    audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioUrl, volume, initialAudioUrl, loadAudioBuffer]);

  const togglePlayPause = useCallback(() => {
    if (!wavesurferRef.current) return;
    
    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
    }
  }, []);

  const handleSkipBackward = useCallback(() => {
    if (!wavesurferRef.current || !duration) return;
    const newTime = Math.max(0, currentTime - 1);
    wavesurferRef.current.seekTo(newTime / duration);
  }, [currentTime, duration]);

  const handleSkipForward = useCallback(() => {
    if (!wavesurferRef.current || !duration) return;
    const newTime = Math.min(duration, currentTime + 1);
    wavesurferRef.current.seekTo(newTime / duration);
  }, [currentTime, duration]);

 const [clickedTimeMs, setClickedTimeMs] = useState(null); // state to store milliseconds

const handleWaveformClick = useCallback(
  (e) => {
    if (!waveformRef.current || !wavesurferRef.current || !duration) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    const ms = Math.floor(newTime * 1000); // Convert to milliseconds

    wavesurferRef.current.seekTo(percentage);
    setCurrentTime(newTime);
    setClickedTimeMs(ms); // Store ms
  },
  [duration]
);

  const handleClose = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      wavesurferRef.current.seekTo(0);
    }
    
    if (audioUrl && audioUrl !== initialAudioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    
    navigate(-1);
  }, [audioUrl, initialAudioUrl, navigate]);

  const handleStop = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      wavesurferRef.current.seekTo(0);
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      <header className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"}`}>
        <button
          onClick={handleClose}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <ChevronLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            disabled={isProcessing || isLoading}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}
          >
            <RotateCcw size={14} className="inline mr-1" /> Reload
          </button>
          <button
            onClick={handleDeleteBefore}
            disabled={isProcessing || isLoading || !processedAudioBuffer}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-red-800 hover:bg-red-700 text-red-200" : "bg-red-100 hover:bg-red-200 text-red-700"}`}
          >
            <Scissors size={14} className="inline mr-1" /> Delete Before
          </button>
          <button
            onClick={handleDeleteAfter}
            disabled={isProcessing || isLoading || !processedAudioBuffer}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-red-800 hover:bg-red-700 text-red-200" : "bg-red-100 hover:bg-red-200 text-red-700"}`}
          >
            <Scissors size={14} className="inline mr-1" /> Delete After
          </button>
          <button
            onClick={handleTranscribe}
            disabled={isProcessing || isLoading || !audioUrl}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-blue-800 hover:bg-blue-700 text-blue-200" : "bg-blue-100 hover:bg-blue-200 text-blue-700"}`}
          >
            Transcribe
          </button>
          <button
            onClick={handleSaveTranscription}
            disabled={isProcessing || isLoading || !transcriptionText.trim() || (!messageId && !urlMessageId)}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-green-800 hover:bg-green-700 text-green-200" : "bg-green-100 hover:bg-green-200 text-green-700"}`}
          >
            <Save size={14} className="inline mr-1" /> Save
          </button>

          <button
            onClick={() => {
              const opening = !showHistory;
              setShowHistory(opening);
              if (opening && !historyLoaded) {
                setHistoryLoaded(true);
                fetchHistory();
              }
            }}
            disabled={isLoadingHistory}
            className={`px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-blue-800 hover:bg-blue-700 text-blue-200" : "bg-blue-100 hover:bg-blue-200 text-blue-700"}`}
          >
            <History size={14} className="inline mr-1" /> History ({historyVersions.length})
          </button>

      <button
        onClick={handledownloadaudio}
        disabled={isProcessing || isLoading || !transcriptionText.trim() || (!messageId && !urlMessageId)}
        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isDarkMode
            ? "bg-emerald-700 hover:bg-emerald-600 text-white"
            : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
          }`}
      >
        <Download size={14} className="inline mr-1 -mt-0.5" /> Download
      </button>




        </div>
        <button
          onClick={handleClose}
          className={`p-2 rounded-lg ${isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100"}`}
        >
          <X size={20} />
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
     <div className={`flex items-center justify-between p-4 rounded-lg mb-6 ${isDarkMode ? "bg-gray-800" : "bg-gray-50"}`}>
  <div className="flex justify-between w-full">
    {/* Left side: Audio Name and Station */}
    <div>
      <h1 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
        {parseAudioUrl(audioUrl)?.audioName || "Unknown Audio"}
      </h1>
      <div className="mt-1">
        <span className="text-sm font-semibold">Station: </span>
        <span className="text-sm">{channelName || "Loading..."}</span>
      </div>
    </div>

    {/* Right side: Recording Details */}
  <div className="text-sm text-right space-y-1">
  <div>
    <span className="font-semibold">Recording date: </span>
    <span className="font-medium">{formatRecordingDate()}</span>
  </div>

  <div>
    <span className="font-semibold">Recording start time: </span>
    <span className="font-medium">
      {formatRecordingTime(recordingStartTime)}
    </span>
    {userTimezone && (
      <span className="text-xs text-blue-500"> ({userTimezone})</span>
    )}
  </div>

  <div>
    <span className="font-semibold">Recording end time: </span>
    <span className="font-medium">
      {formatRecordingTime(recordingEndTime)}
    </span>
    {userTimezone && (
      <span className="text-xs text-blue-500"> ({userTimezone})</span>
    )}
  </div>
</div>


  </div>

 
</div>


        <div className="flex items-center justify-between mb-4">

           {/* Processing/Loading Indicator */}
  {(isProcessing || isLoading) && (
    <div className="flex items-center gap-2 mt-4">
      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <span className={`text-sm ${isDarkMode ? "text-yellow-400" : "text-yellow-600"}`}>
        {isProcessing ? `Processing (${processProgress}%)` : "Loading..."}
      </span>
    </div>
  )}
                      <span className={`text-sm font-medium ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              Time: {formatActualTime(currentTime)} / {formatActualTime(duration)}
            </span>
        </div>



        <div className="mb-6">
          <div
            ref={waveformRef}
            key={waveformKey}
            className={`relative h-24 rounded-xl overflow-hidden cursor-crosshair border ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}
            onClick={handleWaveformClick}
          >
            {isLoading && (
              <div className={`h-full flex items-center justify-center text-center ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>Loading waveform...</div>
            )}
          </div>
          <div className="flex justify-between mt-2 px-4">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{formatActualTime((duration * i) / 8)}</span>
            ))}
          </div>

                <ContentEditable
        innerRef={contentEditableRef}
        html={transcriptionText} // Use innerHTML to preserve text
        onChange={handleChange}
        className={`w-full min-h-[6rem] p-4 mt-4 rounded-lg border overflow-auto whitespace-pre-wrap text-sm ${
          isDarkMode ? "bg-gray-800 text-gray-200 border-gray-700" : "bg-gray-50 text-gray-900 border-gray-200"
        }`}
        data-transcription={transcriptionText}
        placeholder="Transcription will appear here..."
      />
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className={`fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4`}>
            <div className={`w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-lg shadow-xl ${isDarkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}>
              <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                <div>
                  <h2 className="text-lg font-semibold">Version History</h2>
                  <p className="text-xs text-gray-500 mt-1">All timestamps shown in {userTimezone}</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className={`p-2 rounded-lg ${isDarkMode ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2">Loading history...</span>
                  </div>
                ) : historyVersions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No version history available</p>
                    <p className="text-sm">History will be created when you save changes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyVersions.map((version) => (
                      <div
                        key={version.id}
                        className={`p-4 rounded-lg border ${isDarkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              version.version_number === 0 
                                ? (isDarkMode ? "bg-orange-600 text-white" : "bg-orange-100 text-orange-800")
                                : (isDarkMode ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-800")
                            }`}>
                              {version.version_number === 0 ? "Original" : `Version ${version.version_number}`}
                            </span>
                            <span className="text-sm text-gray-500">
                              {typeof version.created_at === 'string' && version.created_at.includes(' ') ? 
                                version.created_at : 
                                new Date(version.created_at).toLocaleString("en-US")
                              }
                              {typeof version.created_at === 'string' && version.created_at.includes(' ') && 
                                <span className="ml-1 text-xs text-blue-500">({historyTimezone})</span>
                              }
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => revertToVersion(version.version_number)}
                              disabled={isProcessing}
                              className={`px-3 py-1 text-xs font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-100 hover:bg-green-200 text-green-700"}`}
                            >
                              <ArrowLeft size={12} className="inline mr-1" /> Revert
                            </button>
                            {version.version_number !== 0 && (
                              <button
                                onClick={() => deleteVersion(version.version_number)}
                                disabled={isProcessing}
                                className={`px-3 py-1 text-xs font-medium rounded-lg disabled:opacity-50 ${isDarkMode ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-100 hover:bg-red-200 text-red-700"}`}
                              >
                                <X size={12} className="inline mr-1" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {version.description && (
                          <div className="mb-3">
                            <span className="text-sm font-medium">Description: </span>
                            <span className="text-sm text-gray-600">{version.description}</span>
                          </div>
                        )}
                        
                        <div className="mb-3">
                          <span className="text-sm font-medium">Transcription Preview:</span>
                          <div 
                            className={`mt-2 p-3 rounded text-sm max-h-32 overflow-y-auto ${isDarkMode ? "bg-gray-600" : "bg-gray-100"}`}
                            dangerouslySetInnerHTML={{ 
                              __html: version.transcription ? 
                                (version.transcription.length > 200 ? 
                                  version.transcription.substring(0, 200) + '...' : 
                                  version.transcription
                                ) : 
                                '<span class="text-gray-500 italic">No transcription</span>'
                            }}
                          />
                        </div>
                        
                        {version.audio_filename && (
                          <div className="text-sm">
                            <span className="font-medium">Audio: </span>
                            <span className="text-gray-600">{version.audio_filename}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>




      <footer className={`fixed bottom-0 left-0 right-0 p-4 border-t ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSkipBackward}
              disabled={isLoading || isProcessing}
              className={`p-2 rounded-full disabled:opacity-50 ${isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"}`}
              title="Skip back 1s"
            >
              <SkipBack size={20} />
            </button>
            <button
              onClick={togglePlayPause}
              disabled={isLoading || isProcessing}
              className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50"
            >
              {isLoading || isProcessing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="ml-0.5" />
              )}
            </button>
            <button
              onClick={handleStop}
              disabled={isLoading || isProcessing}
              className={`p-2 rounded-full disabled:opacity-50 ${isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"}`}
              title="Stop"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 6h12v12H6z" />
              </svg>
            </button>
            <button
              onClick={handleSkipForward}
              disabled={isLoading || isProcessing}
              className={`p-2 rounded-full disabled:opacity-50 ${isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-200"}`}
              title="Skip forward 1s"
            >
              <SkipForward size={20} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 size={20} className={isDarkMode ? "text-gray-400" : "text-gray-600"} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-2 rounded-lg cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(147, 51, 234) ${volume * 100}%, ${isDarkMode ? "#4B5563" : "#E5E7EB"} ${volume * 100}%)`,
              }}
            />
            <span className={`text-sm w-8 text-center ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </footer>
      <style jsx>{`
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: rgb(147, 51, 234);
          cursor: pointer;
          border: 1px solid white;
        }
        input[type=range]::-moz-range-thumb {
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: rgb(147, 51, 234);
          cursor: pointer;
          border: 1px solid white;
        }
      `}</style>
    </div>
  );
};

export default ProfessionalAudioEditor;
