import clsx from 'clsx';
import { Users } from 'lucide-react';
import { useApp, AGENT_COLORS } from '../context/AppContext';

function StatusDot({ status }) {
  return (
    <span
      className={clsx(
        'w-2 h-2 rounded-full inline-block flex-shrink-0',
        status === 'idle' && 'bg-gray-500',
        status === 'thinking' && 'bg-yellow-400 animate-agent-pulse',
        status === 'working' && 'bg-green-400',
      )}
    />
  );
}

export default function AgentSidebar() {
  const { agents, selectedAgent, selectAgent } = useApp();

  return (
    <div className="p-3 space-y-1">
      {/* All Agents option — routes through Coordinator */}
      <button
        onClick={() => selectAgent(null)}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
          selectedAgent === null
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
        )}
      >
        <Users size={16} />
        <span className="font-medium">All Agents</span>
      </button>

      <div className="pt-2 pb-1 px-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Specialists
        </span>
      </div>

      {agents.map((agent) => {
        const color = AGENT_COLORS[agent.name] || '#6B7280';
        const isSelected = selectedAgent === agent.name;

        return (
          <button
            key={agent.name}
            onClick={() => selectAgent(agent.name)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
              isSelected
                ? 'bg-gray-800 text-white border border-gray-700'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            )}
          >
            {/* Agent color indicator */}
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: color + '20', color }}
            >
              {agent.name[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <StatusDot status={agent.status} />
                <span className="truncate font-medium">{agent.name}</span>
              </div>
              {agent.current_task && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {agent.status === 'thinking' ? 'Thinking...' : agent.current_task}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
