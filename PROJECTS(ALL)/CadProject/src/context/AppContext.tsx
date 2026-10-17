import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Incident, Notification, KPIStats } from '../types';
import { getIncidents, getKPIStats, submitIncident as apiSubmitIncident, resetDemoData } from '../services/mockApi';
import { DEMO_INCIDENTS } from '../data/mockData';

interface AppContextType {
  incidents: Incident[];
  kpiStats: KPIStats | null;
  notifications: Notification[];
  loading: boolean;
  refreshIncidents: () => Promise<void>;
  addIncident: (incident: Incident) => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  handleResetDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>(DEMO_INCIDENTS);
  const [kpiStats, setKpiStats] = useState<KPIStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([getIncidents(), getKPIStats()]);
      setIncidents(data);
      setKpiStats(stats);
    } catch (e) {
      console.error('[AegisGrid] Error refreshing incidents:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addIncident = useCallback(async (incident: Incident) => {
    await apiSubmitIncident(incident);
    setIncidents(prev => [incident, ...prev]);
    setKpiStats(prev => prev ? {
      ...prev,
      total: prev.total + 1,
      active: prev.active + 1,
    } : null);
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const n: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    setNotifications(prev => [n, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(x => x.id !== n.id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleResetDemo = useCallback(async () => {
    await resetDemoData();
    await refreshIncidents();
  }, [refreshIncidents]);

  useEffect(() => {
    refreshIncidents();
  }, [refreshIncidents]);

  return (
    <AppContext.Provider value={{
      incidents,
      kpiStats,
      notifications,
      loading,
      refreshIncidents,
      addIncident,
      addNotification,
      removeNotification,
      handleResetDemo,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
