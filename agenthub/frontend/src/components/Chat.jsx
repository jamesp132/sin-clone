import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AtSign } from 'lucide-react';
import clsx from 'clsx';
import MessageBubble from './MessageBubble';
import { useApp, AGENT_COLORS } from '../context/AppContext';

export default function Chat() {
  const {
    messages,
    sendMessage,
    isProcessing,
    streamingText,
    streamingAgent,
    selectedAgent,
    currentConversation,
    agents,
  } = useApp();

  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
    setInput('');
    setShowMentions(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Check for @mention
    const lastAt = value.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === 0 || value[lastAt - 1] === ' ')) {
      const query = value.slice(lastAt + 1).toLowerCase();
      setMentionFilter(query);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (agentName) => {
    const lastAt = input.lastIndexOf('@');
    const newInput = input.slice(0, lastAt) + `@${agentName} `;
    setInput(newInput);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().startsWith(mentionFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">
              {currentConversation?.title || 'New Conversation'}
            </h2>
            <p className="text-xs text-gray-500">
              {selectedAgent ? (
                <span className="flex items-center gap-1">
                  Chatting with{' '}
                  <span style={{ color: AGENT_COLORS[selectedAgent] }}>{selectedAgent}</span>
                </span>
              ) : (
                'Coordinator will route your message'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-600">AH</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-400">Welcome to AgentHub</p>
              <p className="text-sm mt-1">
                Send a message to get started. Use <code className="text-gray-400">@AgentName</code>{' '}
                to talk to a specific agent.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              {[
                'Research the latest in AI agents',
                'Help me write a blog post',
                'Review this Python code',
                'Plan my home server setup',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-800 hover:border-gray-700 hover:bg-gray-800 transition-colors text-gray-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming indicator */}
        {streamingText && streamingAgent && (
          <MessageBubble
            message={{
              id: 'streaming',
              role: 'assistant',
              agent_name: streamingAgent,
              content: streamingText,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Thinking indicator */}
        {isProcessing && !streamingText && (
          <div className="flex items-center gap-2 text-gray-500 text-sm pl-10">
            <div className="flex gap-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
            </div>
            <span>{streamingAgent || selectedAgent || 'Coordinator'} is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900/50 p-4">
        {/* @mention dropdown */}
        {showMentions && filteredAgents.length > 0 && (
          <div className="mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {filteredAgents.map((agent) => (
              <button
                key={agent.name}
                onClick={() => insertMention(agent.name)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 transition-colors text-left text-sm"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: (AGENT_COLORS[agent.name] || '#6B7280') + '20',
                    color: AGENT_COLORS[agent.name] || '#6B7280',
                  }}
                >
                  {agent.name[0]}
                </div>
                <span className="text-gray-200">{agent.name}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                selectedAgent
                  ? `Message ${selectedAgent}...`
                  : 'Message your AI team... (use @Agent to direct)'
              }
              rows={1}
              className={clsx(
                'w-full resize-none rounded-xl bg-gray-800 border border-gray-700',
                'px-4 py-3 pr-10 text-sm text-gray-100 placeholder-gray-500',
                'focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600',
                'transition-colors'
              )}
              style={{ maxHeight: '120px', minHeight: '44px' }}
            />
            <button
              type="button"
              onClick={() => {
                setInput(input + '@');
                setShowMentions(true);
                setMentionFilter('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 bottom-3 text-gray-500 hover:text-gray-300 transition-colors"
              title="Mention an agent"
            >
              <AtSign size={16} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className={clsx(
              'flex-shrink-0 p-3 rounded-xl transition-colors',
              input.trim() && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
