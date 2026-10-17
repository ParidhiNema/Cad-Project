// Mock service layer — placeholder for future AWS backend integration
// All methods return simulated data. No real API calls are made.

import type { Incident, KPIStats, Agent } from '../types';
import { DEMO_INCIDENTS, DEMO_AGENTS } from '../data/mockData';

const STORAGE_KEY = 'aegisgrid_incidents';

function loadIncidents(): Incident[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Incident[];
      return [...DEMO_INCIDENTS, ...parsed.filter(i => !DEMO_INCIDENTS.find(d => d.id === i.id))];
    }
  } catch (e) {
    console.warn('[AegisGrid] Could not load incidents from localStorage');
  }
  return [...DEMO_INCIDENTS];
}

function saveIncidents(incidents: Incident[]): void {
  try {
    const userIncidents = incidents.filter(i => !DEMO_INCIDENTS.find(d => d.id === i.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userIncidents));
  } catch (e) {
    console.warn('[AegisGrid] Could not save incidents to localStorage');
  }
}

// ── Incident API (Mock) ──────────────────────────────────────────────────────

/**
 * [MOCK — Future: POST /api/incidents via API Gateway → Lambda → DynamoDB]
 * Simulates incident submission with a fake processing delay.
 */
export async function submitIncident(incident: Incident): Promise<{ success: boolean; incidentId: string }> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
  const incidents = loadIncidents();
  incidents.unshift(incident);
  saveIncidents(incidents);
  return { success: true, incidentId: incident.id };
}

/**
 * [MOCK — Future: GET /api/incidents via API Gateway → Lambda → DynamoDB]
 */
export async function getIncidents(): Promise<Incident[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return loadIncidents();
}

/**
 * [MOCK — Future: GET /api/incidents/:id via API Gateway → Lambda → DynamoDB]
 */
export async function getIncidentById(id: string): Promise<Incident | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const incidents = loadIncidents();
  return incidents.find(i => i.id === id) ?? null;
}

/**
 * [MOCK — Future: PUT /api/incidents/:id/status]
 */
export async function updateIncidentStatus(_id: string, _status: Incident['status']): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return true;
}

/**
 * [MOCK — Future: DELETE /api/incidents (demo reset only)]
 */
export async function resetDemoData(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
  localStorage.removeItem(STORAGE_KEY);
}

// ── Agent API (Mock) ─────────────────────────────────────────────────────────

/**
 * [MOCK — Future: GET /api/agents via API Gateway → Lambda → DynamoDB]
 * Returns simulated agent statuses with random variation.
 */
export async function getAgents(): Promise<Agent[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  // Simulate random status changes
  return DEMO_AGENTS.map(agent => ({
    ...agent,
    processedCount: agent.processedCount + Math.floor(Math.random() * 3),
    lastActive: new Date().toISOString(),
  }));
}

// ── Analytics API (Mock) ─────────────────────────────────────────────────────

/**
 * [MOCK — Future: GET /api/analytics/kpi via API Gateway → Lambda → QuickSight]
 */
export async function getKPIStats(): Promise<KPIStats> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const incidents = loadIncidents();
  return {
    total: incidents.length,
    active: incidents.filter(i => i.status === 'Active' || i.status === 'Dispatched').length,
    critical: incidents.filter(i => i.priority === 'Critical' && i.status !== 'Resolved').length,
    resolved: incidents.filter(i => i.status === 'Resolved').length,
    activeAgents: DEMO_AGENTS.filter(a => a.status === 'Active' || a.status === 'Processing').length,
    avgResponseTime: '5.8 min',
    isDemo: true,
  };
}

// ── ID Generator ─────────────────────────────────────────────────────────────

export function generateIncidentId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900) + 100;
  return `INC-${year}-${seq.toString().padStart(3, '0')}`;
}

// ── CSV Export ───────────────────────────────────────────────────────────────

export function exportToCSV(incidents: Incident[]): void {
  const headers = ['ID', 'Type', 'Priority', 'Status', 'Location', 'Created At', 'Description'];
  const rows = incidents.map(i => [
    i.id,
    i.type,
    i.priority,
    i.status,
    i.location.address ?? `${i.location.lat},${i.location.lng}`,
    new Date(i.createdAt).toLocaleString(),
    `"${i.description.replace(/"/g, '""')}"`,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aegisgrid_incidents_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
