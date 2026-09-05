import apiFetch from '../../utils/apiClient';
import { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, User, ChevronDown, ChevronUp, Minimize2, Maximize2, Move, HelpCircle, Settings } from 'lucide-react';

const EnhancedDraggableBot = ({ 
  isDarkMode = false, 
  branding = {
    organizationName: 'Assistant',
    brandColors: {
      primary: '#4F46E5',
      accent: '#10B981'
    },
    font: 'Inter, sans-serif'
  }
}) => {
  // Retrieve position from localStorage on initial load with better fallback
  const getSavedPosition = () => {
    try {
      const savedPosition = localStorage.getItem('chatbotPosition');
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition);
        // Validate saved position is within current viewport
        if (parsed.x > 0 && parsed.x < window.innerWidth && 
            parsed.y > 0 && parsed.y < window.innerHeight) {
          return parsed;
        }
      }
      return getDefaultPosition();
    } catch (e) {
      return getDefaultPosition();
    }
  };
  
  // Calculate default position based on screen size
  const getDefaultPosition = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      return { x: window.innerWidth / 2 - 160, y: window.innerHeight - 520 };
    }
    return { x: window.innerWidth - 380, y: window.innerHeight - 520 };
  };
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [position, setPosition] = useState(getSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi there! 👋 How can I help you today? Try one of the quick options below or ask me anything!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Predefined questions and responses
  const predefinedQuestions = [
    { question: "How do I get started?", response: "Getting started is easy! Just tell me what you're looking for, and I'll guide you through the process. I can help with product information, troubleshooting, or general inquiries." },
    { question: "What features do you offer?", response: "Our platform offers a wide range of features including real-time communication, customizable interfaces, data analytics, automated responses, and integration with your existing systems. Let me know which area you'd like to explore more!" },
    { question: "Contact support team", response: "I'll connect you with our support team right away. They're available 24/7 and can be reached at support@example.com or by phone at (555) 123-4567. Would you like me to send them a message for you?" },
    { question: "Show latest updates", response: "Our latest update includes improved user interface, faster response times, enhanced security features, and new integration options. We've also fixed several bugs and optimized performance based on user feedback." }
  ];
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const dragHandleRef = useRef(null);
  const inputRef = useRef(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      
      // Adjust position if it would be off-screen after resize
      const width = chatContainerRef.current?.offsetWidth || (newIsMobile ? 320 : 380);
      const height = chatContainerRef.current?.offsetHeight || 500;
      
      if (position.x + width > window.innerWidth) {
        setPosition(prev => ({
          ...prev,
          x: Math.max(0, window.innerWidth - width)
        }));
      }
      
      if (position.y + height > window.innerHeight) {
        setPosition(prev => ({
          ...prev,
          y: Math.max(0, window.innerHeight - height)
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  // Scroll to bottom when new messages are added (only on initial load or when user is at bottom)
  useEffect(() => {
    if (messages.length === 1) {
      // On first message (initial load), scroll to bottom
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (messages.length > 1) {
      // For subsequent messages, only scroll if user is at bottom
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        if (isAtBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
      setShowSuggestions(false);
    }
  }, [messages]);

  // Save position to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chatbotPosition', JSON.stringify(position));
    } catch (e) {
      console.error("Could not save chatbot position to localStorage");
    }
  }, [position]);

  // Focus input when chat is opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, isMinimized]);

  // Improved drag handling with touch support - FIXED VERTICAL DRAGGING
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        // Calculate new position directly from mouse position and drag offset
        const newX = clientX - dragOffset.x;
        const newY = clientY - dragOffset.y;
        
        // Keep within viewport bounds
        const width = chatContainerRef.current?.offsetWidth || (isMobile ? 320 : 380);
        const height = chatContainerRef.current?.offsetHeight || (isMinimized ? 48 : 500);
        const maxX = window.innerWidth - width;
        const maxY = window.innerHeight - height;
        
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
  }, [isDragging, dragOffset, isMobile, isMinimized]);

  const handleDragStart = (e) => {
    // Get the element being targeted
    const target = e.target || (e.touches && e.touches[0].target);
    
    // Only initiate drag if clicking on the drag handle
    if (target === dragHandleRef.current || dragHandleRef.current.contains(target)) {
      setIsDragging(true);
      
      // Get the current position of the chat window
      const rect = chatContainerRef.current.getBoundingClientRect();
      
      // Get the mouse/touch position
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      // Calculate the offset (distance from the mouse to the top-left corner of the chat)
      setDragOffset({
        x: clientX - rect.left,
        y: clientY - rect.top
      });
      
      // Store the starting position for reference
      setStartDragPosition({
        x: position.x,
        y: position.y
      });
      
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const userQuery = input;
    setInput('');
    setIsLoading(true);

    try {
      // Check if the question matches any predefined questions
      const matchedQuestion = predefinedQuestions.find(
        item => item.question.toLowerCase() === userQuery.toLowerCase()
      );

      if (matchedQuestion) {
        // Use predefined response
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: matchedQuestion.response
          }]);
          setIsLoading(false);
        }, 800);
      } else {
        // Simulated API response
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `I received your message: "${userQuery}". How can I help further?` 
          }]);
          setIsLoading(false);
        }, 1000);
      }
      
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

  const handlePredefinedQuestion = (question) => {
    setInput(question);
    setShowSuggestions(false);
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  const toggleChat = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setShowSuggestions(true);
      }
    }
  };

  const resetPosition = () => {
    const newPosition = getDefaultPosition();
    setPosition(newPosition);
    try {
      localStorage.setItem('chatbotPosition', JSON.stringify(newPosition));
    } catch (e) {
      console.error("Could not save chatbot position to localStorage");
    }
  };

  const { primaryColor, accentColor, fontFamily } = {
    primaryColor: branding.brandColors.primary,
    accentColor: branding.brandColors.accent,
    fontFamily: branding.font
  };

  // Enhanced chat styles - added transitions and animations
  const chatStyles = {
    position: 'fixed',
    bottom: position.y + 'px',
    left: position.x + 'px',
    zIndex: 9999,
    transition: isDragging ? 'none' : 'all 0.3s ease-in-out',
    transform: isOpen ? 'scale(1)' : 'scale(0.98)',
    opacity: isOpen ? 1 : 0.95,
  };

  // Get chat width based on screen size and state
  const getChatWidth = () => {
    if (isMinimized) return 'w-64';
    if (isCompact) return 'w-72';
    if (isMobile) return 'w-full sm:w-80 max-w-[95vw]';
    return 'w-80 md:w-96';
  };

  // Get chat height based on screen size and state
  const getChatHeight = () => {
    if (isMinimized) return 'h-12';
    if (isCompact) return 'h-96';
    if (isMobile) return 'h-[80vh] max-h-[500px]';
    return 'h-[500px]';
  };

  return (
    <div style={chatStyles} className="font-sans">
      {/* Floating Button */}
      {!isOpen && !isMinimized && (
        <button
          onClick={toggleChat}
          className="rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ 
            backgroundColor: primaryColor, 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '60px',
            height: '60px',
            outline: 'none'
          }}
          aria-label="Open chat assistant"
        >
          <Bot className="text-white" size={28} />
        </button>
      )}

      {/* Chat Window */}
      {(isOpen || isMinimized) && (
        <div 
          ref={chatContainerRef}
          className={`rounded-lg shadow-xl transition-all duration-300 ${
            isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
          } ${getChatHeight()} ${getChatWidth()}`}
          style={{ 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            backdropFilter: 'blur(10px)',
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.5)'}`,
            borderRadius: '16px',
            overflow: 'hidden',
            fontFamily: fontFamily
          }}
        >
          {/* Header */}
          <div 
            ref={dragHandleRef}
            className="flex items-center justify-between p-3 cursor-move select-none"
            style={{ 
              backgroundColor: primaryColor,
              backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px'
            }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            aria-label="Drag to move chat window"
          >
            <div className="flex items-center space-x-2">
              <Move className="text-white opacity-70" size={16} />
              <span className="font-semibold text-white truncate">
                {isMinimized ? 'Chat Assistant' : branding.organizationName + ' Assistant'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {!isMinimized && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                  }}
                  className="hover:bg-white hover:bg-opacity-20 rounded p-1 focus:outline-none focus:ring-1 focus:ring-white focus:ring-opacity-50"
                  aria-label="Settings"
                >
                  <Settings className="text-white" size={16} />
                </button>
              )}
              {!isMinimized && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCompact(!isCompact);
                  }}
                  className="hover:bg-white hover:bg-opacity-20 rounded p-1 focus:outline-none focus:ring-1 focus:ring-white focus:ring-opacity-50"
                  aria-label={isCompact ? "Expand chat" : "Compact mode"}
                >
                  {isCompact ? (
                    <Maximize2 className="text-white" size={16} />
                  ) : (
                    <Minimize2 className="text-white" size={16} />
                  )}
                </button>
              )}
              {isMinimized ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChat();
                  }}
                  className="hover:bg-white hover:bg-opacity-20 rounded p-1 focus:outline-none focus:ring-1 focus:ring-white focus:ring-opacity-50"
                  aria-label="Expand chat"
                >
                  <ChevronUp className="text-white" size={20} />
                </button>
              ) : (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(true);
                    }}
                    className="hover:bg-white hover:bg-opacity-20 rounded p-1 focus:outline-none focus:ring-1 focus:ring-white focus:ring-opacity-50"
                    aria-label="Minimize chat"
                  >
                    <ChevronDown className="text-white" size={16} />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setIsMinimized(false);
                    }}
                    className="hover:bg-white hover:bg-opacity-20 rounded p-1 focus:outline-none focus:ring-1 focus:ring-white focus:ring-opacity-50"
                    aria-label="Close chat"
                  >
                    <X className="text-white" size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Settings Panel - shown only when settings is open */}
          {!isMinimized && showSettings && (
            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className="font-medium mb-2">Settings</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Dark Mode</label>
                  <div 
                    className={`w-10 h-5 rounded-full relative cursor-pointer ${isDarkMode ? 'bg-blue-500' : 'bg-gray-300'}`}
                    onClick={() => window.parent.postMessage({ type: 'toggleDarkMode' }, '*')}
                    role="switch"
                    aria-checked={isDarkMode}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        window.parent.postMessage({ type: 'toggleDarkMode' }, '*');
                      }
                    }}
                  >
                    <div 
                      className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${isDarkMode ? 'transform translate-x-5' : ''}`}
                    ></div>
                  </div>
                </div>
                <button 
                  className={`text-sm px-3 py-1 rounded w-full text-left focus:outline-none focus:ring-2 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500' : 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-300'}`}
                  onClick={resetPosition}
                >
                  Reset Position
                </button>
                <button 
                  className={`text-sm px-3 py-1 rounded w-full text-left focus:outline-none focus:ring-2 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 focus:ring-gray-500' : 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-300'}`}
                  onClick={() => {
                    setMessages([{ role: 'assistant', content: 'Hi there! 👋 How can I help you today? Try one of the quick options below or ask me anything!' }]);
                    setShowSuggestions(true);
                  }}
                >
                  Reset Conversation
                </button>
              </div>
            </div>
          )}

          {/* Messages - Hidden when minimized */}
          {!isMinimized && (
            <>
              <div 
                className={`p-4 overflow-y-auto space-y-4 ${
                  isCompact 
                    ? 'h-64' 
                    : isMobile 
                      ? showSettings ? 'h-[calc(100%-160px)]' : 'h-[calc(100%-100px)]'
                      : showSettings ? 'h-[320px]' : 'h-[400px]'
                }`}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: isDarkMode ? '#4a5568 #2d3748' : '#cbd5e0 #edf2f7'
                }}
              >
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    style={{
                      animation: 'fadeIn 0.3s ease-in-out',
                      opacity: 0,
                      animationFillMode: 'forwards'
                    }}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'text-white'
                          : isDarkMode
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                      style={{
                        backgroundColor: message.role === 'user' ? accentColor : null,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                        borderRadius: message.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0',
                        animationDelay: `${index * 0.1}s`
                      }}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        {message.role === 'user' ? (
                          <User size={14} />
                        ) : (
                          <Bot size={14} />
                        )}
                        <span className="text-xs font-semibold">
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-tl-none`}>
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Predefined Questions */}
                {showSuggestions && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Quick actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {predefinedQuestions.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handlePredefinedQuestion(item.question)}
                          className={`text-xs py-1.5 px-3 rounded-full text-left transition-colors ${
                            isDarkMode 
                              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                          } focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            isDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-300'
                          }`}
                          style={{ 
                            maxWidth: isMobile ? '100%' : '48%', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {item.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form 
                onSubmit={handleSubmit} 
                className="p-3 border-t" 
                style={{ borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 0.8)' }}
              >
                <div className="flex items-center space-x-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(243, 244, 246, 0.8)',
                      color: isDarkMode ? 'white' : 'rgb(31, 41, 55)',
                      border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 0.8)'}`,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      borderRadius: '12px',
                      outlineColor: accentColor
                    }}
                    disabled={isLoading}
                    aria-label="Chat message"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim()) handleSubmit(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={`p-2 rounded-full transition-all duration-200 ${!input.trim() ? 'opacity-50' : 'hover:scale-105'} focus:outline-none focus:ring-2 focus:ring-offset-2`}
                    style={{ 
                      backgroundColor: accentColor,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                      outlineColor: accentColor
                    }}
                    aria-label="Send message"
                  >
                    <Send className="text-white" size={18} />
                  </button>
                </div>
                {!showSuggestions && (
                  <div className="mt-2 flex justify-center">
                    <button
                      onClick={() => setShowSuggestions(true)}
                      className={`text-xs flex items-center space-x-1 ${
                        isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                      } focus:outline-none focus:underline`}
                      aria-label="Show quick actions"
                    >
                      <HelpCircle size={12} />
                      <span>Show quick actions</span>
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      )}

      {/* Add CSS animation for fade-in effect */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default EnhancedDraggableBot;
