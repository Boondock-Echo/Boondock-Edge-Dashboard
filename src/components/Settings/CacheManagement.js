import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import listStyles from '../ui/List.module.css';
import noticeStyles from '../ui/Notice.module.css';

const CACHE_KEYS = {
  CHANNELS: 'cached_channels',
  MESSAGES: 'cached_messages',
  KEYWORDS: 'cached_keywords',
  TIMEZONE: 'cached_timezone',
  LAST_FETCH: 'last_fetch_time'
};

const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState({});
  const [isClearing, setIsClearing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const getCacheSize = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? new Blob([data]).size : 0;
    } catch (error) {
      return 0;
    }
  };

  const getTotalCacheSize = () => {
    try {
      let totalSize = 0;
      Object.values(CACHE_KEYS).forEach(key => {
        totalSize += getCacheSize(key);
      });
      return totalSize;
    } catch (error) {
      return 0;
    }
  };

  const getCacheStats = () => {
    const stats = {};
    let totalSize = 0;

    Object.entries(CACHE_KEYS).forEach(([name, key]) => {
      const size = getCacheSize(key);
      const data = localStorage.getItem(key);
      let itemCount = 0;
      
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            itemCount = parsed.length;
          } else if (typeof parsed === 'object') {
            itemCount = Object.keys(parsed).length;
          }
        } catch (e) {
          itemCount = 1; // Single item if not parseable
        }
      }

      stats[name] = {
        size,
        itemCount,
        key
      };
      totalSize += size;
    });

    stats.total = { size: totalSize };
    return stats;
  };

  const clearCache = () => {
    setIsClearing(true);
    try {
      Object.values(CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      setCacheStats(getCacheStats());
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const refreshStats = () => {
    setCacheStats(getCacheStats());
    setLastRefresh(Date.now());
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageQuota = () => {
    try {
      // Estimate available storage (this is approximate)
      const testKey = 'storage_test';
      const testData = 'x'.repeat(1024 * 1024); // 1MB test
      let available = 0;
      
      try {
        localStorage.setItem(testKey, testData);
        localStorage.removeItem(testKey);
        available = 5 * 1024 * 1024; // Assume 5MB available
      } catch (e) {
        available = 0;
      }
      
      return available;
    } catch (error) {
      return 0;
    }
  };

  const totalSize = cacheStats.total?.size || 0;
  const availableStorage = getStorageQuota();
  const usagePercentage = availableStorage > 0 ? (totalSize / availableStorage) * 100 : 0;
  const isHighUsage = usagePercentage > 80;

  return (
    <div className="stackLarge">
      <div>
        <h2>Cache Management</h2>
        <p className={cardStyles.description}>
          Manage local storage cache to optimize performance and prevent storage issues.
        </p>
      </div>

      {/* Storage Usage Overview */}
      <div className={cardStyles.card}>
        <div className={cardStyles.header}>
          <h3 className={cardStyles.title}>Storage Usage</h3>
          <Button onClick={refreshStats} size="icon" title="Refresh stats" aria-label="Refresh cache stats">
            <RefreshCw size={16} />
          </Button>
        </div>
        
        <div className="stackCompact">
          <div className="rowBetween">
            <span>Used: {formatBytes(totalSize)}</span>
            <span>Available: ~{formatBytes(availableStorage)}</span>
          </div>
          <div className="meter" role="progressbar" aria-valuenow={Math.min(usagePercentage, 100)} aria-valuemin="0" aria-valuemax="100">
            <div className="meterFill" style={{ width: `${Math.min(usagePercentage, 100)}%` }} />
          </div>
          <div className="row">
            {isHighUsage ? (
              <AlertTriangle size={14} />
            ) : (
              <CheckCircle size={14} />
            )}
            <span className={`pill ${isHighUsage ? 'pillDanger' : 'pillSuccess'}`}>
              {usagePercentage.toFixed(1)}% used
            </span>
          </div>
        </div>

        {isHighUsage && (
          <div className={`${noticeStyles.notice} ${noticeStyles.warning}`}>
            <AlertTriangle className={noticeStyles.icon} size={16} />
            <div className={noticeStyles.body}>
              <p>High storage usage detected. Consider clearing cache to prevent storage errors.</p>
            </div>
          </div>
        )}
      </div>

      {/* Cache Items */}
      <div className={cardStyles.card}>
        <h3 className={cardStyles.title}>Cache Items</h3>
        <div className={listStyles.list}>
          {Object.entries(cacheStats).map(([name, stats]) => {
            if (name === 'total') return null;
            return (
              <div key={name} className={listStyles.item}>
                <div className={listStyles.content}>
                  <div className={listStyles.title}>{name.replace(/_/g, ' ')}</div>
                  <div className={listStyles.meta}>
                    {stats.itemCount} items • {formatBytes(stats.size)}
                  </div>
                </div>
                {stats.size > 0 && (
                  <Button
                    onClick={() => {
                      localStorage.removeItem(stats.key);
                      refreshStats();
                    }}
                    size="icon"
                    variant="danger"
                    title="Clear this cache item"
                    aria-label={`Clear ${name} cache`}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className={cardStyles.card}>
        <h3 className={cardStyles.title}>Actions</h3>
        <div className="stack">
          <Button
            onClick={clearCache}
            disabled={isClearing || totalSize === 0}
            variant="danger"
          >
            {isClearing ? (
              <>
                <RefreshCw className="spin" size={16} />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Clear All Cache
              </>
            )}
          </Button>
          
          <div className={`${noticeStyles.notice} ${noticeStyles.info}`}>
            <Info className={noticeStyles.icon} size={16} />
            <div className={noticeStyles.body}>
              <p><strong>Cache Information</strong></p>
              <ul>
                <li>Cache helps improve app performance by storing frequently accessed data</li>
                <li>Messages are automatically limited to prevent storage issues</li>
                <li>Cache is automatically cleared when it becomes too old</li>
                <li>Last refreshed: {new Date(lastRefresh).toLocaleString()}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheManagement;
