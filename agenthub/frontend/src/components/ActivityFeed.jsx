import { useMemo } from 'react';
import { Brain, CheckCircle, GitBranch, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useApp, AGENT_COLORS } from '../context/AppContext';

const TYPE_ICONS = {
  thinking: Brain,
  complete: CheckCircle,
  delegation: GitBranch,
  error: AlertCircle,
};

const TYPE_COLORS = {
  thinking: 'text-yellow-400',
  complete: 'text-green-400',
  delegation: 'text-blue-400',
  error: 'text-red-400',
};

export default function ActivityFeed() {
  const { activityLog } = useApp();

  const entries = useMemo(() => activityLog.slice(0, 50), [activityLog]);

  if (entries.length === 0) {
    return (
      <div className="p-3 border-t border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Activity Feed
        </h3>
        <p className="text-xs text-gray-600">No activity yet. Start a conversation to see agent activity here.</p>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-gray-800">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Activity Feed
      </h3>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {entries.map((entry, i) => {
          const Icon = TYPE_ICONS[entry.type] || Brain;
          const colorClass = TYPE_COLORS[entry.type] || 'text-gray-400';
          const agentColor = AGENT_COLORS[entry.agent] || '#6B7280';
          const time = entry.timestamp
            ? new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : '';

          return (
            <div
              key={i}
              className="flex items-start gap-2 text-xs py-1 transition-agent"
            >
              <Icon size={12} className={clsx('mt-0.5 flex-shrink-0', colorClass)} />
              <div className="min-w-0 flex-1">
                <p className="text-gray-400 leading-relaxed">
                  <span className="font-medium" style={{ color: agentColor }}>
                    {entry.agent}
                  </span>{' '}
                  {entry.text.replace(`${entry.agent} `, '')}
                </p>
              </div>
              <span className="text-gray-600 flex-shrink-0">{time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
