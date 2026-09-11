import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect, useRef } from "react";
import { X, Save, Volume2, Clock, MinusCircle, PlusCircle, Settings } from "lucide-react";
import Button from "../ui/Button";
import formStyles from "../ui/Form.module.css";
import modalStyles from "../ui/Modal.module.css";
import { toast } from 'react-toastify';

const ChannelSettingsModal = ({ isOpen, onClose, channel, onSave }) => {
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
  const dialogRef = useRef(null);

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


  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    if (!dialog.open) {
      dialog.showModal();
    }
  }, [isOpen]);

  // Audio gain options: finite set of dB values
  const audioGainOptions = [-3, 0, 3, 6, 9, 12, 15, 18, 21, 24];

  const ranges = {
    threshold: {
      min: 0,
      max: 60,
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
          `Updated Channel ${channel.name}: ${formatChangesMessage(changedSettings)}`,
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
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
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const renderRangeField = (key, value) => {
    const range = ranges[key];
    const Icon = range.icon;

    return (
      <div key={key} className={formStyles.field}>
        <div className={formStyles.fieldHeader}>
          <div className={formStyles.fieldInfo}>
            <Icon className={formStyles.fieldIcon} aria-hidden="true" />
            <div>
              <label className={formStyles.label} htmlFor={`channel-setting-${key}`}>
                {range.label}
              </label>
              <p className={formStyles.description}>{range.description}</p>
            </div>
          </div>
          <span className={formStyles.value} aria-live="polite">
            {value}{range.unit}
          </span>
        </div>

        <input
          id={`channel-setting-${key}`}
          type="range"
          value={value}
          onChange={(e) => handleInputChange(key, e.target.value)}
          min={range.min}
          max={range.max}
          step={range.step}
          className={formStyles.range}
          disabled={isSaving}
        />
        <div className={formStyles.rangeScale} aria-hidden="true">
          <span>{range.min}{range.unit}</span>
          <span>{range.max}{range.unit}</span>
        </div>
      </div>
    );
  };

  const handleDialogCancel = (event) => {
    event.preventDefault();
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`${modalStyles.dialog} ${modalStyles.wide}`}
      aria-labelledby="channel-settings-title"
      aria-describedby="channel-settings-description"
      onCancel={handleDialogCancel}
    >
        <div className={modalStyles.header}>
          <div>
            <h2 id="channel-settings-title" className={modalStyles.title}>
              {channel?.name || 'Channel Settings'}
            </h2>
            <p id="channel-settings-description" className={modalStyles.subtitle}>
              Adjust audio processing parameters
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close channel settings"
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className={formStyles.form}>
          <div className={modalStyles.body}>
            <div className="gridTwo">
              {Object.entries(settings).map(([key, value]) => {
                if (key === 'audio_gain' || key === 'discard_small_enabled' || key === 'discard_small_min_ms') {
                  return null;
                }
                return renderRangeField(key, value);
              })}

              <div className={formStyles.field}>
                <div className={formStyles.fieldHeader}>
                  <div className={formStyles.fieldInfo}>
                    <Settings className={formStyles.fieldIcon} aria-hidden="true" />
                    <div>
                      <label className={formStyles.label} htmlFor="channel-setting-audio-gain">
                        Audio Gain
                      </label>
                      <p className={formStyles.description}>
                        Audio codec gain in dB (default: 3 dB)
                      </p>
                    </div>
                  </div>
                  <span className={formStyles.value}>{settings.audio_gain} dB</span>
                </div>

                <select
                  id="channel-setting-audio-gain"
                  value={settings.audio_gain}
                  onChange={(e) => handleGainChange(e.target.value)}
                  className={formStyles.select}
                  disabled={isSaving}
                >
                  {audioGainOptions.map((gain) => (
                    <option key={gain} value={gain.toString()}>
                      {gain >= 0 ? `+${gain}` : gain} dB
                    </option>
                  ))}
                </select>
              </div>

              <div className={formStyles.field}>
                <div className={formStyles.fieldHeader}>
                  <div className={formStyles.fieldInfo}>
                    <MinusCircle className={formStyles.fieldIcon} aria-hidden="true" />
                    <div>
                      <span className={formStyles.label}>Discard Small Audio</span>
                      <p className={formStyles.description}>Enable discarding small audio files</p>
                    </div>
                  </div>

                  <label className={formStyles.switch}>
                    <span className={formStyles.srOnly}>Discard small audio files</span>
                    <input
                      type="checkbox"
                      checked={settings.discard_small_enabled}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        discard_small_enabled: e.target.checked
                      }))}
                      disabled={isSaving}
                    />
                    <span className={formStyles.switchTrack} aria-hidden="true">
                      <span className={formStyles.switchThumb} />
                    </span>
                  </label>
                </div>
              </div>

              {settings.discard_small_enabled && renderRangeField(
                'discard_small_min_ms',
                settings.discard_small_min_ms
              )}
            </div>
          </div>

          <div className={modalStyles.actionsBetween}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSetDefaults}
              disabled={isSaving}
            >
              Reset to Defaults
            </Button>

            <div className={modalStyles.actions}>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? (
                  <span className="spinner spinnerSmall" role="status" aria-label="Saving channel settings" />
                ) : (
                  <>
                    <Save size={16} aria-hidden="true" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
    </dialog>
  );
};

export default ChannelSettingsModal;
