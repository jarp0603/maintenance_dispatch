import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { woApi } from '../lib/api';
import { ISSUE_TYPE_OPTIONS, ISSUE_TYPE_LABELS, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../lib/constants';
import { toast } from 'sonner';

const EMPTY = {
  tenant_name: '', unit_number: '', address: '', issue_type: 'general',
  priority: 'medium', status: 'pending', scheduled_date: '', scheduled_time: '',
  tenant_email: '', notes: '',
};

export default function WorkOrderModal({ open, onClose, onSaved, initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        tenant_name: initial.tenant_name || '',
        unit_number: initial.unit_number || '',
        address: initial.address || '',
        issue_type: initial.issue_type || 'general',
        priority: initial.priority || 'medium',
        status: initial.status || 'pending',
        scheduled_date: initial.scheduled_date || '',
        scheduled_time: initial.scheduled_time || '',
        tenant_email: initial.tenant_email || '',
        notes: initial.notes || '',
      } : EMPTY);
    }
  }, [open, initial]);

  if (!open) return null;

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.tenant_name.trim() || !form.unit_number.trim() || !form.address.trim()) {
      toast.error('Tenant name, unit number, and address are required');
      return;
    }
    setSaving(true);
    try {
      let saved;
      if (initial?.id) {
        const res = await woApi.update(initial.id, form);
        saved = res.data;
        toast.success('Work order updated');
      } else {
        const res = await woApi.create(form);
        saved = res.data;
        toast.success('Work order created');
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save work order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Work Order' : 'New Work Order'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tenant Name *</label>
              <input className="input" value={form.tenant_name} onChange={set('tenant_name')} placeholder="John Smith" required />
            </div>
            <div>
              <label className="label">Unit # *</label>
              <input className="input" value={form.unit_number} onChange={set('unit_number')} placeholder="4B" required />
            </div>
          </div>

          <div>
            <label className="label">Address *</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="123 Main St, City, State" required />
          </div>

          <div>
            <label className="label">Tenant Email</label>
            <input className="input" type="email" value={form.tenant_email} onChange={set('tenant_email')} placeholder="tenant@example.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Issue Type</label>
              <select className="select" value={form.issue_type} onChange={set('issue_type')}>
                {ISSUE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={set('priority')}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.status} onChange={set('status')}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Scheduled Date</label>
              <input className="input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
            </div>
          </div>

          <div>
            <label className="label">Scheduled Time</label>
            <input className="input" type="time" value={form.scheduled_time} onChange={set('scheduled_time')} />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Additional details about the issue..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Work Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
