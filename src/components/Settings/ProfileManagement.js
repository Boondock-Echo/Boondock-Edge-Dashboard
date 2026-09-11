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

import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import modalStyles from '../ui/Modal.module.css';
import noticeStyles from '../ui/Notice.module.css';

const ProfileManagement = () => {
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


  if (loading) {
    return (
      <div className="row">
        <span className="spinner spinnerSmall" aria-hidden="true" />
      </div>
    );
  }

  const ProfileModal = ({ isOpen, onClose, onSubmit, isEdit }) => {
    const dialogRef = useRef(null);

    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (isOpen && !dialog.open) dialog.showModal();
      if (!isOpen && dialog.open) dialog.close();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <dialog ref={dialogRef} className={modalStyles.dialog} onCancel={(event) => { event.preventDefault(); onClose(); }}>
        <div className={modalStyles.body}>
          <div >
            <div className="rowBetween">
              <h2 className={cardStyles.title}>
                {isEdit ? 'Edit Profile' : 'Create New Profile'}
              </h2>
              <button
                onClick={onClose}
                className={`${buttonStyles.button} ${buttonStyles.ghost} ${buttonStyles.icon}`}
              >
                <X className="iconMedium" />
              </button>
            </div>

            <div className="stack">
              {!isEdit && (
                <div>
                  <label className={formStyles.label}>
                    Profile Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={formStyles.input}
                    placeholder="e.g., Manager, Viewer, etc."
                  />
                </div>
              )}

              <div>
                <label className={formStyles.label}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={formStyles.textarea}
                  rows="3"
                  placeholder="Describe this profile..."
                />
              </div>

              <div>
                <label className={formStyles.label}>
                  Features
                </label>
                <div className="scrollPanel">
                  {features.map((feature) => {
                    const Icon = getFeatureIcon(feature.key);
                    const isEnabled = formData.features[feature.key] || false;
                    return (
                      <div
                        key={feature.key}
                        className="rowBetween"
                      >
                        <div className="row">
                          <Icon className="iconMedium" />
                          <div>
                            <div >
                              {feature.label}
                            </div>
                            <div >
                              {feature.description}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleFeatureToggle(feature.key)}
                          className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
                        >
                          <div
                            className={cardStyles.card}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rowWrap">
                <button
                  onClick={onSubmit}
                  disabled={!isEdit && !formData.name.trim()}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  <Save className="iconSmall" />
                  {isEdit ? 'Update Profile' : 'Create Profile'}
                </button>
                <button
                  onClick={onClose}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    );
  };

  return (
    <div className="stack stackLarge">
      {toast && (
        <div className={`${noticeStyles.notice} ${toast.type === 'error' ? noticeStyles.error : noticeStyles.success}`}>
          <div className={noticeStyles.body}><p>{toast.message}</p></div>
        </div>
      )}

      <div className="stack stackLarge">
        <SettingsSectionHeader
          icon={Shield}
          title="Profiles"
          description="Create and manage user profiles with feature-based access control"
          iconColor="purple"
        />
        
        <div >
          <button
            onClick={() => {
              setFormData({ name: '', description: '', features: {} });
              fetchFeatures(true);
              isModalOpenRef.current = true;
              setIsCreateModalOpen(true);
            }}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}
          >
            <Plus className="iconMedium" />
            Create Profile
          </button>
        </div>

        <div className="gridThree">
          {Object.entries(profiles).map(([name, profile]) => {
            const enabledFeatures = Object.values(profile.features || {}).filter(Boolean).length;
            const totalFeatures = Object.keys(profile.features || {}).length;
            const isDefault = profile.isDefault || false;

            return (
              <div key={name} className={cardStyles.card}>
                <div className="row">
                  <div>
                    <h3 className={cardStyles.title}>
                      {name}
                      {isDefault && (
                        <span className="pill pillAccent">
                          Default
                        </span>
                      )}
                    </h3>
                    {profile.description && (
                      <p className="mutedText smallText">
                        {profile.description}
                      </p>
                    )}
                  </div>
                  {!isDefault && (
                    <div className="rowWrap">
                      <button
                        onClick={() => handleEdit(name)}
                        className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.icon}`}
                        title="Edit Profile"
                      >
                        <Edit className="iconSmall" />
                      </button>
                      <button
                        onClick={() => handleDelete(name)}
                        className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.icon}`}
                        title="Delete Profile"
                      >
                        <Trash2 className="iconSmall" />
                      </button>
                    </div>
                  )}
                </div>

                <div >
                  <div >
                    Features: {enabledFeatures} / {totalFeatures} enabled
                  </div>
                  <div className="stack">
                    {Object.entries(profile.features || {}).map(([key, enabled]) => {
                      const feature = features.find(f => f.key === key);
                      if (!feature) return null;
                      const Icon = getFeatureIcon(key);
                      return (
                        <div key={key} className="row">
                          {enabled ? (
                            <Check className="iconSmall" />
                          ) : (
                            <X className="iconSmall" />
                          )}
                          <Icon className="iconSmall" />
                          <span className={enabled ? '' : 'mutedText'}>
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
