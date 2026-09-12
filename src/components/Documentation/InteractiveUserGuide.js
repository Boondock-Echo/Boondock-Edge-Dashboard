import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Play, 
  Pause,
  Search, 
  Settings, 
  Users, 
  Radio,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  HelpCircle,
  ArrowRight,
  ArrowUpDown,
  Copy,
  Check,
  CheckCheck,
  X as XIcon,
  Filter,
  Eye,
  FileText,
  Tag,
  Volume2,
  Volume1,
  Trash2,
  Download,
  ExternalLink,
  MessageSquare,
  SkipBack,
  SkipForward,
  Clock,
  Calendar,
  Sun,
  Moon
} from 'lucide-react';
import PageSpecificDocumentation from './PageSpecificDocumentation';
import styles from '../ui/Documentation.module.css';

const InteractiveUserGuide = () => {
  const [searchParams] = useSearchParams();
  const pageParam = searchParams.get('page');
  const tabParam = searchParams.get('tab');
  const globalTabParam = searchParams.get('globalTab');

  // Initialize sections based on URL parameters
  const getInitialSections = () => {
    const baseSections = {
      gettingStarted: false,
      howItWorks: false,
      commonTasks: false,
      troubleshooting: false,
      quickReference: false,
      bestPractices: false,
      interfaceControls: false
    };

    // Show relevant sections based on page parameter
    if (pageParam === 'dashboard') {
      baseSections.gettingStarted = true;
      baseSections.interfaceControls = true;
      baseSections.commonTasks = true;
    } else if (pageParam === 'settings') {
      baseSections.interfaceControls = true;
      baseSections.commonTasks = true;
      baseSections.quickReference = true;
      
      // If specific tab is provided, we could show even more specific content
      if (tabParam === 'summary') {
        baseSections.quickReference = true;
      } else if (tabParam === 'recorders' || tabParam === 'channels-stations') {
        baseSections.commonTasks = true;
        baseSections.troubleshooting = true;
      } else if (tabParam === 'keywords-tags') {
        baseSections.commonTasks = true;
      }
    } else if (pageParam === 'users') {
      baseSections.commonTasks = true;
      baseSections.quickReference = true;
    } else if (pageParam === 'logs') {
      baseSections.troubleshooting = true;
      baseSections.quickReference = true;
    } else if (pageParam === 'reports') {
      baseSections.commonTasks = true;
      baseSections.quickReference = true;
    } else if (pageParam === 'player') {
      baseSections.interfaceControls = true;
    } else {
      // Default: show getting started
      baseSections.gettingStarted = true;
    }

    return baseSections;
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return JSON.parse(localStorage.getItem("isDarkMode")) || false;
  });
  
  const [expandedSections, setExpandedSections] = useState(getInitialSections);
  const [copiedText, setCopiedText] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Update sections when URL parameters change
  useEffect(() => {
    setExpandedSections(getInitialSections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageParam, tabParam, globalTabParam]);

  // Highlight text function
  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) => 
      regex.test(part) ? (
        <mark key={idx} className={styles.highlight}>
          {part}
        </mark>
      ) : part
    );
  };

  // Check if content matches search query
  const matchesSearch = (text) => {
    if (!searchQuery || !text) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Auto-expand sections that have matches when searching
  useEffect(() => {
    if (searchQuery) {
      // Check each section for matches and expand if found
      const queryLower = searchQuery.toLowerCase();
      setExpandedSections({
        gettingStarted: 'getting started access dashboard log in check device verify channels'.includes(queryLower),
        howItWorks: 'how it works system flow recording process device listens upload transcription'.includes(queryLower),
        commonTasks: 'common tasks find recording monitor channel review activity configure keyword'.includes(queryLower),
        troubleshooting: 'troubleshooting no recordings transcribing device offline can\'t find'.includes(queryLower),
        quickReference: 'quick reference keyboard shortcuts action location'.includes(queryLower),
        bestPractices: 'best practices tips optimizing recording quality daily operations'.includes(queryLower),
        interfaceControls: 'interface controls buttons topbar sidebar message audio player filter view settings'.includes(queryLower)
      });
    }
  }, [searchQuery]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const SectionHeader = ({ title, icon: Icon, isExpanded, onClick, children }) => (
    <button
      onClick={onClick}
      className={styles.sectionToggle}
    >
      <div className={"row"}>
        <Icon className={`${styles.iconMedium} ${styles.accentIcon}`} />
        <h3 className={styles.heading4}>{title}</h3>
        {children}
      </div>
      {isExpanded ? (
        <ChevronDown className={`${styles.iconMedium} ${styles.accentIcon}`} />
      ) : (
        <ChevronRight className={`${styles.iconMedium} ${styles.accentIcon}`} />
      )}
    </button>
  );

  const StepCard = ({ number, title, description, icon: Icon, code, children }) => {
    const titleMatches = matchesSearch(title);
    const descMatches = matchesSearch(description);
    const shouldShow = !searchQuery || titleMatches || descMatches;
    
    if (!shouldShow) return null;
    
    return (
      <div className={styles.card}>
        <div className={styles.rowStart}>
          <div className={styles.stepNumber}>
            {number}
          </div>
          <div className={"grow"}>
            <div className={"row"}>
              {Icon && <Icon className={`${styles.iconMedium} ${styles.accentIcon}`} />}
              <h4 className={styles.emphasis}>
                {highlightText(title, searchQuery)}
              </h4>
            </div>
            <p className={styles.bodyText}>
              {highlightText(description, searchQuery)}
            </p>
          {code && (
            <div className={styles.codeWrap}>
              <div className={styles.codeBlock}>
                {code}
              </div>
              <button
                onClick={() => copyToClipboard(code, `code-${number}`)}
                className={styles.copyButton}
              >
                {copiedText === `code-${number}` ? (
                  <Check className={`${styles.iconSmall} ${styles.successIcon}`} />
                ) : (
                  <Copy className={styles.iconSmall} />
                )}
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
    );
  };

  const TaskCard = ({ title, description, steps, icon: Icon }) => {
    const titleMatches = matchesSearch(title);
    const descMatches = matchesSearch(description);
    const stepsMatch = steps.some(step => matchesSearch(step));
    const shouldShow = !searchQuery || titleMatches || descMatches || stepsMatch;
    
    if (!shouldShow) return null;
    
    return (
      <div className={styles.card}>
        <div className={"row"}>
          {Icon && <Icon className={`${styles.iconMedium} ${styles.accentIcon}`} />}
          <h4 className={styles.emphasis}>
            {highlightText(title, searchQuery)}
          </h4>
        </div>
        <p className={styles.bodyText}>
          {highlightText(description, searchQuery)}
        </p>
        <ol className={styles.orderedList}>
          {steps.map((step, idx) => {
            const stepMatches = matchesSearch(step);
            if (searchQuery && !stepMatches) return null;
            return (
              <li key={idx} className={styles.bodyText}>
                <span className={styles.emphasis}>{idx + 1}.</span> {highlightText(step, searchQuery)}
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const TroubleshootingCard = ({ problem, solutions, icon: Icon }) => {
    const problemMatches = matchesSearch(problem);
    const solutionsMatch = solutions.some(solution => matchesSearch(solution));
    const shouldShow = !searchQuery || problemMatches || solutionsMatch;
    
    if (!shouldShow) return null;
    
    return (
      <div className={styles.card}>
        <div className={styles.rowStart}>
          <AlertCircle className={`${styles.iconMedium} ${styles.dangerIcon}`} />
          <div className={"grow"}>
            <h4 className={styles.emphasis}>
              {highlightText(problem, searchQuery)}
            </h4>
            <ul className={"stack stackCompact"}>
              {solutions.map((solution, idx) => {
                const solutionMatches = matchesSearch(solution);
                if (searchQuery && !solutionMatches) return null;
                return (
                  <li key={idx} className={styles.rowStart}>
                    <CheckCircle className={`${styles.iconSmall} ${styles.successIcon}`} />
                    <span>{highlightText(solution, searchQuery)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Get context message based on URL parameters
  const getContextMessage = () => {
    if (!pageParam) return null;

    const messages = {
      dashboard: 'Showing documentation relevant to the Dashboard page.',
      settings: tabParam 
        ? `Showing documentation relevant to Settings → ${tabParam.charAt(0).toUpperCase() + tabParam.slice(1).replace('-', ' ')}.`
        : 'Showing documentation relevant to the Settings page.',
      users: 'Showing documentation relevant to User Management.',
      logs: 'Showing documentation relevant to the Logs page.',
      reports: 'Showing documentation relevant to Reports.',
      profile: 'Showing documentation relevant to User Profile.',
      player: 'Showing documentation relevant to the Advanced Audio Player.',
      general: null
    };

    return messages[pageParam] || null;
  };

  const contextMessage = getContextMessage();

  // Determine if we should show page-specific documentation or general guide
  const showPageSpecificDocs = pageParam && pageParam !== 'general';

  return (
    <div className={"stack"}>
      {/* Context Banner */}
      {contextMessage && (
        <div className={styles.card}>
          <div className={"row"}>
            <HelpCircle className={`${styles.iconMedium} ${styles.accentIcon}`} />
            <p className={styles.emphasis}>{contextMessage}</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={styles.searchClear}
            >
              <XIcon className={styles.iconSmall} />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className={styles.caption}>
            Searching for: <span className={styles.emphasis}>{searchQuery}</span>
          </p>
        )}
      </div>

      {/* Page-Specific Documentation */}
      {showPageSpecificDocs && (
        <div className={styles.sectionGap}>
          <PageSpecificDocumentation
            page={pageParam}
            tab={tabParam}
            globalTab={globalTabParam}
            highlightText={highlightText}
            matchesSearch={matchesSearch}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {/* Only show general guide sections if no page-specific docs or if explicitly showing general */}
      {(!showPageSpecificDocs || pageParam === 'general') && (
        <>
          {/* Getting Started */}
          <div>
        <SectionHeader
          title="Getting Started"
          icon={Play}
          isExpanded={expandedSections.gettingStarted}
          onClick={() => toggleSection('gettingStarted')}
        />
        {expandedSections.gettingStarted && (
          <div className={styles.sectionContent}>
            <StepCard
              number="1"
              title="Access the Dashboard"
              description="Open your web browser and navigate to the Boondock Edge server URL"
              icon={BookOpen}
            >
              <div className={styles.callout}>
                <p className={styles.caption}>
                  💡 <strong>Tip:</strong> Bookmark the URL for quick access
                </p>
              </div>
            </StepCard>

            <StepCard
              number="2"
              title="Log In"
              description="Enter your username and password to access the system"
              icon={Users}
            />

            <StepCard
              number="3"
              title="Check Device Status"
              description="Look at the dashboard to see connected devices. Green = Online, Red = Needs Attention"
              icon={Radio}
            >
              <div className={styles.codeBlock}>
                <div className={"row"}>
                  <div className={`${styles.statusDot} ${styles.statusSuccess}`}></div>
                  <span>Device Online</span>
                </div>
                <div className={"row"}>
                  <div className={`${styles.statusDot} ${styles.statusDanger}`}></div>
                  <span>Device Offline</span>
                </div>
              </div>
            </StepCard>

            <StepCard
              number="4"
              title="Verify Channels"
              description="Go to Settings → Channels to ensure your audio channels are configured"
              icon={Settings}
            />
          </div>
        )}
      </div>

      {/* How It Works */}
      <div>
        <SectionHeader
          title="How It Works"
          icon={HelpCircle}
          isExpanded={expandedSections.howItWorks}
          onClick={() => toggleSection('howItWorks')}
        />
        {expandedSections.howItWorks && (
          <div className={styles.sectionContent}>
            <div className={styles.card}>
              <h4 className={styles.emphasis}>
                System Flow Diagram
              </h4>
              <div className={styles.mono}>
                <pre className={styles.codeBlock}>
{`┌─────────────────────────────────────┐
│   Boondock Edge Device              │
│   (Hardware Recorder)               │
│                                     │
│   • Listens for audio               │
│   • Detects audio threshold         │
│   • Records automatically           │
│   • Uploads to server               │
└──────────────┬──────────────────────┘
               │
               │ (WiFi/Network)
               │
               ▼
┌─────────────────────────────────────┐
│   Boondock Edge Server              │
│   (Web Application)                 │
│                                     │
│   • Receives recordings             │
│   • Transcribes audio               │
│   • Stores data                     │
│   • Provides dashboard              │
└─────────────────────────────────────┘`}
                </pre>
              </div>
            </div>

            <div className={styles.card}>
              <h4 className={styles.emphasis}>
                Recording Process
              </h4>
              <div className={"stack"}>
                {[
                  { step: 'Device Listens', desc: 'Continuously monitors audio input' },
                  { step: 'Audio Detection', desc: 'When audio exceeds threshold, recording starts' },
                  { step: 'Recording', desc: 'Audio captured and stored locally' },
                  { step: 'Upload', desc: 'Recording automatically uploaded to server' },
                  { step: 'Transcription', desc: 'Server processes audio to create text' },
                  { step: 'Storage', desc: 'Recording and transcript stored in dashboard' }
                ].map((item, idx) => (
                  <div key={idx} className={styles.rowStart}>
                    <div className={"row"}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className={styles.emphasis}>{item.step}</p>
                      <p className={styles.bodyText}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Common Tasks */}
      <div>
        <SectionHeader
          title="Common Tasks"
          icon={CheckCircle}
          isExpanded={expandedSections.commonTasks}
          onClick={() => toggleSection('commonTasks')}
        />
        {expandedSections.commonTasks && (
          <div className={styles.sectionContent}>
            <TaskCard
              title="Find a Specific Recording"
              description="Search through all recordings to find a specific conversation or event"
              icon={Search}
              steps={[
                'Go to the main dashboard',
                'Use the search bar at the top',
                'Enter keywords from the conversation',
                'Review the search results',
                'Click on a result to view details and play audio'
              ]}
            />

            <TaskCard
              title="Monitor a Specific Channel"
              description="Focus on recordings from a single audio source"
              icon={Radio}
              steps={[
                'In the sidebar, find the Channels section',
                'Click on the channel you want to monitor',
                'The dashboard will filter to show only that channel',
                'You\'ll see real-time updates for that channel'
              ]}
            />

            <TaskCard
              title="Review Today's Activity"
              description="View all recordings from the current day"
              icon={BookOpen}
              steps={[
                'On the dashboard, look at the date filter',
                'Select "Today" or click today\'s date',
                'Scroll through the messages list',
                'Use the search bar if you need to find something specific'
              ]}
            />

            <TaskCard
              title="Configure Keyword Alerts"
              description="Set up keywords to highlight important terms in transcripts"
              icon={Settings}
              steps={[
                'Go to Settings → Keywords',
                'Click "Add Keyword"',
                'Enter the keyword you want to monitor',
                'Save the keyword',
                'When this keyword appears, it will be highlighted'
              ]}
            />
          </div>
        )}
      </div>

      {/* Troubleshooting */}
      <div>
        <SectionHeader
          title="Troubleshooting"
          icon={AlertCircle}
          isExpanded={expandedSections.troubleshooting}
          onClick={() => toggleSection('troubleshooting')}
        />
        {expandedSections.troubleshooting && (
          <div className={styles.sectionContent}>
            <TroubleshootingCard
              problem="No Recordings Appearing"
              solutions={[
                'Check device status in Settings → Summary',
                'Verify device is online (green indicator)',
                'Check channel configuration in Settings → Channels',
                'Adjust threshold settings if needed'
              ]}
            />

            <TroubleshootingCard
              problem="Recordings Not Transcribing"
              solutions={[
                'Check transcription settings in Settings → Summary',
                'Verify transcription services are enabled',
                'Check audio quality of recordings',
                'Wait a few minutes and refresh - processing may be queued'
              ]}
            />

            <TroubleshootingCard
              problem="Can't Find a Recording"
              solutions={[
                'Expand the date range in filters',
                'Clear channel filters',
                'Try different search terms',
                'Check if recording is still processing'
              ]}
            />

            <TroubleshootingCard
              problem="Device Shows Offline"
              solutions={[
                'Check physical device power and network cables',
                'Verify WiFi/network settings on device',
                'Restart the device if possible',
                'Contact administrator if issue persists'
              ]}
            />
          </div>
        )}
      </div>

      {/* Quick Reference */}
      <div>
        <SectionHeader
          title="Quick Reference"
          icon={BookOpen}
          isExpanded={expandedSections.quickReference}
          onClick={() => toggleSection('quickReference')}
        />
        {expandedSections.quickReference && (
          <div className={styles.sectionContent}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.emphasis}>
                      Action
                    </th>
                    <th className={styles.emphasis}>
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody >
                  {[
                    { action: 'View recordings', location: 'Main Dashboard' },
                    { action: 'Search recordings', location: 'Search bar (top of dashboard)' },
                    { action: 'Configure channels', location: 'Settings → Channels' },
                    { action: 'Manage users', location: 'Settings → Users' },
                    { action: 'View logs', location: 'Settings → Logs' },
                    { action: 'Check device status', location: 'Settings → Summary' },
                    { action: 'Set keywords', location: 'Settings → Keywords' },
                    { action: 'Change settings', location: 'Settings → Global Settings' }
                  ].map((row, idx) => (
                    <tr key={idx}>
                      <td className={styles.bodyText}>
                        {row.action}
                      </td>
                      <td className={styles.bodyText}>
                        {row.location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.card}>
              <h4 className={styles.emphasis}>
                Keyboard Shortcuts
              </h4>
              <div className={"stack stackCompact"}>
                {[
                  { key: 'Ctrl/Cmd + F', action: 'Focus search bar' },
                  { key: 'Esc', action: 'Close modals/dialogs' },
                  { key: 'Arrow Keys', action: 'Navigate through messages (when focused)' }
                ].map((item, idx) => (
                  <div key={idx} className={"row"}>
                    <kbd className={styles.mono}>
                      {item.key}
                    </kbd>
                    <span className={styles.bodyText}>
                      {item.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interface Controls & Buttons */}
      <div>
        <SectionHeader
          title="Interface Controls & Buttons"
          icon={Settings}
          isExpanded={expandedSections.interfaceControls}
          onClick={() => toggleSection('interfaceControls')}
        />
        {expandedSections.interfaceControls && (
          <div className={styles.sectionContent}>
            {/* Top Bar Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <Settings className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Top Bar Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <CheckCheck className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Select Messages Button</h5>
                      <p className={styles.bodyText}>
                        Toggles multi-select mode. When active, you can select multiple messages for batch operations like delete, download, or tag. Click again to exit select mode.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <FileText className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Incident Reports Button</h5>
                      <p className={styles.bodyText}>
                        Opens the Incident Reports page where you can view, create, and manage incident reports based on recordings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Filter className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Filter Button</h5>
                      <p className={styles.bodyText}>
                        Opens the filter panel to set custom date ranges, time ranges, and other filtering options. Use this to narrow down recordings by specific time periods.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Eye className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>View Settings Button</h5>
                      <p className={styles.bodyText}>
                        Opens view customization options. Toggle visibility of time, car/unit, channel, and person fields. Adjust timestamp display format and other view preferences.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Settings className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Settings Button</h5>
                      <p className={styles.bodyText}>
                        Opens the Settings page (admin only). Access system configuration, channel management, user management, keywords, and other administrative functions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    {isDarkMode ? (
                      <Sun className={`${styles.iconMedium} ${styles.warningIcon}`} />
                    ) : (
                      <Moon className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    )}
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Theme Toggle Button</h5>
                      <p className={styles.bodyText}>
                        Switches between light and dark mode. Your preference is saved and will persist across sessions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Clock className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>System Clock</h5>
                      <p className={styles.bodyText}>
                        Displays the current time in your browser timezone. Click to adjust system time (admin only). Shows the detected browser timezone below the time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <Radio className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Sidebar Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Search className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Search Bar</h5>
                      <p className={styles.bodyText}>
                        Search through all recordings by typing keywords, phrases, or any text from transcripts. Results update in real-time as you type.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Radio className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Channel Toggle</h5>
                      <p className={styles.bodyText}>
                        Click a channel name to toggle it on/off. Active channels show recordings, inactive channels are hidden. Each channel has a color indicator and message count.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Settings className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Channel Settings Icon</h5>
                      <p className={styles.bodyText}>
                        Click the settings icon next to a channel to configure its name, color, and other properties. Opens a modal with channel configuration options.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Tag className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Keyword Toggle</h5>
                      <p className={styles.bodyText}>
                        Click a keyword to highlight it in all recordings. Active keywords are highlighted in the transcript text. Shows count of occurrences next to each keyword.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <BookOpen className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Documentation Button</h5>
                      <p className={styles.bodyText}>
                        Opens the user guide documentation in a new tab. Contains detailed instructions, troubleshooting, and reference information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Card Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <MessageSquare className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Message Card Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Play className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Play/Pause Audio Button</h5>
                      <p className={styles.bodyText}>
                        Click to play the audio recording. Click again to pause. The button changes to a pause icon when playing. Only one audio can play at a time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Volume2 className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Expand Audio Player</h5>
                      <p className={styles.bodyText}>
                        Click the audio icon or waveform to expand the audio player. Shows playback controls, timeline, speed controls, and waveform visualization.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Trash2 className={`${styles.iconMedium} ${styles.dangerIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Delete Button</h5>
                      <p className={styles.bodyText}>
                        Permanently deletes the recording and transcript. Requires confirmation. Only available if you have delete permissions. Cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Tag className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Tag Button</h5>
                      <p className={styles.bodyText}>
                        Add or manage tags for the recording. Tags help categorize and organize recordings. Click to view existing tags or add new ones.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <FileText className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Incident Report Button</h5>
                      <p className={styles.bodyText}>
                        Create an incident report from this recording. Opens a modal to fill in incident details, add notes, and save the report.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Download className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Download Button</h5>
                      <p className={styles.bodyText}>
                        Downloads the audio file to your computer. In multi-select mode, you can download multiple recordings as a ZIP file.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <ExternalLink className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Advanced Player Button</h5>
                      <p className={styles.bodyText}>
                        Opens the advanced audio player in a new page with enhanced controls, waveform analysis, and playback features.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Check className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Message Checkbox (Multi-Select Mode)</h5>
                      <p className={styles.bodyText}>
                        In multi-select mode, checkboxes appear on messages. Select multiple messages to perform batch operations like delete, download, or tag.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Audio Player Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <Volume2 className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Audio Player Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Play className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Play/Pause</h5>
                      <p className={styles.bodyText}>
                        Main playback control. Toggles between playing and pausing the audio.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <SkipBack className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Skip Backward</h5>
                      <p className={styles.bodyText}>
                        Jumps backward by a set interval (typically 10 seconds). Useful for replaying missed audio.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <SkipForward className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Skip Forward</h5>
                      <p className={styles.bodyText}>
                        Jumps forward by a set interval (typically 10 seconds). Useful for skipping ahead.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <ArrowUpDown className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Playback Speed Control</h5>
                      <p className={styles.bodyText}>
                        Adjust playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x). Useful for faster review or detailed analysis.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <div className={`${styles.iconMedium} ${styles.accentIcon}`}></div>
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Progress Timeline</h5>
                      <p className={styles.bodyText}>
                        Click anywhere on the timeline to jump to that position in the audio. Shows current time and total duration.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Volume2 className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Volume Control</h5>
                      <p className={styles.bodyText}>
                        Adjust audio volume using the volume slider. Mute/unmute with the volume icon.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & View Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <Filter className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Filter & View Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Clock className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Time Filter Dropdown</h5>
                      <p className={styles.bodyText}>
                        Quick time filters: All, Last 30 mins, Last 1 hour, Last 2 hours, Last 4 hours, Last 8 hours, Last 1 Day, Last 2 Days, Last Week. Select a preset to filter recordings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Calendar className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Custom Date Range</h5>
                      <p className={styles.bodyText}>
                        In the filter panel, set start and end dates to view recordings within a specific date range. Can also set custom time ranges.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <ArrowUpDown className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Sort Order Toggle</h5>
                      <p className={styles.bodyText}>
                        Toggle between ascending (oldest first) and descending (newest first) sort order. Located in pagination footer or view settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <Eye className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>View Toggles</h5>
                      <p className={styles.bodyText}>
                        In View Settings: Toggle visibility of Time, Car/Unit, Channel, and Person fields. Show/hide full timestamps. Customize what information is displayed on each message card.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className={styles.card}>
              <h4 className={"row"}>
                <ArrowRight className={`${styles.iconMedium} ${styles.accentIcon}`} />
                Pagination Controls
              </h4>
              <div className={"stack"}>
                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <ChevronLeft className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Previous Page</h5>
                      <p className={styles.bodyText}>
                        Navigate to the previous page of results. Disabled when on the first page.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <ChevronRight className={`${styles.iconMedium} ${styles.accentIcon}`} />
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Next Page</h5>
                      <p className={styles.bodyText}>
                        Navigate to the next page of results. Disabled when on the last page.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <div className={`${styles.iconMedium} ${styles.accentIcon}`}></div>
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Records Per Page</h5>
                      <p className={styles.bodyText}>
                        Dropdown to select how many messages to display per page (10, 20, 50, 100). Your preference is saved.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.subtlePanel}>
                  <div className={styles.rowStart}>
                    <div className={`${styles.iconMedium} ${styles.accentIcon}`}></div>
                    <div className={"grow"}>
                      <h5 className={styles.emphasis}>Page Number Input</h5>
                      <p className={styles.bodyText}>
                        Type a page number to jump directly to that page. Shows current page and total pages.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Best Practices */}
      <div>
        <SectionHeader
          title="Best Practices & Tips"
          icon={Lightbulb}
          isExpanded={expandedSections.bestPractices}
          onClick={() => toggleSection('bestPractices')}
        />
        {expandedSections.bestPractices && (
          <div className={styles.sectionContent}>
            <div className={styles.card}>
              <h4 className={"row"}>
                <CheckCircle className={`${styles.iconMedium} ${styles.successIcon}`} />
                Optimizing Recording Quality
              </h4>
              <ul className={styles.orderedList}>
                <li className={styles.bodyText}>
                  <strong>Set Appropriate Threshold:</strong> Too high may miss quiet audio, too low may record background noise
                </li>
                <li className={styles.bodyText}>
                  <strong>Monitor Channel Status:</strong> Regularly check that channels show as "Active"
                </li>
                <li className={styles.bodyText}>
                  <strong>Use Keywords Effectively:</strong> Add common terms you search for as keywords
                </li>
                <li className={styles.bodyText}>
                  <strong>Regular Maintenance:</strong> Check device status weekly and review system logs
                </li>
              </ul>
            </div>

            <div className={styles.card}>
              <h4 className={"row"}>
                <Lightbulb className={`${styles.iconMedium} ${styles.warningIcon}`} />
                Daily Operations
              </h4>
              <ul className={styles.orderedList}>
                <li className={styles.bodyText}>
                  ✅ Check the dashboard daily for new recordings
                </li>
                <li className={styles.bodyText}>
                  ✅ Configure keywords for important terms
                </li>
                <li className={styles.bodyText}>
                  ✅ Use date ranges to focus on specific time periods
                </li>
                <li className={styles.bodyText}>
                  ✅ Name channels clearly for easy identification
                </li>
                <li className={styles.bodyText}>
                  ✅ Only grant necessary access levels to users
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default InteractiveUserGuide;
