import React, { useState } from 'react';
import UserManagement from '../Users/index';
import ProfileManagement from './ProfileManagement';
import { Shield, Users } from 'lucide-react';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import { SettingsPageHero, SettingsSectionWidth } from './SettingsSectionLayout';
import cardStyles from '../ui/Card.module.css';

const UserManagementSection = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Users"
        description="Manage users, groups, permissions, and MFA requirements."
        icon={<span className="material-symbols-outlined iconMedium">group</span>}
      />

      <div className={cardStyles.card}>
        <SettingsSubnav embedded aria-label="User management">
          <SettingsSubnavTab active={activeTab === 'users'} onClick={() => setActiveTab('users')} className="row">
            <Users className="iconMedium noShrink" />
            Users
          </SettingsSubnavTab>
          <SettingsSubnavTab active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} className="row">
            <Shield className="iconMedium noShrink" />
            Groups
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'users' ? <UserManagement /> : <ProfileManagement />}
      </div>
    </SettingsSectionWidth>
  );
};

export default UserManagementSection;
