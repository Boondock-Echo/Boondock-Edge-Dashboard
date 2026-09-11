import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import { apiFetch } from '../../utils/apiClient';
import { useState } from 'react';
import {
  RadioTower,
  X,
  Volume2,
  Wifi,
  Radio
} from 'lucide-react';

const ChannelCreateModal = ({
  isOpen,
  onClose,
  frequencies,
  onChannelCreated,
}) => {
  const [newChannel, setNewChannel] = useState({
    name: '',
    frequency_id: '',
    person: '',
    tag: '',
    status: 'active',
    src_language: 'english',
    mac: '',
    audio_stream_enabled: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setNewChannel(prev => ({ ...prev, [field]: value }));
  };

  const handleFrequencyChange = (frequencyId) => {
    const selectedFrequency = frequencies.find(f => f.id === parseInt(frequencyId));
    if (selectedFrequency) {
      setNewChannel(prev => ({
        ...prev,
        frequency_id: selectedFrequency.id,
        frequency: selectedFrequency.frequency,
        name: selectedFrequency.name,
        type: selectedFrequency.type,
        tone: selectedFrequency.tone,
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
  
    // Client-side validation could go here
    if (!newChannel.name.trim() || !newChannel.frequency_id) {
      setError('Please fill out all required fields.');
      setIsSaving(false);
      return;
    }
  
    try {
      const response = await apiFetch(`/channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newChannel),
      });
  
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = 'Failed to create channel';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            // If both fail, use default message
            errorMessage = `Failed to create channel: ${response.status} ${response.statusText}`;
          }
        }
        setError(errorMessage);
        setIsSaving(false);
        return; // Don't close modal or call onChannelCreated on error
      }
  
      // Only parse JSON if response is ok
      const data = await response.json();
      
      // Verify we got a valid response
      if (!data || !data.channel_id) {
        setError('Invalid response from server. Channel may not have been created.');
        setIsSaving(false);
        return;
      }
  
      // Only close modal and call callback on success
      if (onChannelCreated) {
        onChannelCreated(data);
      }
      onClose();
    } catch (err) {
      // Network errors or other exceptions
      setError(err.message || 'An error occurred while creating the channel.');
      setIsSaving(false);
      // Don't close modal on error
    }
  };

  return (
    <div className="screenCenter">
      <div className={cardStyles.card}>
        {/* Modal Header */}
        <div className="rowBetween">
          <div className="row">
            <RadioTower  />
            <h3 className="pageTitle">
              Create New Channel
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.icon}`}
          >
            <X  />
          </button>
        </div>

        {/* Modal Body */}
        <div className="stack">
          <div className="gridTwo">
            {/* Frequency Selection */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <div className="row">
                  <Volume2  />
                  Frequency
                </div>
              </label>
              <select
                value={newChannel.frequency_id || ''}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className={formStyles.select}
              >
                <option value="">Select Frequency</option>
                {frequencies.map((freq) => (
                  <option key={freq.id} value={freq.id}>
                    {freq.name} - {freq.frequency} MHz ({freq.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Name Field */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <div className="row">
                  <RadioTower  />
                  Name
                </div>
              </label>
              <input
                type="text"
                value={newChannel.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={formStyles.input}
              />
            </div>

            {/* MAC Address Field */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <div className="row">
                  <Wifi  />
                  MAC Address
                </div>
              </label>
              <input
                type="text"
                value={newChannel.mac}
                onChange={(e) => handleFieldChange("mac", e.target.value)}
                placeholder="XX:XX:XX:XX:XX:XX"
                pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                className={formStyles.input}
              />
            </div>

            {/* Audio Stream Toggle */}
            <div className="stack stackCompact">
              <label className={formStyles.label}>
                <div className="row">
                  <Radio  />
                  Audio Stream
                </div>
              </label>
              <div className="row">
                <label className={formStyles.label}>
                  <input
                    type="checkbox"
                    checked={newChannel.audio_stream_enabled || false}
                    onChange={(e) => handleFieldChange("audio_stream_enabled", e.target.checked)}
                    className={formStyles.input}
                  />
                  <div ></div>
                </label>
                <span className="mutedText smallText">
                  {newChannel.audio_stream_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Other fields similar to ChannelEditModal */}
            {/* ... */}
          </div>

          {/* Error message */}
          {error && (
            <div >{error}</div>
          )}
        </div>

        {/* Modal Footer */}
        <div >
          <button
            onClick={onClose}
            disabled={isSaving}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !newChannel.frequency_id || !newChannel.name}
            className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
          >
            {isSaving ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelCreateModal;