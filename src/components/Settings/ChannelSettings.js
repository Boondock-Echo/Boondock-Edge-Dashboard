import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect } from 'react';
import { Radio, RadioTower, Volume2, Globe2, Tag,
  User2, Settings2, Plus, ExternalLink } from 'lucide-react';
import ChannelEditModal from './ChannelEditModal';
import ChannelCreateModal from './ChannelCreateModal';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ChannelSettings = ({ isDarkMode = false }) => {
  // =========================================================================
  // State Management
  // =========================================================================
  const [channels, setChannels] = useState([]);
  const [editingChannel, setEditingChannel] = useState(null);
  const [tempChannel, setTempChannel] = useState(null);
  const [frequencies, setFrequencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // =========================================================================
  // Toast Notification Utility
  // =========================================================================
  const showToast = (message, type = 'success') => {
    toast[type](message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  // =========================================================================
  // Data Fetching Functions
  // =========================================================================
  const fetchChannels = async () => {
    try {
      const response = await apiFetch(`/channels`);
      if (!response.ok) throw new Error('Failed to fetch channels');
      
      const data = await response.json();
      
      // Validate that data is an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid channels data format - expected array');
      }
      
      setChannels(data.map(channel => ({
        ...channel,
        name: channel.name || `Channel ${channel.id}`,
        enabled: channel.status === "enabled",
        src_language: channel.src_language || "english",
        model: channel.model || "medium.en",
        target_language: channel.target_language || "english",
        color: channel.color || "#000000",
        background_color: channel.background_color || "#ffffff",
        team_color: channel.team_color || "#ffffff",
        textColor: channel.textColor || "#000000",
        person: channel.person || "",
        tag: channel.tag || "",
        audio_stream_enabled: channel.audio_stream_enabled || false,
        audio_stream_port: channel.audio_stream_port || null,
        speaker_enabled: channel.speaker_enabled || false,
        speaker_volume: channel.speaker_volume || 50,
      })));
    } catch (error) {
      console.error('Error fetching channels:', error);
      showToast('Error loading channels!', 'error');
    }
  };

  const fetchFrequencies = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/frequencies`);
      if (!response.ok) throw new Error('Failed to fetch frequencies');
      const data = await response.json();
      setFrequencies(data);
    } catch (error) {
      console.error('Error fetching frequencies:', error);
      showToast('Error loading frequencies!', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // Channel Management Functions
  // =========================================================================
  const handleSave = async (id, channelDataOverride = null) => {
    // Use provided channel data, or tempChannel, or find from channels
    const channelToSave = channelDataOverride || tempChannel || channels.find((ch) => ch.id === id);
    if (!channelToSave) return;

    // Find the original channel to preserve status if not explicitly changed
    const originalChannel = channels.find((ch) => ch.id === id);
    if (!originalChannel) return;

    // Determine status: preserve original status unless it was explicitly changed
    // Use channelDataOverride if provided (from modal save), otherwise use tempChannel logic
    const channelDataToCheck = channelDataOverride || tempChannel;
    let statusToSave = originalChannel.status;
    if (channelDataToCheck && channelDataToCheck.status !== undefined) {
      // Check if status was actually changed from the original
      if (channelDataToCheck.status !== originalChannel.status) {
        // Status was explicitly changed in the modal
        statusToSave = channelDataToCheck.status;
      } else {
        // Status is the same as original, preserve it
        statusToSave = originalChannel.status;
      }
    }
    // If no channelDataToCheck or status not in it, keep original status

    setChannels(prevChannels =>
      prevChannels.map(ch =>
        ch.id === id ? { ...ch, ...channelToSave, enabled: channelToSave.enabled } : ch
      )
    );

    try {
      const response = await apiFetch(`/channel/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          port: channelToSave.port,
          name: channelToSave.name,
          status: statusToSave, // Use preserved or explicitly changed status
          src_language: channelToSave.src_language,
          target_language: channelToSave.target_language,
          model: channelToSave.model,
          color: channelToSave.color,
          background_color: channelToSave.background_color,
          team_color: channelToSave.team_color,
          textColor: channelToSave.textColor,
          driver: channelToSave.driver,
          person: channelToSave.person,
          tag: channelToSave.tag,
          car: channelToSave.car,
          mac: channelToSave.mac,
          frequency: channelToSave.frequency,
          type: channelToSave.type,
          tone: channelToSave.tone,
          audio_stream_enabled: channelToSave.audio_stream_enabled,
          audio_stream_port: channelToSave.audio_stream_port,
          speaker_enabled: channelToSave.speaker_enabled,
          speaker_volume: channelToSave.speaker_volume,
        }),
      });

      if (!response.ok) {
        setChannels(prevChannels =>
          prevChannels.map(ch =>
            ch.id === id ? channels.find(c => c.id === id) || ch : ch
          )
        );
        throw new Error('Failed to update channel');
      }
      showToast(`Channel #${id} updated successfully`);
    } catch (error) {
      console.error('Error updating channel:', error);
      showToast('Error updating channel!', 'error');
    }
  };

  const handleFieldChange = (id, field, value) => {
    setChannels(prevChannels =>
      prevChannels.map(channel =>
        channel.id === id ? { ...channel, [field]: value } : channel
      )
    );
  };

  const handleDeleteChannel = async (channelId) => {
    if (isSaving) return;
    
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete Channel #${channelId}? This will only remove the channel configuration, not the audio files.`)) {
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await apiFetch(`/channel/${channelId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete channel');
      }
      
      // Remove channel from local state
      setChannels(prevChannels => prevChannels.filter(ch => ch.id !== channelId));
      
      // Close the edit modal
      setEditingChannel(null);
      setTempChannel(null);
      
      showToast(`Channel #${channelId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting channel:', error);
      showToast('Error deleting channel!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (channelId, enabled) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const channel = channels.find(ch => ch.id === channelId);
      const newStatus = enabled ? "resume" : "disabled";
      
      setChannels(prevChannels =>
        prevChannels.map(ch =>
          ch.id === channelId ? { ...ch, enabled, status: newStatus, previousStatus: ch.status } : ch
        )
      );

      const response = await apiFetch(`/channel/${channelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...channel, status: newStatus }),
      });

      if (!response.ok) {
        setChannels(prevChannels =>
          prevChannels.map(ch =>
            ch.id === channelId ? { ...ch, enabled: !enabled, status: ch.previousStatus } : ch
          )
        );
        throw new Error('Failed to update channel status');
      }
      showToast(`Channel ${channelId} ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling channel status:', error);
      showToast('Error updating channel status!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResume = async (channelId) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const channel = channels.find(ch => ch.id === channelId);
      setChannels(prevChannels =>
        prevChannels.map(ch =>
          ch.id === channelId ? { ...ch, enabled: true, status: "enabled", previousStatus: ch.status } : ch
        )
      );

      const response = await apiFetch(`/channel/${channelId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        setChannels(prevChannels =>
          prevChannels.map(ch =>
            ch.id === channelId ? { ...ch, enabled: false, status: ch.previousStatus } : ch
          )
        );
        throw new Error('Failed to resume channel');
      }
      showToast(`Channel ${channelId} resumed successfully`);
    } catch (error) {
      console.error('Error resuming channel:', error);
      showToast('Error resuming channel!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateChannel = async (channelData) => {
    // channelData can be either the full channel object or just the response data
    // If it's the response data with channel_id, the channel was already created successfully
    if (channelData && channelData.channel_id) {
      // Channel was successfully created, refresh the list
      setIsSaving(true);
      try {
        await fetchChannels();
        showToast('Channel created successfully');
        setIsCreatingChannel(false);
      } catch (error) {
        console.error('Error refreshing channels:', error);
        showToast('Channel created but failed to refresh list', 'warning');
      } finally {
        setIsSaving(false);
      }
    } else {
      // This shouldn't happen if ChannelCreateModal is working correctly
      console.error('Invalid channel data received:', channelData);
      showToast('Error: Invalid response from channel creation', 'error');
      setIsSaving(false);
    }
  };

  // =========================================================================
  // Modal Handling Functions
  // =========================================================================
  const handleEdit = (channel) => {
    // Find the frequency_id if not present but frequency is present
    let frequency_id = channel.frequency_id;
    if (!frequency_id && channel.frequency && frequencies && frequencies.length > 0) {
      const match = frequencies.find(f => String(f.frequency) === String(channel.frequency));
      if (match) frequency_id = match.id;
    }
    setEditingChannel(channel);
    setTempChannel({ ...channel, frequency_id });
  };

  const handleModalFieldChange = (field, value) => {
    setTempChannel(prev => ({ ...prev, [field]: value }));
  };

  const handleFrequencyChange = (frequencyId) => {
    const selectedFrequency = frequencies.find(f => f.id === parseInt(frequencyId));
    if (selectedFrequency && tempChannel) {
      setTempChannel(prev => ({
        ...prev,
        frequency: selectedFrequency.frequency,
        name: selectedFrequency.name,
        frequency_id: selectedFrequency.id,
        type: selectedFrequency.type,
        tone: selectedFrequency.tone,
        // Preserve existing person and tag values, only use frequency values if current ones are empty
        person: prev.person && prev.person.trim() !== '' ? prev.person : (selectedFrequency.person || ''),
        tag: prev.tag && prev.tag.trim() !== '' ? prev.tag : (selectedFrequency.tag || ''),
        // Preserve existing status
        status: prev.status || selectedFrequency.status
      }));
    }
  };

  const handleModalSave = async (channelId) => {
    if (!editingChannel || !tempChannel || isSaving) return;
    setIsSaving(true);
    try {
      // Find changed fields, but exclude status if it wasn't explicitly changed
      const changedFields = Object.entries(tempChannel).reduce((acc, [key, value]) => {
        // For status field, only include it if it was explicitly changed
        if (key === 'status') {
          // Only include status if it's different from the original
          if (value !== editingChannel.status) {
            acc[key] = value;
          }
        } else if (value !== editingChannel[key]) {
          acc[key] = value;
        }
        return acc;
      }, {});

      if (Object.keys(changedFields).length > 0) {
        // Create updated channel data with all changed fields
        const updatedChannelData = { ...tempChannel, ...changedFields };
        
        // Pass the updated channel data directly to handleSave
        // This ensures we use the correct data without waiting for state updates
        await handleSave(editingChannel.id, updatedChannelData);
      }
      setEditingChannel(null);
      setTempChannel(null);
    } catch (error) {
      console.error('Error saving changes:', error);
      showToast('Error saving changes!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // =========================================================================
  // Audio Stream Link Helper
  // =========================================================================
  const openAudioStream = (channel) => {
    if (channel && channel.mac) {
      const url = `http://${channel.mac}.local/live`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      showToast('MAC address not available for this channel', 'warning');
    }
  };

  // =========================================================================
  // Render Helper Functions
  // =========================================================================
  const getStatusColor = (status) => {
    const statusColors = {
      enabled: 'text-green-500',
      resume: 'text-green-500',
      record_begin: 'text-green-500',
      record_end: 'text-blue-500',
      online: 'text-green-400',
      busy: 'text-orange-500',
      offline: 'text-gray-500',
      disabled: 'text-red-500',
    };
    return statusColors[status?.toLowerCase()] || 'text-gray-500';
  };

  const renderChannelControls = (channel) => (
    <div className="flex items-center gap-3">
      <span className={`flex items-center gap-1 text-xs font-medium capitalize ${getStatusColor(channel.status)}`}>
        {channel.status}
      </span>
      <div className="flex items-center gap-2">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={channel.status !== "disabled"}
            onChange={(e) => handleToggleEnabled(channel.id, e.target.checked)}
            disabled={isSaving}
            className="sr-only peer"
          />
          <div className={`w-9 h-5 ${channel.status !== "disabled" ? 'bg-blue-600' : 'bg-gray-600'}
            peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer 
            peer-checked:after:translate-x-full after:content-[''] after:absolute 
            after:top-[2px] after:left-[2px] after:bg-white after:rounded-full 
            after:h-4 after:w-4 after:transition-all`}></div>
        </label>
      </div>
    </div>
  );

  const renderChannelCard = (channel) => (
    <div
      key={channel.id}
      className={`relative overflow-hidden rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} 
        p-6 transition-all duration-300 hover:shadow-xl border 
        ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
    >
      {/* <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <RadioTower className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <div>
            <h3 className={`text-lg md:text-md font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Channel {channel.id}
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {channel.name}
            </p>
          </div>
        </div>
        {renderChannelControls(channel)}
      </div> */}
<div className="flex justify-between items-start mb-3">
  {/* Left Side: Icon + Text */}
  <div className="flex items-center gap-3 min-w-0">
    <RadioTower className={`w-5 h-5 shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
    <div className="min-w-0">
      <p className={`text-sm md:text-xs  truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Channel {channel.id}
      </p>
      <p
        className={`text-sm md:text-xs font-bold truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
        title={channel.name}
      >
        {channel.name}
      </p>
    </div>
  </div>

  {/* Right Side: Toggle */}
  <div className="shrink-0 ml-2">{renderChannelControls(channel)}</div>
</div>

      <div className={`grid grid-cols-2 gap-4 mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm">{channel.frequency} MHz</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm capitalize">{channel.src_language}</span>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-400" />
          <span className="text-sm">{channel.tag || 'No tag'}</span>
        </div>
        <div className="flex items-center gap-2">
          <User2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm">{channel.person || 'Unassigned'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-gray-400" />
          <span className="text-sm">Audio Stream: {channel.audio_stream_enabled ? 'On' : 'Off'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleEdit(channel)}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg 
            ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
            transition-colors duration-200 font-medium`}
        >
          <Settings2 className="w-4 h-4" />
          Configure
        </button>
        
        {channel.mac && channel.audio_stream_enabled && (
          <button
            onClick={() => openAudioStream(channel)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg 
              ${isDarkMode ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}
              transition-colors duration-200 font-medium`}
          >
            <ExternalLink className="w-4 h-4" />
            Live Audio Stream
          </button>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // Effects
  // =========================================================================
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchChannels();
        await fetchFrequencies();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // =========================================================================
  // Main Render
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* Header with Add Channel Button */}
      <div className={`flex items-center justify-between p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Channels</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Manage communication channels for your recorders
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsCreatingChannel(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Channel</span>
        </button>
      </div>

      {/* Status summary / hint */}
      <div className={`rounded-xl border px-4 py-3 text-xs ${
        isDarkMode
          ? 'border-blue-500/40 bg-blue-900/20 text-blue-100'
          : 'border-blue-200 bg-blue-50 text-blue-800'
      }`}>
        {channels.length === 0
          ? 'No channels configured yet. Create your first channel to begin routing audio.'
          : `Managing ${channels.length} channel${channels.length !== 1 ? 's' : ''}. Click a card to edit details or toggle status.`}
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(channel => renderChannelCard(channel))}
        </div>
      )}

      {editingChannel && (
        <ChannelEditModal
          editingChannel={editingChannel}
          tempChannel={tempChannel}
          frequencies={frequencies}
          isDarkMode={isDarkMode}
          isSaving={isSaving}
          onClose={() => {
            setEditingChannel(null);
            setTempChannel(null);
          }}
          onSave={handleModalSave}
          onFieldChange={handleModalFieldChange}
          onFrequencyChange={handleFrequencyChange}
          onDelete={handleDeleteChannel}
        />
      )}

      {isCreatingChannel && (
        <ChannelCreateModal
          isOpen={isCreatingChannel}
          onClose={() => setIsCreatingChannel(false)}
          onChannelCreated={handleCreateChannel}
          frequencies={frequencies}
          isDarkMode={isDarkMode}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default ChannelSettings;