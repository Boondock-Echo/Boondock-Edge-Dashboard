import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect } from "react";
import { X, Save, Volume2, Clock, MinusCircle, PlusCircle, Settings } from "lucide-react";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChannelSettingsModal = ({ isOpen, onClose, channel, onSave, isDarkMode = true }) => {
  const [settings, setSettings] = useState({
    threshold: "50", // from 0 to 100
    silence: "1000", // ms, default 1 second
    min_rec: "1000", // ms, default 1 second
    max_rec: "30000",
    audio_gain: "3", // dB value from finite set: -3, 0, 3, 6, 9, 12, 15, 18, 21, 24
    discard_small_enabled: true, // Discard small files enabled
    discard_small_min_ms: "1000", // Discard small files minimum ms (1000-5000)
    pre_record_ms: "500" // Pre-recording buffer duration (0-500 ms)
  });
  const [initialSettings, setInitialSettings] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (channel && channel.id) {
      // Fetch full channel data to ensure we have speaker_enabled and speaker_volume
      const fetchChannelData = async () => {
        try {
          const response = await apiFetch(`/channel/${channel.id}`);
          if (response.ok) {
            const fullChannel = await response.json();
            const newSettings = {
              threshold: fullChannel.threshold || "50",
              silence: fullChannel.silence || "1000",
              min_rec: fullChannel.min_rec || "1000",
              max_rec: fullChannel.max_rec || "30000",
              audio_gain: fullChannel.audio_gain || "3",
              discard_small_enabled: fullChannel.discard_small_enabled !== undefined ? fullChannel.discard_small_enabled : true,
              discard_small_min_ms: fullChannel.discard_small_min_ms || "1000",
              pre_record_ms: fullChannel.pre_record_ms || "500"
            };
            setSettings(newSettings);
            setInitialSettings(newSettings);
          } else {
            // Fallback to using channel data if fetch fails
            const newSettings = {
              threshold: channel.threshold || "50",
              silence: channel.silence || "1000",
              min_rec: channel.min_rec || "1000",
              max_rec: channel.max_rec || "30000",
              audio_gain: channel.audio_gain || "3",
              discard_small_enabled: channel.discard_small_enabled !== undefined ? channel.discard_small_enabled : true,
              discard_small_min_ms: channel.discard_small_min_ms || "1000",
              pre_record_ms: channel.pre_record_ms || "500"
            };
            setSettings(newSettings);
            setInitialSettings(newSettings);
          }
        } catch (error) {
          console.error('Error fetching channel data:', error);
          // Fallback to using channel data
          const newSettings = {
            threshold: channel.threshold || "50",
            silence: channel.silence || "1000",
            min_rec: channel.min_rec || "1000",
            max_rec: channel.max_rec || "30000",
            audio_gain: channel.audio_gain || "3",
            discard_small_enabled: channel.discard_small_enabled !== undefined ? channel.discard_small_enabled : true,
            discard_small_min_ms: channel.discard_small_min_ms || "1000",
            pre_record_ms: channel.pre_record_ms || "500"
          };
          setSettings(newSettings);
          setInitialSettings(newSettings);
        }
      };
      fetchChannelData();
    }
  }, [channel]);

  // Audio gain options: finite set of dB values
  const audioGainOptions = [-3, 0, 3, 6, 9, 12, 15, 18, 21, 24];

  const ranges = {
    threshold: {
      min: 0,
      max: 100,
      step: 0.5,
      label: "Audio Threshold",
      unit: "",
      icon: Volume2,
      description: "Adjust at what audio level, the channel starts recording. (0 is most sensitive)"
    },
    silence: {
      min: 500,
      max: 10000,
      step: 100,
      label: "Silence Threshold",
      unit: " ms",
      icon: MinusCircle,
      description: "Duration of silence before stopping recording (default: 1000ms = 1 second)"
    },
    min_rec: {
      min: 100,
      max: 60000,
      step: 100,
      label: "Minimum Recording",
      unit: " ms",
      icon: Clock,
      description: "Shortest allowed recording duration (default: 1000ms = 1 second)"
    },
    max_rec: {
      min: 1000,
      max: 300000,
      step: 1000,
      label: "Maximum Recording",
      unit: " ms",
      icon: PlusCircle,
      description: "Longest allowed recording duration"
    },
    discard_small_min_ms: {
      min: 1000,
      max: 5000,
      step: 100,
      label: "Discard Small Files Min",
      unit: " ms",
      icon: MinusCircle,
      description: "Minimum file size to keep (files smaller than this are discarded)"
    },
    pre_record_ms: {
      min: 0,
      max: 500,
      step: 50,
      label: "Pre-recording Buffer",
      unit: " ms",
      icon: Clock,
      description: "Pre-recording buffer duration before threshold is detected"
    }
  };

  const handleInputChange = (setting, value) => {
    const numValue = parseFloat(value);
    const range = ranges[setting];

    if (range && numValue >= range.min && numValue <= range.max) {
      setSettings(prev => ({ ...prev, [setting]: value }));
    }
  };

  const handleGainChange = (value) => {
    setSettings(prev => ({ ...prev, audio_gain: value }));
  };

  const getChangedSettings = () => {
    return Object.entries(settings).reduce((acc, [key, value]) => {
      if (value !== initialSettings[key]) {
        if (key === 'audio_gain') {
          acc[key] = {
            from: initialSettings[key],
            to: value,
            label: 'Audio Gain',
            unit: ' dB'
          };
        } else if (key === 'discard_small_enabled') {
          acc[key] = {
            from: initialSettings[key] ? 'Enabled' : 'Disabled',
            to: value ? 'Enabled' : 'Disabled',
            label: 'Discard Small Files',
            unit: ''
          };
        } else if (ranges[key]) {
          acc[key] = {
            from: initialSettings[key],
            to: value,
            label: ranges[key].label,
            unit: ranges[key].unit
          };
        }
      }
      return acc;
    }, {});
  };

  const formatChangesMessage = (changes) => {
    const changesList = Object.entries(changes).map(([key, change]) => {
      return `${change.label}: ${change.from}${change.unit} → ${change.to}${change.unit}`;
    });
    return changesList.join('\n');
  };

  // Map a channel setting key to the firmware CLI parameter name (see CLI reference / DEVICE_SERIAL.md).
  const SERIAL_PARAM_MAP = {
    threshold: 'audio.audioThreshold',
    min_rec: 'audio.minrecordingms',
    pre_record_ms: 'audio.prerecordms',
    discard_small_enabled: 'audio.discardSmallFilesEnabled',
    silence: 'audio.silencethresholdms',
    max_rec: 'audio.maxrecordingms',
    audio_gain: 'audio.codecgain',
    discard_small_min_ms: 'audio.discardSmallFilesMinMs'
  };

  // Build "SET <param> <value>" lines for changed fields, followed by a SAVE.
  const buildSerialCommands = (changedSettings) => {
    const commands = Object.keys(changedSettings)
      .map((key) => {
        const param = SERIAL_PARAM_MAP[key];
        if (!param) return null;
        let value = settings[key];
        if (key === 'discard_small_enabled') {
          value = settings[key] ? 'true' : 'false';
        }
        return `SET ${param} ${value}`;
      })
      .filter(Boolean);

    if (commands.length > 0) {
      commands.push('SAVE');
    }
    return commands;
  };

  // Push changed audio settings to the matching recorder over the serial monitor.
  // Best-effort: failures here must not block the channel save.
  const pushSettingsToDevice = async (changedSettings) => {
    if (!channel?.mac) return;
    const commands = buildSerialCommands(changedSettings);
    if (commands.length === 0) return;
    try {
      await apiFetch('/recorders/monitor/send-by-mac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: channel.mac, commands })
      });
    } catch (error) {
      console.error('Failed to push settings to recorder over serial:', error);
    }
  };

  const handleSetDefaults = () => {
    setSettings({
      threshold: "50",
      silence: "1000",
      min_rec: "1000",
      max_rec: "30000",
      audio_gain: "3",
      discard_small_enabled: true,
      discard_small_min_ms: "1000",
      pre_record_ms: "500"
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const changedSettings = getChangedSettings();
      await onSave(channel.id, { ...channel, ...settings });

      // Push the changed audio settings to the matching recorder over the
      // Serial Messages monitor (SET ... then SAVE). Best-effort, non-blocking.
      if (Object.keys(changedSettings).length > 0) {
        await pushSettingsToDevice(changedSettings);
      }

      if (Object.keys(changedSettings).length > 0) {
        toast.success(
          <div>
            <strong>Updated Channel {channel.name}</strong>
            <div className="whitespace-pre-line mt-2 text-sm">
              {formatChangesMessage(changedSettings)}
            </div>
          </div>,
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: isDarkMode ? "dark" : "light",
          }
        );
      } else {
        toast.info(`No changes made to Channel ${channel.name}`, {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: isDarkMode ? "dark" : "light",
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(`Failed to update Channel ${channel.name}`, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: isDarkMode ? "dark" : "light",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return isDarkMode ? (
    // Dark Mode UI
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-gray-800 text-left sm:my-8 sm:w-full sm:max-w-4xl border border-gray-700">
          <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-white focus:outline-none"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative p-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-1">
                {channel?.name || 'Channel Settings'}
              </h3>
              <p className="text-sm text-gray-400">
                Adjust audio processing parameters
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Settings Grid - 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Audio settings with sliders */}
                  {Object.entries(settings).map(([key, value]) => {
                    // Skip audio_gain, discard_small_enabled, and discard_small_min_ms as they're handled separately
                    if (key === 'audio_gain' || key === 'discard_small_enabled' || key === 'discard_small_min_ms') return null;
                    
                    const Icon = ranges[key].icon;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-2 flex-1">
                            <Icon className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-white">
                                {ranges[key].label}
                              </label>
                              <p className="text-xs text-gray-400">
                                {ranges[key].description}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-blue-400 ml-2">
                            {value}{ranges[key].unit}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="range"
                            value={value}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            min={ranges[key].min}
                            max={ranges[key].max}
                            step={ranges[key].step}
                            className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                                     focus:outline-none
                                     [&::-webkit-slider-thumb]:appearance-none
                                     [&::-webkit-slider-thumb]:h-4
                                     [&::-webkit-slider-thumb]:w-4
                                     [&::-webkit-slider-thumb]:rounded-full
                                     [&::-webkit-slider-thumb]:bg-blue-500
                                     [&::-webkit-slider-thumb]:cursor-pointer
                                     [&::-moz-range-thumb]:h-4
                                     [&::-moz-range-thumb]:w-4
                                     [&::-moz-range-thumb]:rounded-full
                                     [&::-moz-range-thumb]:bg-blue-500
                                     [&::-moz-range-thumb]:border-0
                                     [&::-moz-range-thumb]:cursor-pointer"
                            disabled={isSaving}
                          />
                          <div className="flex justify-between px-1 text-xs text-gray-500">
                            <span>{ranges[key].min}{ranges[key].unit}</span>
                            <span>{ranges[key].max}{ranges[key].unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Audio Gain Dropdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 flex-1">
                        <Settings className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white">
                            Audio Gain
                          </label>
                          <p className="text-xs text-gray-400">
                            Audio codec gain in dB (default: 3 dB)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-blue-400 ml-2">
                        {settings.audio_gain} dB
                      </span>
                    </div>

                    <select
                      value={settings.audio_gain}
                      onChange={(e) => handleGainChange(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white
                               focus:outline-none focus:border-blue-500"
                      disabled={isSaving}
                    >
                      {audioGainOptions.map((gain) => (
                        <option key={gain} value={gain.toString()}>
                          {gain >= 0 ? `+${gain}` : gain} dB
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Discard Small Audio Checkbox */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 flex-1">
                        <MinusCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-white">
                            Discard Small Audio
                          </label>
                          <p className="text-xs text-gray-400">
                            Enable discarding small audio files
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-2">
                        <input
                          type="checkbox"
                          checked={settings.discard_small_enabled}
                          onChange={(e) => setSettings(prev => ({ ...prev, discard_small_enabled: e.target.checked }))}
                          className="sr-only peer"
                          disabled={isSaving}
                        />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>
                  
                  {/* Discard Small Files Min Ms - Only enabled when checkbox is checked */}
                  {settings.discard_small_enabled && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 flex-1">
                          <MinusCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-white">
                              {ranges.discard_small_min_ms.label}
                            </label>
                            <p className="text-xs text-gray-400">
                              {ranges.discard_small_min_ms.description}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-blue-400 ml-2">
                          {settings.discard_small_min_ms}{ranges.discard_small_min_ms.unit}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <input
                          type="range"
                          value={settings.discard_small_min_ms}
                          onChange={(e) => handleInputChange('discard_small_min_ms', e.target.value)}
                          min={ranges.discard_small_min_ms.min}
                          max={ranges.discard_small_min_ms.max}
                          step={ranges.discard_small_min_ms.step}
                          className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                                   focus:outline-none
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:h-4
                                   [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-blue-500
                                   [&::-webkit-slider-thumb]:cursor-pointer
                                   [&::-moz-range-thumb]:h-4
                                   [&::-moz-range-thumb]:w-4
                                   [&::-moz-range-thumb]:rounded-full
                                   [&::-moz-range-thumb]:bg-blue-500
                                   [&::-moz-range-thumb]:border-0
                                   [&::-moz-range-thumb]:cursor-pointer"
                          disabled={isSaving}
                        />
                        <div className="flex justify-between px-1 text-xs text-gray-500">
                          <span>{ranges.discard_small_min_ms.min}{ranges.discard_small_min_ms.unit}</span>
                          <span>{ranges.discard_small_min_ms.max}{ranges.discard_small_min_ms.unit}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSetDefaults}
                    className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSaving}
                  >
                    Reset to Defaults
                  </button>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex w-full justify-center px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white rounded focus:outline-none sm:w-auto"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto gap-2"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
          </div>
        </div>
      </div>
    </div>
  ) : (
    // Light Mode UI
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-500/50">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-white text-left sm:my-8 sm:w-full sm:max-w-4xl border border-gray-300">
          <div className="absolute right-0 top-0 pr-4 pt-4 z-10">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative p-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-1">
                {channel?.name || 'Channel Settings'}
              </h3>
              <p className="text-sm text-gray-600">
                Adjust audio processing parameters
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Settings Grid - 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Audio settings with sliders */}
                  {Object.entries(settings).map(([key, value]) => {
                    // Skip audio_gain, discard_small_enabled, and discard_small_min_ms as they're handled separately
                    if (key === 'audio_gain' || key === 'discard_small_enabled' || key === 'discard_small_min_ms') return null;
                    
                    const Icon = ranges[key].icon;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-2 flex-1">
                            <Icon className="h-5 w-5 text-gray-500 mt-0.5" />
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-900">
                                {ranges[key].label}
                              </label>
                              <p className="text-xs text-gray-600">
                                {ranges[key].description}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-blue-600 ml-2">
                            {value}{ranges[key].unit}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <input
                            type="range"
                            value={value}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            min={ranges[key].min}
                            max={ranges[key].max}
                            step={ranges[key].step}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
                                     focus:outline-none
                                     [&::-webkit-slider-thumb]:appearance-none
                                     [&::-webkit-slider-thumb]:h-4
                                     [&::-webkit-slider-thumb]:w-4
                                     [&::-webkit-slider-thumb]:rounded-full
                                     [&::-webkit-slider-thumb]:bg-blue-500
                                     [&::-webkit-slider-thumb]:cursor-pointer
                                     [&::-moz-range-thumb]:h-4
                                     [&::-moz-range-thumb]:w-4
                                     [&::-moz-range-thumb]:rounded-full
                                     [&::-moz-range-thumb]:bg-blue-500
                                     [&::-moz-range-thumb]:border-0
                                     [&::-moz-range-thumb]:cursor-pointer"
                            disabled={isSaving}
                          />
                          <div className="flex justify-between px-1 text-xs text-gray-500">
                            <span>{ranges[key].min}{ranges[key].unit}</span>
                            <span>{ranges[key].max}{ranges[key].unit}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Audio Gain Dropdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 flex-1">
                        <Settings className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-900">
                            Audio Gain
                          </label>
                          <p className="text-xs text-gray-600">
                            Audio codec gain in dB (default: 3 dB)
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-blue-600 ml-2">
                        {settings.audio_gain} dB
                      </span>
                    </div>

                    <select
                      value={settings.audio_gain}
                      onChange={(e) => handleGainChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900
                               focus:outline-none focus:border-blue-500"
                      disabled={isSaving}
                    >
                      {audioGainOptions.map((gain) => (
                        <option key={gain} value={gain.toString()}>
                          {gain >= 0 ? `+${gain}` : gain} dB
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Discard Small Audio Checkbox */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 flex-1">
                        <MinusCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-900">
                            Discard Small Audio
                          </label>
                          <p className="text-xs text-gray-600">
                            Enable discarding small audio files
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-2">
                        <input
                          type="checkbox"
                          checked={settings.discard_small_enabled}
                          onChange={(e) => setSettings(prev => ({ ...prev, discard_small_enabled: e.target.checked }))}
                          className="sr-only peer"
                          disabled={isSaving}
                        />
                        <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                  </div>
                  
                  {/* Discard Small Files Min Ms - Only enabled when checkbox is checked */}
                  {settings.discard_small_enabled && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 flex-1">
                          <MinusCircle className="h-5 w-5 text-gray-500 mt-0.5" />
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-900">
                              {ranges.discard_small_min_ms.label}
                            </label>
                            <p className="text-xs text-gray-600">
                              {ranges.discard_small_min_ms.description}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-blue-600 ml-2">
                          {settings.discard_small_min_ms}{ranges.discard_small_min_ms.unit}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <input
                          type="range"
                          value={settings.discard_small_min_ms}
                          onChange={(e) => handleInputChange('discard_small_min_ms', e.target.value)}
                          min={ranges.discard_small_min_ms.min}
                          max={ranges.discard_small_min_ms.max}
                          step={ranges.discard_small_min_ms.step}
                          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
                                   focus:outline-none
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:h-4
                                   [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-blue-500
                                   [&::-webkit-slider-thumb]:cursor-pointer
                                   [&::-moz-range-thumb]:h-4
                                   [&::-moz-range-thumb]:w-4
                                   [&::-moz-range-thumb]:rounded-full
                                   [&::-moz-range-thumb]:bg-blue-500
                                   [&::-moz-range-thumb]:border-0
                                   [&::-moz-range-thumb]:cursor-pointer"
                          disabled={isSaving}
                        />
                        <div className="flex justify-between px-1 text-xs text-gray-500">
                          <span>{ranges.discard_small_min_ms.min}{ranges.discard_small_min_ms.unit}</span>
                          <span>{ranges.discard_small_min_ms.max}{ranges.discard_small_min_ms.unit}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-300 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSetDefaults}
                    className="px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-800 rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSaving}
                  >
                    Reset to Defaults
                  </button>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex w-full justify-center px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-800 rounded focus:outline-none sm:w-auto"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto gap-2"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
