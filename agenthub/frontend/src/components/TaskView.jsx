import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Clock, Loader2, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { fetchTasks, fetchTask } from '../utils/api';
import { AGENT_COLORS } from '../context/AppContext';

function StatusBadge({ status }) {
  const config = {
    pending: { color: 'text-gray-400 bg-gray-800', icon: Clock, label: 'Pending' },
    in_progress: { color: 'text-yellow-400 bg-yellow-900/30', icon: Loader2, label: 'In Progress' },
    complete: { color: 'text-green-400 bg-green-900/30', icon: CheckCircle, label: 'Complete' },
  };

  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', c.color)}>
      <Icon size={10} className={status === 'in_progress' ? 'animate-spin' : ''} />
      {c.label}
    </span>
  );
}

function TaskItem({ task }) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(null);
  const color = AGENT_COLORS[task.assigned_agent] || '#6B7280';

  const handleToggle = async () => {
    if (!expanded && !details) {
      try {
        const data = await fetchTask(task.id);
        setDetails(data);
      } catch {
        // ignore
      }
    }
    setExpanded(!expanded);
  };

  return (
    <div className="border-l-2 pl-3 py-1" style={{ borderColor: color }}>
      <button
        onClick={handleToggle}
        className="w-full flex items-start gap-2 text-left hover:bg-gray-800/50 rounded-md p-1 -ml-1 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="mt-0.5 text-gray-500 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate" style={{ color }}>
              {task.assigned_agent}
            </span>
            <StatusBadge status={task.status} />
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
        </div>
      </button>

      {expanded && details && (
        <div className="ml-5 mt-1 space-y-2">
          {/* Delegations */}
          {details.delegations?.length > 0 && (
            <div className="space-y-1">
              {details.delegations.map((d) => (
                <div key={d.id} className="flex items-center gap-1 text-xs text-gray-500">
                  <GitBranch size={10} />
                  <span style={{ color: AGENT_COLORS[d.from_agent] }}>{d.from_agent}</span>
                  <span>→</span>
                  <span style={{ color: AGENT_COLORS[d.to_agent] }}>{d.to_agent}</span>
                </div>
              ))}
            </div>
          )}

          {/* Subtasks */}
          {details.subtasks?.length > 0 && (
            <div className="space-y-1">
              {details.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <StatusBadge status={s.status} />
                  <span className="text-gray-400 truncate">{s.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Result preview */}
          {details.result && (
            <p className="text-xs text-gray-500 line-clamp-3 bg-gray-800/50 rounded p-2">
              {details.result.slice(0, 200)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTasks(null, 20);
        setTasks(data.tasks || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();

    // Refresh every 10 seconds
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const recentTasks = tasks.filter((t) => t.status !== 'in_progress').slice(0, 10);

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Tasks
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 size={12} className="animate-spin" />
          Loading...
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-gray-600">No tasks yet</p>
      ) : (
        <div className="space-y-2">
          {activeTasks.length > 0 && (
            <div>
              <p className="text-xs text-yellow-500 font-medium mb-1">Active</p>
              {activeTasks.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          )}

          {recentTasks.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1 mt-3">Recent</p>
              {recentTasks.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
