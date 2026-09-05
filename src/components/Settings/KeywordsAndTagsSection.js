import React, { useState } from 'react';
import KeywordsSection from './KeywordsSection';
import SimpleTagManager from './MasterTagKeyManagement';
import { Siren, Tag } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from './SettingsSectionLayout';

const KeywordsAndTagsSection = ({
  keywords = [],
  newKeyword = '',
  setNewKeyword,
  handleAddKeyword,
  handleRemoveKeyword,
  isDarkMode}) => {
  const [activeTab, setActiveTab] = useState('keywords');
  const card = settingsMainCardClass(isDarkMode);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="Keywords & tags"
        description="Manage alert keywords and classification tags for your communications."
        icon={<span className="material-symbols-outlined text-2xl">shutter_speed</span>}
      />

      <div className={`rounded-xl border p-6 md:p-8 ${card}`}>
        <SettingsSubnav isDarkMode={isDarkMode} embedded aria-label="Keywords and tags">
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'keywords'}
            onClick={() => setActiveTab('keywords')}
            className="flex items-center gap-2"
          >
            <Siren className="h-5 w-5 shrink-0" />
            Keywords
          </SettingsSubnavTab>
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'tags'}
            onClick={() => setActiveTab('tags')}
            className="flex items-center gap-2"
          >
            <Tag className="h-5 w-5 shrink-0" />
            Tags
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'keywords' && (
          <KeywordsSection
            keywords={keywords}
            newKeyword={newKeyword}
            setNewKeyword={setNewKeyword}
            handleAddKeyword={handleAddKeyword}
            handleRemoveKeyword={handleRemoveKeyword}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'tags' && (
          <SimpleTagManager
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default KeywordsAndTagsSection;
