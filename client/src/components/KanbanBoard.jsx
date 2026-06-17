import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { ISSUE_TYPE_ICONS, ISSUE_TYPE_LABELS } from '../lib/constants';
import { MapPin, Clock } from 'lucide-react';

const COLUMNS = [
  { id: 'pending', label: 'Pending', color: 'border-slate-300' },
  { id: 'scheduled', label: 'Scheduled', color: 'border-blue-400' },
  { id: 'in_progress', label: 'In Progress', color: 'border-purple-400' },
  { id: 'completed', label: 'Completed', color: 'border-green-400' },
];

function KanbanCard({ wo }) {
  const navigate = useNavigate();
  return (
    <div
      className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
      onClick={() => navigate(`/work-orders/${wo.id}`)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-base">{ISSUE_TYPE_ICONS[wo.issue_type] || '🔨'}</span>
        <PriorityBadge priority={wo.priority} />
      </div>
      <div className="text-sm font-medium text-slate-900 mb-1 truncate">{wo.tenant_name}</div>
      <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate">Unit {wo.unit_number}</span>
      </div>
      <div className="text-xs text-slate-600 font-medium">
        {ISSUE_TYPE_LABELS[wo.issue_type] || wo.issue_type}
      </div>
      {wo.scheduled_date && (
        <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          {wo.scheduled_date} {wo.scheduled_time && `@ ${wo.scheduled_time}`}
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({ data = {} }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map(({ id, label, color }) => {
        const cards = data[id] || [];
        return (
          <div key={id} className="flex flex-col gap-2">
            <div className={`flex items-center gap-2 pb-2 border-b-2 ${color}`}>
              <span className="text-sm font-semibold text-slate-700">{label}</span>
              <span className="ml-auto bg-slate-100 text-slate-600 text-xs rounded-full px-2 py-0.5 font-medium">
                {cards.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {cards.map((wo) => (
                <KanbanCard key={wo.id} wo={wo} />
              ))}
              {cards.length === 0 && (
                <div className="text-xs text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
                  No items
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
