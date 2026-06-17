import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Trash2, Send, RefreshCw } from 'lucide-react';
import { woApi } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_ICONS, ISSUE_TYPE_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../lib/constants';
import WorkOrderModal from '../components/WorkOrderModal';
import { toast } from 'sonner';

export default function WorkOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [workOrders, setWorkOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: '',
    issue_type: '',
    search: '',
    page: 1,
    limit: 25,
    sort: 'created_at',
    order: 'DESC',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await woApi.list(params);
      setWorkOrders(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this work order?')) return;
    try {
      await woApi.delete(id);
      toast.success('Deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function handleSendScheduling(wo, e) {
    e.stopPropagation();
    if (!wo.tenant_email) {
      toast.error('No tenant email on this work order');
      return;
    }
    try {
      await woApi.sendScheduling(wo.id);
      toast.success('Scheduling link sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send link');
    }
  }

  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Work Orders</h1>
          <p className="text-sm text-slate-500">{total} total work orders</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          <button className="btn-primary" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Work Order</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              className="input pl-8"
              placeholder="Search tenant, unit, address..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          <select className="select w-auto" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="select w-auto" value={filters.priority} onChange={(e) => updateFilter('priority', e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
          <select className="select w-auto" value={filters.issue_type} onChange={(e) => updateFilter('issue_type', e.target.value)}>
            <option value="">All types</option>
            {ISSUE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit / Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Issue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduled</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Loading...</td></tr>
              ) : workOrders.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No work orders found</td></tr>
              ) : workOrders.map((wo) => (
                <tr
                  key={wo.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                >
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{wo.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{wo.tenant_name}</div>
                    {wo.tenant_email && <div className="text-xs text-slate-400">{wo.tenant_email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">Unit {wo.unit_number}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px]">{wo.address}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span>{ISSUE_TYPE_ICONS[wo.issue_type]}</span>
                      <span className="text-slate-700">{ISSUE_TYPE_LABELS[wo.issue_type] || wo.issue_type}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={wo.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {wo.scheduled_date ? `${wo.scheduled_date}${wo.scheduled_time ? ' ' + wo.scheduled_time : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${wo.source === 'email' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {wo.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {wo.tenant_email && (
                        <button
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Send scheduling link"
                          onClick={(e) => handleSendScheduling(wo, e)}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                        onClick={(e) => handleDelete(wo.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500 text-xs">
              Showing {(filters.page - 1) * filters.limit + 1}–{Math.min(filters.page * filters.limit, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                className="btn-secondary py-1 px-2 text-xs"
                disabled={filters.page === 1}
                onClick={() => updateFilter('page', filters.page - 1)}
              >Prev</button>
              <button
                className="btn-secondary py-1 px-2 text-xs"
                disabled={filters.page >= totalPages}
                onClick={() => updateFilter('page', filters.page + 1)}
              >Next</button>
            </div>
          </div>
        )}
      </div>

      <WorkOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
