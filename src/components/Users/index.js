import api from '../../utils/apiClient';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Search, UserPlus, Shield, Activity, Edit, Trash2, Lock, Unlock, X, Save, Key, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import modalStyles from '../ui/Modal.module.css';
import tableStyles from '../ui/Table.module.css';
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

  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className={modalStyles.dialog} onCancel={onClose}>
      <div className={modalStyles.header}>
        <h2 className={modalStyles.title}>
          {isEdit ? 'Edit User' : 'Create New User'}
        </h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close user editor">
          <X size={20} />
        </Button>
      </div>

      <div className={modalStyles.body}>
        <form onSubmit={handleSubmit} className={formStyles.form}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              disabled={isEdit}
              required
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              required
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label}>
              Password {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
              required={!isEdit}
              className={formStyles.input}
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label}>Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))}
              className={formStyles.select}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label}>Profile</label>
            <select
              value={formData.profile || 'Default'}
              onChange={(e) => setFormData(prev => ({...prev, profile: e.target.value}))}
              className={formStyles.select}
            >
              {Object.keys(profiles).map(profileName => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>

          <div className={modalStyles.actions}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">
              <Save size={18} />
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
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
      <div className="centeredContent">
        <div className="row">
          <span className="spinner" role="status" aria-label="Loading users" />
          Loading Users...
        </div>
      </div>
    );
  }

  return (
    <div className="stack stackLarge">
      <SettingsSectionHeader
        icon={Users}
        title="Users"
        description="Manage system access, permissions, and user accounts"
        iconColor="blue"
      />
      
      <div className="actionsEnd">
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <UserPlus size={20} />
          Add New User
        </Button>
      </div>

      <div className="gridThree">
        {[
          { 
            title: 'Total Users', 
            count: users.length,
            icon: <Shield  size={24} />,
          },
          { 
            title: 'Active Users', 
            count: users.filter(user => user.status === 'Active').length,
            icon: <Activity  size={24} />,
          },
          { 
            title: 'Administrators', 
            count: users.filter(user => user.role === 'admin').length,
            icon: <Key  size={24} />,
          }
        ].map((stat, index) => (
          <div 
            key={index} 
            className={cardStyles.card}
          >
            <div className="rowBetween">
              <div>
                <p className={cardStyles.description}>{stat.title}</p>
                <h3 >
                  {stat.count}
                </h3>
              </div>
              <div className="avatar">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div >
        <div className={formStyles.inputFrame}>
          <Search className={formStyles.inputIcon} size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={formStyles.iconInput}
          />
        </div>
      </div>

      <div className={`${cardStyles.card} ${cardStyles.flush}`}>
        <div className={tableStyles.scroll}>
          <table className={tableStyles.table}>
            <thead>
              <tr className={tableStyles.row}>
                <th className={tableStyles.header}>User</th>
                <th className={tableStyles.header}>Email</th>
                <th className={tableStyles.header}>Role</th>
                <th className={tableStyles.header}>Profile</th>
                <th className={tableStyles.header}>Status</th>
                <th className={tableStyles.header}>MFA</th>
                <th className={tableStyles.header}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr 
                  key={user.email} 
                  className={tableStyles.rowInteractive}
                >
                  <td className={tableStyles.cell}>
                    <div className="row">
                      <div className="avatar">
                      <span >
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span >
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className={tableStyles.cell}>{user.email}</td>
                  <td className={tableStyles.cell}>
                    <span className={`pill ${user.role === 'admin' ? 'pillAccent' : ''}`}>
                      {user.role === 'admin' ? 'Administrator' : 'Member'}
                    </span>
                  </td>
                  <td className={tableStyles.cell}>
                    <span className="pill">
                      {user.profile || 'Default'}
                    </span>
                  </td>
                  <td className={tableStyles.cell}>
                    <span className={`pill ${user.status === 'Active' ? 'pillSuccess' : ''}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="stack stackCompact">
                      <span className={`pill ${user.mfa_enabled ? 'pillSuccess' : ''}`}>
                        {user.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {user.mfa_enforced && (
                        <span className="pill pillWarning">
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="rowWrap">
                      <Button
                        onClick={() => {
                          setCurrentUser(user);
                          setIsEditModalOpen(true);
                        }}
                        variant="ghost" size="icon"
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </Button>
                      {isAdmin && (
                        <>
                          {user.mfa_enforced ? (
                            <Button
                              onClick={() => handleEnforceMfa(user.email, false)}
                              variant="warning" size="icon"
                              title="Remove MFA Requirement"
                            >
                              <Unlock size={18} />
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleEnforceMfa(user.email, true)}
                              variant="warning" size="icon"
                              title="Require MFA Setup"
                            >
                              <Lock size={18} />
                            </Button>
                          )}
                          <Button
                            onClick={() => handleResetMfa(user.email)}
                            variant="warning" size="icon"
                            title="Reset/Clear MFA"
                          >
                            <Key size={18} />
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => handleDelete(user.email)}
                        variant="danger" size="icon"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </Button>
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
