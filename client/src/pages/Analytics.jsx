import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, BarChart2, Clock, Building2 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsApi } from '../lib/api';
import { ISSUE_TYPE_LABELS } from '../lib/constants';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState({
    overview: null,
    trends: [],
    byType: [],
    resolutionTime: [],
    byDay: [],
    byUnit: [],
  });

  async function load() {
    setLoading(true);
    try {
      const [overview, trends, byType, resolutionTime, byDay, byUnit] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.trends({ period }),
        analyticsApi.byType(),
        analyticsApi.resolutionTime(),
        analyticsApi.byDay(),
        analyticsApi.byUnit(),
      ]);
      setData({
        overview: overview.data,
        trends: trends.data.data || [],
        byType: byType.data || [],
        resolutionTime: resolutionTime.data || [],
        byDay: byDay.data || [],
        byUnit: byUnit.data || [],
      });
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading analytics...
      </div>
    );
  }

  const statusPieData = data.overview?.byStatus
    ? Object.entries(data.overview.byStatus).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: v }))
    : [];

  const priorityPieData = data.overview?.byPriority
    ? Object.entries(data.overview.byPriority).map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Trends and insights from your maintenance operations</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {['week', 'month'].map((p) => (
              <button
                key={p}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${period === p ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setPeriod(p)}
              >{p}ly</button>
            ))}
          </div>
          <button className="btn-secondary" onClick={load}><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Work Orders', value: data.overview?.total ?? 0, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
          { label: 'This Month', value: data.overview?.thisMonth ?? 0, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
          { label: 'Completed', value: data.overview?.byStatus?.completed ?? 0, icon: Clock, color: 'text-green-600 bg-green-50' },
          { label: 'Pending', value: data.overview?.byStatus?.pending ?? 0, icon: Building2, color: 'text-yellow-600 bg-yellow-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Trends */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" /> Work Orders Over Time
        </h2>
        {data.trends.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">No trend data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Work Orders" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By type */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Issues by Type</h2>
          {data.byType.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byType.map((d) => ({ ...d, name: ISSUE_TYPE_LABELS[d.issue_type] || d.issue_type }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By day of week */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Busiest Days</h2>
          {data.byDay.every((d) => d.count === 0) ? (
            <div className="text-center py-10 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Work Orders" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Status Distribution</h2>
          {statusPieData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {statusPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resolution time */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600" /> Avg. Resolution Time (hrs)
          </h2>
          {data.resolutionTime.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Complete some work orders to see data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.resolutionTime.map((d) => ({ ...d, name: ISSUE_TYPE_LABELS[d.issue_type] || d.issue_type }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} formatter={(v) => [`${v}h`, 'Avg Resolution']} />
                <Bar dataKey="avg_hours" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Hours" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top units */}
      {data.byUnit.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> Units with Most Requests
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Unit</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">Address</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">High Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.byUnit.map((u) => (
                  <tr key={u.unit_number}>
                    <td className="py-2.5 font-medium text-slate-900">Unit {u.unit_number}</td>
                    <td className="py-2.5 text-slate-500 text-xs truncate max-w-[200px]">{u.address}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">{u.count}</td>
                    <td className={`py-2.5 text-right font-semibold ${u.high_priority > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {u.high_priority}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
