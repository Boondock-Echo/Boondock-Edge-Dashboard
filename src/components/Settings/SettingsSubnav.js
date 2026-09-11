import React from 'react';
import styles from '../ui/Navigation.module.css';

const join = (...values) => values.filter(Boolean).join(' ');

export function settingsSubnavTabClass(active, danger = false) {
  if (active) return danger ? styles.dangerActive : styles.active;
  return danger ? styles.danger : styles.tab;
}

export function SettingsSubnav({ 'aria-label': ariaLabel, className = '', embedded = false, children }) {
  return (
    <nav className={join(styles.subnav, embedded && styles.embedded, className)} aria-label={ariaLabel}>
      {children}
    </nav>
  );
}

export function SettingsSubnavTab({ active, danger = false, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={join(styles.tab, settingsSubnavTabClass(false, active, danger), className)}>
      {children}
    </button>
  );
}
