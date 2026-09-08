import React from 'react';
import styles from '../ui/Page.module.css';

const iconVariants = {
  blue: styles.accentTile,
  purple: styles.accentTile,
  green: styles.successTile,
  red: styles.dangerTile,
  orange: styles.warningTile,
  gray: styles.mutedTile,
};

const SettingsSectionHeader = ({ icon: Icon, title, description, iconColor = 'blue' }) => (
  <header className={styles.sectionHeader}>
    <div className={`${styles.sectionHeaderIcon} ${iconVariants[iconColor] || styles.accentTile}`}>
      <Icon size={18} />
    </div>
    <div className={styles.grow}>
      <h2 className={styles.cardTitleCompact}>{title}</h2>
      <p className={styles.subtitle}>{description}</p>
    </div>
  </header>
);

export default SettingsSectionHeader;