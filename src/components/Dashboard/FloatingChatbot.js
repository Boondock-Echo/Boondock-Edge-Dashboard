import apiFetch from '../../utils/apiClient';
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Maximize2,
  Minimize2,
  Move,
  Send,
  Settings,
  User,
  X,
} from 'lucide-react';
import Button from '../ui/Button';
import formStyles from '../ui/Form.module.css';
import styles from '../ui/FloatingChatbot.module.css';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Hi there! 👋 How can I help you today? Try one of the quick options below or ask me anything!',
};

const PREDEFINED_QUESTIONS = [
  {
    question: 'How do I get started?',
    response: "Getting started is easy! Just tell me what you're looking for, and I'll guide you through the process. I can help with product information, troubleshooting, or general inquiries.",
  },
  {
    question: 'What features do you offer?',
    response: "Our platform offers a wide range of features including real-time communication, customizable interfaces, data analytics, automated responses, and integration with your existing systems. Let me know which area you'd like to explore more!",
  },
  {
    question: 'Contact support team',
    response: "I'll connect you with our support team right away. They're available 24/7 and can be reached at support@example.com or by phone at (555) 123-4567. Would you like me to send them a message for you?",
  },
  {
    question: 'Show latest updates',
    response: "Our latest update includes improved user interface, faster response times, enhanced security features, and new integration options. We've also fixed several bugs and optimized performance based on user feedback.",
  },
];

const EnhancedDraggableBot = ({
  branding = {
    organizationName: 'Assistant',
    brandColors: {
      primary: '#4F46E5',
      accent: '#10B981',
    },
    font: 'Inter, sans-serif',
  },
}) => {
  const getDefaultPosition = () => {
    const mobile = window.innerWidth < 768;
    return {
      x: mobile ? window.innerWidth / 2 - 160 : window.innerWidth - 380,
      y: window.innerHeight - 520,
    };
  };

  const getSavedPosition = () => {
    try {
      const savedPosition = localStorage.getItem('chatbotPosition');
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        if (
          parsed.x >= 0 &&
          parsed.x < window.innerWidth &&
          parsed.y >= 0 &&
          parsed.y < window.innerHeight
        ) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Could not read chatbot position from localStorage', error);
    }
    return getDefaultPosition();
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [position, setPosition] = useState(getSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const dragHandleRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      const width = chatContainerRef.current?.offsetWidth || (mobile ? 320 : 380);
      const height = chatContainerRef.current?.offsetHeight || 500;

      setPosition((previous) => ({
        x: Math.max(0, Math.min(previous.x, window.innerWidth - width)),
        y: Math.max(0, Math.min(previous.y, window.innerHeight - height)),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (messages.length === 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setShowSuggestions(false);
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('chatbotPosition', JSON.stringify(position));
    } catch (error) {
      console.error('Could not save chatbot position to localStorage', error);
    }
  }, [position]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 300);
      return () => window.clearTimeout(focusTimer);
    }
    return undefined;
  }, [isOpen, isMinimized]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!isDragging) return;

      event.preventDefault();
      const pointer = event.touches?.[0] || event;
      if (pointer.clientX == null || pointer.clientY == null) return;

      const width = chatContainerRef.current?.offsetWidth || (isMobile ? 320 : 380);
      const height = chatContainerRef.current?.offsetHeight || (isMinimized ? 48 : 500);

      setPosition({
        x: Math.max(0, Math.min(pointer.clientX - dragOffset.x, window.innerWidth - width)),
        y: Math.max(0, Math.min(pointer.clientY - dragOffset.y, window.innerHeight - height)),
      });
    };

    const handlePointerUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
    }

    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchmove', handlePointerMove, { passive: false });
    document.addEventListener('touchend', handlePointerUp);

    return () => {
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('touchend', handlePointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragOffset, isDragging, isMinimized, isMobile]);

  const handleDragStart = (event) => {
    const target = event.target || event.touches?.[0]?.target;
    if (!dragHandleRef.current?.contains(target)) return;

    const rect = chatContainerRef.current.getBoundingClientRect();
    const pointer = event.touches?.[0] || event;

    setIsDragging(true);
    setDragOffset({
      x: pointer.clientX - rect.left,
      y: pointer.clientY - rect.top,
    });

    event.preventDefault();
    event.stopPropagation();
  };

  const sendMessage = (userQuery) => {
    if (!userQuery.trim()) return;

    setMessages((previous) => [...previous, { role: 'user', content: userQuery }]);
    setInput('');
    setIsLoading(true);

    try {
      const matchedQuestion = PREDEFINED_QUESTIONS.find(
        (item) => item.question.toLowerCase() === userQuery.toLowerCase(),
      );

      window.setTimeout(() => {
        setMessages((previous) => [
          ...previous,
          {
            role: 'assistant',
            content: matchedQuestion
              ? matchedQuestion.response
              : `I received your message: "${userQuery}". How can I help further?`,
          },
        ]);
      }, matchedQuestion ? 800 : 1000);
      
      // Uncomment for actual API implementation
      /*
      const response = await apiFetch(`/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userQuery,
          context: messages.slice(-5),
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      */
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your request. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }    
  };

  const handleSubmit = (event) => {
    event?.preventDefault();
    sendMessage(input);
  };

  const handlePredefinedQuestion = (question) => {
    setShowSuggestions(false);
    sendMessage(question);
  };

  const toggleChat = () => {
    if (isMinimized) {
      setIsMinimized(false);
      return;
    }

    setIsOpen((previous) => {
      if (!previous) setShowSuggestions(true);
      return !previous;
    });
  };

  const resetPosition = () => {
    setPosition(getDefaultPosition());
  };

  const resetConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setShowSuggestions(true);
  };

  const rootStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    '--chat-primary': branding.brandColors.primary,
    '--chat-accent': branding.brandColors.accent,
    '--chat-font': branding.font,
  };

  const rootClassName = [
    styles.root,
    isDragging ? styles.dragging : '',
    isOpen || isMinimized ? styles.open : styles.closed,
  ].filter(Boolean).join(' ');

  const panelClassName = [
    styles.panel,
    isCompact ? styles.compact : '',
    isMinimized ? styles.minimized : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} style={rootStyle}>
      {!isOpen && !isMinimized && (
        <button
          type="button"
          onClick={toggleChat}
          className={styles.launcher}
          aria-label="Open chat assistant"
        >
          <Bot size={28} />
        </button>
      )}

      {(isOpen || isMinimized) && (
        <div ref={chatContainerRef} className={panelClassName}>
          <div
            ref={dragHandleRef}
            className={styles.header}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            aria-label="Drag to move chat window"
          >
            <div className={styles.headerTitle}>
              <Move className={styles.dragIcon} size={16} aria-hidden="true" />
              <span className={styles.titleText}>
                {isMinimized ? 'Chat Assistant' : `${branding.organizationName} Assistant`}
              </span>
            </div>

            <div className={styles.headerActions}>
              {!isMinimized && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowSettings((previous) => !previous);
                  }}
                  className={styles.headerButton}
                  aria-label="Chat settings"
                >
                  <Settings size={16} />
                </button>
              )}

              {!isMinimized && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsCompact((previous) => !previous);
                  }}
                  className={styles.headerButton}
                  aria-label={isCompact ? 'Expand chat' : 'Use compact chat'}
                >
                  {isCompact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
              )}

              {isMinimized ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleChat();
                  }}
                  className={styles.headerButton}
                  aria-label="Expand chat"
                >
                  <ChevronUp size={20} />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsMinimized(true);
                    }}
                    className={styles.headerButton}
                    aria-label="Minimize chat"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsOpen(false);
                      setIsMinimized(false);
                    }}
                    className={styles.headerButton}
                    aria-label="Close chat"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {!isMinimized && showSettings && (
            <div className={styles.settings}>
              <h3 className={styles.settingsTitle}>Settings</h3>
              <div className={styles.settingsActions}>
                <Button size="small" variant="secondary" className={styles.settingsButton} onClick={resetPosition}>
                  Reset Position
                </Button>
                <Button size="small" variant="secondary" className={styles.settingsButton} onClick={resetConversation}>
                  Reset Conversation
                </Button>
              </div>
            </div>
          )}

          {!isMinimized && (
            <>
              <div className={styles.messages}>
                {messages.map((message, index) => {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className={`${styles.messageRow} ${isUser ? styles.userRow : styles.assistantRow}`}
                    >
                      <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
                        <div className={styles.messageHeader}>
                          {isUser ? <User size={14} aria-hidden="true" /> : <Bot size={14} aria-hidden="true" />}
                          <span className={styles.messageAuthor}>{isUser ? 'You' : 'Assistant'}</span>
                        </div>
                        <p className={styles.messageText}>{message.content}</p>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className={styles.loadingBubble} aria-label="Assistant is responding" role="status">
                    <span className={styles.loadingDot} aria-hidden="true" />
                    <span className={styles.loadingDot} aria-hidden="true" />
                    <span className={styles.loadingDot} aria-hidden="true" />
                  </div>
                )}

                {showSuggestions && (
                  <div className={styles.suggestions}>
                    <p className={styles.suggestionsLabel}>Quick actions:</p>
                    <div className={styles.suggestionList}>
                      {PREDEFINED_QUESTIONS.map((item) => (
                        <button
                          key={item.question}
                          type="button"
                          onClick={() => handlePredefinedQuestion(item.question)}
                          className={styles.suggestion}
                          title={item.question}
                        >
                          {item.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSubmit} className={styles.composer}>
                <div className={styles.composerRow}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Type your message..."
                    className={`${formStyles.input} ${styles.messageInput}`}
                    disabled={isLoading}
                    aria-label="Chat message"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={styles.sendButton}
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                </div>

                {!showSuggestions && (
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(true)}
                    className={styles.quickActionsToggle}
                  >
                    <HelpCircle size={12} aria-hidden="true" />
                    <span>Show quick actions</span>
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedDraggableBot;
