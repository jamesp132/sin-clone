import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, MessageSquare, Wrench, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import Layout from '../components/Layout';
import MessageBubble from '../components/MessageBubble';
import { AGENT_COLORS } from '../context/AppContext';
import { fetchAgentDetails, sendDirectChat } from '../utils/api';

export default function AgentDetail() {
  const { name } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const color = AGENT_COLORS[name] || '#6B7280';

  useEffect(() => {
    setLoading(true);
    fetchAgentDetails(name)
      .then((data) => setAgent(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const text = input;
    setInput('');
    setSending(true);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: text,
        agent_name: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const result = await sendDirectChat(name, text, conversationId);
      if (result.conversation_id) {
        setConversationId(result.conversation_id);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: result.response,
          agent_name: result.agent || name,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Error: ${err.message}`,
          agent_name: 'System',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-500" />
        </div>
      </Layout>
    );
  }

  if (!agent) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Agent "{name}" not found
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>

            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: color + '20', color }}
            >
              {name[0]}
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-100">{name}</h2>
              <p className="text-xs text-gray-500">{agent.role}</p>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <MessageSquare size={12} />
                <span>{agent.history_length || 0} messages</span>
              </div>
              {agent.tools?.length > 0 && (
                <div className="flex items-center gap-1">
                  <Wrench size={12} />
                  <span>{agent.tools.length} tools</span>
                </div>
              )}
              {agent.can_delegate_to?.length > 0 && (
                <div className="flex items-center gap-1">
                  <GitBranch size={12} />
                  <span>{agent.can_delegate_to.length} delegates</span>
                </div>
              )}
            </div>
          </div>

          {/* Tools and delegation tags */}
          <div className="flex flex-wrap gap-1 mt-3 ml-16">
            {agent.tools?.map((tool) => (
              <span
                key={tool}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400"
              >
                {tool}
              </span>
            ))}
            {agent.can_delegate_to?.map((d) => (
              <span
                key={d}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: (AGENT_COLORS[d] || '#6B7280') + '15',
                  color: AGENT_COLORS[d] || '#6B7280',
                }}
              >
                → {d}
              </span>
            ))}
          </div>
        </div>

        {/* Recent conversations from this agent */}
        {agent.recent_messages?.length > 0 && messages.length === 0 && (
          <div className="px-6 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Recent activity</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {agent.recent_messages.slice(0, 5).map((m) => (
                <p key={m.id} className="text-xs text-gray-400 truncate">
                  {m.content}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold mb-3"
                style={{ backgroundColor: color + '20', color }}
              >
                {name[0]}
              </div>
              <p className="text-sm">
                Chat directly with <span style={{ color }}>{name}</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Messages here bypass the Coordinator
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-gray-500 text-sm pl-10">
              <div className="flex gap-1">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
              </div>
              <span>{name} is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900/50 p-4">
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={`Message ${name}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
              style={{ maxHeight: '120px', minHeight: '44px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className={clsx(
                'flex-shrink-0 p-3 rounded-xl transition-colors',
                input.trim() && !sending
                  ? 'text-white hover:opacity-90'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              )}
              style={
                input.trim() && !sending ? { backgroundColor: color } : undefined
              }
            >
              {sending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
