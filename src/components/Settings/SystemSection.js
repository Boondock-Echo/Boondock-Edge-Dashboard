import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import GlobalSettings from './GlobalSettings';
import Interfaces from './Interfaces';
import BackupRestore from './BackupRestore';
import DangerZone from './DangerZone';
import Maintenance from './Maintenance';
import HallucinationsSection from './HallucinationsSection';
import ApiKeyManagement from './ApiKeyManagement';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from './SettingsSectionLayout';

const TABS = [
  { id: 'display-language', label: 'Display & Language' },
  { id: 'audio-post-processing', label: 'Audio Post processing' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'hotspot-configuration', label: 'WiFi' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'danger-zone', label: 'Danger Zone', danger: true },
];

const SystemSection = ({
  isDarkMode,
  showToast,
  globalSettings,
  handleGlobalChange,
  timezone,
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
      ['display-language', 'audio-post-processing', 'api-keys', 'interfaces', 'hotspot-configuration', 'maintenance', 'danger-zone'].includes(
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
      isDarkMode={isDarkMode}
      timezone={timezone}
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
            isDarkMode={isDarkMode}
            timezone={timezone}
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
            isDarkMode={isDarkMode}
          />
        );
      case 'api-keys':
        return <ApiKeyManagement isDarkMode={isDarkMode} showToast={showToast} user={user} />;
      case 'interfaces':
        return <Interfaces isDarkMode={isDarkMode} />;
      case 'hotspot-configuration':
        return renderHotspotSettings();
      case 'maintenance':
        return (
          <div className="space-y-10">
            <Maintenance
              isDarkMode={isDarkMode}
              showToast={showToast}
            />
            <BackupRestore
              isDarkMode={isDarkMode}
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
            isDarkMode={isDarkMode}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  const card = settingsMainCardClass(isDarkMode);

  const subnav = (
    <SettingsSubnav isDarkMode={isDarkMode} embedded aria-label="System sections">
      {TABS.map((t) => (
        <SettingsSubnavTab
          key={t.id}
          isDarkMode={isDarkMode}
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
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-primary-container p-6 text-on-primary-container">
        <div className="relative z-10">
          <h4 className="font-headline mb-2 text-lg font-bold">Hotspot guide</h4>
          <p className="mb-4 text-xs leading-relaxed opacity-90">
            When the hotspot is enabled, recorders can join the Wi‑Fi network and run Auto Config against this
            server. Set SSID, password, host IP, and port before enabling.
          </p>
          <button
            type="button"
            onClick={() => window.open('/user-guide', '_blank')}
            className="inline-flex items-center gap-2 text-xs font-bold underline underline-offset-4"
          >
            Open user guide
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </button>
        </div>
        <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-8xl opacity-10">
          wifi_tethering
        </span>
      </div>
      <div
        className={`space-y-4 rounded-xl p-6 ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-200/40'}`}
      >
        <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Checklist</h4>
        <ul
          className={`space-y-2 text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-on-surface-variant'}`}
        >
          <li>Unique SSID for the field network</li>
          <li>Strong password (WPA2/WPA3)</li>
          <li>Host IP matches what recorders should call</li>
          <li>Port matches the edge HTTP port</li>
        </ul>
      </div>
    </div>
  );

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="System"
        description="Manage display, API keys, WiFi, backups, and maintenance."
        icon={<span className="material-symbols-outlined text-2xl">settings_suggest</span>}
      />

      {activeTab === 'hotspot-configuration' ? (
        <div className={`space-y-6 rounded-xl border p-6 md:p-8 ${card}`}>
          {subnav}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">{renderTabBody()}</div>
            <div className="xl:col-span-1">{hotspotAside}</div>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl border p-6 md:p-8 ${card}`}>
          {subnav}
          {renderTabBody()}
        </div>
      )}
    </SettingsSectionWidth>
  );
};

export default SystemSection;
