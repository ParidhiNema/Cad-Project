import React, { useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, Users, TrendingUp, MapPin,
  FlaskConical, Zap
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEMO_ACTIVITY_FEED, TREND_DATA, TYPE_DISTRIBUTION } from '../data/mockData';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getPriorityDot, getStatusBadge } from '../utils/helpers';



const MARKER_COLORS: Record<string, string> = {
  Critical: '#E50914',
  High: '#ff6b35',
  Medium: '#ffa500',
  Low: '#4caf50',
};

function KPICard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: number | string; sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; trend?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/50 font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-current/10`} style={{ background: `${color}15` }}>
          <Icon size={20} className={color} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
          <TrendingUp size={11} className="text-green-400" />
          <span className="text-xs text-white/40">{trend}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { incidents, kpiStats } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const navigate = useNavigate();

  const activeIncidents = incidents.filter(i => i.status !== 'Resolved');

  const filteredTable = incidents.filter(i => {
    const matchSearch = i.id.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || i.status === filterStatus;
    return matchSearch && matchStatus;
  }).slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Operations Dashboard</h2>
          <p className="text-sm text-white/40 mt-1">Real-time operational status and telemetry</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Incidents" value={kpiStats?.total ?? incidents.length} icon={Activity}
          color="text-white" sub="All time recorded" trend="+12% vs last week" />
        <KPICard title="Active" value={kpiStats?.active ?? activeIncidents.length} icon={Zap}
          color="text-orange-400" sub="Ongoing incidents" trend="3 new today" />
        <KPICard title="Critical" value={kpiStats?.critical ?? incidents.filter(i => i.priority === 'Critical' && i.status !== 'Resolved').length} icon={AlertTriangle}
          color="text-red-400" sub="Needs immediate action" />
        <KPICard title="Resolved" value={kpiStats?.resolved ?? incidents.filter(i => i.status === 'Resolved').length} icon={CheckCircle}
          color="text-green-400" sub="Resolved cases" trend="5 resolved today" />
        <KPICard title="Active Agents" value={kpiStats?.activeAgents ?? 7} icon={Users}
          color="text-blue-400" sub="Autonomous agents active" />
      </div>

      {/* Map + Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Incident Map */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-red-400" />
              <span className="text-sm font-semibold text-white">Incident Map</span>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ height: 280 }}>
            <MapContainer
              center={[40.72, -73.99]}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {incidents.map(incident => (
                <CircleMarker
                  key={incident.id}
                  center={[incident.location.lat, incident.location.lng]}
                  radius={incident.priority === 'Critical' ? 10 : incident.priority === 'High' ? 8 : 6}
                  pathOptions={{
                    fillColor: MARKER_COLORS[incident.priority],
                    fillOpacity: 0.85,
                    color: '#fff',
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <div className="font-bold">{incident.id}</div>
                      <div>{incident.type} — {incident.priority}</div>
                      <div className="text-white/50 text-[10px] mt-1">{incident.location.address}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Type Distribution */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={15} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Incident Types</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={TYPE_DISTRIBUTION} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                dataKey="value" paddingAngle={3}>
                {TYPE_DISTRIBUTION.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {TYPE_DISTRIBUTION.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[10px] text-white/60 truncate">{d.name}</span>
                <span className="text-[10px] text-white/40 ml-auto">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">7-Day Incident Trend</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={TREND_DATA}>
            <defs>
              <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E50914" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#E50914" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff6b35" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
            <Area type="monotone" dataKey="critical" stroke="#E50914" fill="url(#critGrad)" strokeWidth={2} name="Critical" />
            <Area type="monotone" dataKey="high" stroke="#ff6b35" fill="url(#highGrad)" strokeWidth={2} name="High" />
            <Area type="monotone" dataKey="medium" stroke="#ffa500" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Medium" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Incident Table + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Incidents Table */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white">Recent Incidents</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field text-xs py-1.5 px-3 w-36"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="select-field text-xs py-1.5 px-2 w-28"
              >
                {['All', 'Active', 'Critical', 'Resolved', 'Pending', 'Dispatched'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {['ID', 'Type', 'Priority', 'Status', 'Time'].map(h => (
                    <th key={h} className="text-left text-xs text-white/40 font-medium pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTable.map(inc => (
                  <tr
                    key={inc.id}
                    className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                  >
                    <td className="py-2.5 pr-4 font-mono text-xs text-white/60">{inc.id}</td>
                    <td className="py-2.5 pr-4 text-white text-xs">{inc.type}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(inc.priority)}`} />
                        <span className={`text-xs font-medium ${
                          inc.priority === 'Critical' ? 'text-red-400' :
                          inc.priority === 'High' ? 'text-orange-400' :
                          inc.priority === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                        }`}>{inc.priority}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`status-badge text-[10px] ${getStatusBadge(inc.status)}`}>{inc.status}</span>
                    </td>
                    <td className="py-2.5 text-xs text-white/40">
                      {formatDistanceToNow(new Date(inc.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-green-400" />
            <span className="text-sm font-semibold text-white">Recent Activity</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {DEMO_ACTIVITY_FEED.map(item => (
              <div key={item.id} className="flex items-start gap-2.5 pb-3 border-b border-white/5 last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                  item.type === 'alert' ? 'bg-red-400' :
                  item.type === 'resolution' ? 'bg-green-400' :
                  item.type === 'agent' ? 'bg-blue-400' : 'bg-orange-400'
                }`} />
                <div>
                  <p className="text-xs text-white/70 leading-relaxed">{item.message}</p>
                  <p className="text-[10px] text-white/30 mt-1">
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
