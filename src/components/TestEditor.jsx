import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

/**
 * A minimal test editor component with line numbers, styled to match Skeleton UI
 */
const TestEditor = forwardRef(({ 
  initialContent = '', 
  onChange = () => {},
  className = ''
}, ref) => {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [lineCount, setLineCount] = useState(1);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    // Implement methods expected by parent components
    focus: () => {
      textareaRef.current?.focus();
    },
    getScrollInfo: () => ({ scrollPercentage: 0 }),
    scrollToPosition: () => {}
  }));

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
    updateLineCount(initialContent);
  }, [initialContent]);

  // Update line count based on content
  const updateLineCount = (text) => {
    const lines = (text || '').split('\n').length;
    setLineCount(Math.max(1, lines));
  };

  // Handle content changes
  const handleChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    onChange(newContent);
    updateLineCount(newContent);
  };

  // Handle scroll sync between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className={`editor-container relative ${className}`} 
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1', // Tailwind slate-300 equivalent
        backgroundColor: '#f8fafc',  // Tailwind slate-50 equivalent
      }}>
      
      {/* Line numbers */}
      <div 
        ref={lineNumbersRef}
        className="line-numbers select-none"
        style={{
          width: '3rem',
          padding: '1rem 0.5rem',
          backgroundColor: '#f1f5f9', // Tailwind slate-100 equivalent
          borderRight: '1px solid #e2e8f0', // Tailwind slate-200 equivalent
          color: '#64748b', // Tailwind slate-500 equivalent
          overflow: 'hidden',
          fontSize: '0.875rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: '1.5rem',
          textAlign: 'right',
          userSelect: 'none'
        }}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: '1.5rem' }}>{i + 1}</div>
        ))}
      </div>
      
      {/* Text editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onScroll={handleScroll}
        style={{
          flex: 1,
          padding: '1rem',
          fontSize: '0.875rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: '1.5rem',
          border: 'none',
          outline: 'none',
          resize: 'none',
          backgroundColor: '#f8fafc', // Tailwind slate-50 equivalent
          color: '#0f172a', // Tailwind slate-900 equivalent
          overflow: 'auto'
        }}
        placeholder="Start typing here..."
        spellCheck="false"
        onFocus={(e) => {
          console.log('Editor focused');
          // Move cursor to end when focused
          e.target.setSelectionRange(e.target.value.length, e.target.value.length);
        }}
      />
    </div>
  );
});

export default TestEditor; 