import styles from '../ui/SettingsSearchBar.module.css';
import formStyles from '../ui/Form.module.css';
import buttonStyles from '../ui/Button.module.css';
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";

/**
 * Flat index of settings destinations (top-level tabs and subtabs).
 * Used to jump via URL params: ?tab=…, &systemTab=…
 */
const SETTINGS_DESTINATIONS = [
  { section: "summary", label: "Summary", match: "summary overview" },
  { section: "recorders", label: "Recorders", match: "recorders channels devices" },
  {
    section: "keywords-tags",
    label: "Keyword tracking",
    match: "keywords tags tracking alerts",
  },
  { section: "user-management", label: "Users", match: "users accounts roles" },
  {
    section: "system",
    systemTab: "display-language",
    label: "System · Display & Language",
    match: "display language local time browser time format sort",
  },
  {
    section: "transcription-engine",
    label: "Transcriptions · Service settings",
    match: "transcription services api boondock whisper openai",
  },
  {
    section: "system",
    systemTab: "audio-post-processing",
    label: "System · Audio post processing",
    match: "audio post processing hallucination keywords",
  },
  {
    section: "system",
    systemTab: "api-keys",
    label: "System · API Keys",
    match: "api keys access tokens authentication",
  },
  {
    section: "system",
    systemTab: "interfaces",
    label: "System · Interfaces",
    match: "interfaces network ports",
  },
  {
    section: "system",
    systemTab: "hotspot-configuration",
    label: "System · WiFi",
    match: "hotspot wifi access point wlan",
  },
  {
    section: "system",
    systemTab: "maintenance",
    label: "System · Maintenance · Backup & restore",
    match: "backup restore s3 samba",
  },
  {
    section: "system",
    systemTab: "maintenance",
    label: "System · Maintenance",
    match: "maintenance updates reboot",
  },
  {
    section: "recorders",
    recorderTab: "health",
    label: "Recorders · Health",
    match: "health status diagnostics",
  },
  {
    section: "system",
    systemTab: "danger-zone",
    label: "System · Danger zone",
    match: "danger reset factory delete",
  },
  {
    section: "transcription-engine",
    label: "Transcriptions",
    match: "transcriptions queue logs whisper",
  },
  {
    section: "Logs",
    logsTab: "error",
    label: "Logs · Critical",
    match: "logs critical errors red alerts failures",
  },
  {
    section: "Logs",
    logsTab: "warning",
    label: "Logs · Warnings",
    match: "logs warnings yellow",
  },
  {
    section: "Logs",
    logsTab: "transcription",
    label: "Logs · Comms",
    match: "logs comms communications transcription messages",
  },
  {
    section: "Logs",
    logsTab: "database",
    label: "Logs · Database",
    match: "logs database sql",
  },
  {
    section: "Logs",
    logsTab: "event",
    label: "Logs · Events",
    match: "logs events purple calendar",
  },
  {
    section: "Logs",
    logsTab: "device",
    label: "Logs · Devices",
    match: "logs devices recorder com ports hardware",
  },
];

function splitJumpLabel(label) {
  const sep = " · ";
  const i = label.indexOf(sep);
  if (i === -1) return { group: null, title: label };
  return { group: label.slice(0, i), title: label.slice(i + sep.length) };
}

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function scoreMatch(query, entry) {
  const q = normalize(query);
  if (!q) return 0;
  const hay = `${entry.label} ${entry.match}`;
  if (hay.includes(q)) return 3;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const allWords = words.every((w) => hay.includes(w));
  return allWords ? 2 : 0;
}

export default function SettingsSearchBar({
  allowedSectionIds,
  setSearchParams,
  setIsSidebarOpen,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef(null);

  const allowed = useMemo(() => new Set(allowedSectionIds || []), [allowedSectionIds]);

  const visibleDestinations = useMemo(() => {
    return SETTINGS_DESTINATIONS.filter((e) => allowed.has(e.section));
  }, [allowed]);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) {
      return visibleDestinations;
    }
    return visibleDestinations
      .map((e) => ({ e, s: scoreMatch(q, e) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ e }) => e)
      .slice(0, 12);
  }, [query, visibleDestinations]);

  const go = useCallback(
    (entry) => {
      if (entry.globalTab) {
        setSearchParams({ tab: "global", globalTab: entry.globalTab });
      } else if (entry.systemTab) {
        setSearchParams({ tab: "system", systemTab: entry.systemTab });
      } else if (entry.recorderTab) {
        setSearchParams({ tab: "recorders", recorderTab: entry.recorderTab });
      } else if (entry.logsTab) {
        setSearchParams({ tab: "Logs", logsTab: entry.logsTab });
      } else {
        setSearchParams({ tab: entry.section });
      }
      setQuery("");
      setOpen(false);
      setIsSidebarOpen(false);
    },
    [setSearchParams, setIsSidebarOpen],
  );

  useEffect(() => {
    const onDoc = (ev) => {
      if (rootRef.current && !rootRef.current.contains(ev.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.field}>
        <span
          className={`material-symbols-outlined ${styles.searchIcon}`}
          aria-hidden
        >
          search
        </span>
        <label htmlFor="settings-jump-search" className={formStyles.label}>
          Search settings — find a page or tab
        </label>
        <input
          id="settings-jump-search"
          type="search"
          value={query}
          onChange={(ev) => {
            setQuery(ev.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              setOpen(false);
              ev.target.blur();
            }
            if (ev.key === "Enter" && results.length === 1) {
              ev.preventDefault();
              go(results[0]);
            }
          }}
          placeholder="search settings"
          className={`${formStyles.input} ${styles.input}`}
          aria-autocomplete="list"
          aria-controls="settings-jump-results"
          autoComplete="off"
        />
      </div>

      {open && results.length > 0 ? (
        <ul id="settings-jump-results" className={styles.results} role="listbox">
          <li>
            {normalize(query) ? "Matching" : "Go to"}
          </li>
          {results.map((entry) => {
            const { group, title } = splitJumpLabel(entry.label);
            return (
              <li key={`${entry.section}-${entry.globalTab || ""}-${entry.systemTab || ""}-${entry.recorderTab || ""}-${entry.logsTab || ""}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium} ${styles.resultButton}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => go(entry)}
                >
                  {group ? (
                    <span >
                      <span
                        className="mutedText smallText"
                      >
                        {group}
                      </span>
                      <span
                        className="mutedText smallText"
                      >
                        {title}
                      </span>
                    </span>
                  ) : (
                    <span
                      className="mutedText smallText"
                    >
                      {title}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && query && results.length === 0 ? (
        <div className={styles.empty}>
          No matches. Try a different word.
        </div>
      ) : null}
    </div>
  );
}
