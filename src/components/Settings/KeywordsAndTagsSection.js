import React, { useState } from 'react';
import KeywordsSection from './KeywordsSection';
import SimpleTagManager from './MasterTagKeyManagement';
import KeywordActionsSection, { EmailSettingsSection } from './KeywordActionsSection';
import { Siren, Tag } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import cardStyles from '../ui/Card.module.css';
import { SettingsPageHero, SettingsSectionWidth } from './SettingsSectionLayout';

const KeywordsAndTagsSection = () => {
  const [activeTab, setActiveTab] = useState('keywords');

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Keywords & tags"
        description="Manage group keyword tracking and classification tags."
        icon={<span className="material-symbols-outlined iconMedium">shutter_speed</span>}
      />

      <div className={cardStyles.card}>
        <SettingsSubnav embedded aria-label="Keywords and tags">
          <SettingsSubnavTab active={activeTab === 'keywords'} onClick={() => setActiveTab('keywords')}>
            <Siren className="iconMedium" />
            Keywords
          </SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'actions'} onClick={() => setActiveTab('actions')}>
            Actions
          </SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'email'} onClick={() => setActiveTab('email')}>
            Email delivery
          </SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'tags'} onClick={() => setActiveTab('tags')}>
            <Tag className="iconMedium" />
            Tags
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'keywords' && <KeywordsSection />}
        {activeTab === 'actions' && <KeywordActionsSection />}
        {activeTab === 'email' && <EmailSettingsSection />}
        {activeTab === 'tags' && <SimpleTagManager />}
      </div>
    </SettingsSectionWidth>
  );
};

export default KeywordsAndTagsSection;
