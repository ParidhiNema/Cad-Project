import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle, LayoutDashboard, FileText, BarChart3, ShieldAlert, Activity, Cpu
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Report Emergency', icon: AlertTriangle, exact: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidents', label: 'Incidents', icon: FileText },
  { to: '/agents', label: 'Agent Monitor', icon: Cpu },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#090909] border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="relative">
          <div className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center">
            <ShieldAlert size={20} className="text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-pulse" />
        </div>
        <div>
          <div className="font-bold text-white text-lg leading-tight tracking-tight">AegisGrid</div>
          <div className="text-[10px] text-white/40 font-mono uppercase tracking-wider">AI Emergency Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={isActive ? 'nav-link-active' : 'nav-link'}
            >
              <Icon size={18} className={isActive ? 'text-red-400' : 'text-white/50'} />
              <span className="text-sm">{label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={12} className="text-green-400" />
          <span className="text-[10px] text-white/40">System Status</span>
          <span className="text-[10px] text-green-400 ml-auto font-medium">Operational</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] text-white/40 font-mono">ENCRYPTED GRID ACTIVE</span>
        </div>
        <div className="mt-2 text-[9px] text-white/20 leading-relaxed">
          AegisGrid Enterprise v1.0 · Multi-Agent Command Core
        </div>
      </div>
    </aside>
  );
}
