import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import { apiFetch } from '../../utils/apiClient';
import { useEffect, useState } from 'react';
import { RadioTower, X, Volume2, User2, Tag, ActivitySquare, Languages, Network,
  Radio, Trash2, Speaker } from 'lucide-react';

const LANGUAGES = [
  "english", "spanish", "french", "german", "italian",
  "portuguese", "chinese", "japanese", "korean", "arabic"
];

const ChannelEditModal = ({
  editingChannel,
  tempChannel,
  frequencies,
  isSaving,
  onClose,
  onSave,
  onFieldChange,
  onFrequencyChange,
  onDelete,
}) => {
  const [availablePorts, setAvailablePorts] = useState([]);
  
  // Fetch available ports when audio_stream_enabled changes
  useEffect(() => {
    if (tempChannel?.audio_stream_enabled) {
      const fetchAvailablePorts = async () => {
        try {
          const response = await apiFetch('/available-ports');
          if (response.ok) {
            const data = await response.json();
            // Include current port even if not in available list
            let ports = data.available_ports || [];
            if (tempChannel.audio_stream_port && !ports.includes(tempChannel.audio_stream_port)) {
              ports = [tempChannel.audio_stream_port, ...ports].sort((a, b) => a - b);
            }
            setAvailablePorts(ports);
          }
        } catch (error) {
          console.error('Error fetching available ports:', error);
        }
      };
      fetchAvailablePorts();
    }
  }, [tempChannel?.audio_stream_enabled]);

  // Early return after the hooks
  if (!editingChannel || !tempChannel) return null;

  const handleFrequencyChange = (frequencyId) => {
    onFrequencyChange(frequencyId);
  };

  return (
    <div className="screenCenter">
      <div className={cardStyles.card}>
        {/* Modal Header */}
        <div className="rowBetween">
          <div className="row">
            <RadioTower  />
            <h3 className="pageTitle">
              Edit Channel #{editingChannel.id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.icon}`}
            aria-label="Close"
          >
            <X  />
          </button>
        </div>

        {/* Modal Body */}
        <div className="stack">
          <div className="gridThree">
            {/* Frequency Selection - Made Larger/More Prominent */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Volume2  />
                Frequency Selection
              </label>
              <select
                value={tempChannel.frequency_id || ''}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className={formStyles.select}
              >
                <option value="">Select Frequency</option>
                {frequencies.map((freq) => (
                  <option key={freq.id} value={freq.id}>
                    {freq.name} - {freq.frequency} MHz ({freq.type}) - ({freq.tone})
                  </option>
                ))}
              </select>
            </div>

            {/* Channel Details Section */}
            <div >
              <h4 className="pageTitle">
                Channel Details
              </h4>
            </div>

            {/* Person Field */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <User2  />
                Person
              </label>
              <input
                type="text"
                value={tempChannel.person || ''}
                onChange={(e) => onFieldChange("person", e.target.value)}
                className={formStyles.input}
              />
            </div>

            {/* Tag Field */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Tag  />
                Tag
              </label>
              <input
                type="text"
                value={tempChannel.tag || ''}
                onChange={(e) => onFieldChange("tag", e.target.value)}
                className={formStyles.input}
              />
            </div>

            {/* MAC Address Field - Read Only */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Network  />
                MAC Address
              </label>
              <input
                type="text"
                value={tempChannel.mac || ''}
                disabled
                placeholder="e.g., 00:1A:2B:3C:4D:5E"
                className={formStyles.input}
              />
            </div>

            {/* Status Field */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <ActivitySquare  />
                Status
              </label>
              <select
                value={tempChannel.status || ''}
                onChange={(e) => onFieldChange("status", e.target.value)}
                className={formStyles.select}
              >
                <option value="resumed">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* Audio Stream Toggle */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Radio  />
                Audio Stream
              </label>
              <div className="row">
                <label className={formStyles.label}>
                  <input
                    type="checkbox"
                    checked={tempChannel.audio_stream_enabled || false}
                    onChange={(e) => onFieldChange("audio_stream_enabled", e.target.checked)}
                    className={formStyles.input}
                  />
                  <div ></div>
                </label>
                <span className="mutedText smallText">
                  {tempChannel.audio_stream_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Audio Stream Port - Only show if audio stream is enabled */}
            {tempChannel.audio_stream_enabled && (
              <div className="stack stackCompact">
                <label className={formStyles.label}>
                  <Radio  />
                  Audio Port
                </label>
                <select
                  value={tempChannel.audio_stream_port || ''}
                  onChange={(e) => onFieldChange("audio_stream_port", e.target.value ? parseInt(e.target.value) : null)}
                  className={formStyles.select}
                >
                  <option value="">Select Port</option>
                  {availablePorts.map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Speaker Enable Toggle */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Speaker  />
                Speaker
              </label>
              <div className="row">
                <label className={formStyles.label}>
                  <input
                    type="checkbox"
                    checked={tempChannel.speaker_enabled || false}
                    onChange={(e) => onFieldChange("speaker_enabled", e.target.checked)}
                    className={formStyles.input}
                  />
                  <div ></div>
                </label>
                <span className="mutedText smallText">
                  {tempChannel.speaker_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Speaker Volume - Only show if speaker is enabled */}
            {tempChannel.speaker_enabled && (
              <div className="stack stackCompact">
                <label className={formStyles.label}>
                  <Volume2  />
                  Speaker Volume
                </label>
                <div className="row">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={tempChannel.speaker_volume || 50}
                    onChange={(e) => onFieldChange("speaker_volume", parseInt(e.target.value))}
                    className={formStyles.input}
                    style={{
                      WebkitAppearance: 'none',
                      background: `linear-gradient(to right, ${false ? '#2563eb' : '#3b82f6'} 0%, ${false ? '#2563eb' : '#3b82f6'} ${tempChannel.speaker_volume || 50}%, ${false ? '#374151' : '#e5e7eb'} ${tempChannel.speaker_volume || 50}%, ${false ? '#374151' : '#e5e7eb'} 100%)`
                    }}
                  />
                  <span className="mutedText smallText">
                    {tempChannel.speaker_volume || 50}%
                  </span>
                </div>
              </div>
            )}

            {/* Language Selection */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <Languages  />
                Language
              </label>
              <select
                value={tempChannel.src_language || ''}
                onChange={(e) => onFieldChange("src_language", e.target.value)}
                className={formStyles.select}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Hidden Name Field */}
            <div >
              <label className={formStyles.label}>
                <RadioTower  />
                Name
              </label>
              <input
                type="text"
                value={tempChannel.name || ''}
                onChange={(e) => onFieldChange("name", e.target.value)}
                className={formStyles.input}
              />
            </div>

            {/* Hidden Frequency fields */}
            <div >
              <input
                type="number"
                step="0.001"
                value={tempChannel.frequency || ''}
                onChange={(e) => onFieldChange("frequency", e.target.value)}
              />
              <input
                type="text"
                value={tempChannel.type || ''}
                onChange={(e) => onFieldChange("type", e.target.value)}
              />
              <input
                type="text"
                value={tempChannel.tone || ''}
                onChange={(e) => onFieldChange("tone", e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="rowBetween">
          {/* Delete Button - Left side */}
          <button
            onClick={() => onDelete && onDelete(editingChannel.id)}
            disabled={isSaving}
            className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`}
          >
            <Trash2  />
            Delete
          </button>
          
          {/* Cancel and Save buttons - Right side */}
          <div >
            <button
              onClick={onClose}
              disabled={isSaving}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelEditModal;