import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { usePermissions } from "../hooks/usePermissions";

/**
 * App-wide chrome inspired by Material / MD3 command-center layouts:
 * fixed top bar, fixed sidebar below the bar, scrollable main region.
 */
export default function CommandCenterShell({
  isDarkMode,
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

  const headerBg = isDarkMode
    ? "bg-slate-900 border-slate-800"
    : "bg-slate-50 border-slate-200/80";
  const sidebarBg = isDarkMode
    ? "bg-slate-950 border-slate-800"
    : "bg-slate-100 border-slate-200/60";
  const mainBg = isDarkMode ? "bg-slate-950" : "bg-surface";

  const initial = (user?.username || user?.name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className={`min-h-screen ${mainBg} text-on-surface`}>
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-transparent px-4 shadow-none md:px-6 ${headerBg}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            className={`rounded-full p-2 transition-colors lg:hidden ${isDarkMode ? "text-blue-400 hover:bg-slate-800" : "text-blue-900 hover:bg-slate-200/50"}`}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[22px]">
              {sidebarOpen ? "close" : "menu"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className={
              showBackToDashboardButton
                ? `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    isDarkMode
                      ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                      : "bg-slate-200/70 text-slate-900 hover:bg-slate-300/70"
                  }`
                : `truncate text-left text-lg font-extrabold tracking-tight ${isDarkMode ? "text-blue-400" : "text-blue-900"}`
            }
            title={showBackToDashboardButton ? "Back to dashboard" : productName}
          >
            {showBackToDashboardButton ? (
              <span className="material-symbols-outlined text-[18px] leading-none">
                arrow_back
              </span>
            ) : null}
            {productName}
          </button>
        </div>

        {headerCenter ? (
          <div className="flex min-w-0 flex-1 justify-end px-2 md:px-6">{headerCenter}</div>
        ) : showHeaderSearch ? (
          <div className="hidden max-w-sm flex-1 px-6 md:block">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline">
                search
              </span>
              <input
                readOnly
                placeholder="Search settings…"
                className={`h-10 w-full rounded-xl border-0 py-2 pl-10 pr-4 text-sm outline-none ring-1 ring-transparent transition-shadow focus:ring-2 focus:ring-primary ${
                  isDarkMode
                    ? "bg-slate-800/80 text-slate-100 placeholder:text-slate-500"
                    : "bg-white text-slate-800 placeholder:text-slate-400 shadow-sm"
                }`}
              />
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 md:block" aria-hidden />
        )}

        {(showHeaderUserGuide || (canAccessSettings && showHeaderSettingsButton) || showHeaderProfile) ? (
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {showHeaderUserGuide && (
              <button
                type="button"
                title="User guide"
                onClick={() => navigate("/user-guide")}
                className={`rounded-full p-2 transition-colors ${isDarkMode ? "text-blue-400 hover:bg-slate-800" : "text-blue-900 hover:bg-slate-200/50"}`}
              >
                <span className="material-symbols-outlined text-[22px]">help</span>
              </button>
            )}
            {canAccessSettings && showHeaderSettingsButton && (
              <button
                type="button"
                title="Settings"
                onClick={() => navigate("/settings")}
                className={`rounded-full p-2 transition-colors ${isDarkMode ? "text-blue-400 hover:bg-slate-800" : "text-blue-900 hover:bg-slate-200/50"}`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  settings
                </span>
              </button>
            )}
            {showHeaderProfile && (
              <button
                type="button"
                title="Profile"
                onClick={() => navigate("/profile")}
                className={`ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-sm font-bold text-on-primary-container bg-primary-container`}
              >
                {initial}
              </button>
            )}
          </div>
        ) : (
          <div className="w-0 flex-shrink-0 sm:w-0" aria-hidden />
        )}
      </header>

      <div className="flex min-h-screen pt-16">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-64 flex-col overflow-hidden border-r-0 py-4 shadow-none transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarBg} ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </aside>

        <main
          className={`min-h-[calc(100vh-4rem)] flex-1 overflow-y-auto p-6 md:p-10 lg:ml-64 ${mainBg}`}
        >
          {areaTitle ? (
            <div className="mb-8 hidden lg:block">
              <p
                className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}
              >
                {areaTitle}
              </p>
              {areaSubtitle ? (
                <p
                  className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                >
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
