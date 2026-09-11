import React, { useState } from 'react';
import KeywordsSection from './KeywordsSection';
import SimpleTagManager from './MasterTagKeyManagement';
import { Siren, Tag } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import cardStyles from '../ui/Card.module.css';
import {
  SettingsPageHero,
  SettingsSectionWidth,
} from './SettingsSectionLayout';

const KeywordsAndTagsSection = ({
  keywords = [],
  newKeyword = '',
  setNewKeyword,
  handleAddKeyword,
  handleRemoveKeyword,
}) => {
  const [activeTab, setActiveTab] = useState('keywords');

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Keywords & tags"
        description="Manage alert keywords and classification tags for your communications."
        icon={<span className="material-symbols-outlined iconMedium">shutter_speed</span>}
      />

      <div className={cardStyles.card}>
        <SettingsSubnav embedded aria-label="Keywords and tags">
          <SettingsSubnavTab active={activeTab === 'keywords'} onClick={() => setActiveTab('keywords')}>
            <Siren className="iconMedium" />
            Keywords
          </SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'tags'} onClick={() => setActiveTab('tags')}>
            <Tag className="iconMedium" />
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
          />
        )}
        {activeTab === 'tags' && (
          <SimpleTagManager />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default KeywordsAndTagsSection;
