import React, { useState } from 'react';
import UserManagement from '../Users/index';
import ProfileManagement from './ProfileManagement';
import { Users, Shield } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
  settingsMainCardClass,
} from './SettingsSectionLayout';

const UserManagementSection = ({
  isDarkMode}) => {
  const [activeTab, setActiveTab] = useState('users');
  const card = settingsMainCardClass(isDarkMode);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        isDarkMode={isDarkMode}
        title="Users"
        description="Manage users, roles, and profile settings for your organization."
        icon={<span className="material-symbols-outlined text-2xl">group</span>}
      />

      <div className={`rounded-xl border p-6 md:p-8 ${card}`}>
        <SettingsSubnav isDarkMode={isDarkMode} embedded aria-label="User management">
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            className="flex items-center gap-2"
          >
            <Users className="h-5 w-5 shrink-0" />
            Users
          </SettingsSubnavTab>
          <SettingsSubnavTab
            isDarkMode={isDarkMode}
            active={activeTab === 'profiles'}
            onClick={() => setActiveTab('profiles')}
            className="flex items-center gap-2"
          >
            <Shield className="h-5 w-5 shrink-0" />
            Profiles
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'users' && (
          <UserManagement
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'profiles' && (
          <ProfileManagement
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default UserManagementSection;
