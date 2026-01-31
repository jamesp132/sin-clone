import { useState, useEffect, useCallback } from 'react';
import { fetchAgents } from '../utils/api';

/**
 * Hook for managing agent state, synced with WebSocket updates.
 */
export default function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAgents();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const updateFromWebSocket = useCallback((wsData) => {
    if (wsData.type === 'status_update' && wsData.data?.agents) {
      setAgents(wsData.data.agents);
    } else if (wsData.type === 'agent_thinking') {
      setAgents((prev) =>
        prev.map((a) =>
          a.name === wsData.data.agent
            ? { ...a, status: 'thinking', current_task: wsData.data.task_id?.toString() }
            : a
        )
      );
    } else if (wsData.type === 'agent_complete') {
      setAgents((prev) =>
        prev.map((a) =>
          a.name === wsData.data.agent
            ? { ...a, status: 'idle', current_task: null }
            : a
        )
      );
    }
  }, []);

  return { agents, loading, error, reload: loadAgents, updateFromWebSocket };
}
