export function SettingsPageHero({ title, description, icon, trailing = null }) {
  return (
    <header className="pageHeader">
      <div className="rowBetweenStart">
        <div className="row">
          <div className="iconTile iconTileAccent">{icon}</div>
          <div className="grow">
            <h1 className="pageTitle">{title}</h1>
            <p className="pageSubtitle">{description}</p>
          </div>
        </div>
        {trailing ? <div className="noShrink">{trailing}</div> : null}
      </div>
    </header>
  );
}

export function SettingsSectionWidth({ children }) {
  return <div className="settingsWidth">{children}</div>;
}
