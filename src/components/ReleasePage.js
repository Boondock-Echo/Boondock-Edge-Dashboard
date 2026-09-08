import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, GitBranch, PackageOpen, RefreshCw, Rocket, Tag } from 'lucide-react';
import api from '../utils/apiClient';
import { useAuth } from './AuthContext';
import ReleasePackageUpload from './Release/ReleasePackageUpload';
import Button from './ui/Button';
import { Spinner } from './ui/Spinner';
import styles from './ui/Page.module.css';

const Badge = ({ children, accent = false, success = false }) => (
  <span className={`${styles.badge} ${accent ? styles.accentBadge : ''} ${success ? styles.successBadge : ''}`}>{children}</span>
);

const ReleaseCard = ({ release, index, cardRef }) => (
  <div ref={cardRef} id={`release-${index}`} className={styles.timelineEntry}>
    <div className={styles.timelineMarker}>{index === 0 ? <Rocket size={16} /> : <Tag size={16} />}</div>
    <article className={styles.releaseCard}>
      <header className={styles.releaseCardHeader}>
        <div className={styles.releaseTitleRow}>
          {index === 0 && <Badge success><span className={styles.badgeDot} />Latest</Badge>}
          <h2 className={styles.releaseTitle}>{release.title}</h2>
        </div>
        <div className={styles.badgeRow}>
          {release.date && <Badge><CalendarDays size={12} />{release.date}</Badge>}
          {release.branch && <Badge accent><GitBranch size={12} />{release.branch}</Badge>}
        </div>
      </header>
      {release.sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className={styles.releaseSection}>
          {section.heading && <h3 className={styles.eyebrow}>{section.heading}</h3>}
          {section.items.length > 0 && (
            <ul className={styles.featureList}>
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className={styles.featureItem}><CheckCircle2 size={16} /><span>{item}</span></li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {release.sections.length === 0 && <p className={styles.muted}>No details recorded for this release.</p>}
    </article>
  </div>
);

const ReleasePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef([]);

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

  useEffect(() => {
    if (!cardRefs.current.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = cardRefs.current.indexOf(entry.target);
          if (index !== -1) setActiveIndex(index);
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    cardRefs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [releases]);

  const scrollToCard = (index) => cardRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className={styles.page}>
      <header className={styles.stickyHeader}>
        <div className={styles.wideContainer}>
          <div className={styles.headerGroup}>
            <Button size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></Button>
            <div className={styles.headerIcon}><PackageOpen size={20} /></div>
            <div>
              <h1 className={styles.title}>Release Notes</h1>
              {releases.length > 0 && <p className={styles.subtitle}>{releases.length} release{releases.length !== 1 ? 's' : ''} · latest: {releases[0]?.title}</p>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button size="icon" onClick={fetchNotes} disabled={loading} aria-label="Refresh releases"><RefreshCw size={16} /></Button>
            <Button onClick={() => navigate('/')}>Dashboard</Button>
            <Button onClick={() => navigate('/settings')}>Settings</Button>
          </div>
        </div>
      </header>

      <div className={styles.releaseLayout}>
        <aside className={styles.indexPanel}>
          <h2 className={styles.eyebrow}>Releases</h2>
          {loading ? <Spinner label="Loading release index" /> : (
            <ul className={styles.indexList}>
              {releases.map((release, index) => (
                <li key={release.title || index}>
                  <button className={`${styles.indexButton} ${activeIndex === index ? styles.indexButtonActive : ''}`} onClick={() => scrollToCard(index)}>
                    <span className={styles.indexDot} /><span>{release.title}</span>{activeIndex === index && <ChevronRight size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className={styles.grow}>
          {user && <ReleasePackageUpload />}
          {loading && <div className={styles.loading}><Spinner size="large" label="Loading release notes" /><p>Loading release notes…</p></div>}
          {!loading && error && <div className={styles.error}><p>{error}</p><Button variant="danger" onClick={fetchNotes}>Retry</Button></div>}
          {!loading && !error && releases.length === 0 && (
            <div className={styles.empty}><PackageOpen size={40} /><p>No releases recorded yet.</p><small>Run <code className={styles.code}>release.bat</code> to create your first release entry.</small></div>
          )}
          {!loading && !error && releases.length > 0 && (
            <div className={styles.timeline}>
              {releases.map((release, index) => <ReleaseCard key={release.title || index} release={release} index={index} cardRef={(element) => { cardRefs.current[index] = element; }} />)}
              <div className={styles.timelineEnd}><span /><p>Beginning of release history</p></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default ReleasePage;
