export const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
};

export const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
};

export const ISSUE_TYPE_LABELS = {
  electrical: 'Electrical',
  smoke_alarm: 'Smoke Alarm',
  plumbing: 'Plumbing / ABS',
  welding: 'Welding',
  painting: 'Painting',
  door_repair: 'Door Repair',
  hvac: 'HVAC',
  appliances: 'Appliances',
  general: 'General',
};

export const ISSUE_TYPE_ICONS = {
  electrical: '⚡',
  smoke_alarm: '🔔',
  plumbing: '💧',
  welding: '🔥',
  painting: '🎨',
  door_repair: '🚪',
  hvac: '❄️',
  appliances: '🔧',
  general: '🔨',
};

export const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'emergency'];
export const STATUS_OPTIONS = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
export const ISSUE_TYPE_OPTIONS = Object.keys(ISSUE_TYPE_LABELS);
