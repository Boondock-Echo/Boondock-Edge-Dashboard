import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import GlobalSettings from './GlobalSettings';
import BackupRestore from './BackupRestore';
import DangerZone from './DangerZone';
import Maintenance from './Maintenance';
import HallucinationsSection from './HallucinationsSection';
import ApiKeyManagement from './ApiKeyManagement';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
} from './SettingsSectionLayout';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import listStyles from '../ui/List.module.css';
import noticeStyles from '../ui/Notice.module.css';

const TABS = [
  { id: 'display-language', label: 'Display & Language' },
  { id: 'audio-post-processing', label: 'Audio Post processing' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'hotspot-configuration', label: 'WiFi' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'danger-zone', label: 'Danger Zone', danger: true },
];

const SystemSection = ({
  showToast,
  globalSettings,
  handleGlobalChange,
  timeFormat,
  setTimeFormat,
  reverseSort,
  setReverseSort,
  user,
  handleBackupNow,
  keywords,
  newKeyword,
  setNewKeyword,
  handleAddKeyword,
  handleRemoveKeyword,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hotspot-configuration');

  useEffect(() => {
    const systemTab = searchParams.get('systemTab');
    if (
      systemTab &&
      ['display-language', 'audio-post-processing', 'api-keys', 'hotspot-configuration', 'maintenance', 'danger-zone'].includes(
        systemTab,
      )
    ) {
      setActiveTab(systemTab);
    } else {
      setActiveTab('hotspot-configuration');
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: 'system', systemTab: tabId });
  };

  const renderHotspotSettings = () => (
    <GlobalSettings
      globalSettings={globalSettings}
      handleGlobalChange={handleGlobalChange}
      timeFormat={timeFormat}
      setTimeFormat={setTimeFormat}
      reverseSort={reverseSort}
      setReverseSort={setReverseSort}
      user={user}
      activeSection="hotspot-configuration"
      omitHotspotSectionHeader
      showToast={showToast}
    />
  );

  const renderTabBody = () => {
    switch (activeTab) {
      case 'display-language':
        return (
          <GlobalSettings
            globalSettings={globalSettings}
            handleGlobalChange={handleGlobalChange}
            timeFormat={timeFormat}
            setTimeFormat={setTimeFormat}
            reverseSort={reverseSort}
            setReverseSort={setReverseSort}
            user={user}
            activeSection="display-language"
          />
        );
      case 'audio-post-processing':
        return (
          <HallucinationsSection
            keywords={keywords}
            newKeyword={newKeyword}
            setNewKeyword={setNewKeyword}
            handleAddKeyword={handleAddKeyword}
            handleRemoveKeyword={handleRemoveKeyword}
            globalSettings={globalSettings}
            handleGlobalChange={handleGlobalChange}
          />
        );
      case 'api-keys':
        return <ApiKeyManagement showToast={showToast} user={user} />;
      case 'hotspot-configuration':
        return renderHotspotSettings();
      case 'maintenance':
        return (
          <div className="stack stackLarge">
            <Maintenance
              showToast={showToast}
            />
            <BackupRestore
              showToast={showToast}
              globalSettings={globalSettings}
              handleGlobalChange={handleGlobalChange}
              handleBackupNow={handleBackupNow}
            />
          </div>
        );
      case 'danger-zone':
        return (
          <DangerZone
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };


  const subnav = (
    <SettingsSubnav embedded aria-label="System sections">
      {TABS.map((t) => (
        <SettingsSubnavTab
          key={t.id}
          active={activeTab === t.id}
          danger={!!t.danger}
          onClick={() => handleTabChange(t.id)}
        >
          {t.label}
        </SettingsSubnavTab>
      ))}
    </SettingsSubnav>
  );

  const hotspotAside = activeTab === 'hotspot-configuration' && (
    <div className="stack stackLarge">
      <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
        <span className={`material-symbols-outlined ${noticeStyles.icon}`}>wifi_tethering</span>
        <div className={noticeStyles.body}>
          <p><strong>Hotspot guide</strong></p>
          <p>
            When the hotspot is enabled, recorders can join the Wi‑Fi network and run Auto Config against this
            server. Set SSID, password, host IP, and port before enabling.
          </p>
          <Button type="button" size="small" variant="ghost" onClick={() => window.open('/user-guide', '_blank')}>
            Open user guide
            <span className="material-symbols-outlined iconSmall">open_in_new</span>
          </Button>
        </div>
      </div>
      <div className={`${cardStyles.card} ${cardStyles.compact}`}>
        <p className="eyebrow">Checklist</p>
        <ul className={listStyles.list}>
          <li className={listStyles.item}>Unique SSID for the field network</li>
          <li className={listStyles.item}>Strong password (WPA2/WPA3)</li>
          <li className={listStyles.item}>Host IP matches what recorders should call</li>
          <li className={listStyles.item}>Port matches the edge HTTP port</li>
        </ul>
      </div>
    </div>
  );

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="System"
        description="Manage display, API keys, WiFi, backups, and maintenance."
        icon={<span className="material-symbols-outlined iconMedium">settings_suggest</span>}
      />

      {activeTab === 'hotspot-configuration' ? (
        <div className={`${cardStyles.card} stack stackLarge`}>
          {subnav}
          <div className="gridMainAside">
            <div>{renderTabBody()}</div>
            <div>{hotspotAside}</div>
          </div>
        </div>
      ) : (
        <div className={cardStyles.card}>
          {subnav}
          {renderTabBody()}
        </div>
      )}
    </SettingsSectionWidth>
  );
};

export default SystemSection;
