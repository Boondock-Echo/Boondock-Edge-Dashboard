import React from 'react';
import cardStyles from '../ui/Card.module.css';

const iconVariants = {
  blue: 'iconTileAccent',
  purple: 'iconTileAccent',
  green: 'iconTileSuccess',
  red: 'iconTileDanger',
  orange: 'iconTileWarning',
  gray: 'iconTileMuted',
};

const SettingsSectionHeader = ({ icon: Icon, title, description, iconColor = 'blue' }) => (
  <header className={cardStyles.header}>
    <div className={`iconTile ${iconVariants[iconColor] || 'iconTileAccent'}`}>
      <Icon size={18} />
    </div>
    <div className="grow">
      <h2 className={cardStyles.title}>{title}</h2>
      <p className={cardStyles.description}>{description}</p>
    </div>
  </header>
);

export default SettingsSectionHeader;
