import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/apiClient';
import { useAuth } from '../AuthContext';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import styles from '../ui/FooterPagination.module.css';

const FooterPagination = ({
  currentPage,
  setCurrentPage,
  getFilteredMessages,
  getTotalPages,
  recordsPerPage,
  setRecordsPerPage,
  reverseSort,
  inboxServerHasMore = false,
  /** Real total rows on the server for the current time window (or null if not yet known). */
  inboxServerTotal = null,
  onFetchOlderInbox,
  isFetchingOlderInbox = false,
}) => {
  const { user } = useAuth();
  const loadedMessages = getFilteredMessages().length;
  /**
   * Use the server total when known so the footer reads "Showing X-Y of <real total>"
   * instead of "of <loaded so far>". Falls back to loaded count if the count API failed.
   */
  const totalMessages =
    typeof inboxServerTotal === 'number' && inboxServerTotal >= loadedMessages
      ? inboxServerTotal
      : loadedMessages;
  const totalPages = getTotalPages(totalMessages);
  const loadedPages = getTotalPages(loadedMessages);

  // Guard against empty result sets so we don't show "1-0 of 0"
  const hasMessages = totalMessages > 0 && totalPages > 0;
  const safeCurrentPage = hasMessages ? Math.min(currentPage, totalPages) : 0;

  const startRecord = hasMessages ? (safeCurrentPage - 1) * recordsPerPage + 1 : 0;
  const endRecord = hasMessages ? Math.min(safeCurrentPage * recordsPerPage, totalMessages) : 0;

  // Save pagination preferences to backend
  const savePaginationPreferences = async (newRecordsPerPage, newCurrentPage) => {
    if (!user?.username) return;

    try {
      await api.post(`/pagination-preferences/${user.username}`, {
        recordsPerPage: newRecordsPerPage,
        currentPage: newCurrentPage,
        reverseSort: reverseSort
      });
    } catch (error) {
      console.error('Failed to save pagination preferences:', error);
    }
  };

  // Handle records per page change
  const handleRecordsPerPageChange = (newValue) => {
    const newRecordsPerPage = Number(newValue);
    setRecordsPerPage(newRecordsPerPage);

    // Reset to first page when changing records per page
    const newCurrentPage = 1;
    setCurrentPage(newCurrentPage);

    // Save preferences
    savePaginationPreferences(newRecordsPerPage, newCurrentPage);
  };

  /**
   * Switch to a page; if it falls beyond the locally loaded slice, fetch additional chunks first
   * so the user lands on a page whose rows are actually rendered. Continues fetching while the
   * server still has rows and we still don't have enough loaded for the requested page.
   */
  const navigateToPage = async (newPage) => {
    if (!hasMessages) return;
    const targetPage = Math.max(1, Math.min(newPage, totalPages));
    if (
      typeof onFetchOlderInbox === 'function' &&
      inboxServerHasMore &&
      targetPage > getTotalPages(getFilteredMessages().length)
    ) {
      let safety = 200; // hard guard so a misbehaving server can't loop us
      while (
        safety-- > 0 &&
        targetPage > getTotalPages(getFilteredMessages().length) &&
        inboxServerHasMore
      ) {
        const ok = await onFetchOlderInbox();
        if (!ok) break;
      }
    }
    setCurrentPage(targetPage);
    savePaginationPreferences(recordsPerPage, targetPage);
  };

  const handlePageChange = (newPage) => {
    void navigateToPage(newPage);
  };

  const handleNewClick = async () => {
    if (!hasMessages || isFetchingOlderInbox) return;
    const step = reverseSort ? -1 : 1;
    await navigateToPage(safeCurrentPage + step);
  };

  const handleOldClick = async () => {
    if (!hasMessages || isFetchingOlderInbox) return;
    const step = reverseSort ? 1 : -1;
    await navigateToPage(safeCurrentPage + step);
  };

  // Classic pagination: compute visible page numbers window around current page
  const maxVisiblePages = 5;
  let startPage = 1;
  let endPage = totalPages;

  if (hasMessages) {
    if (totalPages > maxVisiblePages) {
      const halfWindow = Math.floor(maxVisiblePages / 2);
      startPage = Math.max(1, safeCurrentPage - halfWindow);
      endPage = startPage + maxVisiblePages - 1;
      if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }
  } else {
    startPage = 0;
    endPage = 0;
  }

  const pageNumbers = [];
  for (let p = startPage; p <= endPage; p++) {
    if (p >= 1) {
      pageNumbers.push(p);
    }
  }

  return (
    <div className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <Button
            size="small"
            variant="secondary"
            onClick={() => void handleNewClick()}
            disabled={
              !hasMessages ||
              isFetchingOlderInbox ||
              (reverseSort
                ? safeCurrentPage === 1
                : safeCurrentPage === totalPages && !inboxServerHasMore)
            }
            className={styles.navButton}
          >
            <ChevronLeft />
            <span>NEW</span>
          </Button>

          {/* Center section: range info + classic pagination controls */}
          <div className={styles.center}>
            <div className={styles.rangeInfo}>
              <span className={styles.rangeText}>
                {hasMessages ? (
                  <>
                    Showing{' '}
                    <span className={styles.secondaryText}>
                      {startRecord}-{endRecord}
                    </span>{' '}
                    of{' '}
                    <span className={styles.secondaryText}>
                      {totalMessages}
                    </span>
                  </>
                ) : (
                  'No messages to display'
                )}
              </span>
            </div>

            {/* Page indicator (numbers 1,2,3... are intentionally hidden) */}
            <div className={styles.pageInfo}>
              {hasMessages && (
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

          {/* Records per page selector */}
          <div className={styles.records}>
            <label className={styles.recordsLabel} htmlFor="records-per-page">
              Records:
            </label>
            <select
              id="records-per-page"
              value={recordsPerPage}
              onChange={(e) => handleRecordsPerPageChange(e.target.value)}
              className={`${formStyles.select} ${formStyles.selectInline}`}
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* OLD button: move one page toward the oldest messages */}
          <Button
            size="small"
            variant="secondary"
            onClick={() => void handleOldClick()}
            disabled={
              !hasMessages ||
              isFetchingOlderInbox ||
              (reverseSort
                ? safeCurrentPage === totalPages && !inboxServerHasMore
                : safeCurrentPage === 1)
            }
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
