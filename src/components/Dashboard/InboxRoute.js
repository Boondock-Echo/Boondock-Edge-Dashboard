import React from 'react';
import { InboxProvider, useInboxLayout, useInboxPreferences } from '../InboxContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import FooterPagination from './FooterPagination';
import FullscreenMessages from './FullscreenMessages';
import NotificationBanner from './NotificationBanner';
import InboxLiveNotifications from './InboxLiveNotifications';
import InboxMfaReminder from './InboxMfaReminder';
import Button from '../ui/Button';
import styles from '../ui/LiveCommunications.module.css';

const InboxLayout = () => {
  const {
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    isFullscreen,
  } = useInboxLayout();
  const { inboxViewMode } = useInboxPreferences();

  return (
    <div className={styles.shell}>
      {isMobile && !isFullscreen && (
        <div className={styles.mobileHeader}>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              setIsSidebarOpen((open) => !open);
            }}
            variant="ghost"
            size="icon"
            type="button"
            aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="material-symbols-outlined">
              {isSidebarOpen ? 'close' : 'menu'}
            </span>
          </Button>
          <div className={styles.headerSpacer} />
        </div>
      )}

      <div
        className={`${styles.sidebarRail}${isSidebarOpen ? ` ${styles.sidebarRailOpen}` : ''}${isFullscreen ? ` ${styles.sidebarHidden}` : ''}`}
      >
        <Sidebar />
      </div>

      <div className={`${styles.workspace}${isFullscreen ? '' : ` ${styles.workspaceWithSidebar}`}`}>
        <main id="dashboard-main" className={styles.main} aria-label="Live dashboard">
          <a href="#dashboard-feed" className={styles.skipLink}>Skip to messages</a>

          {!isFullscreen && <TopBar />}

          <NotificationBanner />

          <div id="dashboard-feed" className={styles.feed}>
            <FullscreenMessages />
            {inboxViewMode === 'pagination' && <FooterPagination />}
          </div>
        </main>
      </div>

      {isMobile && isSidebarOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <InboxMfaReminder />
      <InboxLiveNotifications />
    </div>
  );
};

const InboxRoute = () => (
  <InboxProvider>
    <InboxLayout />
  </InboxProvider>
);

export default InboxRoute;
