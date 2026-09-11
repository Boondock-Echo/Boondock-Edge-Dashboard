import { apiFetch } from '../../utils/apiClient';
import { useState, useEffect } from 'react';
import { Radio, RadioTower, Volume2, Globe2, Tag,
  User2, Settings2, Plus, ExternalLink } from 'lucide-react';
import ChannelEditModal from './ChannelEditModal';
import ChannelCreateModal from './ChannelCreateModal';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const ChannelSettings = () => {
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
      enabled: 'pillSuccess',
      resume: 'pillSuccess',
      record_begin: 'pillSuccess',
      record_end: 'pillAccent',
      online: 'pillSuccess',
      busy: 'pillWarning',
      offline: '',
      disabled: 'pillDanger',
    };
    return statusColors[status?.toLowerCase()] || '';
  };

  const renderChannelControls = (channel) => (
    <div className="row">
      <span className={`pill ${getStatusColor(channel.status)}`}>
        {channel.status}
      </span>
      <label className={formStyles.switch}>
        <input
          type="checkbox"
          checked={channel.status !== "disabled"}
          onChange={(e) => handleToggleEnabled(channel.id, e.target.checked)}
          disabled={isSaving}
        />
        <span className={formStyles.switchTrack} aria-hidden="true">
          <span className={formStyles.switchThumb} />
        </span>
      </label>
    </div>
  );

  const renderChannelCard = (channel) => (
    <div key={channel.id} className={`${cardStyles.card} ${cardStyles.interactive}`}>
      <div className="rowBetweenStart">
        {/* Left Side: Icon + Text */}
        <div className="row grow">
          <RadioTower className="iconMedium mutedText noShrink" />
          <div className="grow">
            <p className="smallText truncate">Channel {channel.id}</p>
            <p className="smallText mutedText truncate" title={channel.name}>
              <strong>{channel.name}</strong>
            </p>
          </div>
        </div>

        {/* Right Side: Toggle */}
        <div className="noShrink">{renderChannelControls(channel)}</div>
      </div>

      <div className="gridTwo">
        <div className="row"><Volume2 className="iconSmall mutedText" /><span className="smallText">{channel.frequency} MHz</span></div>
        <div className="row"><Globe2 className="iconSmall mutedText" /><span className="smallText">{channel.src_language}</span></div>
        <div className="row"><Tag className="iconSmall mutedText" /><span className="smallText">{channel.tag || 'No tag'}</span></div>
        <div className="row"><User2 className="iconSmall mutedText" /><span className="smallText">{channel.person || 'Unassigned'}</span></div>
        <div className="row"><Radio className="iconSmall mutedText" /><span className="smallText">Audio Stream: {channel.audio_stream_enabled ? 'On' : 'Off'}</span></div>
      </div>

      <div className="stackCompact">
        <Button onClick={() => handleEdit(channel)} className="fullWidth">
          <Settings2 />
          Configure
        </Button>
        
        {channel.mac && channel.audio_stream_enabled && (
          <Button onClick={() => openAudioStream(channel)} variant="accent" className="fullWidth">
            <ExternalLink />
            Live Audio Stream
          </Button>
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
    <div className="stack">
      {/* Header with Add Channel Button */}
      <div className={`${cardStyles.card} ${cardStyles.compact}`}>
        <div className="rowBetweenStart">
          <div className="row">
            <div className="iconTile iconTileAccent"><Radio /></div>
            <div>
              <h3 className={cardStyles.title}>Channels</h3>
              <p className={cardStyles.description}>Manage communication channels for your recorders</p>
            </div>
          </div>
          <Button onClick={() => setIsCreatingChannel(true)} variant="primary">
            <Plus />
            <span>Add Channel</span>
          </Button>
        </div>
      </div>

      {/* Status summary / hint */}
      <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
        <div className={noticeStyles.body}>
          <p>{channels.length === 0
            ? 'No channels configured yet. Create your first channel to begin routing audio.'
            : `Managing ${channels.length} channel${channels.length !== 1 ? 's' : ''}. Click a card to edit details or toggle status.`}</p>
        </div>
      </div>

      {loading && (
        <div className="centeredContent"><span className="spinner spinnerLarge" aria-label="Loading channels" /></div>
      )}

      {!loading && (
        <div className="gridThree">
          {channels.map(channel => renderChannelCard(channel))}
        </div>
      )}

      {editingChannel && (
        <ChannelEditModal
          editingChannel={editingChannel}
          tempChannel={tempChannel}
          frequencies={frequencies}
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
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

export default ChannelSettings;