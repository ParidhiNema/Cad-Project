import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, FlaskConical,
  AlertOctagon, Activity, Cpu, FileText
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Incident } from '../types';
import { getStatusBadge, getPriorityColor, getTypeIcon, formatDateTime } from '../utils/helpers';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { incidents } = useApp();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = incidents.find(i => i.id === id);
    setIncident(found ?? null);
    setLoading(false);
  }, [id, incidents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertOctagon size={48} className="text-white/10 mb-4" />
        <h3 className="text-lg font-semibold text-white/40 mb-2">Incident not found</h3>
        <p className="text-sm text-white/30 mb-4">ID: {id}</p>
        <button onClick={() => navigate('/incidents')} className="btn-secondary text-sm">
          <ArrowLeft size={15} /> Back to Incidents
        </button>
      </div>
    );
  }

  const ai = incident.aiAnalysis;

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/incidents')} className="p-2 rounded-lg bg-black-200 border border-white/10 hover:border-white/20 text-white/50 hover:text-white transition-all mt-1">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xl font-bold text-white">{incident.id}</span>
            <span className={`status-badge ${getStatusBadge(incident.status)}`}>{incident.status}</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${getPriorityColor(incident.priority)}`}>{incident.priority}</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">{incident.type} Emergency</h2>
          <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
            <div className="flex items-center gap-1.5"><Clock size={11} />{formatDateTime(incident.createdAt)}</div>
            <div className="flex items-center gap-1.5"><MapPin size={11} />{incident.location.address ?? 'Unknown'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-white/40" />
              <h3 className="text-sm font-semibold text-white">Incident Description</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">{incident.description}</p>
          </div>

          {/* AI Analysis */}
          {ai && (
            <div className="glass-card p-5 border border-purple-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FlaskConical size={15} className="text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">AI Analysis</h3>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 mb-4">
                <p className="text-xs text-white/60 leading-relaxed">{ai.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-white/40 mb-2">Severity Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/10 rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${ai.severity}%`,
                          background: ai.severity > 75 ? '#E50914' : ai.severity > 50 ? '#ffa500' : '#4caf50',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">{ai.severity}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Confidence</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/10 rounded-full">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${ai.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-white">{ai.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <p className="text-xs text-white/40 mb-2">Detected Hazards</p>
                  <div className="flex flex-wrap gap-2">
                    {ai.detectedHazards.map(h => (
                      <span key={h} className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-xs text-red-300">
                        ⚠ {h}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Recommended Response</p>
                  <div className="p-3 rounded-lg bg-black-300 border border-white/5">
                    <p className="text-xs text-white/70">{ai.recommendedResponse}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Resources Needed</p>
                  <div className="flex flex-wrap gap-2">
                    {ai.resourcesNeeded.map(r => (
                      <span key={r} className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Est. Response Time:</span>
                  <span className="text-white font-mono">{ai.estimatedResponseTime}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={15} className="text-white/40" />
              <h3 className="text-sm font-semibold text-white">Response Timeline</h3>
            </div>
            <div className="space-y-4">
              {incident.timeline.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                      event.type === 'success' ? 'bg-green-400' :
                      event.type === 'warning' ? 'bg-yellow-400' :
                      event.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
                    }`} />
                    {i < incident.timeline.length - 1 && (
                      <div className="w-px flex-1 bg-white/10 mt-1 mb-1 min-h-[20px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm text-white/80">{event.event}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/40">{event.agent}</span>
                      <span className="text-xs text-white/30">{formatDateTime(event.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Dispatch Coordination */}
          <div className="p-4 rounded-xl bg-black-200 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={15} className="text-green-400" />
              <span className="text-xs font-bold text-green-400">DISPATCH COORDINATION ACTIVE</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Response telemetry and unit tracking are streaming through Central Dispatch.
            </p>
          </div>

          {/* Incident Info */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white mb-3">Incident Details</h3>
            {[
              { label: 'Incident ID', value: incident.id },
              { label: 'Type', value: `${getTypeIcon(incident.type)} ${incident.type}` },
              { label: 'Priority', value: incident.priority },
              { label: 'Status', value: incident.status },
              { label: 'Reported By', value: incident.reportedBy },
              { label: 'Created', value: formatDateTime(incident.createdAt) },
              { label: 'Updated', value: formatDateTime(incident.updatedAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-2 text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <span className="text-white/40">{label}</span>
                <span className="text-white/80 text-right font-medium">{value}</span>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={13} className="text-red-400" />
              <span className="text-xs font-semibold text-white">Location</span>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ height: 160 }}>
              <MapContainer
                center={[incident.location.lat, incident.location.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <CircleMarker
                  center={[incident.location.lat, incident.location.lng]}
                  radius={12}
                  pathOptions={{ fillColor: '#E50914', fillOpacity: 0.9, color: '#fff', weight: 2 }}
                >
                  <Popup><div className="text-xs font-bold text-red-500">{incident.location.address || 'Incident Location'}</div></Popup>
                </CircleMarker>
              </MapContainer>
            </div>
            <p className="text-[10px] text-white/30 mt-2">{incident.location.address}</p>
          </div>

          {/* Assigned Agents */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={13} className="text-blue-400" />
              <span className="text-xs font-semibold text-white">Assigned Agents</span>
            </div>
            <div className="space-y-2">
              {incident.assignedAgents.map(agent => (
                <div key={agent} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs text-white/70">{agent}</span>
                  <span className="ml-auto text-[10px] text-green-400">Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
