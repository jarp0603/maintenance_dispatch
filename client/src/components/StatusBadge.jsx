import React from 'react';
import { PRIORITY_COLORS, STATUS_COLORS } from '../lib/constants';

export function StatusBadge({ status }) {
  const label = status?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority === 'emergency' ? '🚨 ' : ''}
      {priority}
    </span>
  );
}
