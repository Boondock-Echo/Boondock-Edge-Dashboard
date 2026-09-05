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
  isDarkMode,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 overflow-y-auto py-6">
      <div className={`relative w-full max-w-2xl p-4 md:p-5 rounded-xl shadow-xl transition-all duration-300 transform ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} border ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        {/* Modal Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <RadioTower className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h3 className="text-lg font-semibold tracking-tight">
              Edit Channel #{editingChannel.id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Frequency Selection - Made Larger/More Prominent */}
            <div className="space-y-1.5 col-span-1 md:col-span-3">
              <label className={`text-sm font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Volume2 className="w-4 h-4" />
                Frequency Selection
              </label>
              <select
                value={tempChannel.frequency_id || ''}
                onChange={(e) => handleFrequencyChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
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
            <div className="md:col-span-3 pt-2">
              <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                Channel Details
              </h4>
            </div>

            {/* Person Field */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <User2 className="w-3.5 h-3.5" />
                Person
              </label>
              <input
                type="text"
                value={tempChannel.person || ''}
                onChange={(e) => onFieldChange("person", e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
              />
            </div>

            {/* Tag Field */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Tag className="w-3.5 h-3.5" />
                Tag
              </label>
              <input
                type="text"
                value={tempChannel.tag || ''}
                onChange={(e) => onFieldChange("tag", e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
              />
            </div>

            {/* MAC Address Field - Read Only */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Network className="w-3.5 h-3.5" />
                MAC Address
              </label>
              <input
                type="text"
                value={tempChannel.mac || ''}
                disabled
                placeholder="e.g., 00:1A:2B:3C:4D:5E"
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 cursor-not-allowed ${isDarkMode ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
              />
            </div>

            {/* Status Field */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <ActivitySquare className="w-3.5 h-3.5" />
                Status
              </label>
              <select
                value={tempChannel.status || ''}
                onChange={(e) => onFieldChange("status", e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
              >
                <option value="resumed">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* Audio Stream Toggle */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Radio className="w-3.5 h-3.5" />
                Audio Stream
              </label>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempChannel.audio_stream_enabled || false}
                    onChange={(e) => onFieldChange("audio_stream_enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 ${tempChannel.audio_stream_enabled ? 'bg-blue-600' : 'bg-gray-600'}
                    peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer 
                    peer-checked:after:translate-x-full after:content-[''] after:absolute 
                    after:top-[2px] after:left-[2px] after:bg-white after:rounded-full 
                    after:h-4 after:w-4 after:transition-all`}></div>
                </label>
                <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {tempChannel.audio_stream_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Audio Stream Port - Only show if audio stream is enabled */}
            {tempChannel.audio_stream_enabled && (
              <div className="space-y-1.5">
                <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <Radio className="w-3.5 h-3.5" />
                  Audio Port
                </label>
                <select
                  value={tempChannel.audio_stream_port || ''}
                  onChange={(e) => onFieldChange("audio_stream_port", e.target.value ? parseInt(e.target.value) : null)}
                  className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
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
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Speaker className="w-3.5 h-3.5" />
                Speaker
              </label>
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempChannel.speaker_enabled || false}
                    onChange={(e) => onFieldChange("speaker_enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-9 h-5 ${tempChannel.speaker_enabled ? 'bg-green-600' : 'bg-gray-600'}
                    peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer 
                    peer-checked:after:translate-x-full after:content-[''] after:absolute 
                    after:top-[2px] after:left-[2px] after:bg-white after:rounded-full 
                    after:h-4 after:w-4 after:transition-all`}></div>
                </label>
                <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {tempChannel.speaker_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Speaker Volume - Only show if speaker is enabled */}
            {tempChannel.speaker_enabled && (
              <div className="space-y-1.5 md:col-span-1">
                <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <Volume2 className="w-3.5 h-3.5" />
                  Speaker Volume
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={tempChannel.speaker_volume || 50}
                    onChange={(e) => onFieldChange("speaker_volume", parseInt(e.target.value))}
                    className={`flex-1 h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r ${
                      isDarkMode ? 'from-blue-600 to-blue-400' : 'from-blue-400 to-blue-600'
                    }`}
                    style={{
                      WebkitAppearance: 'none',
                      background: `linear-gradient(to right, ${isDarkMode ? '#2563eb' : '#3b82f6'} 0%, ${isDarkMode ? '#2563eb' : '#3b82f6'} ${tempChannel.speaker_volume || 50}%, ${isDarkMode ? '#374151' : '#e5e7eb'} ${tempChannel.speaker_volume || 50}%, ${isDarkMode ? '#374151' : '#e5e7eb'} 100%)`
                    }}
                  />
                  <span className={`text-sm font-semibold w-10 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {tempChannel.speaker_volume || 50}%
                  </span>
                </div>
              </div>
            )}

            {/* Language Selection */}
            <div className="space-y-1.5">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <Languages className="w-3.5 h-3.5" />
                Language
              </label>
              <select
                value={tempChannel.src_language || ''}
                onChange={(e) => onFieldChange("src_language", e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
              >
                {LANGUAGES.map((lang) => (
                   <option key={lang} value={lang}>
      {lang.charAt(0).toUpperCase() + lang.slice(1)}
    </option>
                ))}
              </select>
            </div>

            {/* Hidden Name Field */}
            <div className="hidden">
              <label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <RadioTower className="w-3.5 h-3.5" />
                Name
              </label>
              <input
                type="text"
                value={tempChannel.name || ''}
                onChange={(e) => onFieldChange("name", e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm transition-all duration-200 focus:ring-2 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-400'}`}
              />
            </div>

            {/* Hidden Frequency fields */}
            <div className="hidden">
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
        <div className={`relative flex justify-between pt-3 mt-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          {/* Delete Button - Left side */}
          <button
            onClick={() => onDelete && onDelete(editingChannel.id)}
            disabled={isSaving}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isDarkMode
              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300'
              : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          
          {/* Cancel and Save buttons - Right side */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isDarkMode
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } transition-all duration-200 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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