import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import api from '../utils/apiClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sun, Moon, Eye, EyeOff, ArrowRight } from 'lucide-react';

const VERSION = process.env.REACT_APP_VERSION || 'v1.4.0';
const BUILD_DATE = process.env.REACT_APP_BUILD_DATE || 'MAR 16, 2026';
const REMEMBER_KEY = 'boondock_login_remember';
const USERNAME_KEY = 'boondock_login_username';

/** Default Edge logo when `/branding` returns no custom logo (`public/boondock-edge-logo.png`) */
const DEFAULT_EDGE_LOGO = `${process.env.PUBLIC_URL || ''}/boondock-edge-logo.png`;

/** Hero art — left column (`public/login-hero-art.png`), intrinsic 753×1024 px */
const LOGIN_HERO_ART = `${process.env.PUBLIC_URL || ''}/art2.jpg`;

/** Edge device product line — sign-in panel header */
const EDGE_BRAND = {
  eyebrow: 'Edge Device',
  title: 'Boondock Edge',
  subtitle: 'Secure access to your on-site console and authorized recordings.',
};

/** Defaults aligned with docs/branding — API `/branding` overrides when present */
const BRAND = {
  action: 'var(--ui-accent)',
  secondary: 'var(--ui-accent)',
  structureGray: 'var(--ui-panel)',
};

const LoginPage = ({ isDarkMode, toggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [branding, setBranding] = useState({
    organizationName: '',
    tagline: '',
    brandColors: {
      accent: BRAND.action,
      primary: BRAND.secondary,
      secondary: BRAND.structureGray,
    },
    font: 'Inter',
    assets: { logo: null, favicon: null, loader: null }
  });
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const brandingFetchedRef = useRef(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(REMEMBER_KEY) === '1') {
        setRememberDevice(true);
        const saved = localStorage.getItem(USERNAME_KEY);
        if (saved) setUsername(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (brandingFetchedRef.current) return;
    let isMounted = true;
    const fetchBrandingData = async () => {
      try {
        const { data } = await api.get('/branding');
        if (isMounted) {
          setBranding({
            organizationName: data.organization_name ?? '',
            tagline: data.tagline ?? '',
            brandColors: {
              accent: data.brand_colors?.accent || BRAND.action,
              primary: data.brand_colors?.primary || BRAND.secondary,
              secondary: data.brand_colors?.secondary || BRAND.structureGray,
            },
            font: data.font || 'Inter',
            assets: {
              logo: data.assets?.logo ? `data:image/jpeg;base64,${data.assets.logo}` : null,
              favicon: data.assets?.favicon ? `data:image/x-icon;base64,${data.assets.favicon}` : null,
              loader: data.assets?.loader ? `data:image/gif;base64,${data.assets.loader}` : null
            }
          });
          setBrandingLoaded(true);
          brandingFetchedRef.current = true;
        }
      } catch (e) {
        console.error('Error fetching branding data:', e);
        if (isMounted) {
          setBrandingLoaded(true);
          brandingFetchedRef.current = true;
        }
      }
    };
    fetchBrandingData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!brandingLoaded) return;
    const name = branding.organizationName?.trim();
    document.title = name ? `${name} — Sign in` : 'Sign in';
  }, [brandingLoaded, branding.organizationName]);

  const faviconSetRef = useRef(false);
  const faviconUrlRef = useRef(null);
  useEffect(() => {
    const currentFavicon = branding.assets.favicon;
    if (brandingLoaded && currentFavicon &&
        (!faviconSetRef.current || faviconUrlRef.current !== currentFavicon)) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = currentFavicon;
      document.getElementsByTagName('head')[0].appendChild(link);
      faviconSetRef.current = true;
      faviconUrlRef.current = currentFavicon;
    }
  }, [brandingLoaded, branding.assets.favicon]);

  const persistRemember = useCallback(() => {
    try {
      if (rememberDevice) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(USERNAME_KEY, username.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(USERNAME_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [rememberDevice, username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        email: username,
        password,
        totp_code: mfaRequired ? totpCode : undefined,
      });
      persistRemember();
      // TO-DO Pass user not fields
      login({
        username: data.user.email,
        token: data.token,
        name: data.user.name,
        role: data.user.role
      });
      if (data.show_mfa_reminder) {
        sessionStorage.removeItem('mfa_reminder_dismissed');
      }
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.mfa_required) {
        setMfaRequired(true);
        setError('Please enter your MFA code');
      } else if (err.response) {
        setError(data?.error || 'Invalid Credentials');
        setMfaRequired(false);
        setTotpCode('');
      } else {
        setError('Network error. Please try again.');
        console.error('Login error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Authentication chrome always follows the device palette. Organization
  // branding remains available for logos and names, but cannot reduce the
  // contrast of controls or text.
  const actionColor = 'var(--ui-accent)';

  if (!brandingLoaded) {
    return (
      <div
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background text-on-surface"
        style={{ fontFamily: `${branding.font}, Inter, system-ui, sans-serif` }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--ui-border-rgb) / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ui-border-rgb) / 0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-5 px-6">
          <div
            className="h-12 w-12 rounded-full border-[3px] border-t-transparent border-white/18 animate-spin"
            style={{ borderLeftColor: actionColor, borderRightColor: actionColor }}
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/38">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <main
      className={`flex min-h-[100dvh] flex-col overflow-hidden bg-background font-body text-on-surface lg:h-[100dvh] lg:max-h-[100dvh] lg:flex-row ${isDarkMode ? 'dark' : ''}`}
      style={{
        fontFamily: `${branding.font}, Inter, system-ui, sans-serif`,
        '--login-action': actionColor,
      }}
    >
      {/* Mobile / tablet */}
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface px-4 py-3.5 lg:hidden"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.07] backdrop-blur-sm"
            style={{
              boxShadow: '0 0 0 2px rgb(var(--ui-border-rgb) / 0.7), inset 0 -3px 0 0 var(--ui-accent)',
            }}
          >
            {branding.assets.logo ? (
              <img src={branding.assets.logo} alt="" className="h-12 w-12 object-contain" />
            ) : (
              <img src={DEFAULT_EDGE_LOGO} alt="" className="h-[2.75rem] w-[2.75rem] object-contain" />
            )}
          </div>
          {branding.organizationName?.trim() ? (
            <div className="min-w-0">
              <p className="truncate font-headline text-sm font-semibold text-white">{branding.organizationName}</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="shrink-0 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/18"
          aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>

      {/* Left: hero art — width follows intrinsic 753:1024 vs viewport height (cap 50vw); mobile strip matches aspect */}
      <section
        className="relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-background lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0 lg:w-[min(50vw,calc(100dvh*753/1024))] lg:flex-none"
        aria-hidden
      >
        <img
          src={LOGIN_HERO_ART}
          alt=""
          width={753}
          height={1024}
          className="h-auto w-full max-h-[min(52dvh,calc(100vw*1024/753))] object-contain object-center lg:h-full lg:max-h-none lg:w-full lg:object-cover lg:object-center"
          draggable={false}
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-10 bg-gradient-to-l from-black/25 to-transparent lg:block" />
      </section>

      {/* Right: loginnew.html-style panel — white canvas, centered max-w-md, absolute theme toggle */}
      <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border-outline bg-surface text-on-surface lg:h-full lg:min-h-0 lg:min-w-0 lg:border-l">
        {!isDarkMode ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            aria-hidden
            style={{
              boxShadow: 'inset 0 0 80px -20px rgb(var(--ui-accent-rgb) / 0.15)',
            }}
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden
            style={{
              background: 'radial-gradient(ellipse at top left, rgb(var(--ui-accent-rgb) / 0.08) 0%, transparent 55%)',
            }}
          />
        )}

        <nav
          className="absolute right-0 top-0 z-20 hidden items-center p-8 lg:flex"
          aria-label="Display preferences"
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-500 transition-colors hover:text-primary"
            aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </nav>

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col justify-center px-8 py-12 sm:px-12 lg:px-24 lg:py-16">
          <div className="mx-auto w-full max-w-md">
            <header className="mb-12">
            
              <h1 className="font-headline text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {EDGE_BRAND.title}
              </h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-white/55">
                {EDGE_BRAND.subtitle}
              </p>
            </header>

            {error && (
              <div
                className="mb-6 flex animate-fade-in items-center gap-2 rounded-[4px] border border-error bg-error/10 px-3.5 py-3 text-sm text-error"
                role="alert"
              >
                <span className="material-symbols-outlined text-lg">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <LabeledInput
                label="User ID"
                icon="person"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@department.gov"
                autoComplete="username"
                isDarkMode={isDarkMode}
                accent={actionColor}
              />
              <LabeledInput
                label="Password"
                icon="lock"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                isDarkMode={isDarkMode}
                accent={actionColor}
                trailing={
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              {mfaRequired && (
                <LabeledInput
                  label="MFA code"
                  icon="pin"
                  type="text"
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  isDarkMode={isDarkMode}
                  accent={actionColor}
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-outline bg-panel text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                    style={{ accentColor: actionColor }}
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-white/50">Remember this device</span>
                </label>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Need help? Ask your admin.
                </span>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-[4px] border border-transparent bg-primary px-6 py-4 text-sm font-bold uppercase tracking-widest text-on-primary shadow-sm transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    branding.assets.loader ? (
                      <img src={branding.assets.loader} alt="" className="h-5 w-5" />
                    ) : (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )
                  ) : (
                    <>
                      Enter Console
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <footer
          className={`relative z-[1] mt-auto flex shrink-0 flex-col gap-4 border-t p-8 sm:flex-row sm:items-center sm:justify-between ${
            isDarkMode ? 'border-white/10' : 'border-slate-100'
          }`}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:justify-start">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/40">
                System status: Operational
              </span>
            </div>
            <span className="hidden text-[10px] font-bold text-slate-300 sm:inline dark:text-white/25">|</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 tabular-nums dark:text-white/35">
              {VERSION} · {BUILD_DATE}
            </span>
          </div>
          <p className="hidden text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300 sm:block sm:text-right dark:text-white/30">
            Boondock Edge © {new Date().getFullYear()}
          </p>
        </footer>
      </section>
    </main>
  );
};

function LabeledInput({
  label,
  icon,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  isDarkMode,
  accent,
  trailing,
  inputMode
}) {
  const uid = useId();
  const inputId = `${uid}-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/45">
        {label}
      </label>
      <div
        className={`relative flex items-center rounded-[4px] border transition-shadow focus-within:ring-2 focus-within:ring-offset-0 ${
          isDarkMode
            ? 'border-white/[0.12] bg-white/[0.05] focus-within:border-white/20'
            : 'border-outline bg-panel focus-within:border-primary'
        }`}
        style={{ '--tw-ring-color': accent }}
      >
        <span className="material-symbols-outlined pointer-events-none absolute left-3 text-[18px] leading-none text-slate-400 dark:text-white/35">
          {icon}
        </span>
        <input
          id={inputId}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`block w-full rounded-[4px] border-0 bg-transparent py-3.5 pl-10 text-sm outline-none ring-0 placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35 ${
            trailing ? 'pr-10' : 'pr-3'
          }`}
          style={{ caretColor: accent }}
        />
        {trailing ? <div className="absolute inset-y-0 right-0 flex items-center pr-3">{trailing}</div> : null}
      </div>
    </div>
  );
}

export default LoginPage;
