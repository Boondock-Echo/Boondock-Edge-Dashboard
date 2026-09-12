import { Settings, Settings2, Users, Radio, FileText, Logs, User, Volume2, AlertCircle, Info, Lock,
  CheckCircle, HelpCircle, TrendingUp, Server, Siren, Activity, Cloud, ShieldAlert, Network,
  Wifi, Wrench, MessageSquare } from 'lucide-react';
import styles from '../ui/Documentation.module.css';

const PageSpecificDocumentation = ({ page, tab, globalTab, highlightText, matchesSearch, searchQuery }) => {
  
  if (!page) return null;

  // Screenshot display component
  const ScreenshotDisplay = ({ src, alt, caption }) => {
    if (!src) return null;
    return (
      <div className={styles.screenshot}>
        <div className={styles.screenshotFrame}>
          <img 
            src={src} 
            alt={alt || 'Documentation screenshot'} 
            className={styles.screenshotImage}
            style={{ maxHeight: '600px', objectFit: 'contain' }}
          />
        </div>
        {caption && (
          <p className={styles.screenshotCaption}>
            {caption}
          </p>
        )}
      </div>
    );
  };

  const SectionCard = ({ title, icon: Icon, children }) => {
    const titleMatches = matchesSearch(title);
    const shouldShow = !searchQuery || titleMatches;
    
    if (!shouldShow) return null;
    
    return (
      <div className={styles.card}>
        <div className={"row"}>
          {Icon && <Icon className={`${styles.iconMedium} ${styles.accentIcon}`} />}
          <h3 className={styles.heading4}>
            {highlightText(title, searchQuery)}
          </h3>
        </div>
        {children}
      </div>
    );
  };

  const FieldDescription = ({ field, description, required = false, defaultValue = null }) => {
    const fieldMatches = matchesSearch(field) || matchesSearch(description);
    if (searchQuery && !fieldMatches) return null;
    
    return (
      <div className={styles.subtlePanel}>
        <div className={"row"}>
          <code className={styles.emphasis}>
            {highlightText(field, searchQuery)}
          </code>
          {required && (
            <span className={styles.caption}>
              Required
            </span>
          )}
        </div>
        <p className={styles.bodyText}>
          {highlightText(description, searchQuery)}
        </p>
        {defaultValue !== null && (
          <p className={styles.caption}>
            Default: <code className={styles.mono}>{defaultValue}</code>
          </p>
        )}
      </div>
    );
  };

  const ActionDescription = ({ action, description, effects = [] }) => {
    const actionMatches = matchesSearch(action) || matchesSearch(description);
    const effectsMatch = effects.some(e => matchesSearch(e));
    if (searchQuery && (!actionMatches && !effectsMatch)) return null;
    
    return (
      <div className={styles.subtlePanel}>
        <div className={"row"}>
          <CheckCircle className={`${styles.iconSmall} ${styles.successIcon}`} />
          <span className={styles.emphasis}>
            {highlightText(action, searchQuery)}
          </span>
        </div>
        <p className={styles.bodyText}>
          {highlightText(description, searchQuery)}
        </p>
        {effects.length > 0 && (
          <div >
            <p className={styles.emphasis}>Effects:</p>
            <ul className={"stack stackCompact"}>
              {effects.map((effect, idx) => {
                const effectMatches = matchesSearch(effect);
                if (searchQuery && !effectMatches) return null;
                return (
                  <li key={idx} className={styles.caption}>
                    • {highlightText(effect, searchQuery)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Dashboard Page Documentation
  if (page === 'dashboard') {
    return (
      <div>
        <SectionCard title="Dashboard Overview" icon={TrendingUp}>
          <p className={styles.bodyText}>
            The Dashboard is the central hub for viewing, managing, and analyzing all recorded audio communications. It provides real-time access to transcribed recordings with powerful filtering, search, playback, and organization capabilities. The interface is divided into three main areas: Sidebar (left), Message List (center), and Top Bar (controls).
          </p>
          <ScreenshotDisplay 
            src="/screenshots/dashboard-overview.png" 
            alt="Dashboard Overview Screenshot"
            caption="Dashboard main interface showing sidebar, message list, and top bar controls"
          />
        </SectionCard>

        <SectionCard title="Sidebar (Left Panel)" icon={Radio}>
          <p className={styles.bodyText}>
            The sidebar provides navigation, search, and filtering controls. It contains search functionality, channel management, and keyword highlighting tools.
          </p>
          <ScreenshotDisplay 
            src="/screenshots/dashboard-sidebar.png" 
            alt="Dashboard Sidebar Screenshot"
            caption="Sidebar showing search bar, channel list with status indicators, and keywords section"
          />
          
          <FieldDescription
            field="Search Bar"
            description="Real-time search through all recordings. Type keywords, phrases, or text from transcripts. Search works across channel names, transcriptions, timestamps, and metadata. Results update instantly as you type. Highlights matching text in yellow in message cards."
            required={false}
          />
          <FieldDescription
            field="Channel List"
            description="Displays all configured recording channels. Each channel shows: name, status indicator (online/offline), message count, and toggle switch. Click channel name or toggle to show/hide recordings from that channel. Active channels are highlighted with colored border. Channel colors help visual identification."
          />
          <FieldDescription
            field="Channel Status Indicators"
            description="Visual indicators for each channel: Green dot = Online and recording, Red dot = Offline or error, Gray = Inactive. Message count badge shows number of recordings from that channel in current view."
          />
          <FieldDescription
            field="Keywords Section"
            description="List of all configured keywords with occurrence counts. Click keyword to highlight it in all visible message cards. Highlighted keywords appear with colored background. Keyword counts update based on current filtered view. Multiple keywords can be active simultaneously."
          />
          <FieldDescription
            field="Sidebar Footer"
            description="Displays user information, app version, build date, settings link, and logout button. Version shows current branch name from which build was created."
          />
          <FieldDescription
            field="Mobile Sidebar"
            description="On mobile devices, sidebar can be toggled open/closed via menu button. Overlays content when open. Tap outside or use close button to dismiss."
          />
          
          <ActionDescription
            action="Search Recordings"
            description="Type in search bar to filter messages containing search term."
            effects={[
              "Message list filters in real-time",
              "Matching text highlighted in message cards",
              "Search works across all fields (transcription, channel, metadata)",
              "Clear search to show all messages again"
            ]}
          />
          <ActionDescription
            action="Toggle Channel Visibility"
            description="Click channel toggle or channel name to show/hide recordings from that channel."
            effects={[
              "Message list updates immediately",
              "Channel status indicator reflects visibility state",
              "Message counts update based on visible channels",
              "Setting persists in browser localStorage"
            ]}
          />
          <ActionDescription
            action="Highlight Keywords"
            description="Click keyword in keywords section to highlight all occurrences in visible messages."
            effects={[
              "Keyword highlighted with colored background in all matching messages",
              "Multiple keywords can be active simultaneously",
              "Highlight persists until keyword clicked again",
              "Count shows occurrences in current filtered view"
            ]}
          />
        </SectionCard>

        <SectionCard title="Top Bar Controls" icon={Settings}>
          <p className={styles.bodyText}>
            The top bar provides quick access to filtering, selection, view customization, and system controls. All controls are always accessible from the top of the dashboard.
          </p>
          <ScreenshotDisplay 
            src="/screenshots/dashboard-topbar.png" 
            alt="Dashboard Top Bar Screenshot"
            caption="Top bar showing multi-select toggle, time filters, custom filter, view settings, and system clock"
          />
          
          <FieldDescription
            field="Multi-Select Mode Toggle"
            description="Enable/disable multi-select mode for batch operations on messages. When enabled, checkboxes appear on all message cards for selecting multiple items simultaneously."
            defaultValue="Off"
          />
          <FieldDescription
            field="Time Filter Dropdown"
            description="Quick time range filters: All, Last 30 mins, Last 1 hour, Last 2 hours, Last 4 hours, Last 8 hours, Last 1 Day, Last 2 Days, Last Week. Filters messages by timestamp. 'All' shows all recordings."
            defaultValue="All"
          />
          <FieldDescription
            field="Custom Filter Button"
            description="Opens advanced filter panel for custom date/time ranges, specific date selection, start/end times, and precise time window filtering. More granular than time filter dropdown."
          />
          <FieldDescription
            field="View Settings Button"
            description="Opens view settings modal to toggle visibility of: Time column, Channel column, Car/Unit column, Person column. Customize what information is displayed in message cards."
          />
          <FieldDescription
            field="System Clock"
            description="Displays current system time in browser timezone and configured time format. Updates in real-time. Shows timezone abbreviation."
          />
          <FieldDescription
            field="Selected Messages Count"
            description="When in multi-select mode, shows count of currently selected messages. Appears next to multi-select button."
          />
          <FieldDescription
            field="Batch Actions Bar"
            description="When messages are selected, batch action buttons appear: Delete Selected, Download Selected, Tag Selected, Create Report. Allows operating on multiple messages at once."
          />
          <FieldDescription
            field="Theme Toggle"
            description="Switch between light and dark mode. Preference saved in browser localStorage and persists across sessions."
          />
          <FieldDescription
            field="Settings Link"
            description="Quick link to Settings page. Only visible to users with access_settings permission."
          />
          
          <ActionDescription
            action="Enable Multi-Select Mode"
            description="Click multi-select button to enter selection mode."
            effects={[
              "Checkboxes appear on all message cards",
              "Batch action buttons appear in top bar",
              "Can select multiple messages for batch operations",
              "Selected count displayed",
              "Click again to exit multi-select mode"
            ]}
          />
          <ActionDescription
            action="Apply Time Filter"
            description="Select time range from dropdown or use custom filter."
            effects={[
              "Message list filters to selected time range",
              "Pagination resets to first page",
              "Filter persists until changed",
              "Channel and keyword filters still apply",
              "URL updates with filter parameters"
            ]}
          />
          <ActionDescription
            action="Customize View Settings"
            description="Toggle visibility of columns (Time, Channel, Car, Person)."
            effects={[
              "Message cards update to show/hide selected columns",
              "Preferences saved to localStorage",
              "Settings persist across sessions",
              "Applies to all message cards immediately"
            ]}
          />
        </SectionCard>

        <SectionCard title="Message List (Center Panel)" icon={MessageSquare}>
          <p className={styles.bodyText}>
            The message list displays all filtered recordings in chronological order. Each message card contains transcription, metadata, and playback controls. Messages are sorted by timestamp (newest first by default, can be reversed).
          </p>
          <ScreenshotDisplay 
            src="/screenshots/dashboard-messages.png" 
            alt="Dashboard Message List Screenshot"
            caption="Message list showing individual message cards with transcriptions, playback controls, and metadata"
          />
          
          <FieldDescription
            field="Message Card"
            description="Individual card for each recording showing: channel name (colored indicator), timestamp, transcription text, audio playback controls, metadata (car/unit, person), tags, and action buttons."
          />
          <FieldDescription
            field="Channel Indicator"
            description="Colored dot or badge showing which channel the recording came from. Color matches channel configuration. Click channel name to filter by that channel."
          />
          <FieldDescription
            field="Timestamp"
            description="Date and time of recording. Format: Date (MM/DD/YYYY or configured format) and Time (HH:MM:SS or 12h format based on preferences). Timezone matches user/system settings."
          />
          <FieldDescription
            field="Transcription Text"
            description="Full text transcription of the audio recording. Highlighted if search terms match or keywords are active. Word-wrap for long transcriptions. May include [unclear] markers for poor audio quality."
          />
          <FieldDescription
            field="Audio Playback Controls"
            description="Play/pause button, progress bar, current time, duration, and volume control. Expandable player shows waveform visualization. Only one audio can play at a time."
          />
          <FieldDescription
            field="Waveform Visualization"
            description="Visual representation of audio amplitude over time. Appears when player is expanded. Click on waveform to seek to specific position. Shows audio peaks and valleys for visual analysis."
          />
          <FieldDescription
            field="Tags"
            description="User-created tags associated with recording. Displayed as colored badges. Click tag to filter messages by that tag. Admin users can add/remove tags."
          />
          <FieldDescription
            field="Metadata Fields"
            description="Optional fields displayed if enabled in view settings: Car/Unit number, Person name. Shows if available in recording metadata."
          />
          <FieldDescription
            field="Action Buttons"
            description="Per-message actions: Play in Advanced Player (opens full-page player), Download (download audio file), Delete (requires permission), Tag (add/remove tags), Create Report (include in incident report). Buttons shown based on user permissions."
          />
          <FieldDescription
            field="Pagination"
            description="Footer pagination controls: Previous/Next page buttons, page number display, items per page selector (20, 50, 100). Shows total message count and current page range."
          />
          <FieldDescription
            field="Continuous Scroll Mode"
            description="Alternative to pagination: infinite scroll loads more messages as you scroll down. Automatic loading when reaching bottom of list. Useful for browsing through many recordings."
          />
          <FieldDescription
            field="Sort Order"
            description="Messages sorted by timestamp. Default: Newest first (reverse sort). Can toggle to Oldest first (normal sort). Sort preference saved and persists."
          />
          <FieldDescription
            field="Empty State"
            description="When no messages match filters: 'No messages found' message with suggestions to clear filters or adjust search criteria."
          />
          
          <ActionDescription
            action="Play Audio"
            description="Click play button on message card to start playback."
            effects={[
              "Audio starts playing from beginning",
              "Any currently playing audio pauses",
              "Play button changes to pause",
              "Progress bar updates in real-time",
              "Can expand player for waveform view",
              "Playback continues if you navigate away from card"
            ]}
          />
          <ActionDescription
            action="Expand Audio Player"
            description="Click expand button or card to show full player with waveform."
            effects={[
              "Player expands to show waveform visualization",
              "Additional controls visible (seek, speed, volume)",
              "Can interact with waveform for precise seeking",
              "Player collapses when audio stops or another plays"
            ]}
          />
          <ActionDescription
            action="Seek Audio"
            description="Click on progress bar or waveform to jump to specific time position."
            effects={[
              "Audio seeks to clicked position",
              "Playback resumes from new position",
              "Time display updates",
              "Waveform cursor moves to position"
            ]}
          />
          <ActionDescription
            action="Download Recording"
            description="Click download button to save audio file to computer."
            effects={[
              "Audio file downloads in browser",
              "File named with timestamp and channel",
              "Original audio format preserved (WAV/MP3)",
              "Download starts immediately"
            ]}
          />
          <ActionDescription
            action="Delete Recording"
            description="Click delete button to permanently remove recording. Requires delete_audio permission."
            effects={[
              "Confirmation dialog appears",
              "Recording deleted from system",
              "Message card removed from list",
              "Cannot be undone",
              "Associated tags and metadata also deleted"
            ]}
          />
          <ActionDescription
            action="Add/Remove Tags"
            description="Click tag button to manage tags for recording."
            effects={[
              "Tag dropdown opens with available tags",
              "Select tags to add or remove",
              "Tags saved and displayed as badges",
              "Can filter messages by selected tags",
              "Changes saved immediately"
            ]}
          />
          <ActionDescription
            action="Open in Advanced Player"
            description="Click external link button to open recording in full-page advanced player."
            effects={[
              "Navigates to advanced player page",
              "Full-screen audio player interface",
              "Enhanced controls and visualization",
              "Can continue browsing while audio plays",
              "Original message card remains in dashboard"
            ]}
          />
          <ActionDescription
            action="Create Incident Report"
            description="Select messages and click 'Create Report' to generate incident report."
            effects={[
              "Report creation modal opens",
              "Selected messages included in report",
              "Can add notes and additional metadata",
              "Report saved and accessible from Reports page",
              "Can export or share report"
            ]}
          />
        </SectionCard>

        <SectionCard title="Advanced Features" icon={Activity}>
          <FieldDescription
            field="Real-Time Updates"
            description="New recordings appear automatically in message list as they are processed. Auto-refresh keeps list current without manual refresh. New message indicator shows count of new messages since last view."
          />
          <FieldDescription
            field="Search Highlighting"
            description="Search terms highlighted in yellow within transcription text. Multiple search terms all highlighted. Case-insensitive matching."
          />
          <FieldDescription
            field="Keyword Highlighting"
            description="Active keywords highlighted with colored background (color matches keyword configuration). Helps quickly spot important terms across messages."
          />
          <FieldDescription
            field="Hallucination Detection"
            description="Potentially incorrect transcriptions flagged with warning indicator. Enabled in global settings. Helps identify transcription errors for review."
          />
          <FieldDescription
            field="Mobile Responsive"
            description="Dashboard adapts to mobile screens. Sidebar becomes overlay, message cards stack vertically, touch-friendly controls. Optimized for small screens and touch interaction."
          />
          <FieldDescription
            field="Keyboard Shortcuts"
            description="Spacebar = play/pause audio, Arrow keys = navigate messages, Escape = close modals, Ctrl+F = focus search bar."
          />
          <FieldDescription
            field="URL Parameters"
            description="Dashboard state (filters, page, search) encoded in URL. Can bookmark or share specific views. Browser back/forward buttons work for navigation history."
          />
          <FieldDescription
            field="Performance Optimization"
            description="Lazy loading of audio files, pagination for large lists, caching of search results, and efficient rendering for smooth performance with thousands of recordings."
          />
        </SectionCard>

        <SectionCard title="Actions and Effects" icon={CheckCircle}>
          <ActionDescription
            action="Batch Delete Selected Messages"
            description="Select multiple messages and click Delete Selected button."
            effects={[
              "Confirmation dialog shows count of messages to delete",
              "All selected messages deleted permanently",
              "Message cards removed from list",
              "Cannot be undone",
              "Requires delete_audio permission"
            ]}
          />
          <ActionDescription
            action="Batch Download Selected Messages"
            description="Select multiple messages and click Download Selected button."
            effects={[
              "All selected audio files downloaded as ZIP archive",
              "Files organized by channel and timestamp",
              "Download starts automatically",
              "Original audio quality preserved"
            ]}
          />
          <ActionDescription
            action="Batch Tag Selected Messages"
            description="Select multiple messages and click Tag Selected button."
            effects={[
              "Tag selection dropdown appears",
              "Selected tags applied to all selected messages",
              "Tags displayed as badges on message cards",
              "Changes saved immediately"
            ]}
          />
          <ActionDescription
            action="Filter by Custom Date Range"
            description="Use custom filter to specify exact start and end dates/times."
            effects={[
              "Message list filters to specified time window",
              "Precise control over time range",
              "Can combine with channel and keyword filters",
              "Filter parameters saved in URL"
            ]}
          />
          <ActionDescription
            action="Scroll to New Messages"
            description="Click 'New Messages' indicator to scroll to most recent recordings."
            effects={[
              "Page scrolls to newest messages",
              "New message count resets",
              "Works with both sort directions (newest first/last)"
            ]}
          />
        </SectionCard>

        <SectionCard title="Permissions and Roles" icon={Lock}>
          <div className={"stack stackCompact"}>
            <div className={styles.subtlePanel}>
              <p className={styles.emphasis}>All Users:</p>
              <ul className={styles.bodyText}>
                <li>• View recordings and transcriptions</li>
                <li>• Play audio recordings</li>
                <li>• Search and filter messages</li>
                <li>• Download recordings</li>
                <li>• Use time filters and view settings</li>
                <li>• Highlight keywords</li>
                <li>• View tags (read-only)</li>
              </ul>
            </div>
            <div className={styles.subtlePanel}>
              <p className={styles.emphasis}>Users with Additional Permissions:</p>
              <ul className={styles.bodyText}>
                <li>• <code className={styles.mono}>delete_audio</code>: Delete individual recordings</li>
                <li>• <code className={styles.mono}>manage_tags</code>: Add, remove, and manage tags on recordings</li>
                <li>• <code className={styles.mono}>create_reports</code>: Create incident reports from recordings</li>
                <li>• <code className={styles.mono}>access_advanced_player</code>: Open recordings in advanced player</li>
                <li>• <code className={styles.mono}>access_settings</code>: Access Settings page link</li>
              </ul>
            </div>
            <div className={styles.subtlePanel}>
              <p className={styles.emphasis}>Admin Users:</p>
              <ul className={styles.bodyText}>
                <li>• All permissions listed above</li>
                <li>• Batch delete, download, and tag operations</li>
                <li>• Full access to all features and controls</li>
                <li>• Can manage all recordings regardless of channel restrictions</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Common Use Cases" icon={HelpCircle}>
          <div className={styles.callout}>
            <p className={styles.emphasis}>Finding a Recent Recording</p>
            <p className={styles.bodyText}>
              Use time filter dropdown to select "Last 1 hour" or "Last 24 hours". Then search for keywords from the conversation. Results show matching messages with highlighted search terms. Click message to play audio and verify it's the correct recording.
            </p>
          </div>
          <div className={styles.callout}>
            <p className={styles.emphasis}>Monitoring a Specific Channel</p>
            <p className={styles.bodyText}>
              In sidebar, click toggle switches for all channels except the one you want to monitor. Only recordings from selected channel appear. Use real-time updates to see new recordings as they arrive. Channel status indicator shows if channel is currently recording.
            </p>
          </div>
          <div className={styles.callout}>
            <p className={styles.emphasis}>Creating an Incident Report</p>
            <p className={styles.bodyText}>
              Enable multi-select mode, check messages to include in report, click "Create Report" button. Add report title, notes, and metadata. Report is saved and can be accessed from Reports page for export or sharing.
            </p>
          </div>
          <div className={styles.callout}>
            <p className={styles.emphasis}>Tracking Keyword Mentions</p>
            <p className={styles.bodyText}>
              Click keyword in sidebar keywords section to highlight all occurrences in visible messages. Keyword count shows how many messages contain that keyword in current filtered view. Use time filters to see keyword frequency over time periods.
            </p>
          </div>
          <div className={styles.callout}>
            <p className={styles.emphasis}>Batch Download for Analysis</p>
            <p className={styles.bodyText}>
              Apply filters to find relevant recordings, enable multi-select mode, select all messages on current page (or specific ones), click "Download Selected". All files downloaded as ZIP archive for external analysis or backup.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Troubleshooting" icon={AlertCircle}>
          <div className={styles.subtlePanel}>
            <p className={styles.emphasis}>No Messages Appearing</p>
            <ul className={styles.bodyText}>
              <li>• Check if time filter is too restrictive (try "All" time range)</li>
              <li>• Verify channel toggles are enabled for channels with recordings</li>
              <li>• Clear search query if active</li>
              <li>• Check if date range filter excludes all recordings</li>
              <li>• Verify recordings exist for selected time period</li>
            </ul>
          </div>
          <div className={styles.subtlePanel}>
            <p className={styles.emphasis}>Audio Not Playing</p>
            <ul className={styles.bodyText}>
              <li>• Check browser audio permissions are allowed</li>
              <li>• Verify audio file exists and is accessible</li>
              <li>• Check browser console for audio loading errors</li>
              <li>• Try refreshing page if audio context is stuck</li>
              <li>• Ensure no other audio is playing (only one at a time)</li>
            </ul>
          </div>
          <div className={styles.subtlePanel}>
            <p className={styles.emphasis}>Search Not Finding Results</p>
            <ul className={styles.bodyText}>
              <li>• Check spelling of search terms</li>
              <li>• Try partial words if exact phrase not found</li>
              <li>• Ensure time/channel filters aren't excluding matching messages</li>
              <li>• Verify transcriptions are complete (may take time to process)</li>
              <li>• Search is case-insensitive, but verify special characters</li>
            </ul>
          </div>
          <div className={styles.subtlePanel}>
            <p className={styles.emphasis}>Performance Issues with Large Lists</p>
            <ul className={styles.bodyText}>
              <li>• Use time filters to reduce number of messages displayed</li>
              <li>• Enable pagination instead of continuous scroll</li>
              <li>• Reduce items per page (try 20 or 50 instead of 100)</li>
              <li>• Close expanded audio players when not in use</li>
              <li>• Clear browser cache if page becomes unresponsive</li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard title="Troubleshooting" icon={AlertCircle}>
          <div className={"stack stackCompact"}>
            <div className={styles.subtlePanel}>
              <p className={styles.emphasis}>No Recordings Appearing</p>
              <ul className={styles.bodyText}>
                <li>• Check if all channels are toggled off in sidebar</li>
                <li>• Clear active filters (check filter button for active filters)</li>
                <li>• Verify device status in Settings → Summary</li>
                <li>• Check if date range filter excludes current time</li>
              </ul>
            </div>
            <div className={styles.subtlePanel}>
              <p className={styles.emphasis}>Audio Not Playing</p>
              <ul className={styles.bodyText}>
                <li>• Check browser audio permissions</li>
                <li>• Ensure only one audio player is active at a time</li>
                <li>• Try refreshing the page</li>
                <li>• Check network connectivity if streaming</li>
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  // Settings Page Documentation
  if (page === 'settings') {
    const getSettingsTabDoc = () => {
      // Summary Tab
      if (tab === 'summary' || !tab) {
        return (
          <div>
            <SectionCard title="Summary Tab Overview" icon={TrendingUp}>
              <p className={styles.bodyText}>
                The Summary tab provides a comprehensive overview of system health, device status, recording statistics, error monitoring, user activity, and device management settings. It serves as the central dashboard for monitoring system performance and identifying issues at a glance.
              </p>
              <ScreenshotDisplay 
                src="/screenshots/settings-summary.png" 
                alt="Settings Summary Tab Screenshot"
                caption="Summary tab showing system health metrics, device status, recordings by day, errors, and user activity"
              />
            </SectionCard>

            <SectionCard title="Recordings by Day" icon={FileText}>
              <p className={styles.bodyText}>
                View daily recording statistics and trends. Analyze recording activity patterns over time to understand system usage and identify anomalies.
              </p>
              
              <FieldDescription
                field="Daily Recording Count"
                description="Number of recordings created each day. Shown as a graph or list with date and count."
              />
              <FieldDescription
                field="Recording Duration"
                description="Total duration of recordings per day in hours, minutes, and seconds. Helps monitor storage usage trends."
              />
              <FieldDescription
                field="Channel Breakdown"
                description="Per-channel recording statistics showing which stations/channels are most active each day."
              />
              <FieldDescription
                field="Date Range Selection"
                description="Filter recordings by date range to view statistics for specific time periods (today, this week, this month, custom range)."
              />
              
              <ActionDescription
                action="View Daily Details"
                description="Click on a specific day to view all recordings from that day in the main dashboard."
                effects={[
                  "Navigates to dashboard with date filter applied",
                  "Shows all recordings from selected day",
                  "Preserves other active filters"
                ]}
              />
              <ActionDescription
                action="Export Statistics"
                description="Download recording statistics as CSV or JSON file for external analysis or reporting."
                effects={[
                  "Generates data file",
                  "Downloads to user's computer",
                  "Includes all visible statistics"
                ]}
              />
            </SectionCard>

            <SectionCard title="Errors and Warnings" icon={AlertCircle}>
              <p className={styles.bodyText}>
                Monitor system errors and warnings in real-time. Track issues that may affect recording functionality, device connectivity, or system stability.
              </p>
              
              <FieldDescription
                field="Error Severity Levels"
                description="Errors are categorized by severity: Critical (system failures), Error (operation failures), Warning (potential issues), Info (informational messages)."
              />
              <FieldDescription
                field="Error Timestamp"
                description="When each error or warning occurred, shown in your browser timezone and configured time format."
              />
              <FieldDescription
                field="Error Source"
                description="Origin of the error: Device, API, Database, Network, or System component."
              />
              <FieldDescription
                field="Error Message"
                description="Detailed description of what went wrong, including error codes and context."
              />
              
              <ActionDescription
                action="Filter by Severity"
                description="Filter errors by severity level to focus on critical issues or warnings."
                effects={[
                  "Shows only selected severity levels",
                  "Updates error list in real-time",
                  "Filter persists until changed"
                ]}
              />
              <ActionDescription
                action="View Error Details"
                description="Click on an error to see full details, stack trace, and related events."
                effects={[
                  "Opens detailed error view",
                  "Shows full error context",
                  "Provides troubleshooting suggestions"
                ]}
              />
              <ActionDescription
                action="Clear Errors"
                description="Dismiss resolved errors from the summary view. Errors remain in full logs for historical reference."
                effects={[
                  "Removes errors from summary display",
                  "Full error history preserved in logs",
                  "Does not affect error logging"
                ]}
              />
            </SectionCard>

            <SectionCard title="Users and Login History" icon={Users}>
              <p className={styles.bodyText}>
                Monitor user activity and login history. Track who is accessing the system, when they log in, and their recent activity.
              </p>
              
              <FieldDescription
                field="Active Users"
                description="List of users currently logged into the system with their session start time and last activity."
              />
              <FieldDescription
                field="Login History"
                description="Chronological log of all login attempts showing: username, timestamp, IP address, success/failure status, and logout time."
              />
              <FieldDescription
                field="User Activity"
                description="Recent actions performed by each user: page views, settings changes, recordings accessed, and other system interactions."
              />
              <FieldDescription
                field="Session Duration"
                description="How long each user session has been active. Useful for monitoring and security purposes."
              />
              
              <ActionDescription
                action="View User Details"
                description="Click on a user to see their full profile, permissions, and detailed activity history."
                effects={[
                  "Opens user profile page",
                  "Shows all user information",
                  "Displays permission settings"
                ]}
              />
              <ActionDescription
                action="Export Login History"
                description="Download login history as CSV file for security audits or compliance reporting."
                effects={[
                  "Generates CSV file",
                  "Includes all login attempts",
                  "Downloads to computer"
                ]}
              />
              <ActionDescription
                action="Terminate User Session"
                description="Force logout a specific user. Useful for security or when a session needs to be reset."
                effects={[
                  "Immediately logs out selected user",
                  "User must log in again to access",
                  "Requires admin permissions"
                ]}
              />
            </SectionCard>

            <SectionCard title="Device Management" icon={Radio}>
              <p className={styles.bodyText}>
                Configure automatic device detection and connection settings. Enable or disable automatic scanning for compatible recording devices when the application starts.
              </p>
              
              <FieldDescription
                field="Uniden BC125AT Scanner Auto-Detection"
                description="When enabled, automatically scans for and connects to Uniden BC125AT scanners when the application starts. Keeps your scanner inventory up to date without manual configuration."
                defaultValue="Off"
              />
              
              <ActionDescription
                action="Enable/Disable Scanner Auto-Detection"
                description="Toggle automatic detection of Uniden BC125AT scanners."
                effects={[
                  "Scanning occurs at application startup",
                  "Detected scanners added to device list automatically",
                  "Manual scanner configuration still available when disabled"
                ]}
              />
              
              <div className={styles.subtlePanel}>
                <FieldDescription
                  field="ESP32 Boondock Edge Recorder Auto-Detection"
                  description="When enabled, automatically discovers and connects to ESP32-based Boondock Edge recorders (Silicon Labs CP210x USB devices) when the service starts. Simplifies device setup and management."
                  defaultValue="On"
                />
              </div>
              
              <ActionDescription
                action="Enable/Disable ESP32 Recorder Auto-Detection"
                description="Toggle automatic detection of ESP32-based Boondock Edge recorders via USB/Serial."
                effects={[
                  "Scans USB ports for CP210x devices at startup",
                  "Auto-connects to detected devices",
                  "Maintains device list automatically",
                  "Manual device connection still available"
                ]}
              />
              
              <div className={styles.subtlePanel}>
                <FieldDescription
                  field="USB Audio Device Auto-Detection"
                  description="When enabled, automatically scans for and connects to USB audio devices when the application starts. Enables recording from USB audio interfaces, microphones, and other USB audio sources."
                  defaultValue="Off"
                />
              </div>
              
              <ActionDescription
                action="Enable/Disable USB Audio Auto-Detection"
                description="Toggle automatic detection of USB audio input devices."
                effects={[
                  "Scans for USB audio devices at startup",
                  "Makes USB audio sources available for recording",
                  "Supports multiple USB audio devices",
                  "Manual audio device selection still available"
                ]}
              />
              
              <div className={styles.callout}>
                <p className={styles.bodyText}>
                  <strong>Note:</strong> Auto-detection runs at application startup. To detect devices after startup, use manual scan buttons or restart the application. Disabling auto-detection does not disconnect already-connected devices.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="System Health Metrics" icon={TrendingUp}>
              <FieldDescription
                field="Device Status"
                description="Connection status of all recording devices. Green indicator = Online and operational, Red = Offline or Error, Yellow = Connecting/Configuring."
              />
              <FieldDescription
                field="CPU Usage"
                description="Current CPU utilization percentage. High CPU usage may indicate system overload or background processing."
              />
              <FieldDescription
                field="Memory Usage"
                description="RAM usage statistics showing used and available memory. Helps identify memory leaks or resource constraints."
              />
              <FieldDescription
                field="Disk Space"
                description="Storage usage showing available disk space for recordings. Warnings appear when storage is low."
              />
              <FieldDescription
                field="Network Statistics"
                description="Network activity including upload/download speeds, active connections, and data transfer rates."
              />
            </SectionCard>

            <SectionCard title="Actions" icon={CheckCircle}>
              <ActionDescription
                action="Refresh All Data"
                description="Manually refresh device status, statistics, errors, and user activity. Updates are automatic but can be triggered on-demand."
                effects={[
                  "Updates all summary sections",
                  "Refreshes device connection status",
                  "Fetches latest statistics"
                ]}
              />
              <ActionDescription
                action="View Device Details"
                description="Click on a device in the device status section to view detailed information, configuration, and logs."
              />
              <ActionDescription
                action="Manual Device Scan"
                description="Trigger immediate device scan regardless of auto-detection settings. Useful for detecting newly connected devices."
                effects={[
                  "Scans all device types immediately",
                  "Updates device list",
                  "Shows scan progress"
                ]}
              />
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Available to all users with <code className={styles.mono}>access_settings</code> permission. Admin users see all devices, system metrics, and full user activity. Regular users may have limited view of certain sections.
              </p>
              <div className={"stack stackCompact"}>
                <div className={styles.subtlePanel}>
                  <p className={styles.emphasis}>Admin Users:</p>
                  <ul className={styles.bodyText}>
                    <li>• Full access to all summary sections</li>
                    <li>• Can modify device management settings</li>
                    <li>• Can view all user login history</li>
                    <li>• Can terminate user sessions</li>
                    <li>• Can clear errors and warnings</li>
                  </ul>
                </div>
                <div className={styles.subtlePanel}>
                  <p className={styles.emphasis}>Regular Users:</p>
                  <ul className={styles.bodyText}>
                    <li>• View recordings statistics</li>
                    <li>• View system health metrics</li>
                    <li>• View own login history</li>
                    <li>• Cannot modify device management settings</li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Common Use Cases" icon={HelpCircle}>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Daily System Check</p>
                <p className={styles.bodyText}>
                  Review the Summary tab daily to check device status, review any errors/warnings, verify recording activity, and ensure system health metrics are within normal ranges.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Troubleshooting Issues</p>
                <p className={styles.bodyText}>
                  When issues arise, check the Errors and Warnings section first, review device status, check recent login activity for unauthorized access, and examine recording statistics for anomalies.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Setting Up Auto-Detection</p>
                <p className={styles.bodyText}>
                  Enable auto-detection for your device types (Uniden scanners, ESP32 recorders, USB audio) to automatically discover and connect devices without manual configuration each time.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Troubleshooting" icon={AlertCircle}>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Devices Not Auto-Detecting</p>
                <ul className={styles.bodyText}>
                  <li>• Verify auto-detection toggle is enabled for that device type</li>
                  <li>• Check device is connected and powered on before application starts</li>
                  <li>• Ensure device drivers are installed (especially for CP210x USB devices)</li>
                  <li>• Try manual device scan or restart application</li>
                  <li>• Check device compatibility requirements</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>High Error Count</p>
                <ul className={styles.bodyText}>
                  <li>• Review error details for specific error messages</li>
                  <li>• Check device connection status</li>
                  <li>• Verify network connectivity for API-related errors</li>
                  <li>• Check disk space if storage-related errors appear</li>
                  <li>• Review system logs for more detailed error information</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Recording Statistics Not Updating</p>
                <ul className={styles.bodyText}>
                  <li>• Click refresh button to manually update statistics</li>
                  <li>• Check if devices are actively recording</li>
                  <li>• Verify database connection is working</li>
                  <li>• Check for errors in Errors and Warnings section</li>
                </ul>
              </div>
            </SectionCard>
          </div>
        );
      }

      // Recorders Tab
      if (tab === 'recorders') {
        return (
          <div>
            <SectionCard title="Recorders Tab Overview" icon={Radio}>
              <p className={styles.bodyText}>
                The Recorders tab provides comprehensive management of Boondock Edge recording devices. This section handles device enumeration, firmware management, station configuration, and channel setup. Manage all your recording hardware from a centralized interface.
              </p>
              <ScreenshotDisplay 
                src="/screenshots/settings-recorders.png" 
                alt="Settings Recorders Tab Screenshot"
                caption="Recorders tab showing device enumeration, firmware management, and station configuration options"
              />
            </SectionCard>

            <SectionCard title="Boondock Edge Recorders" icon={Radio}>
              <p className={styles.bodyText}>
                Enumerate and manage Boondock Edge devices connected via Serial Port. This section allows you to discover, configure, and monitor physical recording devices.
              </p>
              
              <FieldDescription
                field="Device Enumeration"
                description="Automatically detect and list all Boondock Edge devices connected via serial port. Devices are identified by their MAC address and connection status."
              />
              <FieldDescription
                field="Serial Port Connection"
                description="Communicate with devices over serial interface (115200 baud). Use for direct device configuration and firmware updates."
              />
              <FieldDescription
                field="Device Status"
                description="Real-time display of device connection status: Online (green), Offline (red), or Configuring (yellow)."
              />
              <FieldDescription
                field="Device Information"
                description="View device details including: MAC address (device ID), firmware version, IP address, WiFi SSID, and hardware specs."
              />
              
              <ActionDescription
                action="Scan for Devices"
                description="Manually trigger device discovery to refresh the list of connected Boondock Edge recorders."
                effects={[
                  "Scans all available serial ports",
                  "Updates device list in real-time",
                  "Shows connection status for each device"
                ]}
              />
              <ActionDescription
                action="Configure Device"
                description="Open device configuration dialog to set WiFi credentials, API endpoints, audio settings, and other parameters via serial CLI commands."
                effects={[
                  "Connects to device via serial port",
                  "Sends configuration commands",
                  "Updates device settings immediately"
                ]}
              />
              <ActionDescription
                action="View Device Logs"
                description="Access real-time serial console output from the device for troubleshooting and monitoring."
                effects={[
                  "Opens terminal interface",
                  "Shows live device logs",
                  "Allows CLI command execution"
                ]}
              />
            </SectionCard>

            <SectionCard title="Firmware Management" icon={Server}>
              <p className={styles.bodyText}>
                Upload and manage ESP32 firmware files for Boondock Edge devices. Update device firmware to latest versions, restore previous versions, or flash custom builds.
              </p>
              
              <FieldDescription
                field="Firmware Upload"
                description="Upload new firmware binary files (.bin) to ESP32 devices. Supports full firmware updates and OTA (Over-The-Air) updates."
                required={true}
              />
              <FieldDescription
                field="Firmware Version"
                description="Current firmware version installed on the device. Check before uploading to ensure compatibility."
              />
              <FieldDescription
                field="Bootloader & Partitions"
                description="Upload bootloader.bin and partitions.bin files when performing complete firmware updates. Required for major version changes."
              />
              <FieldDescription
                field="Firmware Storage"
                description="Local repository of firmware files. Stores different firmware versions for easy deployment to multiple devices."
              />
              
              <ActionDescription
                action="Upload Firmware"
                description="Select firmware file and upload to connected ESP32 device via serial port."
                effects={[
                  "Erases flash memory",
                  "Writes new firmware",
                  "Reboots device automatically",
                  "Device will reconnect after update"
                ]}
              />
              <ActionDescription
                action="Verify Firmware"
                description="Check installed firmware version and compare with available versions to ensure devices are up-to-date."
                effects={[
                  "Reads firmware version from device",
                  "Compares with firmware repository",
                  "Shows update recommendations"
                ]}
              />
              <ActionDescription
                action="Rollback Firmware"
                description="Restore previous firmware version if issues occur with new firmware."
                effects={[
                  "Selects previous firmware version",
                  "Uploads to device",
                  "May require device restart"
                ]}
              />
              
              <div className={styles.highlight}>
                <p className={styles.bodyText}>
                  <strong>Warning:</strong> Firmware updates will disconnect the device temporarily. Ensure stable serial connection before starting. Do not power off device during firmware upload.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Stations" icon={Radio}>
              <p className={styles.bodyText}>
                Add and manage stations (recording channels) for your recordings. Stations represent individual audio input sources and can be configured independently with unique settings.
              </p>
              
              <FieldDescription
                field="Station Name"
                description="Unique identifier for the station. Used in recordings and displayed in the dashboard. Examples: 'Dispatch', 'Channel 1', 'Fire Dept'."
                required={true}
              />
              <FieldDescription
                field="Station ID"
                description="Numeric identifier matching the channel ID on the device. Must match device configuration for proper recording assignment."
                required={true}
              />
              <FieldDescription
                field="Device Association"
                description="Link station to specific Boondock Edge device. Multiple stations can be associated with a single device."
                required={true}
              />
              <FieldDescription
                field="Station Type"
                description="Type of audio source: Radio, Scanner, Phone, or Custom. Affects default settings and metadata."
              />
              
              <ActionDescription
                action="Add Station"
                description="Create a new recording station with custom configuration."
                effects={[
                  "Station appears in dashboard sidebar",
                  "Recordings from this station are tagged",
                  "Station-specific settings apply"
                ]}
              />
              <ActionDescription
                action="Edit Station"
                description="Modify station configuration including name, ID, device association, and settings."
                effects={[
                  "Changes apply to new recordings",
                  "Existing recordings retain old metadata",
                  "Station list updates immediately"
                ]}
              />
              <ActionDescription
                action="Delete Station"
                description="Remove station configuration. Recordings remain but lose station association."
                effects={[
                  "Station removed from dashboard",
                  "Historical recordings preserved",
                  "Cannot be undone"
                ]}
              />
              <ActionDescription
                action="Enable/Disable Station"
                description="Toggle station recording without deleting configuration. Disabled stations don't record but settings are preserved."
                effects={[
                  "Recording stops/starts immediately",
                  "Station hidden/shown in dashboard",
                  "Configuration remains intact"
                ]}
              />
            </SectionCard>

            <SectionCard title="Key Fields" icon={Info}>
              <FieldDescription
                field="Channel Name"
                description="Display name for the channel. Used in dashboard and reports."
                required={true}
              />
              <FieldDescription
                field="Channel ID"
                description="Unique numeric identifier. Automatically assigned but can be changed."
                required={true}
              />
              <FieldDescription
                field="Threshold"
                description="Audio detection threshold (0-100). Lower values detect quieter sounds but may trigger more false positives."
                defaultValue="50"
              />
              <FieldDescription
                field="Min Record Duration"
                description="Minimum recording length in seconds before saving. Prevents very short noise recordings."
                defaultValue="2"
              />
              <FieldDescription
                field="Max Record Duration"
                description="Maximum recording length in seconds. Recording splits into multiple files if exceeded."
                defaultValue="300"
              />
              <FieldDescription
                field="Audio Gain"
                description="Amplification level for audio input. Adjust if recordings are too quiet or too loud."
                defaultValue="1.0"
              />
              <FieldDescription
                field="Channel Color"
                description="Color indicator for this channel in the dashboard. Helps visually distinguish channels."
              />
              <FieldDescription
                field="Person/Unit/Car Fields"
                description="Optional metadata fields for identifying the unit or person associated with this channel."
              />
            </SectionCard>

            <SectionCard title="Actions" icon={CheckCircle}>
              <ActionDescription
                action="Create New Channel"
                description="Click 'Add Channel' to create a new recording channel. Configure all settings before saving."
                effects={[
                  "New channel appears in dashboard sidebar",
                  "Channel starts recording immediately if device is connected",
                  "Requires unique channel ID"
                ]}
              />
              <ActionDescription
                action="Edit Channel"
                description="Click settings icon on a channel to modify its configuration."
                effects={[
                  "Changes apply immediately to new recordings",
                  "Existing recordings unaffected",
                  "May require device restart for some settings"
                ]}
              />
              <ActionDescription
                action="Disable/Enable Channel"
                description="Toggle channel status to temporarily stop recording without deleting configuration."
                effects={[
                  "Recording stops immediately",
                  "Channel hidden from dashboard when disabled",
                  "Configuration preserved"
                ]}
              />
              <ActionDescription
                action="Delete Channel"
                description="Permanently remove channel configuration. Use with caution."
                effects={[
                  "Channel removed from all views",
                  "Recordings are preserved",
                  "Cannot be undone"
                ]}
              />
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Only users with <code className={styles.mono}>manage_channels</code> permission (typically admin role) can create, edit, or delete channels.
              </p>
            </SectionCard>

            <SectionCard title="Common Use Cases" icon={HelpCircle}>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Setting Up New Device</p>
                <p className={styles.bodyText}>
                  Create a new channel, assign unique ID matching device configuration, set threshold based on environment, and configure naming for easy identification.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Reducing False Positives</p>
                <p className={styles.bodyText}>
                  Increase threshold, set longer min record duration, and adjust audio gain to filter out background noise.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Troubleshooting" icon={AlertCircle}>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Device Not Detected</p>
                <ul className={styles.bodyText}>
                  <li>• Check USB/Serial cable connection</li>
                  <li>• Verify correct COM port selected</li>
                  <li>• Ensure device is powered on</li>
                  <li>• Try different USB port or cable</li>
                  <li>• Check device drivers are installed</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Firmware Upload Failed</p>
                <ul className={styles.bodyText}>
                  <li>• Ensure stable serial connection</li>
                  <li>• Do not disconnect during upload</li>
                  <li>• Check firmware file is valid .bin format</li>
                  <li>• Verify firmware version compatibility</li>
                  <li>• Try entering bootloader mode manually</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Station Not Recording</p>
                <ul className={styles.bodyText}>
                  <li>• Verify device is online in Summary tab</li>
                  <li>• Check station is not disabled</li>
                  <li>• Ensure station ID matches device channel ID</li>
                  <li>• Verify device association is correct</li>
                  <li>• Check audio source is connected to device</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Recordings Too Quiet/Loud</p>
                <ul className={styles.bodyText}>
                  <li>• Adjust Audio Gain (increase for quiet, decrease for loud)</li>
                  <li>• Check physical audio input levels on device</li>
                  <li>• Verify microphone/source quality</li>
                  <li>• Use device serial CLI to adjust codec gain</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Serial CLI Not Responding</p>
                <ul className={styles.bodyText}>
                  <li>• Check baud rate is set to 115200</li>
                  <li>• Verify serial port is not in use by another application</li>
                  <li>• Try reconnecting to device</li>
                  <li>• Check device logs for errors</li>
                </ul>
              </div>
            </SectionCard>
          </div>
        );
      }

      // Keywords-Tags Tab
      if (tab === 'keywords-tags') {
        return (
          <div>
            <SectionCard title="Keywords & Tags Tab Overview" icon={Siren}>
              <p className={styles.bodyText}>
                Manage keywords for highlighting important terms in transcripts and tags for organizing recordings. Keywords automatically highlight when they appear, while tags are manually applied to recordings.
              </p>
            </SectionCard>

            <SectionCard title="Keywords Section" icon={Info}>
              <FieldDescription
                field="Keyword Text"
                description="The exact word or phrase to highlight. Case-insensitive by default."
                required={true}
              />
              <FieldDescription
                field="Highlight Color"
                description="Visual color for keyword highlighting in transcripts. Helps distinguish different keyword types."
              />
              <FieldDescription
                field="Alert on Match"
                description="If enabled, creates notification when keyword appears in new recordings."
              />
            </SectionCard>

            <SectionCard title="Tags Section" icon={Info}>
              <FieldDescription
                field="Tag Name"
                description="Label for categorizing recordings. Used for filtering and organization."
                required={true}
              />
              <FieldDescription
                field="Tag Color"
                description="Visual indicator color for this tag in the interface."
              />
            </SectionCard>

            <SectionCard title="Actions" icon={CheckCircle}>
              <ActionDescription
                action="Add Keyword"
                description="Create new keyword to automatically highlight in all transcripts."
                effects={[
                  "Keyword highlighted in existing and new recordings",
                  "Appears in sidebar keyword list",
                  "Shows count of occurrences"
                ]}
              />
              <ActionDescription
                action="Delete Keyword"
                description="Remove keyword. Existing highlights remain in saved recordings."
              />
              <ActionDescription
                action="Tag Recording"
                description="Apply tags to recordings from the dashboard message cards."
                effects={[
                  "Recording can be filtered by tag",
                  "Tag appears as badge on message card",
                  "Multiple tags can be applied"
                ]}
              />
            </SectionCard>
          </div>
        );
      }

      // User Management Tab
      if (tab === 'user-management') {
        return (
          <div>
            <SectionCard title="User Management Tab Overview" icon={Users}>
              <p className={styles.bodyText}>
                Create and manage user accounts, assign roles, and configure permissions. Control who has access to different features of the system.
              </p>
            </SectionCard>

            <SectionCard title="User Fields" icon={Info}>
              <FieldDescription
                field="Username"
                description="Unique identifier for login. Cannot be changed after creation."
                required={true}
              />
              <FieldDescription
                field="Password"
                description="Authentication password. Must meet minimum security requirements."
                required={true}
              />
              <FieldDescription
                field="Role"
                description="User role determines default permissions: Admin (full access), Member (limited access)."
                required={true}
                defaultValue="member"
              />
              <FieldDescription
                field="Two-Factor Authentication (2FA)"
                description="Additional security layer. When enabled, users must provide verification code from authenticator app."
              />
            </SectionCard>

            <SectionCard title="Actions" icon={CheckCircle}>
              <ActionDescription
                action="Create User"
                description="Add new user account with specified role and permissions."
                effects={[
                  "User can immediately log in",
                  "Receives role-based default permissions",
                  "Can be assigned custom permissions"
                ]}
              />
              <ActionDescription
                action="Edit User"
                description="Modify user role, permissions, or account settings."
                effects={[
                  "Changes apply immediately",
                  "User may need to log out and back in for permission changes",
                  "Username cannot be changed"
                ]}
              />
              <ActionDescription
                action="Reset Password"
                description="Admin can reset user password. User will need to set new password on next login."
              />
              <ActionDescription
                action="Enable/Disable 2FA"
                description="Toggle two-factor authentication for enhanced security."
              />
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Only users with <code className={styles.mono}>manage_users</code> permission (typically admin role) can access this tab.
              </p>
              <div className={"stack stackCompact"}>
                <div className={styles.subtlePanel}>
                  <p className={styles.emphasis}>Admin Role:</p>
                  <ul className={styles.bodyText}>
                    <li>• Full system access</li>
                    <li>• All settings and configurations</li>
                    <li>• User management</li>
                    <li>• System administration</li>
                  </ul>
                </div>
                <div className={styles.subtlePanel}>
                  <p className={styles.emphasis}>Member Role:</p>
                  <ul className={styles.bodyText}>
                    <li>• View and play recordings</li>
                    <li>• Search and filter</li>
                    <li>• Limited settings access (if granted)</li>
                  </ul>
                </div>
              </div>
            </SectionCard>
          </div>
        );
      }

      // Global/Configurations Tab
      if (tab === 'global') {
        return (
          <div>
            <SectionCard title="Global Configurations Tab Overview" icon={Server}>
              <p className={styles.bodyText}>
                Configure system-wide settings including transcription services, language, backup options, and network interfaces. Changes affect all channels and recordings.
              </p>
              <ScreenshotDisplay 
                src="/screenshots/settings-global.png" 
                alt="Settings Global Tab Screenshot"
                caption="Global settings tab showing transcription configuration, language settings, and backup options"
              />
            </SectionCard>

            <SectionCard title="Sub-Tabs" icon={Info}>
              <FieldDescription
                field="Display & Language"
                description="Set the time format and display language preferences. Timestamps automatically use the browser timezone."
              />
              <FieldDescription
                field="Audio Post-Processing"
                description="Configure transcription models, services, and hallucination detection settings."
              />
              <FieldDescription
                field="Backup & Restore"
                description="Configure automatic backups to S3, Samba shares, and manage restore points."
              />
              <FieldDescription
                field="Interfaces"
                description="Network interface configuration, hotspot settings, and relay controls."
              />
              <FieldDescription
                field="Hotspot Configuration"
                description="WiFi hotspot settings for device connectivity without existing network."
              />
              <FieldDescription
                field="Danger Zone"
                description="Critical operations like system reset, cache clearing, and data deletion."
              />
            </SectionCard>

            <SectionCard title="Key Settings" icon={Settings}>
              <FieldDescription
                field="Transcription Model"
                description="AI model used for speech-to-text. Options: tiny, base, small, medium, large (larger = more accurate but slower)."
                defaultValue="medium.en"
              />
              <FieldDescription
                field="Transcription Services"
                description="Enable/disable local transcription, OpenAI transcription, or Node.js transcription services."
              />
              <FieldDescription
                field="Hallucination Detection"
                description="If enabled, system flags potentially incorrect transcriptions for review."
              />
              <FieldDescription
                field="Auto Backup"
                description="Schedule automatic backups. Supports S3 cloud storage and Samba network shares."
              />
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Only admin users can modify global configurations. Some sub-tabs (like Danger Zone) require additional confirmation.
              </p>
            </SectionCard>

            <SectionCard title="Important Notes" icon={AlertCircle}>
              <div className={styles.highlight}>
                <p className={styles.bodyText}>
                  <strong>Warning:</strong> Changes to global settings affect the entire system and all recordings. Test changes in non-production environments first. Some changes may require system restart.
                </p>
              </div>
            </SectionCard>
          </div>
        );
      }

      // System Tab
      if (tab === 'system') {
        return (
          <div>
            <SectionCard title="System Tab Overview" icon={Settings2}>
              <p className={styles.bodyText}>
                Advanced system administration and maintenance tools. Manage network interfaces, configure WiFi hotspot, perform system maintenance, monitor health, manage backups, and access critical system operations. Use with caution as changes can affect system stability and availability.
              </p>
              <ScreenshotDisplay 
                src="/screenshots/settings-system.png" 
                alt="Settings System Tab Screenshot"
                caption="System tab showing interfaces, hotspot configuration, backup/restore, maintenance, and system health options"
              />
            </SectionCard>

            <SectionCard title="Interfaces" icon={Network}>
              <p className={styles.bodyText}>
                Configure network interfaces, manage WiFi connections, set up static IP addresses, and configure network relay controls. Essential for device connectivity and network configuration.
              </p>
              
              <FieldDescription
                field="Network Interface"
                description="Physical or virtual network adapter (eth0, wlan0, etc.). Select interface to configure network settings."
                required={true}
              />
              <FieldDescription
                field="IP Configuration Mode"
                description="Network IP assignment method: DHCP (automatic) or Static (manual IP address). Static requires manual IP, subnet, gateway, and DNS configuration."
                defaultValue="DHCP"
              />
              <FieldDescription
                field="Static IP Address"
                description="Manual IPv4 address for network interface. Required when using Static IP mode. Must be valid and unique on network."
              />
              <FieldDescription
                field="Subnet Mask"
                description="Network subnet mask (e.g., 255.255.255.0 or /24). Defines network boundaries."
              />
              <FieldDescription
                field="Gateway"
                description="Default gateway/router IP address. Required for internet and network access."
              />
              <FieldDescription
                field="DNS Servers"
                description="Primary and secondary DNS server IP addresses. Used for domain name resolution. Common: 8.8.8.8 (Google), 1.1.1.1 (Cloudflare)."
              />
              
              <ActionDescription
                action="Change Network Configuration"
                description="Switch between DHCP and Static IP modes, or update static IP settings."
                effects={[
                  "Network interface reconfigures immediately",
                  "May cause temporary network disconnection",
                  "New IP address applies after configuration",
                  "System may need to reconnect to network"
                ]}
              />
              <ActionDescription
                action="Test Network Connection"
                description="Verify network connectivity and DNS resolution after configuration changes."
                effects={[
                  "Tests internet connectivity",
                  "Verifies DNS resolution",
                  "Checks gateway accessibility",
                  "Displays connection status"
                ]}
              />
            </SectionCard>

            <SectionCard title="Hotspot Configuration" icon={Wifi}>
              <p className={styles.bodyText}>
                Configure WiFi hotspot/access point mode. Allows Boondock Edge devices to create their own WiFi network for initial setup or when no existing network is available. Useful for field deployment and device configuration.
              </p>
              
              <FieldDescription
                field="Enable Hotspot"
                description="Activate WiFi access point mode. System creates its own WiFi network that other devices can connect to."
                defaultValue="False"
              />
              <FieldDescription
                field="Hotspot SSID"
                description="Network name (SSID) broadcast by the hotspot. Visible to devices scanning for WiFi networks."
                defaultValue="BoondockEdge"
              />
              <FieldDescription
                field="Hotspot Password"
                description="WiFi password/WPA2 key for hotspot network. Minimum 8 characters recommended for security."
                required={true}
                sensitive={true}
              />
              <FieldDescription
                field="Hotspot Channel"
                description="WiFi channel (1-11 for 2.4GHz). Select channel with least interference in your area. Default: Auto (system selects)."
              />
              
              <ActionDescription
                action="Enable/Disable Hotspot"
                description="Toggle WiFi hotspot mode on or off."
                effects={[
                  "Hotspot starts/stops broadcasting",
                  "Connected devices can join hotspot network",
                  "System remains accessible via hotspot when enabled",
                  "May disable regular WiFi client mode when active"
                ]}
              />
            </SectionCard>

            <SectionCard title="Backup & Restore" icon={Cloud}>
              <p className={styles.bodyText}>
                Perform manual backups, restore from backup files, and manage backup history. Create full system backups including recordings, configuration, and database.
              </p>
              
              <FieldDescription
                field="Backup Type"
                description="Type of backup to create: Full (all data including recordings), Configuration Only (settings and channels), or Database Only (SQLite database)."
                defaultValue="Full"
              />
              <FieldDescription
                field="Backup Destination"
                description="Where to save backup: Local filesystem, S3 (if configured), or Samba share (if configured)."
              />
              
              <ActionDescription
                action="Create Backup Now"
                description="Immediately create a new backup with current settings."
                effects={[
                  "Backup process starts immediately",
                  "Progress shown in backup modal",
                  "Backup file saved to configured destination",
                  "Backup added to history list"
                ]}
              />
              <ActionDescription
                action="Restore from Backup"
                description="Restore system from a previous backup file. Requires backup file selection."
                effects={[
                  "System data replaced with backup data",
                  "Existing data may be overwritten",
                  "System may restart after restore",
                  "All changes since backup are lost",
                  "Requires confirmation before proceeding"
                ]}
              />
            </SectionCard>

            <SectionCard title="Maintenance" icon={Wrench}>
              <p className={styles.bodyText}>
                Perform system maintenance tasks including cache management, log rotation, database optimization, and cleanup operations to keep the system running smoothly.
              </p>
              
              <FieldDescription
                field="Cache Size"
                description="Current size of system cache (transcription cache, temporary files). Shows total cache usage."
              />
              <FieldDescription
                field="Log Rotation"
                description="Configure automatic log file rotation. Prevents log files from growing too large. Options: Daily, Weekly, Monthly, or Disabled."
              />
              <FieldDescription
                field="Database Optimization"
                description="Vacuum and optimize SQLite database to reclaim space and improve performance. Recommended monthly or when database grows large."
              />
              
              <ActionDescription
                action="Clear Cache"
                description="Delete all cached files and temporary data. Frees up disk space but may slow down initial operations."
                effects={[
                  "All cached data deleted",
                  "Disk space freed",
                  "Transcription cache cleared",
                  "Temporary files removed",
                  "Next operations may be slower until cache rebuilds"
                ]}
              />
              <ActionDescription
                action="Optimize Database"
                description="Vacuum and optimize SQLite database structure."
                effects={[
                  "Database file size may decrease",
                  "Query performance improves",
                  "Unused space reclaimed",
                  "Operation may take several minutes for large databases"
                ]}
              />
            </SectionCard>

            <SectionCard title="System Health" icon={Activity}>
              <p className={styles.bodyText}>
                Monitor system health metrics including CPU usage, memory usage, disk space, network statistics, and device status. Essential for proactive system management.
              </p>
              
              <FieldDescription
                field="CPU Usage"
                description="Current CPU utilization percentage. High CPU usage may indicate system overload or intensive processing."
              />
              <FieldDescription
                field="Memory Usage"
                description="RAM usage showing used and available memory. Monitor for memory leaks or resource constraints."
              />
              <FieldDescription
                field="Disk Space"
                description="Storage usage showing used and available disk space. Warnings appear when storage is low."
              />
              <FieldDescription
                field="Network Statistics"
                description="Network activity including upload/download speeds, active connections, and data transfer rates."
              />
              <FieldDescription
                field="Device Status"
                description="Connection status and health of all connected recording devices."
              />
            </SectionCard>

            <SectionCard title="Danger Zone" icon={ShieldAlert}>
              <p className={styles.bodyText}>
                Critical system operations that can affect system availability, delete data, or reset system configuration. Use with extreme caution. All operations require explicit confirmation.
              </p>
              
              <FieldDescription
                field="Factory Reset"
                description="Completely reset system to factory defaults. Deletes all recordings, configuration, users, and data. System returns to initial setup state."
              />
              <FieldDescription
                field="Clear All Data"
                description="Delete all recordings and messages while preserving system configuration and users."
              />
              <FieldDescription
                field="Reset Configuration"
                description="Reset all settings to defaults while preserving recordings and user data."
              />
              
              <ActionDescription
                action="Factory Reset"
                description="Completely reset system. ALL DATA WILL BE DELETED."
                effects={[
                  "All recordings deleted",
                  "All configuration reset to defaults",
                  "All users deleted",
                  "All channels and stations removed",
                  "System returns to initial setup",
                  "Requires multiple confirmations",
                  "Cannot be undone"
                ]}
              />
              
              <div className={styles.subtlePanel}>
                <p className={styles.bodyText}>
                  <strong>DANGER:</strong> Operations in the Danger Zone are irreversible and can cause permanent data loss. Always create a backup before performing any Danger Zone operations. These operations require admin privileges and multiple confirmations.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Sub-Tabs Navigation" icon={Info}>
              <FieldDescription
                field="Interfaces"
                description="Network interface configuration, static IP settings, DHCP configuration, DNS settings, and relay controls."
              />
              <FieldDescription
                field="Hotspot Configuration"
                description="WiFi access point settings for creating device's own WiFi network. SSID, password, channel, and IP range configuration."
              />
              <FieldDescription
                field="Backup & Restore"
                description="Manual backup creation, restore from backup files, backup history management, and backup destination configuration."
              />
              <FieldDescription
                field="Maintenance"
                description="Cache management, log rotation, database optimization, old recording cleanup, and system maintenance tasks."
              />
              <FieldDescription
                field="System Health"
                description="Real-time system health monitoring including CPU, memory, disk space, network stats, and device status."
              />
              <FieldDescription
                field="Danger Zone"
                description="Critical operations including factory reset, clear all data, and reset configuration. Requires multiple confirmations."
              />
            </SectionCard>

            <SectionCard title="Common Use Cases" icon={HelpCircle}>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Setting Up Static IP</p>
                <p className={styles.bodyText}>
                  1. Go to Interfaces tab. 2. Select network interface. 3. Change IP mode to Static. 4. Enter IP address, subnet, gateway, and DNS. 5. Save and restart interface. System will use static IP address.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Enabling Hotspot for Field Deployment</p>
                <p className={styles.bodyText}>
                  Go to Hotspot Configuration, enable hotspot, set SSID and password, save. Connect to hotspot from phone/laptop, access web interface at 192.168.4.1, configure device settings. Disable hotspot after configuration if network available.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>System Running Slow</p>
                <p className={styles.bodyText}>
                  Check System Health for resource usage. Clear cache in Maintenance tab. Optimize database if large. Rotate logs if log files are large. Clean old recordings if storage is full.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Troubleshooting" icon={AlertCircle}>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Network Interface Not Working</p>
                <ul className={styles.bodyText}>
                  <li>• Verify physical network cable is connected (for Ethernet)</li>
                  <li>• Check interface is enabled and not down</li>
                  <li>• Verify IP configuration is correct (DHCP or Static)</li>
                  <li>• Test network connection after configuration</li>
                  <li>• Check gateway and DNS settings are correct</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>High System Resource Usage</p>
                <ul className={styles.bodyText}>
                  <li>• Check System Health tab for CPU/memory usage</li>
                  <li>• Clear cache if cache size is very large</li>
                  <li>• Optimize database if database file is large</li>
                  <li>• Rotate logs if log files are consuming space</li>
                  <li>• Consider system restart if usage is consistently high</li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Restricted to admin users only. All system operations require <code className={styles.mono}>manage_system</code> permission. Danger Zone operations require additional confirmations and are logged for audit purposes.
              </p>
              <div className={styles.subtlePanel}>
                <p className={styles.caption}>
                  Regular users cannot access System tab. System operations can affect system availability, data integrity, and network connectivity.
                </p>
              </div>
            </SectionCard>
          </div>
        );
      }

      // Logs Tab
      if (tab === 'Logs' || tab === 'logs') {
        return (
          <div>
            <SectionCard title="Logs Tab Overview" icon={Logs}>
              <p className={styles.bodyText}>
                Comprehensive log viewing and analysis interface. View real-time and historical system logs, device logs, and application logs organized by type. Essential for troubleshooting, system monitoring, debugging issues, and understanding system behavior. All logs are stored by date for easy historical reference.
              </p>
              <ScreenshotDisplay 
                src="/screenshots/settings-logs.png" 
                alt="Settings Logs Tab Screenshot"
                caption="Logs tab showing log type filters, date navigation, search functionality, and categorized log entries (Critical, Warnings, Communications, Database, Events, Devices)"
              />
            </SectionCard>

            <SectionCard title="Log Types" icon={Info}>
              <FieldDescription
                field="Critical (Error) Logs"
                description="Critical errors and system failures. Shows red-colored entries for serious issues that may affect system functionality. Includes error messages, exceptions, and failure conditions that require immediate attention."
                defaultValue="CRITICAL"
              />
              <FieldDescription
                field="Warning Logs"
                description="Non-critical warnings and potential issues. Yellow-colored entries indicate situations that may cause problems but don't prevent operation. Includes deprecation warnings, configuration issues, and performance concerns."
                defaultValue="WARNINGS"
              />
              <FieldDescription
                field="Communication (Transcription) Logs"
                description="Transcription and communication-related logs. Blue-colored entries showing transcribed messages, audio processing events, and communication system activity. Useful for tracking message flow and transcription status."
                defaultValue="COMMS"
              />
              <FieldDescription
                field="Database Logs"
                description="Database operations and queries. Green-colored entries showing database connections, queries, transactions, and data operations. Helps track database performance and identify query issues."
                defaultValue="DATABASE"
              />
              <FieldDescription
                field="Event Logs"
                description="System events and state changes. Purple-colored entries showing important system events, state transitions, configuration changes, and scheduled tasks. Useful for tracking system activity timeline."
                defaultValue="EVENTS"
              />
              <FieldDescription
                field="Device Logs"
                description="Logs from connected recording devices and serial port communications. Teal-colored entries showing device connections, disconnections, device status, serial port activity, and device-specific events. Essential for troubleshooting device connectivity issues."
                defaultValue="DEVICES"
              />
            </SectionCard>

            <SectionCard title="Key Features" icon={Activity}>
              <FieldDescription
                field="Date Navigation"
                description="Select specific date to view historical logs. Defaults to today's date. Use date picker or navigation arrows to browse previous days. Logs are organized by date for easy access to historical data."
                defaultValue="Today"
              />
              <FieldDescription
                field="Log Type Filter"
                description="Filter logs by type: Critical, Warnings, Communications, Database, Events, or Devices. Select a type from the sidebar to show only logs of that category. Click 'All' to view all log types simultaneously."
              />
              <FieldDescription
                field="Search Functionality"
                description="Search logs by keyword or phrase. Enter search term to filter logs containing that text. Search works across all log fields including timestamps, logger names, and messages. Real-time search updates as you type."
              />
              <FieldDescription
                field="Auto-Refresh"
                description="Automatically refresh logs at regular intervals to show new log entries in real-time. Toggle on/off to enable or disable automatic updates. Useful for monitoring live system activity."
                defaultValue="Off"
              />
              <FieldDescription
                field="Device Log Selection"
                description="View logs from specific connected devices. Select device from device list to see logs from that device's serial port. Shows real-time device communication and status messages."
              />
              <FieldDescription
                field="Log Format"
                description="Logs display with timestamp, log level, logger name, and message. Color-coded by severity for quick visual identification. Monospace font for easy reading of technical data."
              />
            </SectionCard>

            <SectionCard title="Actions" icon={CheckCircle}>
              <ActionDescription
                action="Filter by Log Type"
                description="Select log type from sidebar (Critical, Warnings, Communications, Database, Events, Devices) to view only that category of logs."
                effects={[
                  "Logs filtered to selected type",
                  "Other log types hidden",
                  "Filter persists until changed",
                  "Search still works within filtered view"
                ]}
              />
              <ActionDescription
                action="Navigate Dates"
                description="Use date picker or previous/next buttons to view logs from different dates. Logs are organized by date for historical analysis."
                effects={[
                  "Loads logs from selected date",
                  "Date displayed in header",
                  "All log types available for that date",
                  "Previous dates show historical logs"
                ]}
              />
              <ActionDescription
                action="Search Logs"
                description="Enter search term in search box to find specific log entries. Searches across all log fields and all visible log types."
                effects={[
                  "Filters logs containing search term",
                  "Highlights matching text",
                  "Search works in real-time",
                  "Can search across all log types simultaneously"
                ]}
              />
              <ActionDescription
                action="Enable Auto-Refresh"
                description="Toggle auto-refresh to automatically fetch new log entries at regular intervals. Updates log display without manual refresh."
                effects={[
                  "Logs refresh automatically",
                  "New entries appear in real-time",
                  "Scroll position may change",
                  "Uses system resources for polling"
                ]}
              />
              <ActionDescription
                action="View Device Logs"
                description="Select a device from device list to view logs specific to that device's serial port communication."
                effects={[
                  "Shows logs from selected device",
                  "Real-time device communication visible",
                  "Device-specific errors and status shown",
                  "Serial port activity displayed"
                ]}
              />
              <ActionDescription
                action="Clear Search"
                description="Clear search filter to show all logs again. Click X button in search box or delete search text."
                effects={[
                  "All logs visible again",
                  "Search filter removed",
                  "Original log view restored"
                ]}
              />
            </SectionCard>

            <SectionCard title="Log Entry Details" icon={FileText}>
              <FieldDescription
                field="Timestamp"
                description="Exact time when log entry was created. Displayed in the browser timezone. Helps correlate events and understand timing of system activities."
              />
              <FieldDescription
                field="Log Level Label"
                description="Severity indicator: CRITICAL (red), WARNINGS (yellow), COMMS (blue), DATABASE (green), EVENTS (purple), DEVICES (teal). Quick visual identification of log importance."
              />
              <FieldDescription
                field="Logger Name"
                description="System component or module that generated the log entry. Format: SYSTEM/logger-name. Helps identify source of log messages (e.g., SYSTEM/api, SYSTEM/database, SYSTEM/transcription)."
              />
              <FieldDescription
                field="Message"
                description="Detailed log message content. Contains error details, status information, event descriptions, or other relevant information about what occurred in the system."
              />
              <FieldDescription
                field="Color Coding"
                description="Visual indicators: Red border/background for errors, Yellow for warnings, Blue for communications, Green for database, Purple for events, Teal for devices. Makes scanning logs easier."
              />
            </SectionCard>

            <SectionCard title="Common Use Cases" icon={HelpCircle}>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Troubleshooting System Errors</p>
                <p className={styles.bodyText}>
                  Filter to Critical logs, check timestamp of error, read logger name to identify component, review error message for details. Use date navigation to check if errors are recurring. Search for specific error codes or keywords.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Monitoring Device Connectivity</p>
                <p className={styles.bodyText}>
                  Filter to Device logs, select specific device from device list, enable auto-refresh to monitor in real-time. Watch for connection/disconnection events, serial port errors, or device communication issues.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Tracking Transcription Activity</p>
                <p className={styles.bodyText}>
                  Filter to Communication (COMMS) logs to see all transcription activity. Monitor transcription processing, identify transcription errors, track message flow, and verify transcription service is working correctly.
                </p>
              </div>
              <div className={styles.callout}>
                <p className={styles.emphasis}>Reviewing Historical Events</p>
                <p className={styles.bodyText}>
                  Use date navigation to go back to specific dates, filter by Event logs to see system state changes and configuration updates. Search for specific events or time ranges to understand what happened at particular times.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Troubleshooting" icon={AlertCircle}>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>No Logs Appearing</p>
                <ul className={styles.bodyText}>
                  <li>• Verify correct date is selected (defaults to today)</li>
                  <li>• Check if log type filter is too restrictive</li>
                  <li>• Ensure search term isn't filtering out all logs</li>
                  <li>• Try refreshing page or clearing filters</li>
                  <li>• Check if logs exist for selected date</li>
                  <li>• Verify system is generating logs (check if system is running)</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Search Not Finding Results</p>
                <ul className={styles.bodyText}>
                  <li>• Verify search term spelling is correct</li>
                  <li>• Try broader search terms (partial words)</li>
                  <li>• Check if log type filter excludes matching logs</li>
                  <li>• Ensure correct date is selected (logs may be from different date)</li>
                  <li>• Clear search and try different keywords</li>
                  <li>• Search is case-sensitive, try different case variations</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Device Logs Not Showing</p>
                <ul className={styles.bodyText}>
                  <li>• Verify device is connected and recognized by system</li>
                  <li>• Check device is selected in device list</li>
                  <li>• Ensure device has serial port communication active</li>
                  <li>• Filter to Device logs to see device-related entries</li>
                  <li>• Check if device driver is properly installed</li>
                  <li>• Verify serial port is not in use by another application</li>
                </ul>
              </div>
              <div className={styles.subtlePanel}>
                <p className={styles.emphasis}>Too Many Logs to Review</p>
                <ul className={styles.bodyText}>
                  <li>• Filter by specific log type to reduce volume</li>
                  <li>• Use search to find specific entries</li>
                  <li>• Focus on Critical and Warning logs first</li>
                  <li>• Check specific date range rather than all dates</li>
                  <li>• Sort or filter by timestamp to see most recent issues</li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard title="Permissions" icon={Lock}>
              <p className={styles.bodyText}>
                Available to all users with <code className={styles.mono}>view_logs</code> permission. Admin users can view all log types and device logs. Regular users may have limited access to certain log types for security purposes.
              </p>
              <div className={styles.subtlePanel}>
                <p className={styles.caption}>
                  Logs may contain sensitive system information. Access is logged for audit purposes. Export and clearing of logs may require additional permissions.
                </p>
              </div>
            </SectionCard>
          </div>
        );
      }

      return (
        <div>
          <SectionCard title="Settings Overview" icon={Settings}>
            <p className={styles.bodyText}>
              The Settings page provides comprehensive system configuration and management. Access different tabs using the sidebar navigation.
            </p>
            <div className={styles.callout}>
              <p className={styles.bodyText}>
                <strong>Tip:</strong> Use the sidebar to navigate to specific settings sections. Each tab contains detailed configuration options for that area.
              </p>
            </div>
          </SectionCard>
        </div>
      );
    };

    return getSettingsTabDoc();
  }

  // Users Page Documentation
  if (page === 'users') {
    return (
      <div>
        <SectionCard title="User Management Overview" icon={Users}>
          <p className={styles.bodyText}>
            The Users page provides a dedicated interface for managing user accounts. This page focuses specifically on user administration, separate from other settings.
          </p>
        </SectionCard>
        <SectionCard title="Features" icon={Info}>
          <p className={styles.bodyText}>
            This page offers the same functionality as the Settings → User Management tab, but in a dedicated full-page view for easier user administration workflows.
          </p>
        </SectionCard>
      </div>
    );
  }

  // Logs Page Documentation
  if (page === 'logs') {
    return (
      <div>
        <SectionCard title="Logs Page Overview" icon={Logs}>
          <p className={styles.bodyText}>
            Dedicated page for viewing and analyzing system logs. Provides enhanced filtering, search, and export capabilities compared to the Settings → Logs tab.
          </p>
        </SectionCard>
        <SectionCard title="Features" icon={Info}>
          <p className={styles.bodyText}>
            Full-page log viewer with advanced search, date range filtering, and real-time log streaming capabilities.
          </p>
        </SectionCard>
      </div>
    );
  }

  // Reports Page Documentation
  if (page === 'reports') {
    return (
      <div>
        <SectionCard title="Reports Overview" icon={FileText}>
          <p className={styles.bodyText}>
            Create and manage incident reports based on recordings. Reports can include multiple recordings, notes, timestamps, and metadata for documentation and analysis.
          </p>
        </SectionCard>
        <SectionCard title="Actions" icon={CheckCircle}>
          <ActionDescription
            action="Create Report"
            description="Create new incident report, optionally including selected recordings."
            effects={[
              "Report saved with unique ID",
              "Can be exported or printed",
              "Linked recordings remain accessible"
            ]}
          />
          <ActionDescription
            action="View Report"
            description="Open existing report to view details, included recordings, and notes."
          />
          <ActionDescription
            action="Export Report"
            description="Download report as PDF or text file for external sharing."
          />
        </SectionCard>
      </div>
    );
  }

  // Profile Page Documentation
  if (page === 'profile') {
    return (
      <div>
        <SectionCard title="User Profile Overview" icon={User}>
          <p className={styles.bodyText}>
            View and manage your personal account settings, including password, two-factor authentication, and preferences.
          </p>
        </SectionCard>
        <SectionCard title="Sections" icon={Info}>
          <FieldDescription
            field="Account Information"
            description="View username, email, role, and account creation date. Username cannot be changed."
          />
          <FieldDescription
            field="Change Password"
            description="Update your login password. Requires current password confirmation."
          />
          <FieldDescription
            field="Two-Factor Authentication"
            description="Enable or disable 2FA for additional account security."
          />
          <FieldDescription
            field="Preferences"
            description="Personal display and interface preferences."
          />
        </SectionCard>
      </div>
    );
  }

  // Advanced Player Page Documentation
  if (page === 'player') {
    return (
      <div>
        <SectionCard title="Advanced Audio Player Overview" icon={Volume2}>
          <p className={styles.bodyText}>
            Enhanced audio player with advanced controls, waveform visualization, speed adjustment, and detailed playback features. Opens recordings in a dedicated full-page interface.
          </p>
        </SectionCard>
        <SectionCard title="Features" icon={Info}>
          <FieldDescription
            field="Waveform Visualization"
            description="Visual representation of audio waveform for precise navigation and analysis."
          />
          <FieldDescription
            field="Speed Control"
            description="Adjust playback speed from 0.5x to 2x for faster review or detailed analysis."
          />
          <FieldDescription
            field="Precise Seeking"
            description="Click anywhere on waveform or timeline to jump to exact position."
          />
          <FieldDescription
            field="Keyboard Shortcuts"
            description="Spacebar = play/pause, Arrow keys = seek, + / - = speed control."
          />
        </SectionCard>
      </div>
    );
  }

  return null;
};

export default PageSpecificDocumentation;
