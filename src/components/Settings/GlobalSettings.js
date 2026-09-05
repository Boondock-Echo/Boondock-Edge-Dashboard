import React, { useState, useEffect } from 'react';
import api from '../../utils/apiClient';
import {
  Globe,
  DatabaseZap,
  Radio,
  Network,
  Server,
  Cloud,
  Check,
  Clock,
  ArrowUpDown,
  Trash2,
  AlertTriangle,
  SmartphoneNfc,
  Cpu,
} from 'lucide-react';
import SettingsSectionHeader from './SettingsSectionHeader';

const LANGUAGES = [
  "english", "spanish", "french", "german", "italian", "portuguese",
  "chinese", "japanese", "korean", "arabic",
];

// Whisper model mapping for faster-whisper
const WHISPER_MODELS = [
  { value: "tiny.en", label: "Low", level: 1, model: "tiny.en", speed: "Fastest", accuracy: "Good", memory: "4 GB RAM", cpu: "Any CPU" },
  { value: "base.en", label: "Normal", level: 2, model: "base.en", speed: "Fast", accuracy: "Better", memory: "8 GB RAM", cpu: "Any CPU" },
  { value: "small.en", label: "Medium", level: 3, model: "small.en", speed: "Moderate", accuracy: "Great", memory: "16 GB RAM", cpu: "Multi-Core CPU" },
  { value: "medium", label: "High", level: 4, model: "medium", speed: "Slower", accuracy: "Excellent", memory: "32 GB RAM", cpu: "Multi-Core CPU, 100 TOPS GPU" },
  { value: "large", label: "Highest", level: 5, model: "large", speed: "Slowest", accuracy: "Best", memory: "32 GB RAM", cpu: "Multi-Core High CPU, 250 TOPS GPU" },
];

const TIMEZONES = [
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  // North America - US Timezones
  { value: "America/New_York", label: "US Eastern Time (ET)" },
  { value: "America/Chicago", label: "US Central Time (CT)" },
  { value: "America/Denver", label: "US Mountain Time (MT)" },
  { value: "America/Phoenix", label: "US Arizona Time (AZ)" },
  { value: "America/Los_Angeles", label: "US Pacific Time (PT)" },
  { value: "America/Anchorage", label: "US Alaska Time (AKT)" },
  { value: "America/Adak", label: "US Hawaii-Aleutian Time (HST)" },
  { value: "Pacific/Honolulu", label: "US Hawaii Time (HST)" },
  // North America - Canada
  { value: "America/Vancouver", label: "Canada Pacific Time" },
  { value: "America/Edmonton", label: "Canada Mountain Time" },
  { value: "America/Winnipeg", label: "Canada Central Time" },
  { value: "America/Toronto", label: "Canada Eastern Time" },
  { value: "America/Halifax", label: "Canada Atlantic Time" },
  { value: "America/St_Johns", label: "Canada Newfoundland Time" },
  // Mexico
  { value: "America/Mexico_City", label: "Mexico Central Time" },
  { value: "America/Tijuana", label: "Mexico Pacific Time" },
  // South America
  { value: "America/Bogota", label: "Colombia Time (COT)" },
  { value: "America/Lima", label: "Peru Time (PET)" },
  { value: "America/Santiago", label: "Chile Time (CLT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina Time (ART)" },
  { value: "America/Sao_Paulo", label: "Brazil Time (BRT)" },
  // Europe
  { value: "Europe/London", label: "UK - Greenwich Mean Time (GMT)/British Summer Time (BST)" },
  { value: "Europe/Dublin", label: "Ireland Time" },
  { value: "Europe/Lisbon", label: "Portugal Time" },
  { value: "Europe/Paris", label: "France - Central European Time (CET)" },
  { value: "Europe/Berlin", label: "Germany - Central European Time (CET)" },
  { value: "Europe/Madrid", label: "Spain Time" },
  { value: "Europe/Rome", label: "Italy Time" },
  { value: "Europe/Amsterdam", label: "Netherlands Time" },
  { value: "Europe/Brussels", label: "Belgium Time" },
  { value: "Europe/Vienna", label: "Austria Time" },
  { value: "Europe/Zurich", label: "Switzerland Time" },
  { value: "Europe/Stockholm", label: "Sweden Time" },
  { value: "Europe/Oslo", label: "Norway Time" },
  { value: "Europe/Copenhagen", label: "Denmark Time" },
  { value: "Europe/Warsaw", label: "Poland Time" },
  { value: "Europe/Athens", label: "Greece Time" },
  { value: "Europe/Helsinki", label: "Finland Time" },
  { value: "Europe/Moscow", label: "Russia - Moscow Time (MSK)" },
  // Middle East
  { value: "Asia/Istanbul", label: "Turkey Time (TRT)" },
  { value: "Asia/Dubai", label: "United Arab Emirates Time (GST)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia Time (AST)" },
  { value: "Asia/Tel_Aviv", label: "Israel Time (IST)" },
  { value: "Asia/Tehran", label: "Iran Time (IRST)" },
  // Asia
  { value: "Asia/Kolkata", label: "India Time (IST)" },
  { value: "Asia/Kathmandu", label: "Nepal Time (NPT)" },
  { value: "Asia/Dhaka", label: "Bangladesh Time (BST)" },
  { value: "Asia/Colombo", label: "Sri Lanka Time" },
  { value: "Asia/Bangkok", label: "Thailand Time (ICT)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Time (MYT)" },
  { value: "Asia/Jakarta", label: "Indonesia Western Time (WIB)" },
  { value: "Asia/Manila", label: "Philippines Time (PHT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time (HKT)" },
  { value: "Asia/Shanghai", label: "China Time (CST)" },
  { value: "Asia/Taipei", label: "Taiwan Time (CST)" },
  { value: "Asia/Seoul", label: "Korea Time (KST)" },
  { value: "Asia/Tokyo", label: "Japan Time (JST)" },
  // Australia & Pacific
  { value: "Australia/Perth", label: "Australia Western Time (AWST)" },
  { value: "Australia/Adelaide", label: "Australia Central Time (ACST)" },
  { value: "Australia/Darwin", label: "Australia Central Time - NT (ACST)" },
  { value: "Australia/Brisbane", label: "Australia Eastern Time - QLD (AEST)" },
  { value: "Australia/Sydney", label: "Australia Eastern Time - NSW (AEST)" },
  { value: "Australia/Melbourne", label: "Australia Eastern Time - VIC (AEST)" },
  { value: "Australia/Hobart", label: "Australia Eastern Time - TAS (AEST)" },
  { value: "Pacific/Auckland", label: "New Zealand Time (NZST)" },
  { value: "Pacific/Fiji", label: "Fiji Time (FJT)" },
  // Africa
  { value: "Africa/Johannesburg", label: "South Africa Time (SAST)" },
  { value: "Africa/Cairo", label: "Egypt Time (EET)" },
  { value: "Africa/Nairobi", label: "East Africa Time (EAT)" },
  { value: "Africa/Lagos", label: "West Africa Time (WAT)" },
  { value: "Africa/Casablanca", label: "Morocco Time" }
];

const SelectCard = ({ selected, label, value, onClick, children, isDarkMode }) => (
  <div
    onClick={onClick}
    className={`relative p-4 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-102 ${
      selected
        ? isDarkMode
          ? 'bg-blue-900/50 border-2 border-blue-400 shadow-lg'
          : 'bg-blue-50 border-2 border-blue-500 shadow-lg'
        : isDarkMode
          ? 'bg-gray-800 border-2 border-gray-700 hover:border-gray-600'
          : 'bg-white border-2 border-gray-200 hover:border-gray-300'
    }`}
  >
    {selected && (
      <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <Check size={14} className="text-white" />
      </div>
    )}
    <div className={isDarkMode ? 'text-gray-200' : 'text-gray-900'}>
      {children}
    </div>
  </div>
);

const Toggle = ({ checked, onChange, label, icon: Icon, description, metric, isDarkMode, disabled = false }) => (
  <div className="group relative">
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`w-full p-5 rounded-xl border-2 transition-all duration-300 transform hover:scale-102 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${
        checked
          ? isDarkMode
            ? 'bg-blue-900/30 border-blue-400 shadow-lg'
            : 'bg-blue-50 border-blue-500 shadow-lg'
          : isDarkMode
            ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-xl transition-all duration-300 ${
            checked
              ? isDarkMode
                ? 'bg-blue-500/20 shadow-inner'
                : 'bg-blue-500 shadow-inner'
              : isDarkMode
                ? 'bg-gray-700'
                : 'bg-gray-100'
          }`}>
            <Icon size={24} className={checked
              ? isDarkMode
                ? 'text-blue-300'
                : 'text-white'
              : isDarkMode
                ? 'text-gray-400'
                : 'text-gray-500'
            } />
          </div>
          <div className="text-left">
            <h4 className={`font-semibold text-lg ${
              isDarkMode
                ? checked
                  ? 'text-blue-300'
                  : 'text-gray-300'
                : checked
                  ? 'text-blue-900'
                  : 'text-gray-700'
            }`}>
              {label}
            </h4>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {description}
            </p>
            {metric && (
              <div className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isDarkMode
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {metric}
              </div>
            )}
          </div>
        </div>
        <div className="relative">
          <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${
            checked
              ? isDarkMode
                ? 'bg-blue-500'
                : 'bg-blue-500'
              : isDarkMode
                ? 'bg-gray-700'
                : 'bg-gray-200'
          }`}>
            <div className={`absolute w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 top-0.5 ${
              checked ? 'translate-x-6 left-1' : 'translate-x-0 left-1'
            }`} />
          </div>
        </div>
      </div>
    </button>
  </div>
);

// Time Zone Component
const TimeZoneSelector = ({ selectedTimezone, onChange, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const filteredTimeZones = searchTerm
    ? TIMEZONES.filter(tz =>
        tz.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tz.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : TIMEZONES;
  const selectedTZ = TIMEZONES.find(tz => tz.value === selectedTimezone) || TIMEZONES[0];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={18} className="text-blue-500" />
        <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Time Zone
        </label>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-300 ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'
            : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
        }`}
      >
        <span>{selectedTZ.label}</span>
        <svg
          className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className={`absolute z-10 mt-1 w-full rounded-xl ${
          isDarkMode
            ? 'bg-gray-800 border border-gray-700 shadow-lg'
            : 'bg-white border border-gray-200 shadow-lg'
        }`}>
          <div className="p-2">
            <input
              type="text"
              placeholder="Search time zones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full p-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredTimeZones.map((tz) => (
              <button
                key={tz.value}
                onClick={() => {
                  onChange(tz.value);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left p-3 hover:opacity-80 transition-colors duration-200 ${
                  selectedTimezone === tz.value
                    ? isDarkMode
                      ? 'bg-blue-900/40 text-blue-300'
                      : 'bg-blue-50 text-blue-800'
                    : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-700/50'
                      : 'text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tz.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GlobalSettings = ({
  globalSettings = {
    global_target_language: "english",
    global_hallucination: false,
    global_model: "base.en",
    global_transcribe_method: "local",
    global_transcription_api_key: "",
    global_timezone: "Etc/UTC",
    global_enable_uniden_scanners: false,
    global_enable_edge_devices: true,
    global_enable_s3_upload: false,
    s3_endpoint_url: "",
    s3_access_key: "",
    s3_secret_key: "",
    s3_region: "us-east-1",
    s3_bucket_name: "",
    s3_backup_time: "03:00",
    // Samba / network share backup
    samba_backup_enabled: false,
    samba_share_path: "",
    samba_username: "",
    samba_password: "",
    host_ssid: "",
    host_password: "",
    host_ip: "",
    host_port: ""
  },
  handleGlobalChange = () => {},
  keywords = [],
  newKeyword = '',
  setNewKeyword = () => {},
  handleAddKeyword = () => {},
  handleRemoveKeyword = () => {},
  isDarkMode = false,
  toggleDarkMode = () => {},
  timezone = "Etc/UTC",
  timeFormat = "24h",
  setTimeFormat = () => {},
  reverseSort = false,
  setReverseSort = () => {},
  user = null,
  activeSection = null, // Optional: 'display-language', 'device-management', 'transcription-services', 'hotspot-configuration'
  omitHotspotSectionHeader = false,
  showToast = null,
}) => {
  const [selectedTranscriptionService, setSelectedTranscriptionService] = useState(
    globalSettings.global_transcribe_method
  );
  const [hideHallucination, setHideHallucination] = useState(() => {
    return JSON.parse(localStorage.getItem('hideHallucination')) || false;
  });

  useEffect(() => {
    setSelectedTranscriptionService(globalSettings.global_transcribe_method);
  }, [globalSettings.global_transcribe_method]);

  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [hotspotStatus, setHotspotStatus] = useState(null);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [hotspotError, setHotspotError] = useState('');
  const [hotspotActionLoading, setHotspotActionLoading] = useState(false);
  const hotspotManualSave = activeSection === 'hotspot-configuration';
  const [hotspotDraft, setHotspotDraft] = useState({
    host_ssid: '',
    host_password: '',
    host_ip: '',
    host_port: '4000',
  });

  const [hotspotDirty, setHotspotDirty] = useState(false);
  const [hotspotSaveLoading, setHotspotSaveLoading] = useState(false);

  // Channels for auto-transcription
  const [channels, setChannels] = useState([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const CACHE_KEYS = {
    CHANNELS: 'cached_channels',
    MESSAGES: 'cached_messages',
    KEYWORDS: 'cached_keywords',
    TIMEZONE: 'cached_timezone',
    LAST_FETCH: 'last_fetch_time'
  };

  const getCacheSize = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? new Blob([data]).size : 0;
    } catch (error) {
      return 0;
    }
  };

  const getTotalCacheSize = () => {
    try {
      let totalSize = 0;
      Object.values(CACHE_KEYS).forEach(key => {
        totalSize += getCacheSize(key);
      });
      return totalSize;
    } catch (error) {
      return 0;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearCache = () => {
    setIsClearingCache(true);
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      setCacheSize(0);
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsClearingCache(false);
    }
  };

  useEffect(() => {
    setCacheSize(getTotalCacheSize());
  }, []);

  // Derived inbox settings with safe defaults
  const inboxViewMode = globalSettings.global_inbox_view_mode || 'pagination'; // 'pagination' or 'continuous'
  const inboxRecordsPerPage = Number(globalSettings.global_inbox_records_per_page) || 10;
  const fetchHotspotStatus = async () => {
    setHotspotLoading(true);
    setHotspotError('');
    try {
      const response = await api.get(`/hotspot/status`);
      setHotspotStatus(response.data || null);
    } catch (error) {
      console.error('Failed to fetch hotspot status:', error);
      setHotspotError(error.response?.data?.error || 'Unable to fetch hotspot status.');
      setHotspotStatus(null);
    } finally {
      setHotspotLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspotStatus();
  }, []);

  useEffect(() => {
    if (!hotspotManualSave || hotspotDirty) return;
    setHotspotDraft({
      host_ssid: globalSettings.host_ssid || '',
      host_password: globalSettings.host_password || '',
      host_ip: globalSettings.host_ip || '',
      host_port: globalSettings.host_port || '4000',
    });
  }, [
    hotspotManualSave,
    hotspotDirty,
    globalSettings.host_ssid,
    globalSettings.host_password,
    globalSettings.host_ip,
    globalSettings.host_port,
  ]);

  const hotspotConfig = hotspotManualSave ? hotspotDraft : globalSettings;
  const updateHotspotField = (field, value) => {
    if (hotspotManualSave) {
      setHotspotDraft((prev) => ({ ...prev, [field]: value }));
      setHotspotDirty(true);
      return;
    }
    handleGlobalChange(field, value);
  };

  // When we have hotspot status, keep the configuration fields in sync so
  // that Hotspot SSID and Host IP reflect the live hotspot configuration.
  useEffect(() => {
    if (!hotspotStatus) return;
    if (hotspotManualSave && hotspotDirty) return;
    if (hotspotManualSave) {
      setHotspotDraft((prev) => ({
        ...prev,
        ...(hotspotStatus.ssid && hotspotStatus.ssid !== prev.host_ssid
          ? { host_ssid: hotspotStatus.ssid }
          : {}),
        ...(hotspotStatus.ip_address && hotspotStatus.ip_address !== prev.host_ip
          ? { host_ip: hotspotStatus.ip_address }
          : {}),
        ...(!prev.host_port ? { host_port: '4000' } : {}),
      }));
      return;
    }
    if (
      hotspotStatus.ssid &&
      hotspotStatus.ssid !== globalSettings.host_ssid
    ) {
      handleGlobalChange("host_ssid", hotspotStatus.ssid, false);
    }
    if (
      hotspotStatus.ip_address &&
      hotspotStatus.ip_address !== globalSettings.host_ip
    ) {
      handleGlobalChange("host_ip", hotspotStatus.ip_address, false);
    }
    if (!globalSettings.host_port) {
      handleGlobalChange("host_port", "4000", false);
    }
  }, [
    hotspotStatus,
    globalSettings.host_ssid,
    globalSettings.host_ip,
    globalSettings.host_port,
    handleGlobalChange,
    hotspotManualSave,
    hotspotDirty,
  ]);

  const handleSaveHotspotConfiguration = async () => {
    const ssid = (hotspotDraft.host_ssid || '').trim();
    const password = (hotspotDraft.host_password || '').trim();
    const hostIp = (hotspotDraft.host_ip || '').trim();
    const hostPort = String(hotspotDraft.host_port || '4000').trim();
    if (!ssid || !password) {
      setHotspotError('WiFi SSID and password are required before saving.');
      return;
    }
    setHotspotSaveLoading(true);
    setHotspotError('');
    try {
      await api.put(`/settings`, {
        host_ssid: ssid,
        host_password: password,
        host_ip: hostIp,
        // host_port: hostPort,
      });
      handleGlobalChange('host_ssid', ssid, false);
      handleGlobalChange('host_password', password, false);
      handleGlobalChange('host_ip', hostIp, false);
      // handleGlobalChange('host_port', hostPort, false);
      setHotspotDirty(false);
      if (showToast) {
        showToast('Hotspot configuration saved.');
      }
    } catch (error) {
      console.error('Failed to save hotspot configuration:', error);
      setHotspotError(
        error.response?.data?.error || 'Failed to save hotspot configuration.',
      );
    } finally {
      setHotspotSaveLoading(false);
    }
  };

  const handleStartHotspot = async () => {
    setHotspotActionLoading(true);
    setHotspotError('');
    try {
      await api.post(`/hotspot/start`, {
        ssid: hotspotConfig.host_ssid,
        password: hotspotConfig.host_password,
      });
      await fetchHotspotStatus();
    } catch (error) {
      console.error('Failed to start hotspot:', error);
      setHotspotError(error.response?.data?.error || 'Failed to start hotspot.');
    } finally {
      setHotspotActionLoading(false);
    }
  };

  const handleStopHotspot = async () => {
    setHotspotActionLoading(true);
    setHotspotError('');
    try {
      await api.post(`/hotspot/stop`);
      await fetchHotspotStatus();
    } catch (error) {
      console.error('Failed to stop hotspot:', error);
      setHotspotError(error.response?.data?.error || 'Failed to stop hotspot.');
    } finally {
      setHotspotActionLoading(false);
    }
  };

  // Effect for local storage
  useEffect(() => {
    localStorage.setItem('hideHallucination', JSON.stringify(hideHallucination));
  }, [hideHallucination]);

  // Get browser timezone as default if not set
  useEffect(() => {
    if (!globalSettings.global_timezone) {
      try {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        handleGlobalChange("global_timezone", browserTimezone, false); // Don't show notification for initial setup
      } catch (error) {
        // Fallback to UTC if browser API fails
        handleGlobalChange("global_timezone", "Etc/UTC", false); // Don't show notification for initial setup
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Map activeSection to section visibility (must be defined before useEffects that use these)
  const showDisplayLanguage = !activeSection || activeSection === 'display-language';
  const showDeviceManagement = !activeSection || activeSection === 'device-management';
  const showTranscriptionServices = !activeSection || activeSection === 'transcription-services';
  const showHotspotConfiguration = !activeSection || activeSection === 'hotspot-configuration';

  // Fetch channels when transcription services section is active
  useEffect(() => {
    if (showTranscriptionServices) {
      fetchChannels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTranscriptionServices]);

  const fetchChannels = async () => {
    setChannelsLoading(true);
    try {
      const response = await api.get(`/channels`);
      if (response.data) {
        // Ensure auto_transcribe defaults to true if not present
        const channelsWithDefaults = response.data.map(channel => ({
          ...channel,
          auto_transcribe: channel.auto_transcribe !== undefined ? channel.auto_transcribe : true
        }));
        setChannels(channelsWithDefaults);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleChannelAutoTranscribeChange = async (channelId, enabled) => {
    try {
      const response = await api.put(`/channel/${channelId}`, {
        auto_transcribe: enabled
      });
      if (response.status === 200) {
        // Update local state
        setChannels(prevChannels =>
          prevChannels.map(channel =>
            channel.id === channelId
              ? { ...channel, auto_transcribe: enabled }
              : channel
          )
        );
      }
    } catch (error) {
      console.error('Error updating channel auto-transcribe setting:', error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Dark Mode Toggle */}
      {/* Display & Language Settings */}
      {showDisplayLanguage && (
      <div className="space-y-6">
        <SettingsSectionHeader
          icon={Globe}
          title="Display & Language"
          description="Customize how information is displayed, how the inbox behaves, and which language to use for transcriptions"
          isDarkMode={isDarkMode}
          iconColor="blue"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Globe size={18} className="text-blue-500" />
                  Target Language
                </div>
              </label>
              <select
                value={globalSettings.global_target_language || 'english'}
                onChange={(e) => handleGlobalChange("global_target_language", e.target.value)}
                className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-400'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                } focus:ring focus:ring-blue-200/50`}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
              <p className={`mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Select the primary language for transcription. Audio will be processed to detect and transcribe this language.
              </p>
            </div>
            <TimeZoneSelector
              selectedTimezone={globalSettings.global_timezone || "Etc/UTC"}
              onChange={(value) => handleGlobalChange("global_timezone", value)}
              isDarkMode={isDarkMode}
            />
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Set your local timezone. All timestamps in messages and recordings will be displayed in this timezone.
            </p>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-blue-500" />
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Time Format
                </label>
              </div>
              <div className="space-y-3">
                <div
                  onClick={() => setTimeFormat("24h")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    timeFormat === "24h"
                      ? isDarkMode
                        ? 'bg-blue-900/50 border-blue-400 shadow-lg'
                        : 'bg-blue-50 border-blue-500 shadow-lg'
                      : isDarkMode
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      timeFormat === "24h"
                        ? isDarkMode
                          ? 'border-blue-400 bg-blue-400'
                          : 'border-blue-500 bg-blue-500'
                        : isDarkMode
                          ? 'border-gray-500'
                          : 'border-gray-400'
                    }`}>
                      {timeFormat === "24h" && (
                        <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} />
                      )}
                    </div>
                    <div>
                      <h4 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        24-Hour Format
                      </h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Display time as 14:30:45
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setTimeFormat("12h")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    timeFormat === "12h"
                      ? isDarkMode
                        ? 'bg-blue-900/50 border-blue-400 shadow-lg'
                        : 'bg-blue-50 border-blue-500 shadow-lg'
                      : isDarkMode
                        ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      timeFormat === "12h"
                        ? isDarkMode
                          ? 'border-blue-400 bg-blue-400'
                          : 'border-blue-500 bg-blue-500'
                        : isDarkMode
                          ? 'border-gray-500'
                          : 'border-gray-400'
                    }`}>
                      {timeFormat === "12h" && (
                        <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} />
                      )}
                    </div>
                    <div>
                      <h4 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        12-Hour Format
                      </h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Display time as 2:30:45 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className={`mt-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Choose how time is displayed throughout the application (24-hour or 12-hour with AM/PM).
              </p>
            </div>
            {/* Inbox behaviour (Super admin only) */}
            {user?.role === 'admin' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Radio size={18} className="text-blue-500" />
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Inbox View
                  </label>
                </div>
                <div className="space-y-3">
                  <div
                    onClick={() => handleGlobalChange("global_inbox_view_mode", "pagination")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                      inboxViewMode === "pagination"
                        ? isDarkMode
                          ? 'bg-blue-900/50 border-blue-400 shadow-lg'
                          : 'bg-blue-50 border-blue-500 shadow-lg'
                        : isDarkMode
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        inboxViewMode === "pagination"
                          ? isDarkMode
                            ? 'border-blue-400 bg-blue-400'
                            : 'border-blue-500 bg-blue-500'
                          : isDarkMode
                            ? 'border-gray-500'
                            : 'border-gray-400'
                      }`}>
                        {inboxViewMode === "pagination" && (
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} />
                        )}
                      </div>
                      <div>
                        <h4 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                          Pagination (Recommended)
                        </h4>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Show a fixed number of messages per page with classic pagination controls.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    onClick={() => handleGlobalChange("global_inbox_view_mode", "continuous")}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                      inboxViewMode === "continuous"
                        ? isDarkMode
                          ? 'bg-blue-900/50 border-blue-400 shadow-lg'
                          : 'bg-blue-50 border-blue-500 shadow-lg'
                        : isDarkMode
                          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        inboxViewMode === "continuous"
                          ? isDarkMode
                            ? 'border-blue-400 bg-blue-400'
                            : 'border-blue-500 bg-blue-500'
                          : isDarkMode
                            ? 'border-gray-500'
                            : 'border-gray-400'
                      }`}>
                        {inboxViewMode === "continuous" && (
                          <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`} />
                        )}
                      </div>
                      <div>
                        <h4 className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                          Continuous Scrolling
                        </h4>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Load more messages automatically as you scroll, ideal for monitoring in real time.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Default records per page (pagination mode) */}
                <div className="mt-3">
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Default Records per Page
                  </label>
                  <select
                    value={inboxRecordsPerPage}
                    onChange={(e) => handleGlobalChange("global_inbox_records_per_page", parseInt(e.target.value, 10))}
                    className={`w-full md:w-40 p-2 rounded-xl border-2 text-sm ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-400'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                    } focus:ring focus:ring-blue-200/50`}
                  >
                    {[10, 20, 50, 100].map((option) => (
                      <option key={option} value={option}>
                        {option} messages
                      </option>
                    ))}
                  </select>
                  <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    This sets the default page size for the Live Communications inbox when using pagination. Users can still adjust their own preference.
                  </p>
                </div>
              </div>
            )}
            <Toggle
              checked={reverseSort}
              onChange={(checked) => {
                setReverseSort(checked);
                if (user?.username) {
                  const saveReverseSortPreference = async (newReverseSort) => {
                    try {
                      await api.post(`/pagination-preferences/${user.username}`, {
                        recordsPerPage: 20,
                        currentPage: 1,
                        reverseSort: newReverseSort
                      });
                    } catch (error) {
                      console.error('Failed to save reverse sort preference:', error);
                    }
                  };
                  saveReverseSortPreference(checked);
                }
              }}
              label="Message Sorting"
              icon={ArrowUpDown}
              description={reverseSort ? "Newest messages appear at the top of the list" : "Newest messages appear at the bottom of the list"}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>
      )}
      {/* Device Management */}
      {showDeviceManagement && (
      <div className="space-y-6">
        <SettingsSectionHeader
          icon={SmartphoneNfc}
          title="Device Management"
          description="Enable automatic detection and connection to compatible radio devices"
          isDarkMode={isDarkMode}
          iconColor="purple"
        />
        <div className="space-y-4">
          <Toggle
            checked={globalSettings.global_enable_uniden_scanners}
            onChange={(checked) => handleGlobalChange("global_enable_uniden_scanners", checked)}
            label="Enable Uniden Scanners"
            icon={SmartphoneNfc}
            description="Automatically scan for and connect to Uniden BC125AT scanners when the application starts. This keeps your scanner inventory up to date."
            isDarkMode={isDarkMode}
          />
          <Toggle
            checked={globalSettings.global_enable_edge_devices}
            onChange={(checked) => handleGlobalChange("global_enable_edge_devices", checked)}
            label="Enable Boondock Edge Devices"
            icon={Cpu}
            description="Automatically discover and connect to ESP32-based Boondock Edge recorders (Silicon Labs CP210x USB devices) when the service starts."
            metric="Requires restart"
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
      )}
      {/* Transcription Services */}
      {showTranscriptionServices && (
      <div className="space-y-6">
        <SettingsSectionHeader
          icon={Radio}
          title="Transcription Services"
          description="Choose one transcription method. Only one method can be active at a time — if it fails, transcription is marked as failed with no automatic fallback."
          isDarkMode={isDarkMode}
          iconColor="blue"
        />
        <div className="space-y-4">
          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="sr-only">Transcription service</legend>
            {[
              {
                value: 'openai',
                label: 'Boondock API',
                description: "Use Boondock's cloud API service. Requires an internet connection.",
                Icon: Cloud,
                selected: selectedTranscriptionService === 'openai',
              },
              {
                value: 'local',
                label: 'Local Transcription',
                description: 'Process audio on this device using faster-whisper. Works offline.',
                Icon: Server,
                selected: selectedTranscriptionService === 'local',
              },
            ].map(({ value, label, description, Icon, selected }) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border-2 p-5 transition-colors ${
                  selected
                    ? isDarkMode ? 'border-blue-500 bg-blue-950/30' : 'border-blue-500 bg-blue-50'
                    : isDarkMode ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="transcription-service"
                  value={value}
                  checked={Boolean(selected)}
                  onChange={() => {
                    setSelectedTranscriptionService(value);
                    if (value === 'local') {
                      handleGlobalChange('global_transcribe_method', 'local');
                    }
                  }}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-blue-500' : 'text-gray-400'}`} />
                <span>
                  <span className={`block font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{label}</span>
                  <span className={`mt-1 block text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {selectedTranscriptionService === 'openai' && (
            <div className={`rounded-xl border p-5 ${isDarkMode ? 'border-blue-800/60 bg-gray-800/50' : 'border-blue-200 bg-white'}`}>
              <label htmlFor="transcription-api-key" className={`block text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Transcription API Key
              </label>
              <p className={`mb-3 mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Enter the API key used to authenticate requests to the Boondock transcription service.
              </p>
              <input
                id="transcription-api-key"
                type="password"
                autoComplete="off"
                value={globalSettings.global_transcription_api_key || ''}
                onChange={(event) => {
                  const apiKey = event.target.value;
                  if (apiKey.trim()) {
                    handleGlobalChange({
                      global_transcription_api_key: apiKey,
                      global_transcribe_method: 'openai',
                    }, undefined, false);
                  } else if (globalSettings.global_transcribe_method === 'openai') {
                    handleGlobalChange('global_transcription_api_key', '', false);
                  }
                }}
                placeholder="Enter transcription API key"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                  isDarkMode ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder-gray-500' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          )}

            {/* Model Selection - Only show when Local Transcription is enabled */}
            {selectedTranscriptionService === 'local' && (
              <div className={`ml-12 p-5 rounded-xl border-2 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-800/50 border-gray-700'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="space-y-4">
                  {/* Model Selection Slider */}
                  <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DatabaseZap size={18} className="text-blue-500" />
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Model Quality Level
                    </label>
                  </div>
                  {(() => {
                    const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model) || WHISPER_MODELS[1]; // Default to base.en
                    return (
                      <span className={`text-sm font-semibold px-3 py-1 rounded-lg ${
                        isDarkMode
                          ? 'bg-blue-900/50 text-blue-300'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {currentModel.label} ({currentModel.model})
                      </span>
                    );
                  })()}
                </div>
                {/* Slider */}
                <div className="relative">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={(() => {
                      const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                      return currentModel ? currentModel.level : 2; // Default to base.en (level 2)
                    })()}
                    onChange={(e) => {
                      const level = parseInt(e.target.value);
                      const selectedModel = WHISPER_MODELS.find(m => m.level === level);
                      if (selectedModel) {
                        handleGlobalChange("global_model", selectedModel.value);
                        // Automatically enable local transcription when slider is moved
                        if (globalSettings.global_transcribe_method !== 'local') {
                          handleGlobalChange("global_transcribe_method", "local");
                        }
                      }
                    }}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: isDarkMode
                        ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, #374151 ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, #374151 100%)`
                        : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, #e5e7eb ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, #e5e7eb 100%)`
                    }}
                  />
                  <style>{`
                    .slider::-webkit-slider-thumb {
                      appearance: none;
                      width: 20px;
                      height: 20px;
                      border-radius: 50%;
                      background: ${isDarkMode ? '#3b82f6' : '#3b82f6'};
                      cursor: pointer;
                      border: 2px solid ${isDarkMode ? '#1e3a8a' : '#ffffff'};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                    .slider::-moz-range-thumb {
                      width: 20px;
                      height: 20px;
                      border-radius: 50%;
                      background: ${isDarkMode ? '#3b82f6' : '#3b82f6'};
                      cursor: pointer;
                      border: 2px solid ${isDarkMode ? '#1e3a8a' : '#ffffff'};
                      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    }
                  `}</style>
                  {/* Level Labels */}
                  <div className="flex justify-between mt-2">
                    {WHISPER_MODELS.map((model) => (
                      <button
                        key={model.level}
                        type="button"
                        onClick={() => {
                          handleGlobalChange("global_model", model.value);
                          if (globalSettings.global_transcribe_method !== 'local') {
                            handleGlobalChange("global_transcribe_method", "local");
                          }
                        }}
                        className={`text-xs font-medium px-2 py-1 rounded transition-all ${
                          globalSettings.global_model === model.value
                            ? isDarkMode
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-500 text-white'
                            : isDarkMode
                              ? 'text-gray-400 hover:text-gray-300'
                              : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title={`${model.label} - ${model.model}`}
                      >
                        {model.level}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Current Model Info */}
                {(() => {
                  const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model) || WHISPER_MODELS[1];
                  return (
                    <div className={`mt-4 p-4 rounded-lg border-2 ${
                      isDarkMode
                        ? 'bg-gray-800/50 border-gray-700'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                            {currentModel.label} Quality
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {currentModel.model}
                          </span>
                        </div>
                        <div className={`grid grid-cols-2 gap-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <div>
                            <span className="font-medium">Speed:</span> {currentModel.speed}
                          </div>
                          <div>
                            <span className="font-medium">Accuracy:</span> {currentModel.accuracy}
                          </div>
                          <div>
                            <span className="font-medium">Memory:</span> {currentModel.memory}
                          </div>
                          <div>
                            <span className="font-medium">CPU:</span> {currentModel.cpu}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* Hardware Recommendations */}
                <div className={`mt-4 p-4 rounded-lg border-2 ${
                  isDarkMode
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} className={`flex-shrink-0 mt-0.5 ${
                      isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                    }`} />
                    <div className="flex-1">
                      <h5 className={`font-semibold text-sm mb-1 ${
                        isDarkMode ? 'text-yellow-300' : 'text-yellow-800'
                      }`}>
                        Processing Power Notice
                      </h5>
                      <p className={`text-xs ${isDarkMode ? 'text-yellow-200/80' : 'text-yellow-700'}`}>
                        Higher quality levels consume significantly more processing power and memory.
                        <strong> Highest quality (Large model)</strong> requires 32 GB RAM, Multi-Core High CPU, and 250 TOPS GPU.
                        <strong> High quality (Medium model)</strong> requires 32 GB RAM, Multi-Core CPU, and 100 TOPS GPU.
                        Lower quality levels (Low/Normal) are suitable for most devices and provide good accuracy with faster processing.
                        The default <strong>Normal (base.en)</strong> setting offers the best balance of speed and accuracy for most use cases.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
                </div>
              </div>
            )}
          {/* Channel Auto-Transcription Selection */}
          <div className={`mt-6 p-5 rounded-xl border-2 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Radio size={18} className="text-blue-500" />
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Channel Auto-Transcription
                </label>
              </div>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Select which channels should be automatically transcribed when audio is recorded. Each channel defaults to enabled.
              </p>
              {channelsLoading ? (
                <div className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <div className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No channels available
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                          style={{
                            borderColor: channel.color || '#000000',
                            backgroundColor: channel.auto_transcribe !== false ? (channel.color || '#000000') : 'transparent'
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                            {channel.name || `Channel ${channel.id}`}
                          </div>
                          {channel.mac && (
                            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              MAC: {channel.mac}
                            </div>
                          )}
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={channel.auto_transcribe !== false}
                          onChange={(e) => handleChannelAutoTranscribeChange(channel.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={`w-11 h-6 rounded-full peer transition-colors duration-200 ${
                          channel.auto_transcribe !== false
                            ? isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
                            : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                        }`}>
                          <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 mt-0.5 ml-0.5 ${
                            channel.auto_transcribe !== false ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
      {/* Hotspot Configuration Section */}
      {showHotspotConfiguration && (
      <div className="space-y-6">
        {!omitHotspotSectionHeader && (
        <SettingsSectionHeader
          icon={Network}
          title="WiFi"
          description="Configure WiFi hotspot settings for Boondock Recorder devices"
          isDarkMode={isDarkMode}
          iconColor="green"
        />
        )}
        {/* Enable / Disable hotspot */}
        <div className="mt-6">
          <Toggle
            isDarkMode={isDarkMode}
            checked={!!hotspotStatus?.enabled}
            disabled={hotspotActionLoading || hotspotStatus?.supported === false || (!hotspotStatus?.enabled && (!(hotspotConfig.host_ssid || '').trim() || !(hotspotConfig.host_password || '').trim()))}
            onChange={(enabled) => { if (enabled) handleStartHotspot(); else handleStopHotspot(); }}
            label="Enable hotspot"
            icon={Network}
            description={hotspotStatus?.enabled ? 'Hotspot is active. Devices can connect to the WiFi and use Auto Config.' : 'Turn on the WiFi hotspot so recorders can connect and be configured.'}
          />
        </div>
        {/* Custom hotspot: SSID, password, host IP, port — saved and used for hotspot and Auto Config */}
        <div className="mt-8">
          <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            WiFi Settings
          </h3>
          <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Set WiFi SSID and password here. They are used when you enable the hotspot and when you run Auto Config on recorder devices.
            {hotspotManualSave && ' Click Save to store changes before enabling the hotspot.'}
          </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Network size={18} className="text-green-500" />
                WiFi SSID
              </div>
            </label>
            <input
              type="text"
              value={hotspotConfig.host_ssid || ''}
              onChange={(e) => updateHotspotField('host_ssid', e.target.value)}
              placeholder="Enter WiFi SSID"
              className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500 focus:border-green-500'
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-green-500'
              }`}
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Network name for the hotspot and for Auto Config on recorders
            </p>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Network size={18} className="text-green-500" />
                WiFi password
              </div>
            </label>
            <input
              type="password"
              value={hotspotConfig.host_password || ''}
              onChange={(e) => updateHotspotField('host_password', e.target.value)}
              placeholder="Enter WiFi password"
              className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500 focus:border-green-500'
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-green-500'
              }`}
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Password for the hotspot and for Auto Config on recorders
            </p>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Server size={18} className="text-green-500" />
                Host IP
              </div>
            </label>
            <input
              type="text"
              value={hotspotConfig.host_ip || ''}
              onChange={(e) => updateHotspotField('host_ip', e.target.value)}
              placeholder="e.g. 192.168.4.1 or 10.42.0.1"
              className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500 focus:border-green-500'
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-green-500'
              }`}
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              IP that recorders use to reach this server (used by Auto Config)
            </p>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Server size={18} className="text-green-500" />
                Host port
              </div>
            </label>
            <input
              type="number"
              value={hotspotConfig.host_port || ''}
              onChange={(e) => updateHotspotField('host_port', e.target.value)}
              placeholder="e.g. 4000"
              min="1"
              max="65535"
              className={`w-full p-3 rounded-xl border-2 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500 focus:border-green-500'
                  : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:border-green-500'
              }`}
              disabled
            />
            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Port that recorders use (used by Auto Config; 1–65535)
            </p>
          </div>
        </div>
        {hotspotManualSave && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSaveHotspotConfiguration}
              disabled={hotspotSaveLoading || !hotspotDirty}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                hotspotSaveLoading || !hotspotDirty
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {hotspotSaveLoading ? 'Saving…' : 'Save WiFi Settings'}
            </button>
            {hotspotDirty && !hotspotSaveLoading && (
              <span className={`text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                Unsaved changes
              </span>
            )}
          </div>
        )}
        </div>
        <div className={`mt-8 p-4 rounded-xl border-2 ${isDarkMode ? 'border-green-700 bg-green-900/20' : 'border-green-200 bg-green-50'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hotspotStatus?.enabled
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Hotspot status:{' '}
                  {hotspotLoading
                    ? 'Checking...'
                    : hotspotStatus?.supported === false
                      ? 'Not supported on this system'
                      : hotspotStatus?.enabled
                        ? 'Active'
                        : 'Inactive'}
                </span>
              </div>
              <div className={`mt-2 text-xs space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <p>
                  IP:{' '}
                  {hotspotStatus?.ip_address || globalSettings.host_ip || 'Not detected'}
                </p>
                <p>
                  Connected clients:{' '}
                  {hotspotStatus?.clients?.count ?? 0}
                </p>
                {hotspotStatus?.ssid && (
                  <p>Active SSID: {hotspotStatus.ssid}</p>
                )}
              </div>
              {hotspotError && (
                <p className="mt-2 text-xs text-red-500">
                  {hotspotError}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button
                type="button"
                onClick={fetchHotspotStatus}
                disabled={hotspotLoading}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
                  isDarkMode
                    ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      {/* Footer */}
      {!hotspotManualSave && (
      <div className={`text-center py-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <p className="text-sm">Configuration changes are saved automatically</p>
      </div>
      )}
    </div>
  );
};

export default GlobalSettings;
