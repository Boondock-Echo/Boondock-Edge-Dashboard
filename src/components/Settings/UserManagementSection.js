import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../utils/apiClient';
import UserManagement from '../Users/index';
import ProfileManagement from './ProfileManagement';
import { SettingsSubnav, SettingsSubnavTab } from './SettingsSubnav';
import { SettingsPageHero, SettingsSectionWidth } from './SettingsSectionLayout';
import cardStyles from '../ui/Card.module.css';

let pendingLoad = null;

const fetchUserManagementData = () => {
  if (!pendingLoad) {
    pendingLoad = Promise.all([
      api.get('/users'),
      api.get('/groups'),
    ]).finally(() => {
      pendingLoad = null;
    });
  }

  return pendingLoad;
};

const UserManagementSection = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [usersResponse, groupsResponse] = await fetchUserManagementData();
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setGroups(Array.isArray(groupsResponse.data) ? groupsResponse.data : []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load users and groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  return (
    <SettingsSectionWidth>
      <SettingsPageHero
        title="Users"
        description="Manage users, groups, permissions, and MFA requirements."
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
            active={activeTab === 'groups'}
            onClick={() => setActiveTab('groups')}
            className="row"
          >
            <Shield className="iconMedium noShrink" />
            Groups
          </SettingsSubnavTab>
        </SettingsSubnav>

        {activeTab === 'users' ? (
          <UserManagement
            users={users}
            groups={groups}
            loading={loading}
            refresh={refresh}
          />
        ) : (
          <ProfileManagement
            groups={groups}
            loading={loading}
            refresh={refresh}
          />
        )}
      </div>
    </SettingsSectionWidth>
  );
};

export default UserManagementSection;
