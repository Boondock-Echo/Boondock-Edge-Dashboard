import styles from '../ui/ThemeSelector.module.css';
import buttonStyles from '../ui/Button.module.css';
import React from 'react';
import { Palette } from 'lucide-react';

const ThemeSelector = ({ onThemeSelect, }) => {
  const themes = [
    {
      name: 'Police',
      colors: { primary: '#003087', secondary: '#1E90FF', accent: '#FFD700' },
      font: 'roboto',
      description: 'Traditional law enforcement colors'
    },
    {
      name: 'Fire Service',
      colors: { primary: '#8B0000', secondary: '#FF4500', accent: '#FFD700' },
      font: 'poppins',
      description: 'Bold firefighter-inspired tones'
    },
    {
      name: 'EMS',
      colors: { primary: '#006400', secondary: '#98FB98', accent: '#FF0000' },
      font: 'opensans',
      description: 'Emergency medical service palette'
    },
    {
      name: 'Ambulance',
      colors: { primary: '#FFFFFF', secondary: '#FF0000', accent: '#0000FF' },
      font: 'inter',
      description: 'High-visibility ambulance colors'
    },
    {
      name: 'HAM Radio',
      colors: { primary: '#2F4F4F', secondary: '#708090', accent: '#FF8C00' },
      font: 'roboto',
      description: 'Amateur radio community tones'
    },
    {
      name: 'Dispatch',
      colors: { primary: '#191970', secondary: '#4682B4', accent: '#00CED1' },
      font: 'poppins',
      description: 'Control center inspired hues'
    },
    {
      name: 'Search & Rescue',
      colors: { primary: '#FF4500', secondary: '#228B22', accent: '#FFFF00' },
      font: 'inter',
      description: 'High-visibility SAR colors'
    },
    {
      name: 'Coast Guard',
      colors: { primary: '#000080', secondary: '#FF4500', accent: '#FFFFFF' },
      font: 'opensans',
      description: 'Maritime rescue palette'
    },
    {
      name: 'Emergency Management',
      colors: { primary: '#4B0082', secondary: '#9400D3', accent: '#FFD700' },
      font: 'roboto',
      description: 'Command center aesthetics'
    },
    {
      name: 'CB Radio',
      colors: { primary: '#654321', secondary: '#DAA520', accent: '#8B4513' },
      font: 'poppins',
      description: 'Classic citizens band radio feel'
    }
  ];

  const handleThemeSelect = (theme) => {
    onThemeSelect({
      brand_colors: theme.colors,
      font: theme.font
    });
  };

  return (
    <div >
      <h3 className="pageTitle">
        <Palette  />
         Themes
      </h3>
      <div className="gridThree">
        {themes.map((theme) => (
          <button
            key={theme.name}
            onClick={() => handleThemeSelect(theme)}
            className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium} ${styles.themeButton}`}
          >
            <div className="stack stackCompact">
              {/* Theme Name */}
              <div className="rowBetween">
                <span className="mutedText smallText">{theme.name}</span>
                <div className={styles.accentDot} style={{ backgroundColor: theme.colors.accent }} />
              </div>

              {/* Color Swatches */}
              <div className={styles.swatches}>
                <div
                  className={styles.swatch}
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderColor: 'var(--ui-border)'
                  }}
                />
                <div
                  className={styles.swatch}
                  style={{
                    backgroundColor: theme.colors.secondary,
                    borderColor: 'var(--ui-border)'
                  }}
                />
                <div
                  className={styles.swatch}
                  style={{
                    backgroundColor: theme.colors.accent,
                    borderColor: 'var(--ui-border)'
                  }}
                />
              </div>

              {/* Font Preview */}
              <div style={{ fontFamily: theme.font }}>
                {theme.font}
              </div>

              {/* Description */}
              <div>
                {theme.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSelector;