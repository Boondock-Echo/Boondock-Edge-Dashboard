import React from "react";
import Button from '../ui/Button';
import styles from '../ui/Sidebar.module.css';

const SidebarHeader = ({ isMobile, closeSidebar }) => {
  return (
    <div className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.brand}>
          <h1 className={styles.title}>
            Boondock Edge
          </h1>
          <p className={styles.subtitle}>
            Recordings &amp; live feed
          </p>
        </div>
        {isMobile && closeSidebar ? (
          <Button
            type="button"
            onClick={closeSidebar}
            variant="ghost"
            size="icon"
            aria-label="Close sidebar"
          >
            <span className="material-symbols-outlined">close</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default SidebarHeader;
