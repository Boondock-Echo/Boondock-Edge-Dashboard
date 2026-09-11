import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InteractiveUserGuide from './InteractiveUserGuide';
import { ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import styles from '../ui/Documentation.module.css';

const UserGuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* Header - Similar to troubleshoot.boondockecho.com style */}
      <div className={styles.stickyHeader}>
        <div className={styles.headerInner}>
          <div className="rowBetween">
            <div className="row">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ArrowLeft className={styles.iconMedium} />
              </Button>
              <div className="row">
                <div className={styles.brandMark}>
                  <span>📚</span>
                </div>
                <div>
                  <h1 className={styles.headerTitle}>
                    Documentation
                  </h1>
                </div>
              </div>
            </div>
            
            {/* Navigation menu similar to troubleshoot site */}
            <nav className={styles.desktopNav}>
              <button
                onClick={() => navigate('/')}
                className={styles.navButton}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/settings')}
                className={styles.navButton}
              >
                Settings
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content - Clean, minimal style like troubleshoot site */}
      <div className={styles.container}>
        <InteractiveUserGuide />
      </div>
    </div>
  );
};

export default UserGuidePage;
