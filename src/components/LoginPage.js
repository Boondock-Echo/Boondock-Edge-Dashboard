import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import api from '../utils/apiClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sun, Moon, Eye, EyeOff, ArrowRight } from 'lucide-react';
import styles from './ui/Page.module.css';

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
      }, {
        timeout: 0,
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
        className={styles.loadingPage}
        style={{ fontFamily: `${branding.font}, Inter, system-ui, sans-serif` }}
      >
        <div
          className={styles.gridBackdrop}
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--ui-border-rgb) / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--ui-border-rgb) / 0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className={styles.loadingContent}>
          <div
            className={styles.loadingSpinner}
            style={{ borderLeftColor: actionColor, borderRightColor: actionColor }}
          />
          <p className={styles.loadingLabel}>Loading</p>
        </div>
      </div>
    );
  }

  return (
    <main
      className={styles.fullScreenPage}
      style={{
        fontFamily: `${branding.font}, Inter, system-ui, sans-serif`,
        '--login-action': actionColor,
      }}
    >
      {/* Mobile / tablet */}
      <header
        className={styles.mobileHeader}
      >
        <div className={styles.brandRow}>
          <div
            className={styles.logoFrame}
            style={{
              boxShadow: '0 0 0 2px rgb(var(--ui-border-rgb) / 0.7), inset 0 -3px 0 0 var(--ui-accent)',
            }}
          >
            {branding.assets.logo ? (
              <img src={branding.assets.logo} alt="" className={styles.logo} />
            ) : (
              <img src={DEFAULT_EDGE_LOGO} alt="" className={styles.smallLogo} />
            )}
          </div>
          {branding.organizationName?.trim() ? (
            <div className={styles.shrinkable}>
              <p className={styles.organization}>{branding.organizationName}</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className={styles.themeButton}
          aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
        >
          {isDarkMode ? <Sun className={styles.themeIcon} /> : <Moon className={styles.themeIcon} />}
        </button>
      </header>

      {/* Left: hero art — width follows intrinsic 753:1024 vs viewport height (cap 50vw); mobile strip matches aspect */}
      <section
        className={styles.hero}
        aria-hidden
      >
        <img
          src={LOGIN_HERO_ART}
          alt=""
          width={753}
          height={1024}
          className={styles.heroImage}
          draggable={false}
          decoding="async"
        />
        <div className={styles.heroShade} />
      </section>

      {/* Right: loginnew.html-style panel — white canvas, centered max-w-md, absolute theme toggle */}
      <section className={styles.panel}>
        <div className={styles.panelGlow} aria-hidden />

        <nav
          className={styles.desktopNav}
          aria-label="Display preferences"
        >
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.desktopThemeButton}
            aria-label={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? <Sun className={styles.themeIcon} /> : <Moon className={styles.themeIcon} />}
          </button>
        </nav>

        <div className={styles.panelBody}>
          <div className={styles.formContainer}>
            <header className={styles.formHeader}>
            
              <h1 className={styles.authTitle}>
                {EDGE_BRAND.title}
              </h1>
              <p className={styles.authSubtitle}>
                {EDGE_BRAND.subtitle}
              </p>
            </header>

            {error && (
              <div
                className={styles.error}
                role="alert"
              >
                <span className={`material-symbols-outlined ${styles.errorIcon}`}>error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <LabeledInput
                label="User ID"
                icon="person"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@department.gov"
                autoComplete="username"
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
                accent={actionColor}
                trailing={
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.inputAction}
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className={styles.inputActionIcon} /> : <Eye className={styles.inputActionIcon} />}
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
                  accent={actionColor}
                />
              )}
              <div className={styles.formOptions}>
                <label className={styles.remember}>
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className={styles.checkbox}
                    style={{ accentColor: actionColor }}
                  />
                  <span className={styles.optionText}>Remember this device</span>
                </label>
                <span className={styles.optionText}>
                  Need help? Ask your admin.
                </span>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={styles.submit}
                >
                  {isLoading ? (
                    branding.assets.loader ? (
                      <img src={branding.assets.loader} alt="" className={styles.themeIcon} />
                    ) : (
                      <span className={styles.submitSpinner} />
                    )
                  ) : (
                    <>
                      Enter Console
                      <ArrowRight className={styles.submitIcon} strokeWidth={2} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <footer
          className={styles.footer}
        >
          <div className={styles.footerItems}>
            <div className={styles.footerStatus}>
              <span className={styles.statusDot} aria-hidden />
              <span className={styles.statusText}>
                System status: Operational
              </span>
            </div>
            <span className={styles.divider}>|</span>
            <span className={styles.footerText}>
              {VERSION} · {BUILD_DATE}
            </span>
          </div>
          <p className={`${styles.footerText} ${styles.copyright}`}>
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
  accent,
  trailing,
  inputMode
}) {
  const uid = useId();
  const inputId = `${uid}-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.fieldLabel}>
        {label}
      </label>
      <div
        className={styles.inputFrame}
      >
        <span className={styles.inputIcon}>
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
          className={`${styles.iconInput} ${trailing ? styles.inputWithAction : ""}`}
          style={{ caretColor: accent }}
        />
        {trailing ? <div className={styles.inputActionWrap}>{trailing}</div> : null}
      </div>
    </div>
  );
}

export default LoginPage;
