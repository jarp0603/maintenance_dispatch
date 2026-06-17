import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, CalendarCheck, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { woApi } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_ICONS } from '../lib/constants';
import WorkOrderModal from '../components/WorkOrderModal';
import KanbanBoard from '../components/KanbanBoard';
import { toast } from 'sonner';

function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <div
      className={`card flex items-center gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value ?? '—'}</div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [kanban, setKanban] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // 'table' | 'kanban'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes, kanbanRes] = await Promise.all([
        woApi.stats(),
        woApi.list({ limit: 10, sort: 'created_at', order: 'DESC' }),
        woApi.kanban(),
      ]);
      setStats(statsRes.data);
      setRecent(recentRes.data.data);
      setKanban(kanbanRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your maintenance operations</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            New Work Order
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          label="Open Work Orders"
          value={stats?.open}
          color="bg-blue-600"
          onClick={() => navigate('/work-orders?status=pending')}
        />
        <StatCard
          icon={CalendarCheck}
          label="Scheduled Today"
          value={stats?.scheduledToday}
          color="bg-purple-600"
          onClick={() => navigate('/schedule')}
        />
        <StatCard
          icon={CheckCircle}
          label="Completed This Week"
          value={stats?.completedWeek}
          color="bg-green-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats?.overdue}
          color={stats?.overdue > 0 ? 'bg-red-600' : 'bg-slate-600'}
        />
      </div>

      {/* Pipeline / Table toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-slate-900">Work Orders</h2>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'kanban' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setView('kanban')}
          >
            Kanban
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard data={kanban} />
      ) : (
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No work orders yet</p>
              <button className="btn-primary mt-4 mx-auto" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4" /> Create First Work Order
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tenant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Issue</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent.map((wo) => (
                    <tr
                      key={wo.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{wo.tenant_name}</td>
                      <td className="px-4 py-3 text-slate-600">{wo.unit_number}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{ISSUE_TYPE_ICONS[wo.issue_type]}</span>
                          <span className="text-slate-700">{ISSUE_TYPE_LABELS[wo.issue_type] || wo.issue_type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={wo.priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(wo.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-slate-100">
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => navigate('/work-orders')}
                >
                  View all work orders →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <WorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
