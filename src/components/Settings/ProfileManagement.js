import { apiFetch } from '../../utils/apiClient';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Check,
  Settings as SettingsIcon,
  Mail,
  FileText,
  Eye,
  Pencil,
  Play,
  Trash,
  Music
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import SettingsSectionHeader from './SettingsSectionHeader';

const ProfileManagement = ({ isDarkMode }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState({});
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    features: {}
  });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Track if a modal is open to prevent refetching from causing re-renders
  const isModalOpenRef = useRef(false);

  const fetchProfiles = useCallback(async () => {
    // Skip fetch if modal is open to prevent losing focus
    if (isModalOpenRef.current) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch profiles');
      const data = await response.json();
      setProfiles(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchFeatures = useCallback(async (initializeForm = false) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/profiles/features`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      setFeatures(data);
      
      // Initialize form features only when explicitly requested
      if (initializeForm) {
        const initialFeatures = {};
        data.forEach(f => {
          initialFeatures[f.key] = false;
        });
        setFormData(prev => ({ ...prev, features: initialFeatures }));
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  useEffect(() => {
    fetchProfiles();
    fetchFeatures();
  }, [fetchProfiles, fetchFeatures]);

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      showToast('Profile created successfully');
      isModalOpenRef.current = false;
      setIsCreateModalOpen(false);
      setFormData({ name: '', description: '', features: {} });
      fetchProfiles();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/profiles/${currentProfile}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: formData.description,
          features: formData.features
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      showToast('Profile updated successfully');
      isModalOpenRef.current = false;
      setIsEditModalOpen(false);
      setCurrentProfile(null);
      setFormData({ name: '', description: '', features: {} });
      fetchProfiles();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDelete = async (profileName) => {
    if (!window.confirm(`Are you sure you want to delete the profile "${profileName}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/profiles/${profileName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete profile');
      }

      showToast('Profile deleted successfully');
      fetchProfiles();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEdit = (profileName) => {
    const profile = profiles[profileName];
    setCurrentProfile(profileName);
    setFormData({
      name: profileName,
      description: profile.description || '',
      features: { ...profile.features }
    });
    isModalOpenRef.current = true;
    setIsEditModalOpen(true);
  };

  const handleFeatureToggle = (featureKey) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: !prev.features[featureKey]
      }
    }));
  };

  const getFeatureIcon = (key) => {
    const icons = {
      'access_settings': SettingsIcon,
      'inbox': Mail,
      'create_reports': FileText,
      'view_reports': Eye,
      'modify_reports': Pencil,
      'play_audio': Play,
      'delete_audio': Trash,
      'access_advanced_player': Music
    };
    return icons[key] || SettingsIcon;
  };

  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    textSecondary: isDarkMode ? 'text-gray-400' : 'text-gray-600',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    button: isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
    buttonDanger: isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const ProfileModal = ({ isOpen, onClose, onSubmit, isEdit }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className={`${themeClasses.card} rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border`}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-semibold ${themeClasses.text}`}>
                {isEdit ? 'Edit Profile' : 'Create New Profile'}
              </h2>
              <button
                onClick={onClose}
                className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${themeClasses.textSecondary}`} />
              </button>
            </div>

            <div className="space-y-4">
              {!isEdit && (
                <div>
                  <label className={`block ${themeClasses.textSecondary} mb-2`}>
                    Profile Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`${themeClasses.input} w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="e.g., Manager, Viewer, etc."
                  />
                </div>
              )}

              <div>
                <label className={`block ${themeClasses.textSecondary} mb-2`}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={`${themeClasses.input} w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  rows="3"
                  placeholder="Describe this profile..."
                />
              </div>

              <div>
                <label className={`block ${themeClasses.textSecondary} mb-3`}>
                  Features
                </label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {features.map((feature) => {
                    const Icon = getFeatureIcon(feature.key);
                    const isEnabled = formData.features[feature.key] || false;
                    return (
                      <div
                        key={feature.key}
                        className={`${themeClasses.card} border rounded-lg p-3 flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Icon className={`w-5 h-5 ${isEnabled ? 'text-blue-500' : themeClasses.textSecondary}`} />
                          <div>
                            <div className={`font-medium ${themeClasses.text}`}>
                              {feature.label}
                            </div>
                            <div className={`text-sm ${themeClasses.textSecondary}`}>
                              {feature.description}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleFeatureToggle(feature.key)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            isEnabled
                              ? 'bg-blue-600'
                              : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-white transition-transform ${
                              isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onSubmit}
                  disabled={!isEdit && !formData.name.trim()}
                  className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Profile' : 'Create Profile'}
                </button>
                <button
                  onClick={onClose}
                  className={`${themeClasses.card} ${themeClasses.text} px-4 py-2 rounded-lg border transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg ${
          toast.type === 'success' 
            ? (isDarkMode ? 'bg-green-900/20 border-green-600 text-green-400' : 'bg-green-100 border-green-400 text-green-700')
            : (isDarkMode ? 'bg-red-900/20 border-red-600 text-red-400' : 'bg-red-100 border-red-400 text-red-700')
        } border`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <SettingsSectionHeader
          icon={Shield}
          title="Profiles"
          description="Create and manage user profiles with feature-based access control"
          isDarkMode={isDarkMode}
          iconColor="purple"
        />
        
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              setFormData({ name: '', description: '', features: {} });
              fetchFeatures(true);
              isModalOpenRef.current = true;
              setIsCreateModalOpen(true);
            }}
            className={`${themeClasses.button} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors`}
          >
            <Plus className="w-5 h-5" />
            Create Profile
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(profiles).map(([name, profile]) => {
            const enabledFeatures = Object.values(profile.features || {}).filter(Boolean).length;
            const totalFeatures = Object.keys(profile.features || {}).length;
            const isDefault = profile.isDefault || false;

            return (
              <div key={name} className={`${themeClasses.card} border rounded-lg p-6`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className={`text-xl font-semibold ${themeClasses.text} flex items-center gap-2`}>
                      {name}
                      {isDefault && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                          Default
                        </span>
                      )}
                    </h3>
                    {profile.description && (
                      <p className={`${themeClasses.textSecondary} text-sm mt-1`}>
                        {profile.description}
                      </p>
                    )}
                  </div>
                  {!isDefault && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(name)}
                        className={`p-2 ${themeClasses.textSecondary} hover:text-blue-500 transition-colors`}
                        title="Edit Profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(name)}
                        className={`p-2 ${themeClasses.textSecondary} hover:text-red-500 transition-colors`}
                        title="Delete Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className={`text-sm ${themeClasses.textSecondary} mb-2`}>
                    Features: {enabledFeatures} / {totalFeatures} enabled
                  </div>
                  <div className="space-y-1">
                    {Object.entries(profile.features || {}).map(([key, enabled]) => {
                      const feature = features.find(f => f.key === key);
                      if (!feature) return null;
                      const Icon = getFeatureIcon(key);
                      return (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          {enabled ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-gray-400" />
                          )}
                          <Icon className={`w-4 h-4 ${enabled ? 'text-blue-500' : themeClasses.textSecondary}`} />
                          <span className={enabled ? themeClasses.text : themeClasses.textSecondary}>
                            {feature.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ProfileModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          isModalOpenRef.current = false;
          setIsCreateModalOpen(false);
          setFormData({ name: '', description: '', features: {} });
        }}
        onSubmit={handleCreate}
        isEdit={false}
      />

      <ProfileModal
        isOpen={isEditModalOpen}
        onClose={() => {
          isModalOpenRef.current = false;
          setIsEditModalOpen(false);
          setCurrentProfile(null);
          setFormData({ name: '', description: '', features: {} });
        }}
        onSubmit={handleUpdate}
        isEdit={true}
      />
    </div>
  );
};

export default ProfileManagement;

