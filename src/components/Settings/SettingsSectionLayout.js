import React from 'react';
import styles from '../ui/Page.module.css';

export function settingsMainCardClass() {
  return styles.card;
}

export function SettingsPageHero({ title, description, icon, trailing = null }) {
  return (
    <header className={styles.pageHero}>
      <div className={styles.rowBetweenStart}>
        <div className={styles.row}>
          <div className={`${styles.sectionHeaderIcon} ${styles.accentTile}`}>{icon}</div>
          <div className={styles.grow}>
            <h1 className={styles.heroTitle}>{title}</h1>
            <p className={styles.subtitle}>{description}</p>
          </div>
        </div>
        {trailing ? <div className={styles.noShrink}>{trailing}</div> : null}
      </div>
    </header>
  );
}

export function SettingsSectionWidth({ children }) {
  return <div className={styles.settingsWidth}>{children}</div>;
}
