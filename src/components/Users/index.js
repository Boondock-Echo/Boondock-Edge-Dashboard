import api from '../../utils/apiClient';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Search, UserPlus, Shield, Activity, Edit, Trash2, Lock, Unlock, X, Save, Key,Users } from 'lucide-react';
import SettingsSectionHeader from '../Settings/SettingsSectionHeader';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 transform transition-transform duration-300 ease-in-out">
      <div className={`${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
      } text-white px-6 py-4 rounded-lg shadow-lg flex items-center justify-between min-w-[300px]`}>
        <span>{message}</span>
        <button 
          onClick={onClose} 
          className="ml-4 hover:opacity-75 focus:outline-none"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

const UserModal = ({ isEdit = false, user = null, onClose, onSubmit, themeClasses, profiles = {} }) => {
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
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`${themeClasses.card} w-full max-w-md rounded-lg shadow-xl z-50 p-6`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-semibold ${themeClasses.text}`}>
            {isEdit ? 'Edit User' : 'Create New User'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${themeClasses.text} mb-2`}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              disabled={isEdit}
              required
              className={`w-full ${themeClasses.input} rounded-md shadow-sm p-2 ${themeClasses.text}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${themeClasses.text} mb-2`}>
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
              required
              className={`w-full ${themeClasses.input} rounded-md shadow-sm p-2 ${themeClasses.text}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${themeClasses.text} mb-2`}>
              Password {isEdit && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
              required={!isEdit}
              className={`w-full ${themeClasses.input} rounded-md shadow-sm p-2 ${themeClasses.text}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${themeClasses.text} mb-2`}>
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))}
              className={`w-full ${themeClasses.input} rounded-md shadow-sm p-2 ${themeClasses.text}`}
            >
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${themeClasses.text} mb-2`}>
              Profile
            </label>
            <select
              value={formData.profile || 'Default'}
              onChange={(e) => setFormData(prev => ({...prev, profile: e.target.value}))}
              className={`w-full ${themeClasses.input} rounded-md shadow-sm p-2 ${themeClasses.text}`}
            >
              {Object.keys(profiles).map(profileName => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-md border ${themeClasses.subText} hover:bg-gray-100`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Save size={18} className="mr-2" />
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = ({ isDarkMode = false }) => {
  const { user: currentAuthUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState(null);
  const isAdmin = currentAuthUser?.role === 'admin';

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
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

  const themeClasses = {
    background: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    subText: isDarkMode ? 'text-gray-400' : 'text-gray-500',
    tableHover: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    input: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
  };

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
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center text-gray-700">
          <div className="animate-spin mr-3">
            <Shield size={24} />
          </div>
          Loading Users...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <SettingsSectionHeader
        icon={Users}
        title="Users"
        description="Manage system access, permissions, and user accounts"
        isDarkMode={isDarkMode}
        iconColor="blue"
      />
      
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          <UserPlus size={20} />
          Add New User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { 
            title: 'Total Users', 
            count: users.length,
            icon: <Shield className="text-blue-500" size={24} />,
            bgColor: 'bg-blue-500/10'
          },
          { 
            title: 'Active Users', 
            count: users.filter(user => user.status === 'Active').length,
            icon: <Activity className="text-green-500" size={24} />,
            bgColor: 'bg-green-500/10'
          },
          { 
            title: 'Administrators', 
            count: users.filter(user => user.role === 'admin').length,
            icon: <Key className="text-purple-500" size={24} />,
            bgColor: 'bg-purple-500/10'
          }
        ].map((stat, index) => (
          <div 
            key={index} 
            className={`${themeClasses.card} rounded-lg border p-6`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={themeClasses.subText}>{stat.title}</p>
                <h3 className={`text-2xl font-bold ${themeClasses.text} mt-1`}>
                  {stat.count}
                </h3>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.subText}`} size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${themeClasses.input} pl-10 pr-4 py-2 rounded-md ${themeClasses.text}`}
          />
        </div>
      </div>

      <div className={`${themeClasses.card} rounded-lg border overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <th className={`text-left p-4 ${themeClasses.subText}`}>User</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>Email</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>Role</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>Profile</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>Status</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>MFA</th>
                <th className={`text-left p-4 ${themeClasses.subText}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr 
                  key={user.email} 
                  className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} ${themeClasses.tableHover}`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className={`${themeClasses.text} text-sm font-medium`}>
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={`${themeClasses.text} font-medium`}>
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className={`p-4 ${themeClasses.text}`}>{user.email}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                      }`}>
                      {user.role === 'admin' ? 'Administrator' : 'Member'}
                    </span>
                  </td>
                  <td className={`p-4 ${themeClasses.text}`}>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {user.profile || 'Default'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${user.status === 'Active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                      }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs
                        ${user.mfa_enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                        {user.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {user.mfa_enforced && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                          Required
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <button 
                        onClick={() => {
                          setCurrentUser(user);
                          setIsEditModalOpen(true);
                        }}
                        className={`${themeClasses.subText} hover:text-blue-500 transition-colors`}
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      {isAdmin && (
                        <>
                          {user.mfa_enforced ? (
                            <button 
                              onClick={() => handleEnforceMfa(user.email, false)}
                              className={`${themeClasses.subText} hover:text-yellow-500 transition-colors`}
                              title="Remove MFA Requirement"
                            >
                              <Unlock size={18} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleEnforceMfa(user.email, true)}
                              className={`${themeClasses.subText} hover:text-yellow-500 transition-colors`}
                              title="Require MFA Setup"
                            >
                              <Lock size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleResetMfa(user.email)}
                            className={`${themeClasses.subText} hover:text-orange-500 transition-colors`}
                            title="Reset/Clear MFA"
                          >
                            <Key size={18} />
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => handleDelete(user.email)}
                        className={`${themeClasses.subText} hover:text-red-500 transition-colors`}
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
          themeClasses={themeClasses}
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
          themeClasses={themeClasses}
          profiles={profiles}
        />
      )}
    </div>
  );
};

export default UserManagement;