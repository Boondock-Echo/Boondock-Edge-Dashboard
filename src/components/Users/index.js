import api from '../../utils/apiClient';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Search, UserPlus, Shield, Activity, Edit, Trash2, Lock, Unlock, X, Save, Key, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import styles from '../ui/Page.module.css';
import SettingsSectionHeader from '../Settings/SettingsSectionHeader';


const UserModal = ({ isEdit = false, user = null, onClose, onSubmit, profiles = {} }) => {
  const initialFormData = useMemo(() => 
    user ? {
      ...user,
      password: ''
    } : {
      email: '',
      name: '',
      password: '',
      role: 'member',
      profile: 'Default'
    },
    [user]
  );

  const [formData, setFormData] = useState(initialFormData);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      // Error handling will be done in parent component
      throw error;
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalScrim} onClick={onClose}></div>
      <div className={styles.modal}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitleText}>
            {isEdit ? 'Edit User' : 'Create New User'}
          </h2>
          <button 
            onClick={onClose}
            className={styles.iconButton}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.stack}>
          <div>
            <label className={styles.label}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              disabled={isEdit}
              required
              className={styles.input}
            />
          </div>

          <div>
            <label className={styles.label}>
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              required
              className={styles.input}
            />
          </div>

          <div>
            <label className={styles.label}>
              Password {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
              required={!isEdit}
              className={styles.input}
            />
          </div>

          <div>
            <label className={styles.label}>
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))}
              className={styles.input}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className={styles.label}>
              Profile
            </label>
            <select
              value={formData.profile || 'Default'}
              onChange={(e) => setFormData(prev => ({...prev, profile: e.target.value}))}
              className={styles.input}
            >
              {Object.keys(profiles).map(profileName => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.actionsEnd}>
            <button
              type="button"
              onClick={onClose}
              className={styles.secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
            >
              <Save size={18} className={styles.iconSmall} />
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { user: currentAuthUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const isAdmin = currentAuthUser?.role === 'admin';

  const showToast = useCallback((message, type = 'success') => {
    toast[type === 'error' ? 'error' : 'success'](message);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      const transformedUsers = Object.entries(data).map(([email, details]) => ({
        ...details,
        email,
        role: details.role,
        profile: details.profile || 'Default'
      })); 
      setUsers(transformedUsers);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data } = await api.get('/profiles');
      setProfiles(data);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchProfiles();
  }, [fetchUsers, fetchProfiles]);



  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateUser = async (formData) => {
    try {
      await api.post('/users', formData);
      await fetchUsers();
      showToast('User created successfully');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to create user', 'error');
      throw error;
    }
  };

  const handleUpdateUser = async (formData) => {
    try {
      await api.put(`/users/${formData.email}`, formData);
      await fetchUsers();
      showToast('User updated successfully');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update user', 'error');
      throw error;
    }
  };

  const handleDelete = async (email) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${email}`);
      await fetchUsers();
      showToast('User deleted successfully');
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const handleResetMfa = async (email) => {
    if (!window.confirm(`Are you sure you want to reset MFA for ${email}? They will be able to login with just password and can setup MFA again.`)) return;
    try {
      await api.post(`/users/${email}/mfa/reset`);
      await fetchUsers();
      showToast(`MFA reset for ${email}`);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to reset MFA', 'error');
    }
  };

  const handleEnforceMfa = async (email, enforce) => {
    try {
      await api.post(`/users/${email}/mfa/enforce`, { enforce });
      await fetchUsers();
      showToast(`MFA enforcement ${enforce ? 'enabled' : 'removed'} for ${email}`);
    } catch (error) {
      showToast(error.response?.data?.error || `Failed to ${enforce ? 'enforce' : 'remove enforcement'} MFA`, 'error');
    }
  };

  if (loading) {
    return (
      <div className={styles.centeredCompact}>
        <div className={styles.rowMuted}>
          <div className={styles.spin}>
            <Shield size={24} />
          </div>
          Loading Users...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stackLarge}>
      <SettingsSectionHeader
        icon={Users}
        title="Users"
        description="Manage system access, permissions, and user accounts"
        iconColor="blue"
      />
      
      <div className={styles.actionsEnd}>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className={styles.primaryButton}
        >
          <UserPlus size={20} />
          Add New User
        </button>
      </div>

      <div className={styles.statsGrid}>
        {[
          { 
            title: 'Total Users', 
            count: users.length,
            icon: <Shield className={styles.iconAccent} size={24} />,
          },
          { 
            title: 'Active Users', 
            count: users.filter(user => user.status === 'Active').length,
            icon: <Activity className={styles.iconSuccess} size={24} />,
          },
          { 
            title: 'Administrators', 
            count: users.filter(user => user.role === 'admin').length,
            icon: <Key className={styles.iconAccent} size={24} />,
          }
        ].map((stat, index) => (
          <div 
            key={index} 
            className={styles.card}
          >
            <div className={styles.rowBetween}>
              <div>
                <p className={styles.muted}>{stat.title}</p>
                <h3 className={styles.statValue}>
                  {stat.count}
                </h3>
              </div>
              <div className={styles.iconCircle}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.searchField}>
          <Search className={styles.searchIcon} size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.cardFlush}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableRow}>
                <th className={styles.tableHeader}>User</th>
                <th className={styles.tableHeader}>Email</th>
                <th className={styles.tableHeader}>Role</th>
                <th className={styles.tableHeader}>Profile</th>
                <th className={styles.tableHeader}>Status</th>
                <th className={styles.tableHeader}>MFA</th>
                <th className={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr 
                  key={user.email} 
                  className={styles.tableRowInteractive}
                >
                  <td className={styles.tableCell}>
                    <div className={styles.row}>
                      <div className={styles.avatar}>
                      <span className={styles.itemTitle}>
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={styles.itemTitle}>
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>{user.email}</td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeAccent : ''}`}>
                      {user.role === 'admin' ? 'Administrator' : 'Member'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={styles.badge}>
                      {user.profile || 'Default'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={`${styles.badge} ${user.status === 'Active' ? styles.badgeSuccess : ''}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.stackCompact}>
                      <span className={`${styles.badge} ${user.mfa_enabled ? styles.badgeSuccess : ''}`}>
                        {user.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {user.mfa_enforced && (
                        <span className={styles.badgeWarning}>
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.actions}>
                      <button 
                        onClick={() => {
                          setCurrentUser(user);
                          setIsEditModalOpen(true);
                        }}
                        className={styles.iconButton}
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      {isAdmin && (
                        <>
                          {user.mfa_enforced ? (
                            <button 
                              onClick={() => handleEnforceMfa(user.email, false)}
                              className={styles.warningIconButton}
                              title="Remove MFA Requirement"
                            >
                              <Unlock size={18} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleEnforceMfa(user.email, true)}
                              className={styles.warningIconButton}
                              title="Require MFA Setup"
                            >
                              <Lock size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleResetMfa(user.email)}
                            className={styles.warningIconButton}
                            title="Reset/Clear MFA"
                          >
                            <Key size={18} />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDelete(user.email)}
                        className={styles.dangerIconButton}
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <UserModal 
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateUser}
          profiles={profiles}
        />
      )}

      {isEditModalOpen && currentUser && (
        <UserModal 
          isEdit={true} 
          user={currentUser} 
          onClose={() => {
            setIsEditModalOpen(false);
            setCurrentUser(null);
          }}
          onSubmit={handleUpdateUser}
          profiles={profiles}
        />
      )}
    </div>
  );
};

export default UserManagement;
