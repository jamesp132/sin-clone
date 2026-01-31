import { useState, useMemo } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { AGENT_COLORS } from '../context/AppContext';

/** Simple markdown-to-JSX renderer (no external deps). */
function renderContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines = [];
  let key = 0;

  const processInline = (line) => {
    // Bold
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    line = line.replace(/`([^`]+)`/g, '<code>$1</code>');
    return line;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <CodeBlock key={key++} language={codeBlockLang} code={codeLines.join('\n')} />
        );
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-gray-200 mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-base font-semibold text-gray-200 mt-3 mb-1">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-lg font-bold text-gray-100 mt-3 mb-1">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li
          key={key++}
          className="ml-4 text-sm list-disc"
          dangerouslySetInnerHTML={{ __html: processInline(line.slice(2)) }}
        />
      );
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '');
      elements.push(
        <li
          key={key++}
          className="ml-4 text-sm list-decimal"
          dangerouslySetInnerHTML={{ __html: processInline(content) }}
        />
      );
    } else if (line.startsWith('---')) {
      elements.push(<hr key={key++} className="border-gray-700 my-2" />);
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p
          key={key++}
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processInline(line) }}
        />
      );
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <CodeBlock key={key++} language={codeBlockLang} code={codeLines.join('\n')} />
    );
  }

  return elements;
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-500">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-sm">
        <code className="text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

export default function MessageBubble({ message, isStreaming = false }) {
  const [expanded, setExpanded] = useState(true);
  const isUser = message.role === 'user';
  const agentName = message.agent_name || 'User';
  const color = isUser ? '#6B7280' : AGENT_COLORS[agentName] || '#6B7280';
  const isLong = (message.content?.length || 0) > 2000;

  const timestamp = useMemo(() => {
    if (!message.created_at) return '';
    const d = new Date(message.created_at);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [message.created_at]);

  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
        style={{ backgroundColor: color + '20', color }}
      >
        {isUser ? 'U' : agentName[0]}
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[75%] min-w-0', isUser && 'items-end')}>
        {/* Header */}
        <div className={clsx('flex items-center gap-2 mb-1', isUser && 'flex-row-reverse')}>
          <span className="text-xs font-semibold" style={{ color }}>
            {isUser ? 'You' : agentName}
          </span>
          <span className="text-xs text-gray-600">{timestamp}</span>
          {isStreaming && (
            <span className="text-xs text-yellow-500 animate-pulse">streaming...</span>
          )}
        </div>

        {/* Content */}
        <div
          className={clsx(
            'rounded-xl px-4 py-3',
            isUser ? 'bg-blue-600/20 border border-blue-600/20' : 'bg-gray-800/80 border border-gray-800'
          )}
          style={!isUser ? { borderLeftColor: color, borderLeftWidth: '3px' } : undefined}
        >
          <div className={clsx('message-content text-gray-200', !expanded && 'max-h-48 overflow-hidden')}>
            {renderContent(message.content)}
          </div>

          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
