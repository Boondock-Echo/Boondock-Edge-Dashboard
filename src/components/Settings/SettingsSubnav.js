import React from 'react';
import styles from '../ui/Page.module.css';

const join = (...values) => values.filter(Boolean).join(' ');

export function settingsSubnavTabClass(_isDarkMode, active, danger = false) {
  if (active) return danger ? styles.subnavTabDangerActive : styles.subnavTabActive;
  return danger ? styles.subnavTabDanger : styles.subnavTab;
}

export function SettingsSubnav({ 'aria-label': ariaLabel, className = '', embedded = false, children }) {
  return (
    <nav className={join(styles.subnav, embedded && styles.subnavEmbedded, className)} aria-label={ariaLabel}>
      {children}
    </nav>
  );
}

export function SettingsSubnavTab({ active, danger = false, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={join(styles.subnavTabBase, settingsSubnavTabClass(false, active, danger), className)}>
      {children}
    </button>
  );
}
