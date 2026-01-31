/**
 * API utility functions for AgentHub.
 */

const BASE_URL = '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('Cannot connect to AgentHub server. Is it running?');
    }
    throw err;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function sendChatMessage(message, agent = null, conversationId = null) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      agent,
      conversation_id: conversationId,
    }),
  });
}

export async function sendDirectChat(agentName, message, conversationId = null) {
  return request(`/agent/${agentName}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function fetchAgents() {
  return request('/agents');
}

export async function fetchAgentDetails(name) {
  return request(`/agent/${name}`);
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(status = null, limit = 50, offset = 0) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request(`/tasks?${params}`);
}

export async function fetchTask(taskId) {
  return request(`/task/${taskId}`);
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function fetchConversations(limit = 50, offset = 0) {
  return request(`/conversations?limit=${limit}&offset=${offset}`);
}

export async function fetchConversation(id) {
  return request(`/conversations/${id}`);
}

export async function deleteConversation(id) {
  return request(`/conversations/${id}`, { method: 'DELETE' });
}

// ── Memory ────────────────────────────────────────────────────────────────────

export async function addMemory(fact, importance = 5, conversationId = null) {
  const params = new URLSearchParams();
  params.set('fact', fact);
  params.set('importance', String(importance));
  if (conversationId) params.set('conversation_id', String(conversationId));
  return request(`/memory?${params}`, { method: 'POST' });
}

export async function searchMemory(query) {
  return request(`/memory/search?q=${encodeURIComponent(query)}`);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function fetchSettings() {
  return request('/settings');
}

export async function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return request('/health');
}
