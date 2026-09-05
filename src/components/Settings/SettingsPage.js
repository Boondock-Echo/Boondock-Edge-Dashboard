import React, { useEffect, useState, useCallback, useRef } from "react";
import api from '../../utils/apiClient';
import { useNavigate, useSearchParams } from "react-router-dom";
import SummarySection from "./SummarySection";
import TranscriptionEngine from "./TranscriptionEngine";
import KeywordsAndTagsSection from "./KeywordsAndTagsSection";
import HallucinationsSection from "./HallucinationsSection";
import ChannelsAndStationsSection from "./ChannelsAndStationsSection";
import UserManagementSection from "./UserManagementSection";
import SystemSection from "./SystemSection";
import F1TerminalLogs from '../Logs/F1TerminalLogs';
import ReportsComponent from './ReportsManagement';
import ScannerTable from './ScannerTabel';
import RecorderDevices from './RecorderDevices';
import AudioLevelVisualizer from './AudioLevelVisualizer';
import BackupProgressModal from './BackupProgressModal';
import InlineDocumentation from '../Documentation/InlineDocumentation';
import InteractiveUserGuide from '../Documentation/InteractiveUserGuide';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from "../AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import logger from "../../utils/logger";
import CommandCenterShell from "../layout/CommandCenterShell";
import SidebarFooter from "../Dashboard/SidebarFooter";
import SettingsSearchBar from "./SettingsSearchBar";

const SETTINGS_NAV_ICONS = {
  summary: "dashboard",
  recorders: "mic_none",
  "keywords-tags": "key",
  "user-management": "group",
  system: "dns",
  "transcription-engine": "record_voice_over",
  Logs: "history_edu",
};

const SettingsPage = ({ isDarkMode, timezone, timeFormat, setTimeFormat, reverseSort, setReverseSort, onSettingsChange = () => {} }) => {
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeSection, setActiveSection] = useState('summary');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    global_target_language: "english",
    global_model: "medium.en",
    global_hallucination: true,
    global_transcribe_method: "local",
    global_transcribe_node: false,
    global_transcription_api_key: "",
    global_enable_uniden_scanners: false,
    global_enable_edge_devices: true,
    global_enable_usb_audio_devices: false,
    global_enable_s3_upload: false,
    s3_endpoint_url: "",
    s3_access_key: "",
    s3_secret_key: "",
    s3_region: "us-east-1",
    s3_bucket_name: "",
    s3_backup_time: "03:00",
    // Samba / network share backup
    samba_backup_enabled: false,
    samba_share_path: "",
    samba_username: "",
    samba_password: ""
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toastIdRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const saveTimeoutRef = useRef({}); // Track debounce timers per field
  const lastSavedValueRef = useRef({}); // Track last saved value per field to avoid unnecessary saves

  const { logout, user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  // Define all sidebar items
  const allSidebarItems = [
    { id: 'summary', label: 'Summary' },
    { id: 'recorders', label: 'Recorders' },
    { id: 'keywords-tags', label: 'Keyword tracking' },
    { id: 'user-management', label: 'Users' },
    { id: 'system', label: 'System' },
    { id: 'transcription-engine', label: 'Transcriptions' },
    { id: 'Logs', label: 'Logs' },
  ];

  // Filter sidebar items based on permissions
  const sidebarItems = (() => {
    // If userRole is still loading, show all items by default (they'll be filtered later)
    // This prevents the menu from appearing empty while permissions load
    if (userRole === null || permissionsLoading) {
      return allSidebarItems;
    }
    // Admin always sees all items
    if (userRole === 'admin') {
      return allSidebarItems;
    }
    // For non-admins, filter based on access_settings permission
    if (!hasPermission('access_settings')) {
      return [];
    }
    // If has access_settings, show all items
    return allSidebarItems;
  })();

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await api.get(`/users/${user.username}`);
        setUserRole(response.data[user.username]?.role || 'member'); // Default to member if role not found
      } catch (error) {
        logger.error('Error fetching user role:', error);
        setUserRole('member'); // Default to member on error
      }
    };
    if (user?.username) {
      fetchUserRole();
    }
  }, [user?.username]);

  // Redirect if user doesn't have access_settings permission
  useEffect(() => {
    if (!permissionsLoading && userRole !== null && userRole !== 'admin') {
      if (!hasPermission('access_settings')) {
        navigate('/');
      }
    }
  }, [permissionsLoading, userRole, hasPermission, navigate]);

  // Handle URL parameters and set default active section
  useEffect(() => {
    // Don't process if userRole is still loading
    if (userRole === null) {
      return;
    }
    let tabFromUrl = searchParams.get('tab');
    logger.debug('URL tab parameter:', tabFromUrl);
    logger.debug('Current user role:', userRole);
    logger.debug('Available sidebar items:', sidebarItems.map(item => item.id));
    // Handle legacy URL redirects
    if (tabFromUrl === 'channel' || tabFromUrl === 'frequency' || tabFromUrl === 'channels-stations') {
      tabFromUrl = 'recorders';
      setSearchParams({ tab: 'recorders' });
    } else if (tabFromUrl === 'keywords' || tabFromUrl === 'tag') {
      tabFromUrl = 'keywords-tags';
      setSearchParams({ tab: 'keywords-tags' });
    } else if (tabFromUrl === 'user' || tabFromUrl === 'profiles') {
      tabFromUrl = 'user-management';
      setSearchParams({ tab: 'user-management' });
    } else if (tabFromUrl === 'hallucination') {
      tabFromUrl = 'system';
      setSearchParams({ tab: 'system', systemTab: 'audio-post-processing' });
    } else if (tabFromUrl === 'backup-restore' ||
               tabFromUrl === 'interfaces' || tabFromUrl === 'danger') {
      // Map old section IDs to global tab IDs
      let systemTab = 'display-language';
      if (tabFromUrl === 'backup-restore') {
        systemTab = 'maintenance';
      } else if (tabFromUrl === 'interfaces') {
        systemTab = 'interfaces';
      } else if (tabFromUrl === 'danger') {
        systemTab = 'danger-zone';
      }
      tabFromUrl = 'system';
      setSearchParams({ tab: 'system', systemTab });
    } else if (tabFromUrl === 'hotspot-configuration' || tabFromUrl === 'hotspot') {
      tabFromUrl = 'system';
      setSearchParams({ tab: 'system', systemTab: 'hotspot-configuration' });
    }
    if (tabFromUrl) {
      // Check if the tab is valid for the current user role
      const isValidTab = sidebarItems.some(item => item.id === tabFromUrl);
      logger.debug('Is valid tab:', isValidTab);
      if (isValidTab) {
        setActiveSection(tabFromUrl);
        return;
      }
    }
    // If no valid tab in URL, set default based on user role
    if (userRole === 'member') {
      setActiveSection('summary');
      // Update URL to reflect the default tab
      setSearchParams({ tab: 'summary' });
    } else {
      // For non-members, default to summary if no tab specified
      if (!tabFromUrl) {
        setSearchParams({ tab: 'summary' });
      }
    }
  }, [userRole, searchParams, setSearchParams, sidebarItems]);

  // Handle resize for mobile-to-desktop transition
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  const showToast = useCallback((message, type = 'success') => {
    // Prevent multiple rapid calls
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    // Dismiss any existing toast safely
    if (toastIdRef.current) {
      try {
        toast.dismiss(toastIdRef.current);
      } catch (error) {
        logger.error('Error dismissing existing toast:', error);
      }
      toastIdRef.current = null;
    }

    toastTimeoutRef.current = setTimeout(() => {
      const toastOptions = {
        position: 'top-right',
        autoClose: 8000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: isDarkMode ? "dark" : "light",
        onClose: () => {
          // Safely clear the reference
          toastIdRef.current = null;
        },
        onOpen: () => {
          // Ensure we have a valid toast ID
          if (!toastIdRef.current) {
            toastIdRef.current = null;
          }
        }
      };
      try {
        const toastId = type === 'success'
        ? toast.success(message, toastOptions)
        : toast.error(message, toastOptions);
        // Only set the ID if the toast was created successfully
        if (toastId) {
          toastIdRef.current = toastId;
        }
      } catch (error) {
        logger.error('Toast error:', error);
        toastIdRef.current = null;
      }
    }, 100);
  }, [isDarkMode]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      if (toastIdRef.current) {
        try {
          toast.dismiss(toastIdRef.current);
        } catch (error) {
          logger.error('Error dismissing toast:', error);
        }
        toastIdRef.current = null;
      }
    };
  }, []);

  const handleGlobalChange = useCallback((fieldOrUpdates, value, showNotification = true) => {
    const updates = typeof fieldOrUpdates === 'string'
      ? { [fieldOrUpdates]: value }
      : fieldOrUpdates;

    const fields = Object.keys(updates);
    const saveKey = [...fields].sort().join('|');

    setGlobalSettings((previous) => ({ ...previous, ...updates }));
    // Cancel pending saves that touch any of these fields so the latest state wins.
    Object.entries(saveTimeoutRef.current).forEach(([key, timeout]) => {
      if (key.split('|').some((field) => fields.includes(field))) {
        clearTimeout(timeout);
        delete saveTimeoutRef.current[key];
      }
    });

    saveTimeoutRef.current[saveKey] = setTimeout(async () => {
      try {
        if (fields.every((field) => lastSavedValueRef.current[field] === updates[field])) return;
        await api.put(`/settings`, updates);
        fields.forEach((field) => {
          lastSavedValueRef.current[field] = updates[field];
        });
        delete saveTimeoutRef.current[saveKey];
        if (fields.includes('global_show_duplicate_files')) onSettingsChange();
        if (showNotification) showToast('Settings updated successfully!');
      } catch (error) {
        logger.error('Error updating settings:', error);
        showToast('Error updating settings!', 'error');
      }
    }, 1000);
  }, [onSettingsChange, showToast]);

  const fetchSettings = async () => {
    try {
      const response = await api.get(`/settings`);
      const settingsData = response.data;
      setGlobalSettings({
        global_target_language: settingsData.global_target_language ?? "english",
        global_model: settingsData.global_model ?? "base.en",
        global_transcribe_method: settingsData.global_transcribe_method ?? "local",
        global_transcription_api_key: settingsData.global_transcription_api_key ?? "",
        global_transcribe_node: settingsData.global_transcribe_node ?? true,
        global_hallucination: settingsData.global_hallucination ?? true,
        global_timezone: settingsData.global_timezone ?? "UTC",
        global_enable_uniden_scanners: settingsData.global_enable_uniden_scanners ?? false,
        global_enable_edge_devices: settingsData.global_enable_edge_devices ?? true,
        global_enable_usb_audio_devices: settingsData.global_enable_usb_audio_devices ?? false,
        global_enable_s3_upload: settingsData.global_enable_s3_upload ?? false,
        s3_endpoint_url: settingsData.s3_endpoint_url ?? "",
        // Masked keys from backend show as '***', convert to empty string for password fields
        s3_access_key: (settingsData.s3_access_key && settingsData.s3_access_key !== '***') ? settingsData.s3_access_key : "",
        s3_secret_key: (settingsData.s3_secret_key && settingsData.s3_secret_key !== '***') ? settingsData.s3_secret_key : "",
        s3_region: settingsData.s3_region ?? "us-east-1",
        s3_bucket_name: settingsData.s3_bucket_name ?? "",
        s3_backup_time: settingsData.s3_backup_time ?? "03:00",
        // Samba / network share backup
        samba_backup_enabled: settingsData.samba_backup_enabled ?? false,
        samba_share_path: settingsData.samba_share_path ?? "",
        samba_username: settingsData.samba_username ?? "",
        // Keep '***' as-is when password is masked from backend (will display as ****** in UI)
        samba_password: settingsData.samba_password ?? "",
        // Duplicate file visibility
        global_show_duplicate_files: settingsData.global_show_duplicate_files ?? false,
        // Inbox view settings
        global_inbox_view_mode: settingsData.global_inbox_view_mode ?? "pagination",
        global_inbox_records_per_page: settingsData.global_inbox_records_per_page ?? 10,
      });
      setKeywords(Array.isArray(settingsData.keywords) ? settingsData.keywords : []);
    } catch (error) {
      logger.error('Error fetching settings:', error);
      showToast('Error loading settings!', 'error');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchSettings();
      } catch (error) {
        logger.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeSection]);

  const handleAddKeyword = async () => {
    const keyword = newKeyword.trim();
    if (!keyword) return;
    try {
      const response = await api.post(`/settings/keywords`, { keyword });
      setKeywords(response.data?.keywords || [...keywords, keyword]);
      setNewKeyword('');
      showToast('Keyword added successfully!');
    } catch (error) {
      logger.error('Error adding keyword:', error);
      showToast(error.response?.data?.error || 'Error adding keyword!', 'error');
    }
  };

  const handleRemoveKeyword = async (keyword) => {
    try {
      const response = await api.delete(`/settings/keywords/${keyword}`);
      setKeywords(response.data?.keywords || keywords.filter(k => k !== keyword));
      showToast('Keyword removed successfully!');
    } catch (error) {
      logger.error('Error removing keyword:', error);
      showToast(error.response?.data?.error || 'Error removing keyword!', 'error');
    }
  };

  // Helper function to navigate to a specific tab
  const navigateToTab = (tabId) => {
    setActiveSection(tabId);
    if (tabId === "system") {
      const st = searchParams.get("systemTab") || "hotspot-configuration";
      setSearchParams({ tab: "system", systemTab: st });
    } else {
      setSearchParams({ tab: tabId });
    }
  };
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  // Show loading while permissions are being fetched
  if (permissionsLoading || userRole === null) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  // Check if user has access (admin or has access_settings permission)
  if (userRole !== 'admin' && !hasPermission('access_settings')) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl p-8 max-w-md w-full mx-4 text-center`}>
          <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Access Denied
          </h2>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
            You don't have permission to access settings. Please contact your administrator.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <CommandCenterShell
      isDarkMode={isDarkMode}
      productName="Back to Dashboard"
      showBackToDashboardButton
      sidebarOpen={isSidebarOpen}
      setSidebarOpen={setIsSidebarOpen}
      areaTitle=""
      headerCenter={
        <SettingsSearchBar
          isDarkMode={isDarkMode}
          allowedSectionIds={sidebarItems.map((i) => i.id)}
          setSearchParams={setSearchParams}
          setIsSidebarOpen={setIsSidebarOpen}
        />
      }
      showHeaderSearch={false}
      showHeaderUserGuide={false}
      showHeaderSettingsButton={false}
      showHeaderProfile={false}
      sidebar={(
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-6 px-6">
              <h2 className={`font-headline text-lg font-semibold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-on-surface'}`}>
                Settings
              </h2>
              <p className={`mt-0.5 text-sm ${isDarkMode ? 'text-slate-400' : 'text-on-surface-variant'}`}>
                Edge server configuration
              </p>
            </div>
            <nav className="space-y-0.5 px-3" aria-label="Settings sections">
            {sidebarItems.map((item) => {
              const sym = SETTINGS_NAV_ICONS[item.id] || "chevron_right";
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    if (item.id === "system") {
                      const st = searchParams.get("systemTab") || "hotspot-configuration";
                      setSearchParams({ tab: "system", systemTab: st });
                    } else {
                      setSearchParams({ tab: item.id });
                    }
                    setIsSidebarOpen(false);
                  }}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? isDarkMode
                        ? "bg-slate-800 text-blue-200"
                        : "bg-surface-container-low text-primary"
                      : isDarkMode
                        ? "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] leading-none opacity-90">{sym}</span>
                  {item.label}
                </button>
              );
            })}
            </nav>
          </div>
          <SidebarFooter isDarkMode={isDarkMode} />
        </div>
      )}
    >
      <div className="max-w-[1600px]">
            {activeSection === 'summary' && (
              <SummarySection
                isDarkMode={isDarkMode}
                timezone={timezone}
                globalSettings={globalSettings}
                handleGlobalChange={handleGlobalChange}
              />
            )}
            {activeSection === 'transcription-engine' && (
              <TranscriptionEngine
                isDarkMode={isDarkMode}
                globalSettings={globalSettings}
                handleGlobalChange={handleGlobalChange}
              />
            )}
            {activeSection === 'recorders' && (
              <ChannelsAndStationsSection
                isDarkMode={isDarkMode}
                recordersEnabled={globalSettings.global_enable_edge_devices}
                globalSettings={globalSettings}
              />
            )}
            {activeSection === 'hallucination' && (
              <HallucinationsSection
                keywords={keywords}
                newKeyword={newKeyword}
                setNewKeyword={setNewKeyword}
                handleAddKeyword={handleAddKeyword}
                handleRemoveKeyword={handleRemoveKeyword}
                globalSettings={globalSettings}
                handleGlobalChange={handleGlobalChange}
                isDarkMode={isDarkMode}
              />
            )}
            {activeSection === 'keywords-tags' && (
              <KeywordsAndTagsSection
                keywords={keywords}
                newKeyword={newKeyword}
                setNewKeyword={setNewKeyword}
                handleAddKeyword={handleAddKeyword}
                handleRemoveKeyword={handleRemoveKeyword}
                isDarkMode={isDarkMode}
              />
            )}
            {activeSection === 'user-management' && (
              <UserManagementSection
                isDarkMode={isDarkMode}
              />
            )}
            {activeSection === 'system' && (
              <SystemSection
                isDarkMode={isDarkMode}
                showToast={showToast}
                globalSettings={globalSettings}
                handleGlobalChange={handleGlobalChange}
                timezone={timezone}
                timeFormat={timeFormat}
                setTimeFormat={setTimeFormat}
                reverseSort={reverseSort}
                setReverseSort={setReverseSort}
                user={user}
                handleBackupNow={() => setShowBackupModal(true)}
                keywords={keywords}
                newKeyword={newKeyword}
                setNewKeyword={setNewKeyword}
                handleAddKeyword={handleAddKeyword}
                handleRemoveKeyword={handleRemoveKeyword}
              />
            )}
            {activeSection === 'scanner' && (
              <ScannerTable isDarkMode={isDarkMode} />
            )}
            {/* {activeSection === 'reports' && (
              <ReportsComponent isDarkMode={isDarkMode} />
            )} */}
            {activeSection === 'audio' && (
              <AudioLevelVisualizer isDarkMode={isDarkMode} />
            )}
            {activeSection === 'Logs' && (
              <F1TerminalLogs isDarkMode={isDarkMode} syncLogsTabToUrl />
            )}
      </div>
      </CommandCenterShell>
      <BackupProgressModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        isDarkMode={isDarkMode}
        globalSettings={globalSettings}
      />
    </>
  );
};

export default SettingsPage;
