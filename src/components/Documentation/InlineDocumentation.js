import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Loader2, Copy, Check } from 'lucide-react';
import api from '../../utils/apiClient';

const InlineDocumentation = ({ 
  filename, 
  isDarkMode,
  title 
}) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (filename) {
      fetchDocumentation();
    }
  }, [filename]);

  const copyToClipboard = async (text, codeIndex) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(codeIndex);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const fetchDocumentation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/docs/${filename}`,
        {
          responseType: 'text',
          headers: {
            'Accept': 'text/markdown, text/plain, */*'
          }
        }
      );
      const contentData = typeof response.data === 'string' 
        ? response.data 
        : String(response.data || '');
      setContent(contentData.trim());
    } catch (err) {
      console.error('Error fetching documentation:', err);
      const data = err.response?.data;
      const message = typeof data === 'string'
        ? data
        : (data?.message || data?.error || (data && JSON.stringify(data)) || err.message || 'Failed to load documentation');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Loading documentation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`
        p-6 rounded-xl border-2
        ${isDarkMode 
          ? 'bg-red-900/20 border-red-800/50 text-red-400' 
          : 'bg-red-50 border-red-200 text-red-600'
        }
      `}>
        <p className="font-bold text-lg mb-2">⚠️ Error loading documentation</p>
        <p className="text-sm">{typeof error === 'string' ? error : (error?.message || String(error))}</p>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div 
      className={`inline-documentation ${isDarkMode ? 'prose-invert' : ''}`}
      style={{
        maxWidth: '100%',
        color: isDarkMode ? '#D1D5DB' : '#374151'
      }}
    >
      {title && (
        <h2 className={`
          text-2xl font-bold mb-6 pb-3 border-b
          ${isDarkMode 
            ? 'text-white border-gray-700' 
            : 'text-gray-900 border-gray-200'
          }
        `}>
          {title}
        </h2>
      )}
      <div 
        className={`prose prose-lg max-w-none ${isDarkMode ? 'prose-invert' : ''}`}
        style={{ 
          display: 'block',
          width: '100%',
          whiteSpace: 'normal',
          wordWrap: 'normal',
          fontFamily: 'inherit',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml={true}
          components={{
            p: ({ children }) => (
              <p className={`
                ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}
                leading-relaxed mb-4
              `}>
                {children}
              </p>
            ),
            h1: ({ children }) => (
              <h1 className={`
                text-3xl font-bold mb-6 pb-3 border-b
                ${isDarkMode 
                  ? 'text-white border-gray-700' 
                  : 'text-gray-900 border-gray-200'
                }
              `}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={`
                text-2xl font-bold mt-8 mb-4
                ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}
              `}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={`
                text-xl font-bold mt-6 mb-3
                ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}
              `}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={`
                text-lg font-semibold mt-4 mb-2
                ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}
              `}>
                {children}
              </h4>
            ),
            pre: ({ children, ...props }) => {
              const childArray = React.Children.toArray(children);
              const codeChild = childArray.find(child => {
                if (React.isValidElement(child) && child.props?.className) {
                  return /language-/.test(child.props.className);
                }
                return false;
              });
              
              if (codeChild) {
                return <>{children}</>;
              }
              
              return (
                <pre 
                  className={`
                    ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'}
                    p-4 rounded-lg overflow-x-auto my-4
                    font-mono text-sm
                    border
                    ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
                  `}
                  {...props}
                >
                  {children}
                </pre>
              );
            },
            code: ({ node, inline, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');
              const codeIndex = Math.random().toString(36).substr(2, 9);
              const language = match ? match[1] : '';
              
              if (!inline && match) {
                return (
                  <div className="relative group my-4">
                    <div className={`
                      absolute top-3 right-3 z-10
                      ${isDarkMode ? 'bg-gray-700/90' : 'bg-gray-200/90'}
                      backdrop-blur-sm rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-opacity
                    `}>
                      {copiedCode === codeIndex ? (
                        <div className="flex items-center gap-1.5 px-2">
                          <Check className="w-4 h-4 text-green-500" />
                          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Copied!
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => copyToClipboard(codeString, codeIndex)}
                          className={`
                            ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
                            transition-colors flex items-center gap-1.5 px-2
                          `}
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                          <span className="text-xs">Copy</span>
                        </button>
                      )}
                    </div>
                    <div className="rounded-xl overflow-hidden border shadow-lg"
                      style={{
                        borderColor: isDarkMode ? '#374151' : '#4B5563'
                      }}
                    >
                      <SyntaxHighlighter
                        language={language}
                        style={isDarkMode ? vscDarkPlus : vs}
                        customStyle={{
                          margin: 0,
                          padding: '1.25rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          borderRadius: '0.75rem',
                          background: isDarkMode ? '#1F2937' : '#F9FAFB'
                        }}
                        PreTag="div"
                        showLineNumbers={codeString.split('\n').length > 5}
                        lineNumberStyle={{
                          minWidth: '3em',
                          paddingRight: '1em',
                          color: isDarkMode ? '#6B7280' : '#9CA3AF',
                          userSelect: 'none'
                        }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                );
              }
              return (
                <code className={`
                  ${isDarkMode 
                    ? 'bg-gray-800/80 text-blue-400 border-gray-700' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                  }
                  px-2 py-1 rounded-md text-sm font-mono
                  border
                `} {...props}>
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 rounded-lg border shadow-sm">
                <table className={`
                  min-w-full border-collapse
                  ${isDarkMode 
                    ? 'border-gray-700' 
                    : 'border-gray-200'
                  }
                `}>
                  {children}
                </table>
              </div>
            ),
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`
                  ${isDarkMode 
                    ? 'text-blue-400 hover:text-blue-300' 
                    : 'text-blue-600 hover:text-blue-700'
                  }
                  underline decoration-2 underline-offset-2
                  transition-colors duration-200
                  font-medium
                `}
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className={`
                border-l-4 pl-6 py-3 my-6 rounded-r-lg
                ${isDarkMode 
                  ? 'border-blue-500 bg-gray-800/50 text-gray-300' 
                  : 'border-blue-500 bg-blue-50 text-gray-700'
                }
              `}>
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-outside ml-6 space-y-2 my-4">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-outside ml-6 space-y-2 my-4">
                {children}
              </ol>
            ),
            hr: () => (
              <hr className={`
                my-8 border-t-2
                ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
              `} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default InlineDocumentation;
