import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import SettingsSectionHeader from './SettingsSectionHeader';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const EMPTY_FORM = {
  ssid: '',
  password: '',
  host_ip: '',
  host_port: 4000,
};

const WifiSettings = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [hotspot, setHotspot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hotspotAction, setHotspotAction] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, statusResponse] = await Promise.all([
        api.get('/settings/wifi'),
        api.get('/hotspot/status'),
      ]);
      const settings = settingsResponse.data || {};
      setForm({
        ssid: settings.ssid || '',
        password: '',
        host_ip: settings.host_ip || '',
        host_port: Number(settings.host_port) || 4000,
      });
      setPasswordConfigured(Boolean(settings.password_configured));
      setHotspot(statusResponse.data || null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load Wi-Fi settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ssid: form.ssid.trim(),
        host_ip: form.host_ip.trim(),
        host_port: Number(form.host_port),
      };
      if (form.password) payload.password = form.password;
      const { data } = await api.patch('/settings/wifi', payload);
      setForm((previous) => ({
        ...previous,
        ssid: data.ssid || '',
        password: '',
        host_ip: data.host_ip || '',
        host_port: Number(data.host_port) || 4000,
      }));
      setPasswordConfigured(Boolean(data.password_configured));
      toast.success('Wi-Fi settings saved');
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Failed to save Wi-Fi settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleHotspot = async () => {
    setHotspotAction(true);
    setError('');
    try {
      const active = Boolean(hotspot?.active || hotspot?.is_active || hotspot?.running);
      if (active) {
        await api.post('/hotspot/stop');
      } else {
        const payload = {};
        if (form.ssid) payload.ssid = form.ssid;
        if (form.password) payload.password = form.password;
        await api.post('/hotspot/start', payload);
      }
      const { data } = await api.get('/hotspot/status');
      setHotspot(data || null);
      toast.success(active ? 'Hotspot stopped' : 'Hotspot started');
    } catch (requestError) {
      const message = requestError.response?.data?.error || 'Hotspot action failed';
      setError(message);
      toast.error(message);
    } finally {
      setHotspotAction(false);
    }
  };

  if (loading) return <div className="centeredContent"><span className="spinner" /></div>;

  const hotspotActive = Boolean(hotspot?.active || hotspot?.is_active || hotspot?.running);

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Wifi}
        title="Wi-Fi"
        description="Configure recorder network discovery and the local hotspot."
        iconColor="blue"
      />

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <div className="gridMainAside">
        <div className={`${cardStyles.card} stackLarge`}>
          <div>
            <label className={formStyles.label}>SSID</label>
            <input className={formStyles.input} value={form.ssid} onChange={(event) => updateField('ssid', event.target.value)} />
          </div>
          <div>
            <label className={formStyles.label}>Wi-Fi password</label>
            <input
              type="password"
              className={formStyles.input}
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              placeholder={passwordConfigured ? 'Configured — enter a new password to replace' : 'Enter password'}
              autoComplete="new-password"
            />
          </div>
          <div className="gridTwo">
            <div>
              <label className={formStyles.label}>Host IP</label>
              <input className={formStyles.input} value={form.host_ip} onChange={(event) => updateField('host_ip', event.target.value)} />
            </div>
            <div>
              <label className={formStyles.label}>Host port</label>
              <input type="number" min="1" max="65535" className={formStyles.input} value={form.host_port} onChange={(event) => updateField('host_port', event.target.value)} />
            </div>
          </div>
          <div className="actionsEnd">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? <span className="spinner spinnerSmall" /> : <Save size={18} />}
              Save Wi-Fi settings
            </Button>
          </div>
        </div>

        <div className={`${cardStyles.card} stack`}>
          <div className="rowBetween">
            <div>
              <p className="eyebrow">Hotspot</p>
              <h3 className={cardStyles.title}>{hotspotActive ? 'Running' : 'Stopped'}</h3>
            </div>
            {hotspotActive ? <Wifi size={24} /> : <WifiOff size={24} />}
          </div>
          {hotspot?.ssid ? <p className="smallText mutedText">SSID: {hotspot.ssid}</p> : null}
          {hotspot?.ip_address ? <p className="smallText mutedText">IP: {hotspot.ip_address}</p> : null}
          <Button variant={hotspotActive ? 'danger' : 'success'} onClick={toggleHotspot} disabled={hotspotAction}>
            {hotspotAction ? <RefreshCw className="spin" size={18} /> : hotspotActive ? <WifiOff size={18} /> : <Wifi size={18} />}
            {hotspotActive ? 'Stop hotspot' : 'Start hotspot'}
          </Button>
          <Button variant="ghost" onClick={load}><RefreshCw size={18} />Refresh status</Button>
        </div>
      </div>
    </div>
  );
};

export default WifiSettings;
