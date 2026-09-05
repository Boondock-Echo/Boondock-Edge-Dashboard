import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/apiClient';
import { useAuth } from '../AuthContext';

const FooterPagination = ({
  currentPage,
  setCurrentPage,
  getFilteredMessages,
  isDarkMode,
  setIsDarkMode,
  getTotalPages,
  recordsPerPage,
  setRecordsPerPage,
  isMobile,
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

  const commonStyles = {
    background: isDarkMode ? 'bg-slate-950/90' : 'bg-white/90',
    borderColor: isDarkMode ? 'border-slate-800' : 'border-slate-200/40',
    textColor: isDarkMode ? 'text-slate-200' : 'text-slate-800',
    secondaryTextColor: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    buttonBackground: isDarkMode ? 'bg-slate-800' : 'bg-slate-100',
    buttonHoverBackground: isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200',
    disabledOpacity: isDarkMode ? 'disabled:opacity-30' : 'disabled:opacity-50',
    borderBackground: isDarkMode ? 'bg-slate-900' : 'bg-slate-50',
  };

  return (
    <div
      className={`sticky bottom-0 z-20 border-t backdrop-blur-sm ${commonStyles.background} ${commonStyles.borderColor} ${commonStyles.textColor}`}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className={`flex items-center ${isMobile ? 'flex-col space-y-2 py-2' : 'justify-between h-16 space-x-4'}`}>
          <button
            onClick={() => void handleNewClick()}
            disabled={
              !hasMessages ||
              isFetchingOlderInbox ||
              (reverseSort
                ? safeCurrentPage === 1
                : safeCurrentPage === totalPages && !inboxServerHasMore)
            }
            className={`flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-lg ${commonStyles.buttonBackground} ${commonStyles.buttonHoverBackground} ${commonStyles.borderColor} ${commonStyles.disabledOpacity} transition-all duration-300 group`}
          >
            <ChevronLeft
              size={isMobile ? 14 : 16}
              className={`mr-1 md:mr-2 ${commonStyles.secondaryTextColor} group-hover:transform group-hover:-translate-x-0.5 transition-transform`}
            />
            <span className={`${commonStyles.secondaryTextColor} font-medium text-sm md:text-base`}>NEW</span>
          </button>

          {/* Center section: range info + classic pagination controls */}
          <div className={`flex-1 flex flex-col items-center ${isMobile ? 'space-y-2' : 'space-y-1'}`}>
            <div className={`text-center px-3 py-1 rounded-lg ${commonStyles.borderBackground} ${commonStyles.borderColor} ${isMobile ? 'w-full' : 'w-auto'}`}>
              <span className="text-xs md:text-sm font-medium">
                {hasMessages ? (
                  <>
                    Showing{' '}
                    <span className={commonStyles.secondaryTextColor}>
                      {startRecord}-{endRecord}
                    </span>{' '}
                    of{' '}
                    <span className={commonStyles.secondaryTextColor}>
                      {totalMessages}
                    </span>
                  </>
                ) : (
                  'No messages to display'
                )}
              </span>
            </div>

            {/* Page indicator (numbers 1,2,3... are intentionally hidden) */}
            <div className="flex items-center space-x-1 md:space-x-2 text-xs md:text-sm">
              {hasMessages && (
                <span className={commonStyles.secondaryTextColor}>
                  Page {safeCurrentPage} of {totalPages}
                  {totalMessages > loadedMessages && (
                    <span className="ml-2 opacity-70">
                      ({loadedMessages.toLocaleString()} loaded)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Records per page selector */}
          <div className={`flex items-center ${isMobile ? 'w-full justify-center mt-1' : 'space-x-2'}`}>
            {!isMobile && <label className="text-sm font-medium">Records:</label>}
            <select
              value={recordsPerPage}
              onChange={(e) => handleRecordsPerPageChange(e.target.value)}
              className={`px-2 py-1 rounded border ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} text-xs md:text-sm focus:ring focus:ring-orange-300 focus:outline-none`}
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* OLD button: move one page toward the oldest messages */}
          <button
            onClick={() => void handleOldClick()}
            disabled={
              !hasMessages ||
              isFetchingOlderInbox ||
              (reverseSort
                ? safeCurrentPage === totalPages && !inboxServerHasMore
                : safeCurrentPage === 1)
            }
            className={`flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-lg ${commonStyles.buttonBackground} ${commonStyles.buttonHoverBackground} ${commonStyles.borderColor} ${commonStyles.disabledOpacity} transition-all duration-300 group`}
          >
            <span className={`${commonStyles.secondaryTextColor} font-medium text-sm md:text-base`}>OLD</span>
            <ChevronRight
              size={isMobile ? 14 : 16}
              className={`ml-1 md:ml-2 ${commonStyles.secondaryTextColor} group-hover:transform group-hover:translate-x-0.5 transition-transform`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FooterPagination;