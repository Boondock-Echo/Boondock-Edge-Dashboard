import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, HelpCircle } from 'lucide-react';
import styles from '../ui/Documentation.module.css';

const FloatingDocumentationIcon = () => {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);

  // Get saved position from localStorage
  const getSavedPosition = () => {
    try {
      const saved = localStorage.getItem('docIconPosition');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate position is within viewport
        if (parsed.x >= 0 && parsed.y >= 0) {
          return parsed;
        }
      }
    } catch (e) {
      // Fallback to default
    }
    return { x: window.innerWidth - 100, y: 100 };
  };

  const [position, setPosition] = useState(getSavedPosition);

  // Save position to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('docIconPosition', JSON.stringify(position));
    } catch (e) {
      // Ignore errors
    }
  }, [position]);

  // Build context-aware documentation URL
  const getDocumentationUrl = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    
    // Build base URL - point to Docusaurus docs server (relative path)
    const baseUrl = '/docs/user-guide';
    let docPath = '';
    let hash = '';

    // Map routes to documentation sections
    if (path === '/') {
      docPath = 'dashboard';
    } else if (path === '/settings') {
      docPath = 'settings';
      // Include tab parameter if present
      const tab = searchParams.get('tab');
      if (tab) {
        // Example: /docs/user-guide/settings#summary-tab
        hash = `#${tab}-tab`;
      }
    } else if (path === '/users' || path === '/user-management') {
      // No dedicated users page in user-guide; send to overview
      docPath = 'overview';
    } else if (path === '/logs') {
      docPath = 'logs';
    } else if (path === '/report' || path === '/reports') {
      // No dedicated reports page; send to dashboard docs
      docPath = 'dashboard';
    } else if (path === '/profile') {
      // No dedicated profile page; send to overview
      docPath = 'overview';
    } else if (path === '/advanced-player') {
      // No dedicated player page; send to overview
      docPath = 'overview';
    } else {
      // For unknown routes, just link to high-level overview
      docPath = 'overview';
    }

    // Build final URL like:
    //   /docs/user-guide/settings#summary-tab
    const normalizedPath = docPath ? `/${docPath}` : '';
    return `${baseUrl}${normalizedPath}${hash}`;
  };

  const handleClick = (e) => {
    // Prevent navigation if we're dragging
    if (isDragging) {
      return;
    }
    const docUrl = getDocumentationUrl();
    // Open in new tab
    window.open(docUrl, '_blank', 'noopener,noreferrer');
  };

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        // Calculate new position
        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const iconSize = 56; // width/height of icon
        const maxX = window.innerWidth - iconSize;
        const maxY = window.innerHeight - iconSize;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    // Add touch events for mobile
    const handleTouchMove = (e) => handleMouseMove(e);
    const handleTouchEnd = () => handleMouseUp();

    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, dragOffset]);

  const handleDragStart = (e) => {
    const rect = iconRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (!clientX || !clientY) return;
    
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
    setIsDragging(true);
    
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle responsive positioning
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        // Ensure icon stays within viewport
        const iconSize = 56;
        const maxX = window.innerWidth - iconSize;
        const maxY = window.innerHeight - iconSize;
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY)
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Don't show on the documentation page itself
  if (location.pathname.startsWith('/docs')) {
    return null;
  }

  return (
    <button
      ref={iconRef}
      onClick={!isDragging ? handleClick : undefined}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onMouseEnter={() => !isDragging && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${styles.floatingButton} ${isDragging ? styles.dragging : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      aria-label="View documentation for this page (drag to move)"
      title="View page-specific documentation (drag to move)"
    >
      {isHovered ? (
        <HelpCircle className={styles.iconLarge} />
      ) : (
        <BookOpen className={styles.iconLarge} />
      )}
      
      {/* Tooltip */}
      {isHovered && (
        <div
          className={styles.tooltip}
        >
          View Documentation
          <div
            className={styles.tooltipArrow}
          />
        </div>
      )}
    </button>
  );
};

export default FloatingDocumentationIcon;
