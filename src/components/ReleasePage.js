import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, GitBranch, PackageOpen, RefreshCw, Rocket, Tag } from 'lucide-react';
import api from '../utils/apiClient';
import { useAuth } from './AuthContext';
import ReleasePackageUpload from './Release/ReleasePackageUpload';
import Button from './ui/Button';
import pageStyles from './ui/Page.module.css';
import cardStyles from './ui/Card.module.css';
import listStyles from './ui/List.module.css';
import noticeStyles from './ui/Notice.module.css';
import timelineStyles from './ui/Timeline.module.css';

const ReleaseCard = ({ release, index, cardRef }) => (
  <div ref={cardRef} id={`release-${index}`} className={timelineStyles.entry}>
    <div className={timelineStyles.marker}>{index === 0 ? <Rocket size={16} /> : <Tag size={16} />}</div>
    <article className={cardStyles.card}>
      <header className={cardStyles.header}>
        <div className="row">
          {index === 0 && <span className={"pill pillSuccess"}><span className={timelineStyles.dot} />Latest</span>}
          <h2 className={cardStyles.title}>{release.title}</h2>
        </div>
        <div className="row">
          {release.date && <span className="pill"><CalendarDays size={12} />{release.date}</span>}
          {release.branch && <span className={"pill pillAccent"}><GitBranch size={12} />{release.branch}</span>}
        </div>
      </header>
      {release.sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className={cardStyles.section}>
          {section.heading && <h3 className="eyebrow">{section.heading}</h3>}
          {section.items.length > 0 && (
            <ul className={listStyles.checkList}>
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className={listStyles.checkItem}><CheckCircle2 size={16} /><span>{item}</span></li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {release.sections.length === 0 && <p className={cardStyles.description}>No details recorded for this release.</p>}
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
    <main className={pageStyles.page}>
      <header className={pageStyles.stickyHeader}>
        <div className={pageStyles.wideContainer}>
          <div className="row">
            <Button size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></Button>
            <div className={pageStyles.headerIcon}><PackageOpen size={20} /></div>
            <div>
              <h1 className={pageStyles.title}>Release Notes</h1>
              {releases.length > 0 && <p className={pageStyles.subtitle}>{releases.length} release{releases.length !== 1 ? 's' : ''} · latest: {releases[0]?.title}</p>}
            </div>
          </div>
          <div className="rowWrap">
            <Button size="icon" onClick={fetchNotes} disabled={loading} aria-label="Refresh releases"><RefreshCw size={16} /></Button>
            <Button onClick={() => navigate('/')}>Dashboard</Button>
            <Button onClick={() => navigate('/settings')}>Settings</Button>
          </div>
        </div>
      </header>

      <div className={timelineStyles.layout}>
        <aside className={timelineStyles.index}>
          <h2 className="eyebrow">Releases</h2>
          {loading ? <span className="spinner" role="status" aria-label="Loading release index" /> : (
            <ul className={timelineStyles.indexList}>
              {releases.map((release, index) => (
                <li key={release.title || index}>
                  <button className={`${timelineStyles.indexButton} ${activeIndex === index ? timelineStyles.indexButtonActive : ''}`} onClick={() => scrollToCard(index)}>
                    <span className={timelineStyles.dot} /><span>{release.title}</span>{activeIndex === index && <ChevronRight size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="grow stack">
          {user && <ReleasePackageUpload />}
          {loading && <div className="centeredContent"><span className="spinner spinnerLarge" role="status" aria-label="Loading release notes" /><p>Loading release notes…</p></div>}
          {!loading && error && <div className={`${noticeStyles.notice} ${noticeStyles.error}`}><div className={noticeStyles.body}><p>{error}</p><Button variant="danger" onClick={fetchNotes}>Retry</Button></div></div>}
          {!loading && !error && releases.length === 0 && (
            <div className={cardStyles.card}><div className="centeredContent"><PackageOpen size={40} /><p>No releases recorded yet.</p><small>Run <code>release.bat</code> to create your first release entry.</small></div></div>
          )}
          {!loading && !error && releases.length > 0 && (
            <div className={timelineStyles.timeline}>
              {releases.map((release, index) => <ReleaseCard key={release.title || index} release={release} index={index} cardRef={(element) => { cardRefs.current[index] = element; }} />)}
              <div className={timelineStyles.end}><span /><p>Beginning of release history</p></div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default ReleasePage;
