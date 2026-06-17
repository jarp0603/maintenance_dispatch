import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { settingsApi, gmailApi, calendlyApi } from '../lib/api';
import { toast } from 'sonner';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [calendlyStatus, setCalendlyStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, gmailRes, calendlyRes] = await Promise.allSettled([
          settingsApi.get(),
          gmailApi.status(),
          calendlyApi.status(),
        ]);
        if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
        if (gmailRes.status === 'fulfilled') setGmailStatus(gmailRes.value.data);
        if (calendlyRes.status === 'fulfilled') setCalendlyStatus(calendlyRes.value.data);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Handle OAuth redirect params
    if (searchParams.get('gmail_connected')) {
      toast.success(`Gmail connected: ${searchParams.get('email') || ''}`);
    } else if (searchParams.get('gmail_error')) {
      toast.error(`Gmail error: ${searchParams.get('gmail_error')}`);
    }
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(settings);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleGmailConnect() {
    try {
      const res = await gmailApi.authUrl();
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate Gmail auth');
    }
  }

  async function handleGmailDisconnect() {
    if (!confirm('Disconnect Gmail?')) return;
    try {
      await gmailApi.disconnect();
      setGmailStatus({ connected: false });
      toast.success('Gmail disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  }

  async function handleGmailSync() {
    setSyncing(true);
    try {
      const res = await gmailApi.sync();
      toast.success(`Synced: ${res.data.parsed} new work orders parsed`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function set(key) {
    return (e) => setSettings((s) => ({ ...s, [key]: e.target.value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Configure your dispatch system</p>
      </div>

      {/* Gmail Integration */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Gmail Integration</h2>
        <div className="flex items-center gap-3 mb-4">
          {gmailStatus?.connected ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Connected</div>
                <div className="text-xs text-slate-500">{gmailStatus.email}</div>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  className="btn-secondary text-xs py-1.5"
                  onClick={handleGmailSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
                <button className="btn-danger text-xs py-1.5" onClick={handleGmailDisconnect}>Disconnect</button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Not connected</div>
                <div className="text-xs text-slate-500">Connect Gmail to auto-parse maintenance emails</div>
              </div>
              <button className="btn-primary ml-auto" onClick={handleGmailConnect}>
                Connect Gmail
              </button>
            </>
          )}
        </div>
        {!process.env.VITE_GMAIL_CONFIGURED && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            Set <code className="font-mono bg-slate-200 px-1 rounded">GMAIL_CLIENT_ID</code>, <code className="font-mono bg-slate-200 px-1 rounded">GMAIL_CLIENT_SECRET</code>, and <code className="font-mono bg-slate-200 px-1 rounded">GMAIL_REDIRECT_URI</code> in your server <code className="font-mono bg-slate-200 px-1 rounded">.env</code> to enable Gmail.
          </div>
        )}
      </div>

      {/* Calendly */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Calendly Integration</h2>
        <div className="flex items-center gap-3 mb-4">
          {calendlyStatus?.connected ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div className="text-sm font-medium text-slate-900">Configured</div>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Not configured</div>
                <div className="text-xs text-slate-500">Set CALENDLY_API_KEY and CALENDLY_EVENT_URL in .env</div>
              </div>
            </>
          )}
        </div>
        <div>
          <label className="label">Calendly Event URL</label>
          <input
            className="input"
            placeholder="https://calendly.com/your-username/maintenance"
            value={settings.calendly_event_url || ''}
            onChange={set('calendly_event_url')}
          />
          <p className="text-xs text-slate-500 mt-1">This URL is sent to tenants for scheduling. Get it from your Calendly event.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Business Info */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Business Information</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Business Name</label>
              <input className="input" value={settings.business_name || ''} onChange={set('business_name')} placeholder="Maintenance Dispatch" />
            </div>
            <div>
              <label className="label">Technician Name</label>
              <input className="input" value={settings.technician_name || ''} onChange={set('technician_name')} placeholder="Your Name" />
            </div>
            <div>
              <label className="label">Tech Email (for signatures)</label>
              <input className="input" type="email" value={settings.tech_email || ''} onChange={set('tech_email')} placeholder="you@example.com" />
            </div>
          </div>
        </div>

        {/* Follow-up Timing */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Automated Follow-up Timing</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First Follow-up (hours after creation)</label>
                <input className="input" type="number" min={1} value={settings.followup_1_hours || '48'} onChange={set('followup_1_hours')} />
              </div>
              <div>
                <label className="label">Second Follow-up (hours after creation)</label>
                <input className="input" type="number" min={1} value={settings.followup_2_hours || '96'} onChange={set('followup_2_hours')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Appointment Reminder (hours before)</label>
                <input className="input" type="number" min={1} value={settings.reminder_hours || '24'} onChange={set('reminder_hours')} />
              </div>
              <div>
                <label className="label">Min Gap Between Jobs (minutes)</label>
                <input className="input" type="number" min={0} value={settings.min_gap_minutes || '30'} onChange={set('min_gap_minutes')} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notifications_enabled"
                className="w-4 h-4 rounded accent-blue-600"
                checked={settings.notifications_enabled !== 'false'}
                onChange={(e) => setSettings((s) => ({ ...s, notifications_enabled: e.target.checked ? 'true' : 'false' }))}
              />
              <label htmlFor="notifications_enabled" className="text-sm text-slate-700">
                Enable automated email notifications
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
