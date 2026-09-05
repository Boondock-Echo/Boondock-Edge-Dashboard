import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { Upload, FileAudio, AlertCircle, CheckCircle, Loader2, X, Clock, Globe, Tag, Radio, Settings, Zap, Volume2, Calendar, MapPin } from 'lucide-react';
import { toast } from 'react-toastify';

const AudioUploader = ({ isDarkMode }) => {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [formData, setFormData] = useState({
    trigger: '',
    audioEnd: '',
    duration: '',
    audioLevel: '',
    initResponse: false
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [extractedDateTime, setExtractedDateTime] = useState(null);
  const [isAddingTags, setIsAddingTags] = useState(false);
  const [timezoneData, setTimezoneData] = useState({
    selectedTimezone: 'America/Chicago',
    useCustomDateTime: false,
    customDateTime: '',
    customDate: '',
    customTime: ''
  });

  // Common timezones for selection
  const timezones = [
    { value: 'America/Chicago', label: 'Chicago (CST/CDT)', offset: '-06:00/-05:00' },
    { value: 'America/New_York', label: 'New York (EST/EDT)', offset: '-05:00/-04:00' },
    { value: 'America/Denver', label: 'Denver (MST/MDT)', offset: '-07:00/-06:00' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)', offset: '-08:00/-07:00' },
    { value: 'America/Phoenix', label: 'Phoenix (MST)', offset: '-07:00' },
    { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00/+01:00' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: '+01:00/+02:00' },
    { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', offset: '+01:00/+02:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: '+08:00' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: '+10:00/+11:00' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: '+00:00' }
  ];

  // Fetch channels and tags on component mount
  useEffect(() => {
    fetchChannels();
    fetchAvailableTags();
  }, []);

  // Update current time display every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update current time display
      setTimezoneData(prev => ({ ...prev }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await apiFetch(`/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data);
        if (data.length > 0) {
          setSelectedChannel(data[0].id.toString());
        }
      } else {
        console.error('Failed to fetch channels');
        toast.error('Failed to load channels');
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Error loading channels');
    }
  };

  const fetchAvailableTags = async () => {
    try {
      const response = await apiFetch(`/tags`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data.map(tag => tag.name));
      } else {
        console.error('Failed to fetch tags');
        toast.error('Failed to load available tags');
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Error loading tags');
    }
  };

  const extractDateTimeFromFilename = (filename) => {
    if (!filename) return null;
    
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Try different date/time patterns
    const patterns = [
      // YYYY-MM-DDTHH-MM-SSZ.wav format
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/,
      // YYYYMMDD_HHMMSS format
      /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/,
      // YYYY-MM-DD_HH-MM-SS format
      /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/,
      // YYYYMMDDHHMMSS format
      /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
    ];
    
    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        let year, month, day, hour, minute, second;
        
        if (pattern.source.includes('T')) {
          // YYYY-MM-DDTHH-MM-SSZ format
          [, year, month, day, hour, minute, second] = match;
        } else if (pattern.source.includes('_')) {
          // YYYY-MM-DD_HH-MM-SS or YYYYMMDD_HHMMSS format
          if (pattern.source.includes('-')) {
            [, year, month, day, hour, minute, second] = match;
          } else {
            [, year, month, day, hour, minute, second] = match;
          }
        } else {
          // YYYYMMDDHHMMSS format
          [, year, month, day, hour, minute, second] = match;
        }
        
        try {
          const date = new Date(
            parseInt(year),
            parseInt(month) - 1, // Month is 0-indexed
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          );
          
          if (!isNaN(date.getTime())) {
            return {
              date: date,
              formatted: date.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              })
            };
          }
        } catch (error) {
          console.error('Error parsing date from filename:', error);
        }
      }
    }
    
    return null;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('audio/') && !file.name.toLowerCase().endsWith('.wav')) {
        toast.error('Please select a valid audio file (.wav)');
        return;
      }
      
      setSelectedFile(file);
      
      // Extract date/time from filename
      const extracted = extractDateTimeFromFilename(file.name);
      setExtractedDateTime(extracted);
      
      if (extracted) {
        toast.success(`Extracted date/time: ${extracted.formatted}`);
      } else {
        toast.info('No date/time pattern found in filename');
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTimezoneChange = (field, value) => {
    setTimezoneData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // If toggling custom datetime on, populate with current time
      if (field === 'useCustomDateTime' && value === true) {
        const currentDateTime = getCurrentDateTime();
        newData.customDate = currentDateTime.date;
        newData.customTime = currentDateTime.time;
      }
      
      return newData;
    });
  };

  const handleTagToggle = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        const newTags = prev.filter(t => t !== tag);
        console.log('Removed tag:', tag, 'New tags:', newTags);
        return newTags;
      } else {
        const newTags = [...prev, tag];
        console.log('Added tag:', tag, 'New tags:', newTags);
        return newTags;
      }
    });
  };

  const clearSelectedTags = () => {
    setSelectedTags([]);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const convertToUTC = (dateTime, timezone) => {
    try {
      // Parse the input date and time
      const [datePart, timePart] = dateTime.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Create a date object representing the local time in the specified timezone
      // We need to treat this as if it's already in the target timezone
      const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      
      // Get the timezone offset for the specified timezone at this specific date
      // This accounts for daylight saving time changes
      const tempDate = new Date(year, month - 1, day, 12, 0, 0, 0); // Use noon to avoid DST edge cases
      const utcTemp = new Date(tempDate.getTime() + (tempDate.getTimezoneOffset() * 60000));
      const targetTemp = new Date(utcTemp.toLocaleString("en-US", {timeZone: timezone}));
      const timezoneOffsetMinutes = (targetTemp.getTime() - utcTemp.getTime()) / (1000 * 60);
      
      // Convert the local time to UTC by subtracting the timezone offset
      const utcResult = new Date(localDate.getTime() - (timezoneOffsetMinutes * 60000));
      
      return utcResult;
    } catch (error) {
      console.error('Error converting timezone:', error);
      // Fallback: return current time in UTC
      return new Date();
    }
  };

  const generateFilename = () => {
    let dateToUse;
    
    if (timezoneData.useCustomDateTime && timezoneData.customDate && timezoneData.customTime) {
      // Use custom date and time
      const customDateTime = `${timezoneData.customDate}T${timezoneData.customTime}`;
      dateToUse = convertToUTC(customDateTime, timezoneData.selectedTimezone);
    } else {
      // Use current time in selected timezone
      const now = new Date();
      dateToUse = convertToUTC(now.toISOString(), timezoneData.selectedTimezone);
    }
    
    const year = dateToUse.getUTCFullYear();
    const month = String(dateToUse.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateToUse.getUTCDate()).padStart(2, '0');
    const hours = String(dateToUse.getUTCHours()).padStart(2, '0');
    const minutes = String(dateToUse.getUTCMinutes()).padStart(2, '0');
    const seconds = String(dateToUse.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}Z.wav`;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!selectedChannel) {
      toast.error('Please select a channel');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    try {
      const formDataToSend = new FormData();
      
      // Create a new file with the generated filename
      const filename = generateFilename();
      const renamedFile = new File([selectedFile], filename, {
        type: selectedFile.type,
        lastModified: selectedFile.lastModified
      });
      
      formDataToSend.append('file', renamedFile);

      // Build URL with parameters
      const params = new URLSearchParams({ channel_id: selectedChannel });
      
      // Add custom timestamp if using custom datetime
      if (timezoneData.useCustomDateTime && timezoneData.customDate && timezoneData.customTime) {
        const customDateTime = `${timezoneData.customDate}T${timezoneData.customTime}`;
        const utcDateTime = convertToUTC(customDateTime, timezoneData.selectedTimezone);
        const utcTimestamp = utcDateTime.toISOString().replace('Z', 'Z');
        params.append('timestamp', utcTimestamp);
      }
      
      if (formData.trigger) params.append('t', formData.trigger);
      if (formData.audioEnd) params.append('x', formData.audioEnd);
      if (formData.duration) params.append('d', formData.duration);
      if (formData.audioLevel) params.append('a', formData.audioLevel);
      if (formData.initResponse) params.append('i', 'true');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // TO-DO If we want to keep this update to /upload/audio
      // const response = await apiFetch(`/uploads?${params.toString()}`, {
      //   method: 'POST',
      //   body: formDataToSend
      // });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();

      if (response.ok) {
        setUploadStatus({
          type: 'success',
          message: 'File uploaded successfully!',
          details: result
        });
        toast.success('Audio file uploaded successfully!');
        
        // Add tags to the uploaded recording if any are selected
        console.log('Selected tags:', selectedTags);
        console.log('Recording ID:', result.recording_id);
        
        if (selectedTags.length > 0 && result.recording_id) {
          setIsAddingTags(true);
          try {
            console.log('Attempting to add tags to recording:', result.recording_id);
            const tagPromises = selectedTags.map(async (tag) => {
              console.log('Adding tag:', tag);
              const response = await apiFetch(`/recordings_tag/${result.recording_id}/tags`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tag })
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to add tag ${tag}:`, response.status, errorText);
                throw new Error(`Failed to add tag ${tag}: ${response.status} ${errorText}`);
              }
              
              console.log(`Successfully added tag: ${tag}`);
              return response;
            });
            
            await Promise.all(tagPromises);
            toast.success(`Added ${selectedTags.length} tag(s) to the recording`);
          } catch (tagError) {
            console.error('Error adding tags:', tagError);
            toast.warning('File uploaded but failed to add some tags');
          } finally {
            setIsAddingTags(false);
          }
        } else {
          console.log('No tags to add or no recording ID available');
        }
        
        // Reset form
        setSelectedFile(null);
        setSelectedTags([]);
        setExtractedDateTime(null);
        setFormData({
          trigger: '',
          audioEnd: '',
          duration: '',
          audioLevel: '',
          initResponse: false
        });
        setTimezoneData({
          selectedTimezone: 'America/Chicago',
          useCustomDateTime: false,
          customDateTime: '',
          customDate: '',
          customTime: ''
        });
        document.getElementById('audioFile').value = '';
      } else {
        setUploadStatus({
          type: 'error',
          message: result.error || 'Upload failed',
          details: result
        });
        toast.error(result.error || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: 'Upload failed: ' + error.message,
        details: null
      });
      toast.error('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setSelectedTags([]);
    setExtractedDateTime(null);
    document.getElementById('audioFile').value = '';
  };

  const themeClasses = {
    container: isDarkMode 
      ? 'bg-gray-800 border-gray-700' 
      : 'bg-white border-gray-200',
    input: isDarkMode
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
    label: isDarkMode ? 'text-gray-300' : 'text-gray-700',
    button: isDarkMode
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonDisabled: isDarkMode
      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
  };

  return (
    <div className={`p-8 ${themeClasses.container} rounded-xl border shadow-lg`}>
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
            <Upload className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-1`}>
          Manual Audio Upload
        </h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Upload audio files directly to specific channels for processing and transcription
        </p>
          </div>
      </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Available Channels
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {channels.length}
            </p>
          </div>
          
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Tag className={`w-4 h-4 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Available Tags
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {availableTags.length}
            </p>
          </div>
          
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <FileAudio className={`w-4 h-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Selected File
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {selectedFile ? '1' : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area - Side by Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
      <div className="space-y-6">
        {/* Channel Selection */}
        <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center gap-2 mb-4">
            <Radio className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Target Channel
            </h3>
          </div>
          <div className="relative">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input} appearance-none cursor-pointer`}
          >
            <option value="">Select a channel...</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} (ID: {channel.id}) - {channel.mac}
              </option>
            ))}
          </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Settings className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
          </div>
          {selectedChannel && (
            <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-green-400' : 'bg-green-600'}`}></div>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                  Channel Selected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* File Selection */}
        <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center gap-2 mb-4">
            <FileAudio className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Audio File
            </h3>
          </div>
          
          <div className="relative">
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-all hover:border-blue-400 ${isDarkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'}`}>
            <input
              id="audioFile"
              type="file"
              accept=".wav,.mp3,.m4a"
              onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-3">
                <div className={`p-4 rounded-full ${isDarkMode ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <Volume2 className={`w-8 h-8 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <div>
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedFile ? selectedFile.name : 'Click to select audio file'}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Supports .wav, .mp3, .m4a files
                  </p>
                </div>
            {selectedFile && (
              <button
                onClick={clearFile}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
              >
                    <X className="w-4 h-4 inline mr-1" />
                    Remove File
              </button>
            )}
          </div>
            </div>
          </div>
          
          {selectedFile && (
            <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <FileAudio className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFile.name}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Size: {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              
              {/* Extracted Date/Time Display */}
              {extractedDateTime && (
                <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                      Extracted Date/Time
                </span>
              </div>
                  <div className={`text-sm ${isDarkMode ? 'text-green-200' : 'text-green-700'}`}>
                    {extractedDateTime.formatted}
              </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Tag Selection */}
        <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center gap-2 mb-4">
            <Tag className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Tags (Optional)
            </h3>
            {selectedTags.length > 0 && (
              <span className={`px-2 py-1 text-xs rounded-full ${isDarkMode ? 'bg-purple-700 text-purple-200' : 'bg-purple-100 text-purple-800'}`}>
                {selectedTags.length} selected
              </span>
            )}
        </div>

        <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Select tags to apply to this recording:
              </span>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearSelectedTags}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${isDarkMode ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                >
                  Clear All
                </button>
              )}
            </div>
            
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
                      selectedTags.includes(tag)
                        ? isDarkMode
                          ? 'bg-purple-600 text-white border-purple-500 shadow-lg transform scale-105'
                          : 'bg-purple-100 text-purple-800 border-purple-300 shadow-md transform scale-105'
                        : isDarkMode
                          ? 'bg-gray-600 text-gray-300 border-gray-500 hover:bg-gray-500 hover:scale-105'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:scale-105'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <Tag className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                <p className="text-sm">No tags available</p>
                <p className="text-xs mt-1">Create tags in the Tag Manager first</p>
              </div>
            )}
            
            {selectedTags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <div className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Selected Tags:
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${
                        isDarkMode ? 'bg-purple-700 text-purple-200' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {tag}
                      <button
                        onClick={() => handleTagToggle(tag)}
                        className={`ml-1 p-0.5 rounded-full transition-colors ${
                          isDarkMode ? 'text-purple-300 hover:text-red-400 hover:bg-red-900/30' : 'text-purple-600 hover:text-red-600 hover:bg-red-100'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
        {/* Timezone and DateTime Selection */}
        <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center gap-2 mb-6">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <Globe className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Timezone & Timestamp Settings
            </h3>
          </div>

          {/* Timezone Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${themeClasses.label} mb-3`}>
              <MapPin className="w-4 h-4 inline mr-2" />
              Timezone
            </label>
            <div className="relative">
            <select
              value={timezoneData.selectedTimezone}
              onChange={(e) => handleTimezoneChange('selectedTimezone', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input} appearance-none cursor-pointer`}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Globe className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            </div>
          </div>

          {/* Custom DateTime Toggle */}
          <div className={`flex items-center p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} mb-6`}>
            <input
              type="checkbox"
              id="useCustomDateTime"
              checked={timezoneData.useCustomDateTime}
              onChange={(e) => handleTimezoneChange('useCustomDateTime', e.target.checked)}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="useCustomDateTime" className={`ml-3 text-sm font-medium ${themeClasses.label} cursor-pointer`}>
              <Clock className="w-4 h-4 inline mr-2" />
              Use custom date and time
            </label>
          </div>

           {/* Custom DateTime Inputs */}
           {timezoneData.useCustomDateTime && (
             <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} mb-6`}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                     <Calendar className="w-4 h-4 inline mr-2" />
                   Date
                 </label>
                 <input
                   type="date"
                   value={timezoneData.customDate || getCurrentDateTime().date}
                   onChange={(e) => handleTimezoneChange('customDate', e.target.value)}
                     className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
                 />
               </div>
               <div>
                 <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                     <Clock className="w-4 h-4 inline mr-2" />
                   Time
                 </label>
                 <input
                   type="time"
                   step="1"
                   value={timezoneData.customTime || getCurrentDateTime().time}
                   onChange={(e) => handleTimezoneChange('customTime', e.target.value)}
                     className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
                 />
                 </div>
               </div>
               
               {/* Refresh Current Time Button */}
               <div className="mt-4 flex justify-center">
                 <button
                   type="button"
                   onClick={() => {
                     const currentDateTime = getCurrentDateTime();
                     handleTimezoneChange('customDate', currentDateTime.date);
                     handleTimezoneChange('customTime', currentDateTime.time);
                   }}
                   className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                     isDarkMode
                       ? 'bg-blue-600 hover:bg-blue-700 text-white'
                       : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                   }`}
                 >
                   <Clock className="w-4 h-4" />
                   Use Current Time
                 </button>
               </div>
             </div>
           )}

           {/* Timezone Conversion Example */}
           {timezoneData.useCustomDateTime && timezoneData.customDate && timezoneData.customTime && (
             <div className={`p-3 rounded-md mb-4 ${isDarkMode ? 'bg-gray-600' : 'bg-yellow-50'}`}>
               <div className="flex items-center gap-2 mb-2">
                 <Globe className="w-4 h-4 text-yellow-500" />
                 <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                   Timezone Conversion:
                 </span>
               </div>
               <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                 <div className="mb-1">
                   <strong>Local Time:</strong> {timezoneData.customDate} {timezoneData.customTime} ({timezones.find(tz => tz.value === timezoneData.selectedTimezone)?.label})
                 </div>
                 <div>
                   <strong>UTC Time:</strong> {convertToUTC(`${timezoneData.customDate}T${timezoneData.customTime}`, timezoneData.selectedTimezone).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                 </div>
               </div>
             </div>
           )}

           {/* Current Time Display */}
           <div className={`p-3 rounded-md mb-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-100'}`}>
             <div className="flex items-center gap-2 mb-2">
               <Clock className="w-4 h-4 text-blue-500" />
               <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                 Current time in {timezones.find(tz => tz.value === timezoneData.selectedTimezone)?.label}:
               </span>
             </div>
             <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
               {new Date().toLocaleString("en-US", { 
                 timeZone: timezoneData.selectedTimezone,
                 year: 'numeric',
                 month: '2-digit',
                 day: '2-digit',
                 hour: '2-digit',
                 minute: '2-digit',
                 second: '2-digit',
                 hour12: false
               })}
             </div>
           </div>

           {/* UTC Preview */}
           <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-600' : 'bg-blue-50'}`}>
             <div className="flex items-center gap-2 mb-2">
               <Clock className="w-4 h-4 text-blue-500" />
               <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                 Generated UTC Filename:
               </span>
             </div>
             <code className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'} font-mono`}>
               {generateFilename()}
             </code>
             <div className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
               This filename will be used when uploading the file
             </div>
           </div>
        </div>

        {/* Additional Parameters */}
        <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
          <div className="flex items-center gap-2 mb-6">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Settings className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
            </div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Additional Parameters
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                <Zap className="w-4 h-4 inline mr-2" />
              Trigger
            </label>
            <input
              type="number"
              value={formData.trigger}
              onChange={(e) => handleInputChange('trigger', e.target.value)}
              placeholder="1"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                <Volume2 className="w-4 h-4 inline mr-2" />
              Audio End
            </label>
            <input
              type="number"
              value={formData.audioEnd}
              onChange={(e) => handleInputChange('audioEnd', e.target.value)}
              placeholder="0"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                <Clock className="w-4 h-4 inline mr-2" />
              Duration
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => handleInputChange('duration', e.target.value)}
              placeholder="30"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${themeClasses.label} mb-2`}>
                <Volume2 className="w-4 h-4 inline mr-2" />
              Audio Level
            </label>
            <input
              type="number"
              value={formData.audioLevel}
              onChange={(e) => handleInputChange('audioLevel', e.target.value)}
              placeholder="75"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${themeClasses.input}`}
            />
          </div>
        </div>

        {/* Checkbox */}
          <div className={`flex items-center p-4 rounded-lg border mt-6 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          <input
            type="checkbox"
            id="initResponse"
            checked={formData.initResponse}
            onChange={(e) => handleInputChange('initResponse', e.target.checked)}
              className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
            <label htmlFor="initResponse" className={`ml-3 text-sm font-medium ${themeClasses.label} cursor-pointer`}>
              <Settings className="w-4 h-4 inline mr-2" />
            Get device settings response
          </label>
          </div>
        </div>

        {/* Upload Button */}
        <div className="mt-8">
        <button
          onClick={handleUpload}
            disabled={!selectedFile || !selectedChannel || isUploading || isAddingTags}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg ${
              !selectedFile || !selectedChannel || isUploading || isAddingTags
                ? themeClasses.buttonDisabled
                : `${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                  } transform hover:scale-105 active:scale-95`
            }`}
        >
          {isUploading ? (
            <>
                <Loader2 className="w-6 h-6 animate-spin" />
              Uploading... ({uploadProgress}%)
            </>
            ) : isAddingTags ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Adding tags...
            </>
          ) : (
            <>
                <Upload className="w-6 h-6" />
              Upload Audio File
            </>
          )}
        </button>
          
          {/* Upload Requirements */}
          <div className="mt-4 text-center">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {!selectedFile && !selectedChannel ? 'Please select a channel and audio file to upload' :
               !selectedFile ? 'Please select an audio file to upload' :
               !selectedChannel ? 'Please select a target channel' :
               'Ready to upload'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Upload Progress
              </span>
              <span className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {uploadProgress}%
              </span>
            </div>
            <div className={`w-full rounded-full h-3 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Message */}
        {uploadStatus && (
          <div className={`mt-6 p-6 rounded-xl border shadow-lg flex items-start gap-4 ${
            uploadStatus.type === 'success'
              ? isDarkMode ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
              : isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
          }`}>
            <div className={`p-2 rounded-full ${
              uploadStatus.type === 'success'
                ? isDarkMode ? 'bg-green-800/30' : 'bg-green-100'
                : isDarkMode ? 'bg-red-800/30' : 'bg-red-100'
          }`}>
            {uploadStatus.type === 'success' ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
                <AlertCircle className="w-6 h-6 text-red-500" />
            )}
            </div>
            <div className="flex-1">
              <p className={`text-lg font-semibold ${
                uploadStatus.type === 'success'
                  ? isDarkMode ? 'text-green-400' : 'text-green-800'
                  : isDarkMode ? 'text-red-400' : 'text-red-800'
              }`}>
                {uploadStatus.message}
              </p>
              {uploadStatus.details && (
                <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <pre className={`text-xs overflow-auto ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {JSON.stringify(uploadStatus.details, null, 2)}
                </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tag Addition Status */}
        {isAddingTags && (
          <div className={`mt-6 p-6 rounded-xl border shadow-lg flex items-start gap-4 ${
            isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
          }`}>
            <div className={`p-2 rounded-full ${isDarkMode ? 'bg-blue-800/30' : 'bg-blue-100'}`}>
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
            <div className="flex-1">
              <p className={`text-lg font-semibold ${
                isDarkMode ? 'text-blue-400' : 'text-blue-800'
              }`}>
                Adding {selectedTags.length} tag(s) to recording...
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className={`px-3 py-1 text-sm font-medium rounded-full ${
                      isDarkMode ? 'bg-blue-700 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AudioUploader;
