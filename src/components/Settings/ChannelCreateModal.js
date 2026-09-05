import { apiFetch } from '../../utils/apiClient';
import { useState } from 'react';
import {
  RadioTower,
  X,
  Volume2,
  User2,
  Wifi,
  Tag,
  ActivitySquare,
  Languages,
  Radio
} from 'lucide-react';

const LANGUAGES = [
  "english", "spanish", "french", "german", "italian",
  "portuguese", "chinese", "japanese", "korean", "arabic"
];

const ChannelCreateModal = ({
  isOpen,
  onClose,
  frequencies,
  edgeServerEndpoint,
  isDarkMode,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-2xl p-6 rounded-2xl shadow-2xl transition-transform duration-300 transform scale-95 hover:scale-100 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <RadioTower className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Create New Channel
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative space-y-6 py-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Frequency Selection */}
            <div className="space-y-2 col-span-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Volume2 className="w-4 h-4" />
                  Frequency
                </div>
              </label>
              <select
                value={newChannel.frequency_id || ''}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition-all duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
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
            <div className="space-y-2 col-span-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <RadioTower className="w-4 h-4" />
                  Name
                </div>
              </label>
              <input
                type="text"
                value={newChannel.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={`w-full px-4 py-2 rounded-lg border transition-all duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            {/* MAC Address Field */}
            <div className="space-y-2 col-span-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="w-4 h-4" />
                  MAC Address
                </div>
              </label>
              <input
                type="text"
                value={newChannel.mac}
                onChange={(e) => handleFieldChange("mac", e.target.value)}
                placeholder="XX:XX:XX:XX:XX:XX"
                pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
                className={`w-full px-4 py-2 rounded-lg border transition-all duration-200 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>

            {/* Audio Stream Toggle */}
            <div className="space-y-2 col-span-2">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Radio className="w-4 h-4" />
                  Audio Stream
                </div>
              </label>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newChannel.audio_stream_enabled || false}
                    onChange={(e) => handleFieldChange("audio_stream_enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 ${newChannel.audio_stream_enabled ? 'bg-blue-600' : 'bg-gray-600'}
                    peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer 
                    peer-checked:after:translate-x-full after:content-[''] after:absolute 
                    after:top-[2px] after:left-[2px] after:bg-white after:rounded-full 
                    after:h-4 after:w-4 after:transition-all`}></div>
                </label>
                <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {newChannel.audio_stream_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Other fields similar to ChannelEditModal */}
            {/* ... */}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-500 text-sm mt-4">{error}</div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`relative flex justify-end pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${isDarkMode
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !newChannel.frequency_id || !newChannel.name}
            className={`px-4 py-2 ml-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {isSaving ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelCreateModal;