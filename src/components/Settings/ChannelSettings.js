import { apiFetch } from '../../utils/apiClient';
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Globe2, Plus, Radio, RadioTower, Settings2, Tag, User2, Volume2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ChannelEditModal from './ChannelEditModal';
import ChannelCreateModal from './ChannelCreateModal';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const normalizeChannel = (channel) => ({
  ...channel,
  name: channel.name || `Channel ${channel.id}`,
  status: channel.status || 'enabled',
  src_language: channel.src_language || 'english',
  model: channel.model || 'medium.en',
  target_language: channel.target_language || 'english',
  color: channel.color || '#000000',
  background_color: channel.background_color || '#ffffff',
  team_color: channel.team_color || '#ffffff',
  person: channel.person || '',
  tag: channel.tag || '',
  audio_stream_enabled: Boolean(channel.audio_stream_enabled),
  audio_stream_port: channel.audio_stream_port || null,
  speaker_enabled: Boolean(channel.speaker_enabled),
  speaker_volume: channel.speaker_volume ?? 50,
});

const responseError = async (response, fallback) => {
  try {
    const data = await response.json();
    return data.error || data.message || fallback;
  } catch {
    return fallback;
  }
};

const ChannelSettings = () => {
  const [channels, setChannels] = useState([]);
  const [frequencies, setFrequencies] = useState([]);
  const [editingChannel, setEditingChannel] = useState(null);
  const [tempChannel, setTempChannel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsResponse, frequenciesResponse] = await Promise.all([
        apiFetch('/channels'),
        apiFetch('/frequencies'),
      ]);
      if (!channelsResponse.ok) throw new Error(await responseError(channelsResponse, 'Failed to load channels'));
      if (!frequenciesResponse.ok) throw new Error(await responseError(frequenciesResponse, 'Failed to load frequencies'));
      const [channelData, frequencyData] = await Promise.all([channelsResponse.json(), frequenciesResponse.json()]);
      setChannels(Array.isArray(channelData) ? channelData.map(normalizeChannel) : []);
      setFrequencies(Array.isArray(frequencyData) ? frequencyData : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchChannel = async (id, changes) => {
    const response = await apiFetch(`/channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    if (!response.ok) throw new Error(await responseError(response, 'Failed to update channel'));
    const data = await response.json();
    return normalizeChannel(data.channel || data);
  };

  const toggleEnabled = async (channel, enabled) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await patchChannel(channel.id, { status: enabled ? 'enabled' : 'disabled' });
      setChannels((items) => items.map((item) => item.id === channel.id ? updated : item));
      toast.success(`Channel ${channel.id} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (channel) => {
    let frequencyId = channel.frequency_id;
    if (!frequencyId && channel.frequency != null) {
      frequencyId = frequencies.find((frequency) => String(frequency.frequency) === String(channel.frequency))?.id;
    }
    setEditingChannel(channel);
    setTempChannel({ ...channel, frequency_id: frequencyId || '' });
  };

  const saveEdit = async () => {
    if (!editingChannel || !tempChannel || saving) return;
    const ignored = new Set(['id', 'frequency_id', 'deleted', 'device_sync']);
    const changes = {};
    Object.entries(tempChannel).forEach(([key, value]) => {
      if (!ignored.has(key) && value !== editingChannel[key]) changes[key] = value;
    });
    if (!Object.keys(changes).length) {
      setEditingChannel(null);
      setTempChannel(null);
      return;
    }
    setSaving(true);
    try {
      const updated = await patchChannel(editingChannel.id, changes);
      setChannels((items) => items.map((item) => item.id === editingChannel.id ? updated : item));
      setEditingChannel(null);
      setTempChannel(null);
      toast.success(`Channel ${editingChannel.id} updated`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (saving || !window.confirm(`Delete Channel #${id}? Audio files are preserved.`)) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/channels/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response, 'Failed to delete channel'));
      setChannels((items) => items.filter((item) => item.id !== id));
      setEditingChannel(null);
      setTempChannel(null);
      toast.success(`Channel ${id} deleted`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const frequencyChanged = (frequencyId) => {
    const frequency = frequencies.find((item) => item.id === Number(frequencyId));
    if (!frequency) return;
    setTempChannel((previous) => ({
      ...previous,
      frequency_id: frequency.id,
      frequency: frequency.frequency,
      name: frequency.name,
      type: frequency.type,
      tone: frequency.tone,
      person: previous.person || frequency.person || '',
      tag: previous.tag || frequency.tag || '',
    }));
  };

  const statusClass = (status) => ({
    enabled: 'pillSuccess', online: 'pillSuccess', busy: 'pillWarning', disabled: 'pillDanger', deleted: 'pillDanger',
  }[String(status).toLowerCase()] || '');

  return (
    <div className="stack">
      <div className={`${cardStyles.card} ${cardStyles.compact}`}>
        <div className="rowBetweenStart">
          <div className="row"><div className="iconTile iconTileAccent"><Radio /></div><div><h3 className={cardStyles.title}>Channels</h3><p className={cardStyles.description}>Manage recorder communication channels.</p></div></div>
          <Button variant="primary" onClick={() => setCreating(true)}><Plus />Add channel</Button>
        </div>
      </div>

      <div className={`${noticeStyles.notice} ${noticeStyles.info}`}><div className={noticeStyles.body}><p>{channels.length ? `${channels.length} channel${channels.length === 1 ? '' : 's'} configured.` : 'No channels configured.'}</p></div></div>
      {loading ? <div className="centeredContent"><span className="spinner spinnerLarge" /></div> : null}

      {!loading ? <div className="gridThree">{channels.map((channel) => (
        <div key={channel.id} className={`${cardStyles.card} ${cardStyles.interactive}`}>
          <div className="rowBetweenStart">
            <div className="row grow"><RadioTower className="iconMedium mutedText" /><div className="grow"><p className="smallText">Channel {channel.id}</p><strong className="smallText">{channel.name}</strong></div></div>
            <div className="row"><span className={`pill ${statusClass(channel.status)}`}>{channel.status}</span><label className={formStyles.switch}><input type="checkbox" checked={channel.status !== 'disabled'} disabled={saving} onChange={(event) => toggleEnabled(channel, event.target.checked)} /><span className={formStyles.switchTrack}><span className={formStyles.switchThumb} /></span></label></div>
          </div>
          <div className="gridTwo">
            <div className="row"><Volume2 className="iconSmall mutedText" /><span className="smallText">{channel.frequency || '—'} MHz</span></div>
            <div className="row"><Globe2 className="iconSmall mutedText" /><span className="smallText">{channel.src_language}</span></div>
            <div className="row"><Tag className="iconSmall mutedText" /><span className="smallText">{channel.tag || 'No tag'}</span></div>
            <div className="row"><User2 className="iconSmall mutedText" /><span className="smallText">{channel.person || 'Unassigned'}</span></div>
          </div>
          <div className="stackCompact"><Button className="fullWidth" onClick={() => edit(channel)}><Settings2 />Configure</Button>{channel.mac && channel.audio_stream_enabled ? <Button variant="accent" className="fullWidth" onClick={() => window.open(`http://${channel.mac}.local/live`, '_blank', 'noopener,noreferrer')}><ExternalLink />Live audio stream</Button> : null}</div>
        </div>
      ))}</div> : null}

      {editingChannel ? <ChannelEditModal editingChannel={editingChannel} tempChannel={tempChannel} frequencies={frequencies} isSaving={saving} onClose={() => { setEditingChannel(null); setTempChannel(null); }} onSave={saveEdit} onFieldChange={(field, value) => setTempChannel((previous) => ({ ...previous, [field]: value }))} onFrequencyChange={frequencyChanged} onDelete={remove} /> : null}
      {creating ? <ChannelCreateModal isOpen frequencies={frequencies} onClose={() => setCreating(false)} onChannelCreated={async () => { setCreating(false); await load(); toast.success('Channel created'); }} /> : null}
    </div>
  );
};

export default ChannelSettings;
