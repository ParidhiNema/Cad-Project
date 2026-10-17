import { Bell, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Emergency Reporting Portal',
  '/dashboard': 'Operations Dashboard',
  '/incidents': 'Incident Management',
  '/agents': 'Multi-Agent Monitor',
  '/analytics': 'Analytics & Insights',
};

export default function TopBar() {
  const { notifications, refreshIncidents, loading } = useApp();
  const location = useLocation();

  const title = Object.entries(PAGE_TITLES).find(([path]) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  })?.[1] ?? 'AegisGrid';

  return (
    <header className="fixed top-0 left-64 right-0 z-40 bg-[#090909]/95 backdrop-blur-md border-b border-white/5 px-6 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">{title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-white/40 font-mono">SYSTEM ACTIVE · LIVE MONITORING</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshIncidents}
            className="p-2 rounded-lg bg-black-200 border border-white/10 hover:border-white/20 text-white/50 hover:text-white transition-all duration-200"
            title="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative">
            <div className="p-2 rounded-lg bg-black-200 border border-white/10 text-white/50 cursor-pointer hover:border-white/20 hover:text-white transition-all">
              <Bell size={15} />
            </div>
            {notifications.length > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {notifications.length}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-green-400">COMMAND ACTIVE</span>
          </div>
        </div>
      </div>
    </header>
  );
}
