import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Loader2, Copy, Check } from 'lucide-react';
import api from '../../utils/apiClient';
import styles from '../ui/Documentation.module.css';

const syntaxTheme = {
  'code[class*="language-"]': {
    color: 'var(--ui-text)',
    background: 'var(--ui-surface)'
  },
  'pre[class*="language-"]': {
    color: 'var(--ui-text)',
    background: 'var(--ui-surface)'
  },
  comment: { color: 'var(--ui-muted)' },
  punctuation: { color: 'var(--ui-muted)' },
  property: { color: 'var(--ui-accent)' },
  tag: { color: 'var(--ui-accent)' },
  boolean: { color: 'var(--ui-warning)' },
  number: { color: 'var(--ui-warning)' },
  string: { color: 'var(--ui-success)' },
  operator: { color: 'var(--ui-text)' },
  keyword: { color: 'var(--ui-accent)' },
  function: { color: 'var(--ui-success)' },
};

const InlineDocumentation = ({ 
  filename, 
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
      <div className={styles.loading}>
        <Loader2 className={`${styles.iconLarge} spin`} />
        <p className={styles.supportingText}>
          Loading documentation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p className={styles.heading4}>⚠️ Error loading documentation</p>
        <p className={styles.bodyText}>{typeof error === 'string' ? error : (error?.message || String(error))}</p>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className={`inline-documentation ${styles.article}`}>
      {title && (
        <h2 className={styles.heading2}>
          {title}
        </h2>
      )}
      <div className="documentation-viewer">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml={true}
          components={{
            p: ({ children }) => (
              <p className={styles.bodyText}>
                {children}
              </p>
            ),
            h1: ({ children }) => (
              <h1 className={styles.heading1}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={styles.heading2}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={styles.heading3}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={styles.heading4}>
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
                <pre className={styles.codeBlock} {...props}>
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
                  <div className={styles.codeWrap}>
                    {copiedCode === codeIndex ? (
                      <div className={styles.copyButton}>
                        <Check className={`${styles.iconSmall} ${styles.successIcon}`} />
                        <span className={styles.caption}>
                          Copied!
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => copyToClipboard(codeString, codeIndex)}
                        className={styles.copyButton}
                        title="Copy code"
                      >
                        <Copy className={styles.iconSmall} />
                        <span className={styles.caption}>Copy</span>
                      </button>
                    )}
                    <div className={styles.screenshotFrame}>
                      <SyntaxHighlighter
                        language={language}
                        style={syntaxTheme}
                        customStyle={{
                          margin: 0,
                          padding: '1.25rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          borderRadius: 0,
                          background: 'var(--ui-surface)'
                        }}
                        PreTag="div"
                        showLineNumbers={codeString.split('\n').length > 5}
                        lineNumberStyle={{
                          minWidth: '3em',
                          paddingRight: '1em',
                          color: 'var(--ui-muted)',
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
                <code className={styles.inlineCode} {...props}>
                  {children}
                </code>
              );
            },
            table: ({ children }) => (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  {children}
                </table>
              </div>
            ),
            a: ({ href, children }) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className={styles.blockquote}>
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className={styles.unorderedList}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className={styles.orderedList}>
                {children}
              </ol>
            ),
            hr: () => (
              <hr className="divider" />
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
