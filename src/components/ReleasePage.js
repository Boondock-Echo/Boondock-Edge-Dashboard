import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/apiClient';
import {
  ArrowLeft,
  Tag,
  CalendarDays,
  GitBranch,
  Rocket,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  PackageOpen,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import ReleasePackageUpload from './Release/ReleasePackageUpload';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

const PALETTE = [
  { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30',   dot: 'bg-blue-400'   },
  { bg: 'bg-emerald-500/20',text: 'text-emerald-400',border: 'border-emerald-500/30',dot: 'bg-emerald-400' },
  { bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/30',  dot: 'bg-amber-400'  },
  { bg: 'bg-rose-500/20',   text: 'text-rose-400',   border: 'border-rose-500/30',   dot: 'bg-rose-400'   },
  { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   border: 'border-cyan-500/30',   dot: 'bg-cyan-400'   },
];

const palette = (i) => PALETTE[i % PALETTE.length];

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${className}`}>
    {children}
  </span>
);

const FeatureItem = ({ text, isDarkMode }) => (
  <li className="flex items-start gap-2.5 group">
    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${
      isDarkMode ? 'text-slate-600 group-hover:text-emerald-400' : 'text-gray-300 group-hover:text-emerald-500'
    }`} />
    <span className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
      {text}
    </span>
  </li>
);

const ReleaseCard = ({ release, index, isDarkMode, cardRef }) => {
  const color = palette(index);
  const isLatest = index === 0;

  return (
    <div
      ref={cardRef}
      id={`release-${index}`}
      className={`relative flex gap-6 pb-10 group`}
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div className={`
          relative z-10 w-10 h-10 rounded-full flex items-center justify-center
          border-2 shadow-lg transition-all duration-300
          ${isDarkMode
            ? `${color.bg} ${color.border} group-hover:scale-110`
            : `bg-white border-gray-200 group-hover:scale-110 shadow-sm`
          }
        `}>
          {isLatest
            ? <Rocket className={`w-4 h-4 ${isDarkMode ? color.text : 'text-violet-500'}`} />
            : <Tag className={`w-4 h-4 ${isDarkMode ? color.text : 'text-gray-400'}`} />
          }
        </div>
        {/* connector line rendered by parent */}
      </div>

      {/* Card */}
      <div className={`
        flex-1 rounded-xl border p-5 transition-all duration-300
        hover:shadow-xl hover:-translate-y-0.5
        ${isDarkMode
          ? 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
          : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
        }
      `}>
        {/* Card header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {isLatest && (
              <Badge className={`${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Latest
              </Badge>
            )}
            <h2 className={`text-lg font-semibold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
              {release.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {release.date && (
              <Badge className={isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}>
                <CalendarDays className="w-3 h-3" />
                {release.date}
              </Badge>
            )}
            {release.branch && (
              <Badge className={isDarkMode ? `${color.bg} ${color.text}` : 'bg-blue-50 text-blue-600'}>
                <GitBranch className="w-3 h-3" />
                {release.branch}
              </Badge>
            )}
          </div>
        </div>

        {/* Sections */}
        {release.sections.map((section, si) => (
          <div key={si} className="mb-4 last:mb-0">
            {section.heading && (
              <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${
                isDarkMode ? 'text-slate-500' : 'text-gray-400'
              }`}>
                {section.heading}
              </p>
            )}
            {section.items.length > 0 && (
              <ul className="space-y-2">
                {section.items.map((item, ii) => (
                  <FeatureItem key={ii} text={item} isDarkMode={isDarkMode} />
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* Empty state for a release with no sections */}
        {release.sections.length === 0 && (
          <p className={`text-sm italic ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            No details recorded for this release.
          </p>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */

const ReleasePage = ({ isDarkMode: isDarkModeProp }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isDarkMode, setIsDarkMode] = useState(() =>
    isDarkModeProp !== undefined
      ? isDarkModeProp
      : JSON.parse(localStorage.getItem('isDarkMode')) || false
  );

  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef([]);

  useEffect(() => {
    const onStorage = () => setIsDarkMode(JSON.parse(localStorage.getItem('isDarkMode')) || false);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/release-notes`);
      setReleases(data.releases || []);
    } catch (err) {
      setError('Could not load release notes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, []);

  /* Track which card is in view for sidebar highlight */
  useEffect(() => {
    if (!cardRefs.current.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [releases]);

  const scrollToCard = (index) => {
    cardRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── render ── */
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950' : 'bg-gray-50'}`}>

      {/* ── Sticky Header ── */}
      <header className={`
        sticky top-0 z-20 border-b backdrop-blur-sm
        ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-gray-200'}
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-md transition-all ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className={`w-9 h-9 rounded-md flex items-center justify-center ${
              isDarkMode ? 'bg-violet-600/20' : 'bg-violet-50'
            }`}>
              <PackageOpen className={`w-5 h-5 ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`} />
            </div>

            <div>
              <h1 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                Release Notes
              </h1>
              {releases.length > 0 && (
                <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  {releases.length} release{releases.length !== 1 ? 's' : ''} · latest: {releases[0]?.title}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotes}
              className={`p-2 rounded-md transition-all ${
                isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              } ${loading ? 'animate-spin opacity-50 pointer-events-none' : ''}`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {['Dashboard', 'Settings'].map((label) => (
                <button
                  key={label}
                  onClick={() => navigate(label === 'Dashboard' ? '/' : '/settings')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isDarkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">

        {/* ── Sidebar index ── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className={`sticky top-24 rounded-xl border p-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100 shadow-sm'
          }`}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${
              isDarkMode ? 'text-slate-500' : 'text-gray-400'
            }`}>Releases</p>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-8 rounded-md animate-pulse ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`} />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {releases.map((r, i) => {
                  const color = palette(i);
                  const isActive = activeIndex === i;
                  return (
                    <li key={i}>
                      <button
                        onClick={() => scrollToCard(i)}
                        className={`
                          w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs
                          transition-all duration-200
                          ${isActive
                            ? isDarkMode
                              ? `${color.bg} ${color.text} font-medium`
                              : 'bg-violet-50 text-violet-700 font-medium'
                            : isDarkMode
                              ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                          }
                        `}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isActive ? (isDarkMode ? color.dot : 'bg-violet-500') : (isDarkMode ? 'bg-slate-600' : 'bg-gray-300')
                        }`} />
                        <span className="truncate">{r.title}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Timeline ── */}
        <main className="flex-1 min-w-0">
          {user && <ReleasePackageUpload isDarkMode={isDarkMode} />}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className={`w-10 h-10 rounded-full border-2 border-t-violet-400 animate-spin ${
                isDarkMode ? 'border-slate-700' : 'border-gray-200'
              }`} />
              <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                Loading release notes…
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className={`rounded-xl border p-8 text-center ${
              isDarkMode ? 'bg-red-950/30 border-red-900/40 text-red-400' : 'bg-red-50 border-red-100 text-red-600'
            }`}>
              <p className="font-medium mb-2">{error}</p>
              <button
                onClick={fetchNotes}
                className={`text-sm underline underline-offset-2 ${
                  isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'
                }`}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && releases.length === 0 && (
            <div className={`rounded-xl border p-12 text-center ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'
            }`}>
              <PackageOpen className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-gray-300'}`} />
              <p className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                No releases recorded yet.
              </p>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                Run <code className="font-mono">release.bat</code> to create your first release entry.
              </p>
            </div>
          )}

          {/* Timeline cards */}
          {!loading && !error && releases.length > 0 && (
            <div className="relative">
              {/* Vertical spine line */}
              <div className={`absolute left-5 top-5 bottom-0 w-px ${
                isDarkMode ? 'bg-slate-800' : 'bg-gray-200'
              }`} />

              {releases.map((release, i) => (
                <ReleaseCard
                  key={i}
                  release={release}
                  index={i}
                  isDarkMode={isDarkMode}
                  cardRef={(el) => (cardRefs.current[i] = el)}
                />
              ))}

              {/* End cap */}
              <div className="flex items-center gap-4 pl-1 pt-2">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-gray-300'}`} />
                </div>
                <p className={`text-xs italic ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                  Beginning of release history
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReleasePage;
