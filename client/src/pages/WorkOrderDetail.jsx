import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, Send, CheckCircle, RefreshCw, Mail, MapPin, Clock, User } from 'lucide-react';
import { woApi } from '../lib/api';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_ICONS, STATUS_OPTIONS } from '../lib/constants';
import WorkOrderModal from '../components/WorkOrderModal';
import { toast } from 'sonner';

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div>
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-sm text-slate-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [wo, setWo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await woApi.get(id);
      setWo(res.data);
    } catch {
      toast.error('Work order not found');
      navigate('/work-orders');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(status) {
    setUpdatingStatus(true);
    try {
      const res = await woApi.update(id, { status });
      setWo((prev) => ({ ...prev, ...res.data }));
      toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this work order?')) return;
    try {
      await woApi.delete(id);
      toast.success('Work order deleted');
      navigate('/work-orders');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function handleSendScheduling() {
    if (!wo.tenant_email) { toast.error('No tenant email'); return; }
    try {
      await woApi.sendScheduling(id);
      toast.success('Scheduling link sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (!wo) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          onClick={() => navigate('/work-orders')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900 truncate">{wo.tenant_name}</h1>
            <PriorityBadge priority={wo.priority} />
            <StatusBadge status={wo.status} />
          </div>
          <p className="text-xs text-slate-500">Work Order #{wo.id} · Created {new Date(wo.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-secondary" onClick={() => setEditOpen(true)}><Edit2 className="w-3.5 h-3.5" /> Edit</button>
          <button className="btn-danger" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Details</h2>
            <InfoRow icon={User} label="Tenant" value={wo.tenant_name} />
            <InfoRow icon={MapPin} label="Unit / Address" value={`Unit ${wo.unit_number} — ${wo.address}`} />
            <InfoRow icon={Mail} label="Tenant Email" value={wo.tenant_email} />
            <InfoRow icon={() => <span>{ISSUE_TYPE_ICONS[wo.issue_type]}</span>} label="Issue Type" value={ISSUE_TYPE_LABELS[wo.issue_type] || wo.issue_type} />
            <InfoRow icon={Clock} label="Scheduled" value={wo.scheduled_date ? `${wo.scheduled_date}${wo.scheduled_time ? ' at ' + wo.scheduled_time : ''}` : null} />
            {wo.notes && (
              <div>
                <div className="text-xs text-slate-500 font-medium mb-1">Notes</div>
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{wo.notes}</div>
              </div>
            )}
          </div>

          {/* Email logs */}
          {wo.email_logs?.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Email History</h2>
              <div className="space-y-2">
                {wo.email_logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-xs">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-slate-500 w-24 shrink-0">{log.email_type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-700 truncate">{log.recipient}</span>
                    <span className="text-slate-400 shrink-0 ml-auto">{new Date(log.sent_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          {/* Status change */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Update Status</h2>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors capitalize ${wo.status === s ? 'bg-blue-600 text-white font-medium' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus || wo.status === s}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Actions</h2>
            <div className="space-y-2">
              {wo.tenant_email && (
                <button className="btn-secondary w-full justify-center" onClick={handleSendScheduling}>
                  <Send className="w-3.5 h-3.5" /> Send Scheduling Link
                </button>
              )}
              {wo.status !== 'completed' && (
                <button
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => handleStatusChange('completed')}
                  disabled={updatingStatus}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Mark Completed
                </button>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="card text-xs space-y-2 text-slate-500">
            <div className="flex justify-between">
              <span>Source</span>
              <span className="font-medium text-slate-700 capitalize">{wo.source}</span>
            </div>
            <div className="flex justify-between">
              <span>Followup 1</span>
              <span className={wo.followup_1_sent ? 'text-green-600 font-medium' : ''}>{wo.followup_1_sent ? 'Sent' : 'Not sent'}</span>
            </div>
            <div className="flex justify-between">
              <span>Followup 2</span>
              <span className={wo.followup_2_sent ? 'text-green-600 font-medium' : ''}>{wo.followup_2_sent ? 'Sent' : 'Not sent'}</span>
            </div>
            <div className="flex justify-between">
              <span>Reminder</span>
              <span className={wo.reminder_sent ? 'text-green-600 font-medium' : ''}>{wo.reminder_sent ? 'Sent' : 'Not sent'}</span>
            </div>
            {wo.completed_at && (
              <div className="flex justify-between">
                <span>Completed</span>
                <span>{new Date(wo.completed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkOrderModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => setWo((prev) => ({ ...prev, ...saved }))}
        initial={wo}
      />
    </div>
  );
}
