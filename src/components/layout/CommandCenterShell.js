import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import Button from "../ui/Button";
import formStyles from "../ui/Form.module.css";
import styles from "../ui/CommandCenterShell.module.css";

/**
 * App-wide chrome inspired by Material / MD3 command-center layouts:
 * fixed top bar, fixed sidebar below the bar, scrollable main region.
 */
export default function CommandCenterShell({
  sidebar,
  sidebarOpen,
  setSidebarOpen,
  areaTitle = "Command Center",
  areaSubtitle = "",
  productName = "Boondock Edge",
  showBackToDashboardButton = false,
  children,
  /** Replaces the default center search when set (e.g. settings jump search). */
  headerCenter = null,
  showHeaderSearch = true,
  showHeaderUserGuide = true,
  showHeaderSettingsButton = true,
  showHeaderProfile = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canAccessSettings =
    user?.role === "admin" || hasPermission("access_settings");

  const initial = (user?.username || user?.name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <span className="material-symbols-outlined">
              {sidebarOpen ? "close" : "menu"}
            </span>
          </Button>
          <Button
            variant={showBackToDashboardButton ? "secondary" : "ghost"}
            size="small"
            onClick={() => navigate("/")}
            title={showBackToDashboardButton ? "Back to dashboard" : productName}
          >
            {showBackToDashboardButton ? (
              <span className="material-symbols-outlined">
                arrow_back
              </span>
            ) : null}
            {productName}
          </Button>
        </div>

        {headerCenter ? (
          <div className={styles.headerSearch}>{headerCenter}</div>
        ) : showHeaderSearch ? (
          <div className={styles.headerSearch}>
            <div className={formStyles.inputFrame}>
              <span className={`material-symbols-outlined ${formStyles.inputIcon}`}>
                search
              </span>
              <input
                readOnly
                placeholder="Search settings…"
                className={formStyles.iconInput}
              />
            </div>
          </div>
        ) : (
          <div className={styles.headerSearch} aria-hidden />
        )}

        {(showHeaderUserGuide || (canAccessSettings && showHeaderSettingsButton) || showHeaderProfile) ? (
          <div className={styles.headerActions}>
            {showHeaderUserGuide && (
              <Button
                variant="ghost"
                size="icon"
                title="User guide"
                aria-label="User guide"
                onClick={() => navigate("/user-guide")}
              >
                <span className="material-symbols-outlined">help</span>
              </Button>
            )}
            {canAccessSettings && showHeaderSettingsButton && (
              <Button
                variant="ghost"
                size="icon"
                title="Settings"
                aria-label="Settings"
                onClick={() => navigate("/settings")}
              >
                <span className="material-symbols-outlined">
                  settings
                </span>
              </Button>
            )}
            {showHeaderProfile && (
              <button
                type="button"
                title="Profile"
                onClick={() => navigate("/profile")}
                className={styles.profile}
              >
                {initial}
              </button>
            )}
          </div>
        ) : (
          <div aria-hidden />
        )}
      </header>

      <div className={styles.content}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className={styles.overlay}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        >
          {sidebar}
        </aside>

        <main
          className={styles.main}
        >
          {areaTitle ? (
            <div className={styles.areaHeader}>
              <p className={styles.areaTitle}>
                {areaTitle}
              </p>
              {areaSubtitle ? (
                <p className={styles.areaSubtitle}>
                  {areaSubtitle}
                </p>
              ) : null}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
