import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useSearchParams } from 'react-router-dom';
import WifiSettings from './WifiSettings';
import BackupRestore from './BackupRestore';
import DangerZone from './DangerZone';
import Maintenance from './Maintenance';
import HallucinationsSection from './HallucinationsSection';
import ApiKeyManagement from './ApiKeyManagement';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import { SettingsPageHero, SettingsSectionWidth } from './SettingsSectionLayout';
import { useAuth } from '../AuthContext';
import cardStyles from '../ui/Card.module.css';

const TABS = [
  { id: 'audio-post-processing', label: 'Audio post processing' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'hotspot-configuration', label: 'Wi-Fi' },
  { id: 'maintenance', label: 'Maintenance & Backup' },
  { id: 'danger-zone', label: 'Danger Zone', danger: true },
];

const SystemSection = () => {
  const { user: authValue } = useAuth();
  const user = authValue?.user ?? authValue ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('systemTab');
  const validTabs = new Set(TABS.map((tab) => tab.id));
  const fallbackTab = 'hotspot-configuration';
  const normalizedRequested = requested === 'display-language' ? fallbackTab : requested;
  const [activeTab, setActiveTab] = useState(
    validTabs.has(normalizedRequested) ? normalizedRequested : fallbackTab,
  );

  useEffect(() => {
    const next = validTabs.has(normalizedRequested) ? normalizedRequested : fallbackTab;
    setActiveTab(next);
    if (requested !== next) {
      setSearchParams({ tab: 'system', systemTab: next }, { replace: true });
    }
  }, [normalizedRequested, requested, setSearchParams]);

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: 'system', systemTab: tabId });
  };

  const showToast = (message, type = 'success') => {
    toast[type === 'error' ? 'error' : 'success'](message);
  };

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="System"
        description="Manage audio processing, API keys, Wi-Fi, backups, maintenance, and system access."
        icon={<span className="material-symbols-outlined iconMedium">settings_suggest</span>}
      />

      <div className={`${cardStyles.card} stack stackLarge`}>
        <SettingsSubnav embedded aria-label="System sections">
          {TABS.map((tab) => (
            <SettingsSubnavTab
              key={tab.id}
              active={activeTab === tab.id}
              danger={Boolean(tab.danger)}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </SettingsSubnavTab>
          ))}
        </SettingsSubnav>

        {activeTab === 'audio-post-processing' ? <HallucinationsSection /> : null}
        {activeTab === 'api-keys' ? <ApiKeyManagement user={user} showToast={showToast} /> : null}
        {activeTab === 'hotspot-configuration' ? <WifiSettings /> : null}
        {activeTab === 'maintenance' ? (
          <div className="stack stackLarge">
            <Maintenance />
            <BackupRestore />
          </div>
        ) : null}
        {activeTab === 'danger-zone' ? <DangerZone showToast={showToast} /> : null}
      </div>
    </SettingsSectionWidth>
  );
};

export default SystemSection;
