import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, RefreshCw } from 'lucide-react';
import { woApi } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_ICONS } from '../lib/constants';
import { toast } from 'sonner';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDayLabel(d) {
  const today = formatDate(new Date());
  const s = formatDate(d);
  if (s === today) return 'Today';
  if (s === formatDate(addDays(new Date(), 1))) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Schedule() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Generate 7-day week view starting from currentDate's week Monday
  const weekStart = (() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  })();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load all scheduled work orders — we'll filter client-side for the week
        const startStr = formatDate(weekDays[0]);
        const endStr = formatDate(weekDays[6]);
        const res = await woApi.list({ status: 'scheduled', limit: 200 });
        setWorkOrders(res.data.data);
      } catch {
        toast.error('Failed to load schedule');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [weekStart.toISOString()]);

  function getOrdersForDay(day) {
    const dayStr = formatDate(day);
    return workOrders
      .filter((wo) => wo.scheduled_date === dayStr)
      .sort((a, b) => (a.scheduled_time || '23:59').localeCompare(b.scheduled_time || '23:59'));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-500">Weekly view of scheduled work orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setCurrentDate(new Date())}>Today</button>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button className="p-2 hover:bg-slate-50 transition-colors" onClick={() => setCurrentDate((d) => addDays(d, -7))}>
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="px-3 text-sm font-medium text-slate-700">
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button className="p-2 hover:bg-slate-50 transition-colors" onClick={() => setCurrentDate((d) => addDays(d, 7))}>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/route')}>
            <MapPin className="w-4 h-4" /> Route View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading schedule...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const orders = getOrdersForDay(day);
            const isToday = formatDate(day) === formatDate(new Date());
            return (
              <div key={formatDate(day)} className="min-w-0">
                {/* Day header */}
                <div className={`text-center py-2 mb-2 rounded-lg ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <div className="text-xs font-semibold">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-slate-900'}`}>
                    {day.getDate()}
                  </div>
                  {orders.length > 0 && (
                    <div className={`text-xs mt-0.5 ${isToday ? 'text-blue-100' : 'text-slate-500'}`}>
                      {orders.length} job{orders.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Work order cards */}
                <div className="space-y-1.5">
                  {orders.map((wo) => (
                    <div
                      key={wo.id}
                      className="bg-white border border-slate-100 rounded-lg p-2 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all text-xs"
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                    >
                      <div className="font-medium text-slate-900 truncate">{wo.tenant_name}</div>
                      <div className="text-slate-500 truncate">U{wo.unit_number}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span>{ISSUE_TYPE_ICONS[wo.issue_type]}</span>
                        {wo.scheduled_time && (
                          <span className="text-blue-600 font-medium">{wo.scheduled_time}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="h-12 border-2 border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
