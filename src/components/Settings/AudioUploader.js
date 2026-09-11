import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect } from 'react';
import { Upload, FileAudio, AlertCircle, CheckCircle, Loader2, X, Clock, Globe, Tag, Radio, Settings, Zap, Volume2, Calendar, MapPin } from 'lucide-react';
import { toast } from 'react-toastify';

const AudioUploader = ({ }) => {
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

  return (
    <div >
      {/* Header Section */}
      <div >
        <div className="row">
          <div className={cardStyles.card}>
            <Upload  />
          </div>
          <div>
            <h2 className="pageTitle">
          Manual Audio Upload
        </h2>
            <p className="mutedText smallText">
              Upload audio files directly to specific channels for processing and transcription
        </p>
          </div>
      </div>

        {/* Quick Stats */}
        <div className="gridThree">
          <div className={cardStyles.card}>
            <div className="row">
              <Radio  />
              <span className="mutedText smallText">
                Available Channels
              </span>
            </div>
            <p className="mutedText smallText">
              {channels.length}
            </p>
          </div>
          
          <div className={cardStyles.card}>
            <div className="row">
              <Tag  />
              <span className="mutedText smallText">
                Available Tags
              </span>
            </div>
            <p className="mutedText smallText">
              {availableTags.length}
            </p>
          </div>
          
          <div className={cardStyles.card}>
            <div className="row">
              <FileAudio  />
              <span className="mutedText smallText">
                Selected File
              </span>
            </div>
            <p className="mutedText smallText">
              {selectedFile ? '1' : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area - Side by Side Layout */}
      <div className="gridTwo">
        {/* Left Column */}
      <div className="stack">
        {/* Channel Selection */}
        <div className={cardStyles.card}>
          <div className="row">
            <Radio  />
            <h3 className="pageTitle">
            Target Channel
            </h3>
          </div>
          <div >
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
              className={formStyles.select}
          >
            <option value="">Select a channel...</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} (ID: {channel.id}) - {channel.mac}
              </option>
            ))}
          </select>
            <div className="row">
              <Settings  />
            </div>
          </div>
          {selectedChannel && (
            <div className={cardStyles.card}>
              <div className="row">
                <div ></div>
                <span className="mutedText smallText">
                  Channel Selected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* File Selection */}
        <div className={cardStyles.card}>
          <div className="row">
            <FileAudio  />
            <h3 className="pageTitle">
            Audio File
            </h3>
          </div>
          
          <div >
            <div >
            <input
              id="audioFile"
              type="file"
              accept=".wav,.mp3,.m4a"
              onChange={handleFileSelect}
                className={formStyles.input}
              />
              <div className="stack">
                <div className={cardStyles.card}>
                  <Volume2  />
                </div>
                <div>
                  <p className="mutedText smallText">
                    {selectedFile ? selectedFile.name : 'Click to select audio file'}
                  </p>
                  <p className="mutedText smallText">
                    Supports .wav, .mp3, .m4a files
                  </p>
                </div>
            {selectedFile && (
              <button
                onClick={clearFile}
                    className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
              >
                    <X  />
                    Remove File
              </button>
            )}
          </div>
            </div>
          </div>
          
          {selectedFile && (
            <div className={cardStyles.card}>
              <div className="row">
                <FileAudio  />
                <div >
                  <p className="mutedText smallText">
                  {selectedFile.name}
                  </p>
                  <p className="mutedText smallText">
                    Size: {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              
              {/* Extracted Date/Time Display */}
              {extractedDateTime && (
                <div className={cardStyles.card}>
                  <div className="row">
                    <Calendar  />
                    <span className="mutedText smallText">
                      Extracted Date/Time
                </span>
              </div>
                  <div >
                    {extractedDateTime.formatted}
              </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Tag Selection */}
        <div className={cardStyles.card}>
          <div className="row">
            <Tag  />
            <h3 className="pageTitle">
              Tags (Optional)
            </h3>
            {selectedTags.length > 0 && (
              <span className="mutedText smallText">
                {selectedTags.length} selected
              </span>
            )}
        </div>

        <div className={cardStyles.card}>
            <div className="rowBetween">
              <span className="mutedText smallText">
                Select tags to apply to this recording:
              </span>
              {selectedTags.length > 0 && (
                <button
                  onClick={clearSelectedTags}
                  className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
                >
                  Clear All
                </button>
              )}
            </div>
            
            {availableTags.length > 0 ? (
              <div className="rowWrap">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <div >
                <Tag  />
                <p className="mutedText smallText">No tags available</p>
                <p className="mutedText smallText">Create tags in the Tag Manager first</p>
              </div>
            )}
            
            {selectedTags.length > 0 && (
              <div >
                <div >
                  Selected Tags:
                </div>
                <div className="rowWrap">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className="mutedText smallText"
                    >
                      {tag}
                      <button
                        onClick={() => handleTagToggle(tag)}
                        className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.icon}`}
                      >
                        <X  />
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
          <div className="stack">
        {/* Timezone and DateTime Selection */}
        <div className={cardStyles.card}>
          <div className="row">
            <div >
              <Globe  />
            </div>
            <h3 className="pageTitle">
              Timezone & Timestamp Settings
            </h3>
          </div>

          {/* Timezone Selection */}
          <div >
            <label className={formStyles.label}>
              <MapPin  />
              Timezone
            </label>
            <div >
            <select
              value={timezoneData.selectedTimezone}
              onChange={(e) => handleTimezoneChange('selectedTimezone', e.target.value)}
                className={formStyles.select}
            >
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
              <div className="row">
                <Globe  />
              </div>
            </div>
          </div>

          {/* Custom DateTime Toggle */}
          <div className="row">
            <input
              type="checkbox"
              id="useCustomDateTime"
              checked={timezoneData.useCustomDateTime}
              onChange={(e) => handleTimezoneChange('useCustomDateTime', e.target.checked)}
              className={formStyles.input}
            />
            <label htmlFor="useCustomDateTime" className={formStyles.label}>
              <Clock  />
              Use custom date and time
            </label>
          </div>

           {/* Custom DateTime Inputs */}
           {timezoneData.useCustomDateTime && (
             <div className={cardStyles.card}>
               <div className="gridTwo">
               <div>
                 <label className={formStyles.label}>
                     <Calendar  />
                   Date
                 </label>
                 <input
                   type="date"
                   value={timezoneData.customDate || getCurrentDateTime().date}
                   onChange={(e) => handleTimezoneChange('customDate', e.target.value)}
                     className={formStyles.input}
                 />
               </div>
               <div>
                 <label className={formStyles.label}>
                     <Clock  />
                   Time
                 </label>
                 <input
                   type="time"
                   step="1"
                   value={timezoneData.customTime || getCurrentDateTime().time}
                   onChange={(e) => handleTimezoneChange('customTime', e.target.value)}
                     className={formStyles.input}
                 />
                 </div>
               </div>
               
               {/* Refresh Current Time Button */}
               <div >
                 <button
                   type="button"
                   onClick={() => {
                     const currentDateTime = getCurrentDateTime();
                     handleTimezoneChange('customDate', currentDateTime.date);
                     handleTimezoneChange('customTime', currentDateTime.time);
                   }}
                   className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                 >
                   <Clock  />
                   Use Current Time
                 </button>
               </div>
             </div>
           )}

           {/* Timezone Conversion Example */}
           {timezoneData.useCustomDateTime && timezoneData.customDate && timezoneData.customTime && (
             <div className={cardStyles.card}>
               <div className="row">
                 <Globe  />
                 <span className="mutedText smallText">
                   Timezone Conversion:
                 </span>
               </div>
               <div >
                 <div >
                   <strong>Local Time:</strong> {timezoneData.customDate} {timezoneData.customTime} ({timezones.find(tz => tz.value === timezoneData.selectedTimezone)?.label})
                 </div>
                 <div>
                   <strong>UTC Time:</strong> {convertToUTC(`${timezoneData.customDate}T${timezoneData.customTime}`, timezoneData.selectedTimezone).toISOString().replace('T', ' ').replace('Z', ' UTC')}
                 </div>
               </div>
             </div>
           )}

           {/* Current Time Display */}
           <div className={cardStyles.card}>
             <div className="row">
               <Clock  />
               <span className="mutedText smallText">
                 Current time in {timezones.find(tz => tz.value === timezoneData.selectedTimezone)?.label}:
               </span>
             </div>
             <div >
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
           <div className={cardStyles.card}>
             <div className="row">
               <Clock  />
               <span className="mutedText smallText">
                 Generated UTC Filename:
               </span>
             </div>
             <code className="codeBlock">
               {generateFilename()}
             </code>
             <div >
               This filename will be used when uploading the file
             </div>
           </div>
        </div>

        {/* Additional Parameters */}
        <div className={cardStyles.card}>
          <div className="row">
            <div >
              <Settings  />
            </div>
            <h3 className="pageTitle">
              Additional Parameters
            </h3>
          </div>
          
          <div className="gridTwo">
          <div>
            <label className={formStyles.label}>
                <Zap  />
              Trigger
            </label>
            <input
              type="number"
              value={formData.trigger}
              onChange={(e) => handleInputChange('trigger', e.target.value)}
              placeholder="1"
                className={formStyles.input}
            />
          </div>
          <div>
            <label className={formStyles.label}>
                <Volume2  />
              Audio End
            </label>
            <input
              type="number"
              value={formData.audioEnd}
              onChange={(e) => handleInputChange('audioEnd', e.target.value)}
              placeholder="0"
                className={formStyles.input}
            />
          </div>
          <div>
            <label className={formStyles.label}>
                <Clock  />
              Duration
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) => handleInputChange('duration', e.target.value)}
              placeholder="30"
                className={formStyles.input}
            />
          </div>
          <div>
            <label className={formStyles.label}>
                <Volume2  />
              Audio Level
            </label>
            <input
              type="number"
              value={formData.audioLevel}
              onChange={(e) => handleInputChange('audioLevel', e.target.value)}
              placeholder="75"
                className={formStyles.input}
            />
          </div>
        </div>

        {/* Checkbox */}
          <div className="row">
          <input
            type="checkbox"
            id="initResponse"
            checked={formData.initResponse}
            onChange={(e) => handleInputChange('initResponse', e.target.checked)}
              className={formStyles.input}
          />
            <label htmlFor="initResponse" className={formStyles.label}>
              <Settings  />
            Get device settings response
          </label>
          </div>
        </div>

        {/* Upload Button */}
        <div >
        <button
          onClick={handleUpload}
            disabled={!selectedFile || !selectedChannel || isUploading || isAddingTags}
            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
        >
          {isUploading ? (
            <>
                <Loader2  />
              Uploading... ({uploadProgress}%)
            </>
            ) : isAddingTags ? (
              <>
                <Loader2  />
                Adding tags...
            </>
          ) : (
            <>
                <Upload  />
              Upload Audio File
            </>
          )}
        </button>
          
          {/* Upload Requirements */}
          <div >
            <p className="mutedText smallText">
              {!selectedFile && !selectedChannel ? 'Please select a channel and audio file to upload' :
               !selectedFile ? 'Please select an audio file to upload' :
               !selectedChannel ? 'Please select a target channel' :
               'Ready to upload'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {isUploading && (
          <div className={cardStyles.card}>
            <div className="rowBetween">
              <span className="mutedText smallText">
                Upload Progress
              </span>
              <span className="mutedText smallText">
                {uploadProgress}%
              </span>
            </div>
            <div >
              <div
                
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Message */}
        {uploadStatus && (
          <div className={cardStyles.card}>
            <div >
            {uploadStatus.type === 'success' ? (
                <CheckCircle  />
            ) : (
                <AlertCircle  />
            )}
            </div>
            <div >
              <p >
                {uploadStatus.message}
              </p>
              {uploadStatus.details && (
                <div className={cardStyles.card}>
                  <pre className="codeBlock">
                  {JSON.stringify(uploadStatus.details, null, 2)}
                </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tag Addition Status */}
        {isAddingTags && (
          <div className={cardStyles.card}>
            <div >
              <Loader2  />
            </div>
            <div >
              <p >
                Adding {selectedTags.length} tag(s) to recording...
              </p>
              <div className="rowWrap">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="mutedText smallText"
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
