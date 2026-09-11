import React, { useState } from 'react';
import UserManagement from '../Users/index';
import ProfileManagement from './ProfileManagement';
import { Users, Shield } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import {
  SettingsPageHero,
  SettingsSectionWidth,
} from './SettingsSectionLayout';
import cardStyles from '../ui/Card.module.css';

const UserManagementSection = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Users"
        description="Manage users, roles, and profile settings for your organization."
        icon={<span className="material-symbols-outlined iconMedium">group</span>}
      />

      <div className={cardStyles.card}>
        <SettingsSubnav embedded aria-label="User management">
          <SettingsSubnavTab
            active={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            className="row"
          >
            <Users className="iconMedium noShrink" />
            Users
          </SettingsSubnavTab>
          <SettingsSubnavTab
            active={activeTab === 'profiles'}
            onClick={() => setActiveTab('profiles')}
            className="row"
          >
            <Shield className="iconMedium noShrink" />
            Profiles
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'users' && (
          <UserManagement />
        )}
        {activeTab === 'profiles' && (
          <ProfileManagement />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default UserManagementSection;
