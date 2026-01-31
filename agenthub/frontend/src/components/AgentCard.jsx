import { useState } from 'react';
import { Settings, ToggleLeft, ToggleRight, Edit2, X, Check, Wrench, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { AGENT_COLORS } from '../context/AppContext';

export default function AgentCard({ agent, onUpdatePersona, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [persona, setPersona] = useState('');
  const [enabled, setEnabled] = useState(true);

  const color = AGENT_COLORS[agent.name] || '#6B7280';

  const handleEdit = () => {
    setPersona('');
    setEditing(true);
  };

  const handleSave = () => {
    if (persona.trim() && onUpdatePersona) {
      onUpdatePersona(agent.name, persona);
    }
    setEditing(false);
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    onToggle?.(agent.name, next);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 transition-agent hover:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: color + '20', color }}
          >
            {agent.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-gray-200">{agent.name}</h3>
            <p className="text-xs text-gray-500">{agent.role}</p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title={enabled ? 'Disable agent' : 'Enable agent'}
        >
          {enabled ? (
            <ToggleRight size={24} className="text-green-400" />
          ) : (
            <ToggleLeft size={24} className="text-gray-600" />
          )}
        </button>
      </div>

      {/* Tools */}
      {agent.tools && agent.tools.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Wrench size={10} />
            <span>Tools</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((tool) => (
              <span
                key={tool}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Delegation permissions */}
      {agent.can_delegate_to && agent.can_delegate_to.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <GitBranch size={10} />
            <span>Can delegate to</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {agent.can_delegate_to.map((name) => (
              <span
                key={name}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: (AGENT_COLORS[name] || '#6B7280') + '15',
                  color: AGENT_COLORS[name] || '#6B7280',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Edit persona */}
      {editing ? (
        <div className="mt-3">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Custom persona instructions..."
            rows={3}
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              className="p-1.5 rounded-md text-green-400 hover:text-green-300 hover:bg-green-900/20 transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleEdit}
          className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Edit2 size={12} />
          Edit Persona
        </button>
      )}
    </div>
  );
}
