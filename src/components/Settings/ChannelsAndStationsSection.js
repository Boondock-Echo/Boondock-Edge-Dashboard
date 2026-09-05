
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChannelSettings from './ChannelSettings';
import FrequencyManagement from './FrequencyManagement';
import RecorderDevices from './RecorderDevices';
import USBRecorders from './USBRecorders';
import Health from './Health';
import { Activity, Radio, RadioTower, SmartphoneNfc, Usb } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from './SettingsSectionLayout';

const ChannelsAndStationsSection = ({
  isDarkMode,
  recordersEnabled,
  globalSettings,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const edgeRecordersEnabled = globalSettings?.global_enable_edge_devices || false;
  const usbRecordersEnabled = globalSettings?.global_enable_usb_audio_devices || false;

  const getInitialTab = () => {
    if (edgeRecordersEnabled) return 'recorders';
    if (usbRecordersEnabled) return 'usb-recorders';
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
      if (usbRecordersEnabled) {
        setActiveTab('usb-recorders');
      } else {
        setActiveTab('channels');
      }
    } else if (activeTab === 'usb-recorders' && !usbRecordersEnabled) {
      if (edgeRecordersEnabled) {
        setActiveTab('recorders');
      } else {
        setActiveTab('channels');
      }
    }
  }, [activeTab, edgeRecordersEnabled, usbRecordersEnabled]);

  const tabClassName = 'flex max-w-max shrink-0 items-center gap-1 whitespace-nowrap md:gap-2';
  const card = settingsMainCardClass(isDarkMode);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="Recorders"
        description="Configure channels, frequencies, and connected recorders."
        icon={<span className="material-symbols-outlined text-2xl">mic_none</span>}
      />

      <div className={`rounded-xl border p-6 md:p-8 ${card}`}>
        <SettingsSubnav isDarkMode={isDarkMode} embedded aria-label="Recorder sections">
          {edgeRecordersEnabled && (
            <SettingsSubnavTab
              isDarkMode={isDarkMode}
              active={activeTab === 'recorders'}
              onClick={() => handleTabChange('recorders')}
              className={tabClassName}
            >
              <SmartphoneNfc className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
              Edge Recorders
            </SettingsSubnavTab>
          )}
          {usbRecordersEnabled && (
            <SettingsSubnavTab
              isDarkMode={isDarkMode}
              active={activeTab === 'usb-recorders'}
              onClick={() => handleTabChange('usb-recorders')}
              className={tabClassName}
            >
              <Usb className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
              USB Recorders
            </SettingsSubnavTab>
          )}
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'channels'}
            onClick={() => handleTabChange('channels')}
            className={tabClassName}
          >
            <Radio className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            Channels
          </SettingsSubnavTab>
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'stations'}
            onClick={() => handleTabChange('stations')}
            className={tabClassName}
          >
            <RadioTower className="h-4 w-4 shrink-0 md:h-5 md:w-5" />
            Stations
          </SettingsSubnavTab>
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
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
            isDarkMode={isDarkMode}
            enabled={recordersEnabled}
          />
        )}
        {activeTab === 'usb-recorders' && (
          <USBRecorders
            isDarkMode={isDarkMode}
            globalSettings={globalSettings}
          />
        )}
        {activeTab === 'channels' && (
          <ChannelSettings
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'stations' && (
          <FrequencyManagement
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'health' && (
          <Health isDarkMode={isDarkMode} />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default ChannelsAndStationsSection;
