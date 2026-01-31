import { useState, useEffect } from 'react';
import { Eye, EyeOff, Trash2, Download, Moon, Sun } from 'lucide-react';
import Layout from '../components/Layout';
import AgentCard from '../components/AgentCard';
import { useApp, AGENT_COLORS } from '../context/AppContext';
import { fetchSettings, updateSettings, fetchAgentDetails } from '../utils/api';

export default function Settings() {
  const { agents } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [agentDetails, setAgentDetails] = useState({});

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        if (data.api_key_configured) setApiKey('********');
      })
      .catch(() => {});

    // Load agent details
    agents.forEach((agent) => {
      fetchAgentDetails(agent.name)
        .then((data) => {
          setAgentDetails((prev) => ({ ...prev, [agent.name]: data }));
        })
        .catch(() => {});
    });
  }, [agents]);

  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey === '********') return;
    setSaving(true);
    try {
      await updateSettings({ anthropic_api_key: apiKey });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all conversation history? This cannot be undone.')) {
      // Clear via API
      updateSettings({ clear_history: 'true' }).catch(() => {});
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/conversations?limit=1000');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agenthub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleUpdatePersona = (name, persona) => {
    updateSettings({ [`agent_persona_${name}`]: persona }).catch(() => {});
  };

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure AgentHub to your liking</p>
          </div>

          {/* API Key */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">API Configuration</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Anthropic API Key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 pr-10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Your API key is stored securely and never sent to any third party.
                </p>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">Dark Mode</p>
                <p className="text-xs text-gray-500">Toggle between dark and light theme</p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {darkMode ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            </div>
          </section>

          {/* Data Management */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Data</h2>
            <div className="flex gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <Download size={16} />
                Export Data
              </button>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900/20 border border-red-900/30 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={16} />
                Clear History
              </button>
            </div>
          </section>

          {/* Agent Cards */}
          <section>
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent) => {
                const details = agentDetails[agent.name] || {};
                return (
                  <AgentCard
                    key={agent.name}
                    agent={{
                      ...agent,
                      role: details.role || '',
                      tools: details.tools || [],
                      can_delegate_to: details.can_delegate_to || [],
                    }}
                    onUpdatePersona={handleUpdatePersona}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
