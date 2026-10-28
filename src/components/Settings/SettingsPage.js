import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SummarySection from './SummarySection';
import TranscriptionEngine from './TranscriptionEngine';
import KeywordsAndTagsSection from './KeywordsAndTagsSection';
import ChannelsAndStationsSection from './ChannelsAndStationsSection';
import UserManagementSection from './UserManagementSection';
import SystemSection from './SystemSection';
import F1TerminalLogs from '../Logs/F1TerminalLogs';
import ReleasePage from '../ReleasePage';
import VersionPage from '../Version/VersionPage';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import CommandCenterShell from '../layout/CommandCenterShell';
import SidebarFooter from '../Dashboard/SidebarFooter';
import SettingsSearchBar from './SettingsSearchBar';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import noticeStyles from '../ui/Notice.module.css';
import navStyles from '../ui/Navigation.module.css';

const SETTINGS_NAV_ICONS = {
  summary: 'dashboard',
  recorders: 'mic_none',
  'keywords-tags': 'key',
  'user-management': 'group',
  system: 'dns',
  'transcription-engine': 'record_voice_over',
  Logs: 'history_edu',
  release: 'description',
  version: 'system_update',
};

const SETTINGS_SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'recorders', label: 'Recorders' },
  { id: 'keywords-tags', label: 'Keyword tracking' },
  { id: 'user-management', label: 'Users' },
  { id: 'system', label: 'System' },
  { id: 'transcription-engine', label: 'Transcriptions' },
  { id: 'Logs', label: 'Logs' },
  // { id: 'release', label: 'Release Notes' },
  // { id: 'version', label: 'Software Update', adminOnly: true },
];

const LEGACY_TAB_MAP = {
  channel: 'recorders',
  frequency: 'recorders',
  'channels-stations': 'recorders',
  keywords: 'keywords-tags',
  tag: 'keywords-tags',
  user: 'user-management',
  profiles: 'user-management',
};

const SettingsPage = () => {
  const { user: authValue } = useAuth();
  const user = authValue?.user ?? authValue ?? null;
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const canAccessSettings = user?.role === 'admin' || hasPermission('access_settings');
  const sidebarItems = useMemo(
    () => SETTINGS_SECTIONS.filter((item) => !item.adminOnly || user?.role === 'admin'),
    [user?.role],
  );

  const requestedTab = searchParams.get('tab');
  const normalizedTab = LEGACY_TAB_MAP[requestedTab] || requestedTab;
  const activeSection = sidebarItems.some((item) => item.id === normalizedTab)
    ? normalizedTab
    : 'summary';

  useEffect(() => {
    if (!canAccessSettings) return;

    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (requestedTab === 'hallucination') {
      nextParams.set('tab', 'system');
      nextParams.set('systemTab', 'audio-post-processing');
      changed = true;
    } else if (requestedTab === 'backup-restore') {
      nextParams.set('tab', 'system');
      nextParams.set('systemTab', 'maintenance');
      changed = true;
    } else if (requestedTab === 'hotspot') {
      nextParams.set('tab', 'system');
      nextParams.set('systemTab', 'hotspot-configuration');
      changed = true;
    } else if (requestedTab === 'display-language') {
      // Display/time/inbox preferences now live in the inbox UI.
      nextParams.set('tab', 'system');
      nextParams.set('systemTab', 'hotspot-configuration');
      changed = true;
    } else if (nextParams.get('tab') !== activeSection) {
      nextParams.set('tab', activeSection);
      changed = true;
    }

    if (changed) setSearchParams(nextParams, { replace: true });
  }, [activeSection, canAccessSettings, requestedTab, searchParams, setSearchParams]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) {
    return <div className="screenCenter"><span className="spinner spinnerLarge" /></div>;
  }

  if (!canAccessSettings) {
    return (
      <div className="screenCenter">
        <div className={cardStyles.card}>
          <div className={`${noticeStyles.notice} ${noticeStyles.error}`}>
            <div className={noticeStyles.body}>
              <p><strong>Access denied</strong></p>
              <p>You do not have permission to access settings.</p>
            </div>
          </div>
          <div className="actionsEnd">
            <Button onClick={() => navigate('/')} variant="primary">Go to dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const navigateTo = (section) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', section);
    if (section === 'system' && !next.get('systemTab')) {
      next.set('systemTab', 'hotspot-configuration');
    }
    setSearchParams(next);
    setIsSidebarOpen(false);
  };

  return (
    <CommandCenterShell
      productName="Back to Dashboard"
      showBackToDashboardButton
      sidebarOpen={isSidebarOpen}
      setSidebarOpen={setIsSidebarOpen}
      areaTitle=""
      headerCenter={(
        <SettingsSearchBar
          allowedSectionIds={sidebarItems.map((item) => item.id)}
          setSearchParams={setSearchParams}
          setIsSidebarOpen={setIsSidebarOpen}
        />
      )}
      showHeaderSearch={false}
      showHeaderUserGuide={false}
      showHeaderSettingsButton={false}
      showHeaderProfile={false}
      sidebar={(
        <div className="columnFill">
          <div className="grow scrollY">
            <div className="sidebarSection">
              <h2 className="sidebarTitle">Settings</h2>
              <p className="sidebarSubtitle">Edge server configuration</p>
            </div>
            <nav className={navStyles.vertical} aria-label="Settings sections">
              {sidebarItems.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`${navStyles.verticalItem} ${active ? navStyles.verticalActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`material-symbols-outlined ${navStyles.verticalIcon}`}>
                      {SETTINGS_NAV_ICONS[item.id] || 'chevron_right'}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <SidebarFooter />
        </div>
      )}
    >
      <div className="contentWide">
        {activeSection === 'summary' ? <SummarySection /> : null}
        {activeSection === 'transcription-engine' ? <TranscriptionEngine /> : null}
        {activeSection === 'recorders' ? <ChannelsAndStationsSection /> : null}
        {activeSection === 'keywords-tags' ? <KeywordsAndTagsSection /> : null}
        {activeSection === 'user-management' ? <UserManagementSection /> : null}
        {activeSection === 'system' ? <SystemSection /> : null}
        {activeSection === 'Logs' ? <F1TerminalLogs syncLogsTabToUrl /> : null}
        {activeSection === 'release' ? <ReleasePage embedded /> : null}
        {activeSection === 'version' ? <VersionPage embedded /> : null}
      </div>
    </CommandCenterShell>
  );
};

export default SettingsPage;
