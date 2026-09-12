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

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import noticeStyles from '../ui/Notice.module.css';
import Button from '../ui/Button';
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

const SelectCard = ({ selected, label, value, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${formStyles.choiceCard} ${selected ? formStyles.choiceCardSelected : ''}`}
    aria-pressed={selected}
  >
    {selected && <Check className="iconSmall" />}
    <span>{children}</span>
  </button>
);

const Toggle = ({ checked, onChange, label, icon: Icon, description, metric, disabled = false }) => (
  <div className={`${formStyles.choiceCard} ${checked ? formStyles.choiceCardSelected : ''}`}>
    <div className="row grow">
      <Icon className="iconMedium" />
      <div className="grow">
        <h4 className={cardStyles.title}>{label}</h4>
        <p className="mutedText smallText">{description}</p>
        {metric && <div className="row">{metric}</div>}
      </div>
    </div>
    <label className={formStyles.switch}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
    </label>
  </div>
);
const GlobalSettings = ({
  globalSettings = {
    global_target_language: "english",
    global_hallucination: false,
    global_model: "base.en",
    global_transcribe_method: "local",
    global_transcription_api_key: "",
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
    <div className="stack stackLarge">
      {/* Header with Dark Mode Toggle */}
      {/* Display & Language Settings */}
      {showDisplayLanguage && (
      <div className="stack stackLarge">
        <SettingsSectionHeader
          icon={Globe}
          title="Display & Language"
          description="Customize how information is displayed, how the inbox behaves, and which language to use for transcriptions"
          iconColor="blue"
        />
        <div className="gridTwo">
          <div className="stack stackLarge">
            <div>
              <label className={formStyles.label}>
                <div className="row">
                  <Globe size={18} />
                  Target Language
                </div>
              </label>
              <select
                value={globalSettings.global_target_language || 'english'}
                onChange={(e) => handleGlobalChange("global_target_language", e.target.value)}
                className={formStyles.select}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} >
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
              <p className="mutedText tinyText">
                Select the primary language for transcription. Audio will be processed to detect and transcribe this language.
              </p>
            </div>
          </div>
          <div className="stack stackLarge">
            <div>
              <div className="row">
                <Clock size={18} />
                <label className={formStyles.label}>
                  Time Format
                </label>
              </div>
              <div className="stack">
                {[
                  {
                    value: '24h',
                    label: '24-Hour Format',
                    description: 'Display time as 14:30:45',
                    selected: timeFormat === '24h',
                  },
                  {
                    value: '12h',
                    label: '12-Hour Format',
                    description: 'Display time as 2:30:45 PM',
                    selected: timeFormat === '12h',
                  },
                ].map(({ value, label, description, selected }) => (
                  <label
                    key={value}
                    className={`${formStyles.choiceCard} ${
                      selected ? formStyles.choiceCardSelected : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="time-format"
                      value={value}
                      checked={Boolean(selected)}
                      onChange={() => {
                        setTimeFormat(value);
                      }}
                    />
                    <span className="stackCompact grow">
                      <strong>{label}</strong>
                      <div className="mutedText smallText">
                        {description}
                      </div>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mutedText tinyText">
                Choose how time is displayed throughout the application (24-hour or 12-hour with AM/PM).
              </p>
            </div>
            {/* Inbox behaviour (Super admin only) */}
            {user?.role === 'admin' && (
              <div className="stack">
                <div className="row">
                  <Radio size={18} />
                  <label className={formStyles.label}>
                    Inbox View
                  </label>
                </div>
                <div className="stack">
                  {[
                    {
                      value: 'pagination',
                      label: 'Pagination (Recommended)',
                      description: 'Show a fixed number of messages per page with classic pagination controls.',
                      selected: inboxViewMode === 'pagination',
                    },
                    {
                      value: 'continuous',
                      label: 'Continuous Scrolling',
                      description: 'Load more messages automatically as you scroll, ideal for monitoring in real time.',
                      selected: inboxViewMode === 'continuous',
                    },
                  ].map(({ value, label, description, selected }) => (
                    <label
                      key={value}
                      className={`${formStyles.choiceCard} ${
                        selected ? formStyles.choiceCardSelected : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="time-format"
                        value={value}
                        checked={Boolean(selected)}
                        onChange={() => {
                          handleGlobalChange("global_inbox_view_mode", value);
                        }}
                      />
                      <span className="stackCompact grow">
                        <strong>{label}</strong>
                        <div className="mutedText smallText">
                          {description}
                        </div>
                      </span>
                    </label>
                  ))}
                </div>
                {/* Default records per page (pagination mode) */}
                <div >
                  <label className={formStyles.label}>
                    Default Records per Page
                  </label>
                  <select
                    value={inboxRecordsPerPage}
                    onChange={(e) => handleGlobalChange("global_inbox_records_per_page", parseInt(e.target.value, 10))}
                    className={formStyles.select}
                  >
                    {[10, 20, 50, 100].map((option) => (
                      <option key={option} value={option}>
                        {option} messages
                      </option>
                    ))}
                  </select>
                  <p className="mutedText tinyText">
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
                />
          </div>
        </div>
      </div>
      )}
      {/* Device Management */}
      {showDeviceManagement && (
      <div className="stack stackLarge">
        <SettingsSectionHeader
          icon={SmartphoneNfc}
          title="Device Management"
          description="Enable automatic detection and connection to compatible radio devices"
          iconColor="purple"
        />
        <div className="stack">
          <Toggle
            checked={globalSettings.global_enable_uniden_scanners}
            onChange={(checked) => handleGlobalChange("global_enable_uniden_scanners", checked)}
            label="Enable Uniden Scanners"
            icon={SmartphoneNfc}
            description="Automatically scan for and connect to Uniden BC125AT scanners when the application starts. This keeps your scanner inventory up to date."
            />
          <Toggle
            checked={globalSettings.global_enable_edge_devices}
            onChange={(checked) => handleGlobalChange("global_enable_edge_devices", checked)}
            label="Enable Boondock Edge Devices"
            icon={Cpu}
            description="Automatically discover and connect to ESP32-based Boondock Edge recorders (Silicon Labs CP210x USB devices) when the service starts."
            metric="Requires restart"
            />
        </div>
      </div>
      )}
      {/* Transcription Services */}
      {showTranscriptionServices && (
      <div className="stack stackLarge">
        <SettingsSectionHeader
          icon={Radio}
          title="Transcription Services"
          description="Choose one transcription method. Only one method can be active at a time — if it fails, transcription is marked as failed with no automatic fallback."
          iconColor="blue"
        />
        <div className="stack">
          <fieldset>
            <legend className={formStyles.srOnly}>Transcription service</legend>
            <div className="gridTwo">
              {[
                {
                  value: 'openai',
                  label: 'Boondock API',
                  description:
                    "Use Boondock's cloud API service. Requires an internet connection.",
                  Icon: Cloud,
                  selected: selectedTranscriptionService === 'openai',
                },
                {
                  value: 'local',
                  label: 'Local Transcription',
                  description:
                    'Process audio on this device using faster-whisper. Works offline.',
                  Icon: Server,
                  selected: selectedTranscriptionService === 'local',
                },
              ].map(({ value, label, description, Icon, selected }) => (
                <label
                  key={value}
                  className={`${formStyles.choiceCard} ${
                    selected ? formStyles.choiceCardSelected : ''
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
                  />

                  <Icon className="iconMedium" />

                  <span className="stackCompact grow">
                    <strong>{label}</strong>
                    <div className="mutedText smallText">
                      {description}
                    </div>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {selectedTranscriptionService === 'openai' && (
            <div className={cardStyles.card}>
              <label htmlFor="transcription-api-key" className={formStyles.label}>
                Transcription API Key
              </label>
              <p className="mutedText smallText">
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
                className={formStyles.input}
              />
            </div>
          )}

            {/* Model Selection - Only show when Local Transcription is enabled */}
            {selectedTranscriptionService === 'local' && (
              <div className={cardStyles.card}>
                <div className="stack">
                  {/* Model Selection Slider */}
                  <div className="stack">
                <div className="rowBetween">
                  <div className="row">
                    <DatabaseZap size={18} />
                    <label className={formStyles.label}>
                      Model Quality Level
                    </label>
                  </div>
                  {(() => {
                    const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model) || WHISPER_MODELS[1]; // Default to base.en
                    return (
                      <span className="pill pillAccent">
                        {currentModel.label} ({currentModel.model})
                      </span>
                    );
                  })()}
                </div>
                {/* Slider */}
                <div >
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
                    className={formStyles.range}
                    style={{ background: `linear-gradient(to right, var(--ui-accent) 0%, var(--ui-accent) ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, var(--ui-border) ${(((() => {
                            const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model);
                            return currentModel ? currentModel.level : 2;
                          })() - 1) / 4) * 100}%, var(--ui-border) 100%)` }}
                  />

                  {/* Level Labels */}
                  <div className='rowBetween'>
                    {WHISPER_MODELS.map((model) => (
                      <Button
                        key={model.level}
                        type="button"
                        onClick={() => {
                          handleGlobalChange("global_model", model.value);
                          if (globalSettings.global_transcribe_method !== 'local') {
                            handleGlobalChange("global_transcribe_method", "local");
                          }
                        }}
                        variant={model.value === globalSettings.global_model? "primary" : "ghost"}
                        size="small"
                        title={`${model.label} - ${model.model}`}
                      >
                        {model.level}
                      </Button>
                    ))}
                  </div>
                </div>
                {/* Current Model Info */}
                {(() => {
                  const currentModel = WHISPER_MODELS.find(m => m.value === globalSettings.global_model) || WHISPER_MODELS[1];
                  return (
                    <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                      <div className="stack">
                        <div className="rowBetween">
                          <span className="mutedText smallText">
                            {currentModel.label} Quality
                          </span>
                          <span className="pill pillAccent">
                            {currentModel.model}
                          </span>
                        </div>
                        <div className="gridTwo">
                          <div>
                            <span>Speed:</span> {currentModel.speed}
                          </div>
                          <div>
                            <span>Accuracy:</span> {currentModel.accuracy}
                          </div>
                          <div>
                            <span>Memory:</span> {currentModel.memory}
                          </div>
                          <div>
                            <span>CPU:</span> {currentModel.cpu}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {/* Hardware Recommendations */}
                <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
                  <div className="row">
                    <AlertTriangle size={18} className="iconSmall" />
                    <div className="grow">
                      <h5 className={cardStyles.title}>
                        Processing Power Notice
                      </h5>
                      <p className="mutedText tinyText">
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
          <div className={cardStyles.card}>
            <div className="stack">
              <div className="row">
                <Radio size={18} />
                <label className={formStyles.label}>
                  Channel Auto-Transcription
                </label>
              </div>
              <p className="mutedText smallText">
                Select which channels should be automatically transcribed when audio is recorded. Each channel defaults to enabled.
              </p>
              {channelsLoading ? (
                <div className="centeredContent mutedText smallText">
                  Loading channels...
                </div>
              ) : channels.length === 0 ? (
                <div className="centeredContent mutedText smallText">
                  No channels available
                </div>
              ) : (
                <div className="scrollPanel">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="rowBetween"
                    >
                      <div className="row">
                        <div
                          className={cardStyles.card}
                          style={{
                            borderColor: channel.color || '#000000',
                            backgroundColor: channel.auto_transcribe !== false ? (channel.color || '#000000') : 'transparent'
                          }}
                        />
                        <div className="grow">
                          <div >
                            {channel.name || `Channel ${channel.id}`}
                          </div>
                          {channel.mac && (
                            <div >
                              MAC: {channel.mac}
                            </div>
                          )}
                        </div>
                      </div>
                      <label className={formStyles.switch}>
                        <input
                          type="checkbox"
                          checked={channel.auto_transcribe !== false}
                          onChange={(e) => handleChannelAutoTranscribeChange(channel.id, e.target.checked)}
                        />
                        <span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span>
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
      <div className="stack stackLarge">
        {!omitHotspotSectionHeader && (
        <SettingsSectionHeader
          icon={Network}
          title="WiFi"
          description="Configure WiFi hotspot settings for Boondock Recorder devices"
          iconColor="green"
        />
        )}
        {/* Enable / Disable hotspot */}
        <div >
          <Toggle
              checked={!!hotspotStatus?.enabled}
            disabled={hotspotActionLoading || hotspotStatus?.supported === false || (!hotspotStatus?.enabled && (!(hotspotConfig.host_ssid || '').trim() || !(hotspotConfig.host_password || '').trim()))}
            onChange={(enabled) => { if (enabled) handleStartHotspot(); else handleStopHotspot(); }}
            label="Enable hotspot"
            icon={Network}
            description={hotspotStatus?.enabled ? 'Hotspot is active. Devices can connect to the WiFi and use Auto Config.' : 'Turn on the WiFi hotspot so recorders can connect and be configured.'}
          />
        </div>
        {/* Custom hotspot: SSID, password, host IP, port — saved and used for hotspot and Auto Config */}
        <div >
          <h3 className={cardStyles.title}>
            WiFi Settings
          </h3>
          <p className="mutedText tinyText">
            Set WiFi SSID and password here. They are used when you enable the hotspot and when you run Auto Config on recorder devices.
            {hotspotManualSave && ' Click Save to store changes before enabling the hotspot.'}
          </p>
        <div className="gridTwo">
          <div>
            <label className={formStyles.label}>
              <div className="row">
                <Network size={18} />
                WiFi SSID
              </div>
            </label>
            <input
              type="text"
              value={hotspotConfig.host_ssid || ''}
              onChange={(e) => updateHotspotField('host_ssid', e.target.value)}
              placeholder="Enter WiFi SSID"
              className={formStyles.input}
            />
            <p className="mutedText tinyText">
              Network name for the hotspot and for Auto Config on recorders
            </p>
          </div>
          <div>
            <label className={formStyles.label}>
              <div className="row">
                <Network size={18} />
                WiFi password
              </div>
            </label>
            <input
              type="password"
              value={hotspotConfig.host_password || ''}
              onChange={(e) => updateHotspotField('host_password', e.target.value)}
              placeholder="Enter WiFi password"
              className={formStyles.input}
            />
            <p className="mutedText tinyText">
              Password for the hotspot and for Auto Config on recorders
            </p>
          </div>
          <div>
            <label className={formStyles.label}>
              <div className="row">
                <Server size={18} />
                Host IP
              </div>
            </label>
            <input
              type="text"
              value={hotspotConfig.host_ip || ''}
              onChange={(e) => updateHotspotField('host_ip', e.target.value)}
              placeholder="e.g. 192.168.4.1 or 10.42.0.1"
              className={formStyles.input}
            />
            <p className="mutedText tinyText">
              IP that recorders use to reach this server (used by Auto Config)
            </p>
          </div>
          <div>
            <label className={formStyles.label}>
              <div className="row">
                <Server size={18} />
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
              className={formStyles.input}
              disabled
            />
            <p className="mutedText tinyText">
              Port that recorders use (used by Auto Config; 1–65535)
            </p>
          </div>
        </div>
        {hotspotManualSave && (
          <div className="rowWrap">
            <button
              type="button"
              onClick={handleSaveHotspotConfiguration}
              disabled={hotspotSaveLoading || !hotspotDirty}
              className={`${buttonStyles.button} ${buttonStyles.success} ${buttonStyles.medium}`}
            >
              {hotspotSaveLoading ? 'Saving…' : 'Save WiFi Settings'}
            </button>
            {hotspotDirty && !hotspotSaveLoading && (
              <span className="mutedText tinyText">
                Unsaved changes
              </span>
            )}
          </div>
        )}
        </div>
        <div className={`${noticeStyles.notice} ${noticeStyles.success}`}>
          <div className="rowBetween">
            <div>
              <div className="row">
                <span
                  className="pill pillSuccess"
                />
                <span className="mutedText smallText">
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
              <div className="stack">
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
                <p className="mutedText tinyText">
                  {hotspotError}
                </p>
              )}
            </div>
            <div className="rowWrap">
              <button
                type="button"
                onClick={fetchHotspotStatus}
                disabled={hotspotLoading}
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
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
      <div className="centeredContent mutedText smallText">
        <p className="mutedText smallText">Configuration changes are saved automatically</p>
      </div>
      )}
    </div>
  );
};

export default GlobalSettings;
