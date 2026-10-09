import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Radio, RadioTower, SmartphoneNfc } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import ChannelSettings from './ChannelSettings';
import FrequencyManagement from './FrequencyManagement';
import RecorderDevices from './RecorderDevices';
import Health from './Health';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import { SettingsPageHero, SettingsSectionWidth } from './SettingsSectionLayout';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import noticeStyles from '../ui/Notice.module.css';

const ChannelsAndStationsSection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestedTab = searchParams.get('recorderTab');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/recorders');
      setSettings(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to load recorder settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const edgeEnabled = Boolean(settings?.edge_recorders_enabled);
  const validTabs = edgeEnabled
    ? ['recorders', 'channels', 'stations', 'health']
    : ['channels', 'stations', 'health'];
  const activeTab = validTabs.includes(requestedTab)
    ? requestedTab
    : (edgeEnabled ? 'recorders' : 'channels');

  useEffect(() => {
    if (requestedTab !== activeTab) {
      setSearchParams({ tab: 'recorders', recorderTab: activeTab }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  const setRecorderFlag = async (field, value) => {
    setSettings((previous) => ({ ...previous, [field]: value }));
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/settings/recorders', { [field]: value });
      setSettings(data);
      toast.success('Recorder settings saved');
    } catch (requestError) {
      await loadSettings();
      const message = requestError.response?.data?.error || 'Failed to save recorder settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="centeredContent"><span className="spinner" /></div>;

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Recorders"
        description="Configure recorder services, channels, frequencies, and connected devices."
        icon={<span className="material-symbols-outlined iconMedium">mic_none</span>}
      />

      {error ? <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p></div></div> : null}

      <div className={`${cardStyles.card} stackLarge`}>
        <div className="gridTwo">
          <label className={`${formStyles.choiceCard} ${settings?.edge_recorders_enabled ? formStyles.choiceCardSelected : ''}`}>
            <span className="grow"><strong>Edge recorders</strong><p className="smallText mutedText">Enable discovery and management of Boondock Edge recorders.</p></span>
            <span className={formStyles.switch}><input type="checkbox" checked={Boolean(settings?.edge_recorders_enabled)} disabled={saving} onChange={(event) => setRecorderFlag('edge_recorders_enabled', event.target.checked)} /><span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span></span>
          </label>
          <label className={`${formStyles.choiceCard} ${settings?.uniden_scanners_enabled ? formStyles.choiceCardSelected : ''}`}>
            <span className="grow"><strong>Uniden scanners</strong><p className="smallText mutedText">Enable discovery of supported Uniden scanner devices.</p></span>
            <span className={formStyles.switch}><input type="checkbox" checked={Boolean(settings?.uniden_scanners_enabled)} disabled={saving} onChange={(event) => setRecorderFlag('uniden_scanners_enabled', event.target.checked)} /><span className={formStyles.switchTrack} aria-hidden="true"><span className={formStyles.switchThumb} /></span></span>
          </label>
        </div>

        <SettingsSubnav embedded aria-label="Recorder sections">
          {edgeEnabled ? <SettingsSubnavTab active={activeTab === 'recorders'} onClick={() => setSearchParams({ tab: 'recorders', recorderTab: 'recorders' })}><SmartphoneNfc className="iconSmall" />Edge Recorders</SettingsSubnavTab> : null}
          <SettingsSubnavTab active={activeTab === 'channels'} onClick={() => setSearchParams({ tab: 'recorders', recorderTab: 'channels' })}><Radio className="iconSmall" />Channels</SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'stations'} onClick={() => setSearchParams({ tab: 'recorders', recorderTab: 'stations' })}><RadioTower className="iconSmall" />Stations</SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'health'} onClick={() => setSearchParams({ tab: 'recorders', recorderTab: 'health' })}><Activity className="iconSmall" />Health</SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'recorders' ? <RecorderDevices enabled={edgeEnabled} /> : null}
        {activeTab === 'channels' ? <ChannelSettings /> : null}
        {activeTab === 'stations' ? <FrequencyManagement /> : null}
        {activeTab === 'health' ? <Health /> : null}
      </div>
    </SettingsSectionWidth>
  );
};

export default ChannelsAndStationsSection;
