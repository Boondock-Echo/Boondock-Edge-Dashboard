import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import styles from '../ui/FooterPagination.module.css';
import { useInboxMessages, useInboxPreferences } from '../InboxContext';

const FooterPagination = () => {
  const {
    visibleMessages,
    displayTotal,
    hasMore,
    olderLoading,
  } = useInboxMessages();
  const {
    currentPage,
    goToPage,
    recordsPerPage,
    setRecordsPerPage,
    reverseSort,
  } = useInboxPreferences();

  const loadedMessages = visibleMessages.length;
  const totalMessages = Math.max(displayTotal, loadedMessages);
  const totalPages = totalMessages > 0 ? Math.ceil(totalMessages / recordsPerPage) : 0;
  const safeCurrentPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 0;

  const startRecord = safeCurrentPage > 0
    ? (safeCurrentPage - 1) * recordsPerPage + 1
    : 0;
  const endRecord = safeCurrentPage > 0
    ? Math.min(safeCurrentPage * recordsPerPage, totalMessages)
    : 0;

  const navigateToPage = async (page) => {
    if (!totalPages) return;
    const target = Math.max(1, Math.min(page, totalPages));
    await goToPage(target);
  };

  const handleNewClick = () => {
    const step = reverseSort ? -1 : 1;
    void navigateToPage(safeCurrentPage + step);
  };

  const handleOldClick = () => {
    const step = reverseSort ? 1 : -1;
    void navigateToPage(safeCurrentPage + step);
  };

  const atNewEdge = reverseSort
    ? safeCurrentPage <= 1
    : safeCurrentPage >= totalPages && !hasMore;
  const atOldEdge = reverseSort
    ? safeCurrentPage >= totalPages && !hasMore
    : safeCurrentPage <= 1;

  return (
    <div className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <Button
            size="small"
            variant="secondary"
            onClick={handleNewClick}
            disabled={!totalPages || olderLoading || atNewEdge}
            className={styles.navButton}
          >
            <ChevronLeft />
            <span>NEW</span>
          </Button>

          <div className={styles.center}>
            <div className={styles.rangeInfo}>
              <span className={styles.rangeText}>
                {totalPages ? (
                  <>
                    Showing{' '}
                    <span className={styles.secondaryText}>{startRecord}-{endRecord}</span>{' '}
                    of{' '}
                    <span className={styles.secondaryText}>{totalMessages}</span>
                  </>
                ) : (
                  'No messages to display'
                )}
              </span>
            </div>

            <div className={styles.pageInfo}>
              {totalPages > 0 && (
                <span className={styles.secondaryText}>
                  Page {safeCurrentPage} of {totalPages}
                  {totalMessages > loadedMessages && (
                    <span className={styles.loadedCount}>
                      ({loadedMessages.toLocaleString()} loaded)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className={styles.records}>
            <label className={styles.recordsLabel} htmlFor="records-per-page">
              Records:
            </label>
            <select
              id="records-per-page"
              value={recordsPerPage}
              onChange={(e) => setRecordsPerPage(e.target.value)}
              className={`${formStyles.select} ${formStyles.selectInline}`}
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <Button
            size="small"
            variant="secondary"
            onClick={handleOldClick}
            disabled={!totalPages || olderLoading || atOldEdge}
            className={styles.navButton}
          >
            <span>OLD</span>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FooterPagination;
