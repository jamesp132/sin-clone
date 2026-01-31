import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Settings, Clock, PanelRightOpen, PanelRightClose, Wifi, WifiOff, Plus } from 'lucide-react';
import clsx from 'clsx';
import AgentSidebar from './AgentSidebar';
import TaskView from './TaskView';
import ActivityFeed from './ActivityFeed';
import { useApp } from '../context/AppContext';

export default function Layout({ children }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const { connectionStatus, newConversation } = useApp();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chat' },
    { path: '/history', icon: Clock, label: 'History' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Left sidebar — agents */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo / title */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm">
              AH
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AgentHub</h1>
              <div className="flex items-center gap-1 text-xs">
                {connectionStatus === 'connected' ? (
                  <>
                    <Wifi size={10} className="text-green-400" />
                    <span className="text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={10} className="text-red-400" />
                    <span className="text-red-400">
                      {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            New Conversation
          </button>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto">
          <AgentSidebar />
        </div>

        {/* Navigation */}
        <nav className="p-3 border-t border-gray-800 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                location.pathname === item.path
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>

      {/* Right panel — tasks & activity */}
      {rightPanelOpen && (
        <aside className="w-80 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Activity</h2>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TaskView />
            <ActivityFeed />
          </div>
        </aside>
      )}

      {/* Toggle button when panel is closed */}
      {!rightPanelOpen && (
        <button
          onClick={() => setRightPanelOpen(true)}
          className="fixed right-4 top-4 z-10 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <PanelRightOpen size={16} />
        </button>
      )}
    </div>
  );
}
