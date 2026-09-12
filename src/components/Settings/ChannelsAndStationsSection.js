
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChannelSettings from './ChannelSettings';
import FrequencyManagement from './FrequencyManagement';
import RecorderDevices from './RecorderDevices';
import Health from './Health';
import { Activity, Radio, RadioTower, SmartphoneNfc, Usb } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
} from './SettingsSectionLayout';
import cardStyles from '../ui/Card.module.css';


const ChannelsAndStationsSection = ({
  recordersEnabled,
  globalSettings,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const edgeRecordersEnabled = globalSettings?.global_enable_edge_devices || false;

  const getInitialTab = () => {
    if (edgeRecordersEnabled) return 'recorders';
    return 'channels';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    const recorderTab = searchParams.get('recorderTab');
    if (['recorders', 'usb-recorders', 'channels', 'stations', 'health'].includes(recorderTab)) {
      setActiveTab(recorderTab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: 'recorders', recorderTab: tabId });
  };

  useEffect(() => {
    if (activeTab === 'recorders' && !edgeRecordersEnabled) {
      setActiveTab('channels');
    } 
  }, [activeTab, edgeRecordersEnabled]);

  const tabClassName = 'flex max-w-max shrink-0 items-center gap-1 whitespace-nowrap md:gap-2';

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Recorders"
        description="Configure channels, frequencies, and connected recorders."
        icon={<span className="material-symbols-outlined text-2xl">mic_none</span>}
      />

      <div className={`rounded-xl border p-6 md:p-8 ${cardStyles.card}`}>
        <SettingsSubnav embedded aria-label="Recorder sections">
          {edgeRecordersEnabled && (
            <SettingsSubnavTab
              active={activeTab === 'recorders'}
              onClick={() => handleTabChange('recorders')}
              className={tabClassName}
            >
              <SmartphoneNfc className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
              Edge Recorders
            </SettingsSubnavTab>
          )}
          <SettingsSubnavTab
            active={activeTab === 'channels'}
            onClick={() => handleTabChange('channels')}
            className={tabClassName}
          >
            <Radio className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            Channels
          </SettingsSubnavTab>
          <SettingsSubnavTab
            active={activeTab === 'stations'}
            onClick={() => handleTabChange('stations')}
            className={tabClassName}
          >
            <RadioTower className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            Stations
          </SettingsSubnavTab>
          <SettingsSubnavTab
            active={activeTab === 'health'}
            onClick={() => handleTabChange('health')}
            className={tabClassName}
          >
            <Activity className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            Health
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'recorders' && (
          <RecorderDevices
            enabled={recordersEnabled}
          />
        )}
        {activeTab === 'channels' && (
          <ChannelSettings />
        )}
        {activeTab === 'stations' && (
          <FrequencyManagement />
        )}
        {activeTab === 'health' && (
          <Health />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default ChannelsAndStationsSection;
