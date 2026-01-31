import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import useWebSocket from '../hooks/useWebSocket';
import useAgents from '../hooks/useAgents';
import { sendChatMessage, fetchConversation, fetchConversations } from '../utils/api';

const AppContext = createContext(null);

/** Agent color map for consistent coloring. */
export const AGENT_COLORS = {
  Coordinator: '#3B82F6',
  Researcher: '#8B5CF6',
  Writer: '#10B981',
  Editor: '#14B8A6',
  Coder: '#F97316',
  CodeReviewer: '#EF4444',
  Analyst: '#6366F1',
  Sysadmin: '#6B7280',
  Creative: '#EC4899',
  Planner: '#EAB308',
  Assistant: '#06B6D4',
};

export function AppProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingAgent, setStreamingAgent] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [tasks, setTasks] = useState([]);

  const { agents, updateFromWebSocket } = useAgents();

  const addActivity = useCallback((entry) => {
    setActivityLog((prev) => [
      { ...entry, timestamp: new Date().toISOString() },
      ...prev.slice(0, 99),
    ]);
  }, []);

  const handleWsMessage = useCallback(
    (msg) => {
      updateFromWebSocket(msg);

      switch (msg.type) {
        case 'agent_thinking':
          addActivity({
            type: 'thinking',
            agent: msg.data.agent,
            text: `${msg.data.agent} is thinking...`,
          });
          setStreamingAgent(msg.data.agent);
          setStreamingText('');
          break;

        case 'agent_response':
          setStreamingText((prev) => prev + msg.data.token);
          break;

        case 'agent_complete':
          addActivity({
            type: 'complete',
            agent: msg.data.agent,
            text: `${msg.data.agent} completed response`,
          });
          // The full response will come via chat_complete or the API response
          break;

        case 'delegation':
          addActivity({
            type: 'delegation',
            agent: msg.data.from_agent,
            text: `${msg.data.from_agent} delegated to ${msg.data.to_agent}: ${msg.data.task}`,
          });
          setStreamingAgent(msg.data.to_agent);
          setStreamingText('');
          break;

        case 'task_update':
          setTasks((prev) => {
            const existing = prev.findIndex((t) => t.task_id === msg.data.task_id);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { ...updated[existing], ...msg.data };
              return updated;
            }
            return [msg.data, ...prev];
          });
          break;

        case 'error':
          addActivity({
            type: 'error',
            agent: 'System',
            text: msg.data.message,
          });
          break;
      }
    },
    [updateFromWebSocket, addActivity]
  );

  const { connectionStatus, sendMessage: wsSend } = useWebSocket(handleWsMessage);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations()
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {});
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim() || isProcessing) return;

      setIsProcessing(true);
      setStreamingText('');

      // Determine agent from @mention or selection
      let agent = selectedAgent;
      const mentionMatch = text.match(/^@(\w+)\s/);
      if (mentionMatch) {
        agent = mentionMatch[1];
        text = text.replace(/^@\w+\s/, '');
      }

      // Add user message to local state immediately
      const userMsg = {
        id: Date.now(),
        role: 'user',
        content: text,
        agent_name: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const result = await sendChatMessage(text, agent, currentConversation?.id || null);

        // Update conversation
        if (result.conversation_id) {
          if (!currentConversation || currentConversation.id !== result.conversation_id) {
            setCurrentConversation({ id: result.conversation_id, title: text.slice(0, 80) });
          }

          // Reload the full conversation to get all messages
          const conv = await fetchConversation(result.conversation_id);
          setMessages(conv.messages || []);

          // Refresh conversation list
          const convList = await fetchConversations();
          setConversations(convList.conversations || []);
        }

        setStreamingText('');
        setStreamingAgent(null);
      } catch (err) {
        addActivity({
          type: 'error',
          agent: 'System',
          text: err.message,
        });
        // Add error as a message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant',
            agent_name: 'System',
            content: `Error: ${err.message}`,
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedAgent, currentConversation, isProcessing, addActivity]
  );

  const selectAgent = useCallback((agentName) => {
    setSelectedAgent(agentName);
  }, []);

  const selectConversation = useCallback(async (conv) => {
    if (!conv) {
      setCurrentConversation(null);
      setMessages([]);
      return;
    }
    try {
      const data = await fetchConversation(conv.id);
      setCurrentConversation(data);
      setMessages(data.messages || []);
    } catch {
      // ignore
    }
  }, []);

  const newConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    setStreamingText('');
    setStreamingAgent(null);
  }, []);

  const value = {
    // State
    agents,
    conversations,
    currentConversation,
    messages,
    selectedAgent,
    isProcessing,
    streamingText,
    streamingAgent,
    activityLog,
    tasks,
    connectionStatus,
    // Actions
    sendMessage,
    selectAgent,
    selectConversation,
    newConversation,
    wsSend,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export default AppContext;
