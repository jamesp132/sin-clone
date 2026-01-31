import { useState, useEffect, useCallback } from 'react';
import { Search, MessageSquare, Trash2, Clock } from 'lucide-react';
import clsx from 'clsx';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import { fetchConversations, deleteConversation } from '../utils/api';

export default function History() {
  const { selectConversation } = useApp();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchConversations(200);
      setConversations(data.conversations || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = conversations.filter(
    (c) => !search || c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (e, conv) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteConversation(conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
    } catch {
      // ignore
    }
  };

  const handleSelect = (conv) => {
    selectConversation(conv);
    // Navigate to home
    window.location.href = '/';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">History</h1>
              <p className="text-sm text-gray-500 mt-1">
                {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-700"
            />
          </div>

          {/* Conversation list */}
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={40} className="mx-auto text-gray-700 mb-3" />
              <p className="text-gray-500">
                {search ? 'No conversations match your search' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 hover:bg-gray-800/50 transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={16} className="text-gray-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {conv.title || 'Untitled conversation'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={10} className="text-gray-600" />
                      <span className="text-xs text-gray-500">
                        {formatDate(conv.updated_at || conv.created_at)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, conv)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
