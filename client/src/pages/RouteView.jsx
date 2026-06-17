import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Navigation, ExternalLink, Printer, AlertCircle, RefreshCw } from 'lucide-react';
import { routesApi } from '../lib/api';
import { ISSUE_TYPE_LABELS, ISSUE_TYPE_ICONS } from '../lib/constants';
import { toast } from 'sonner';

export default function RouteView() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadRoute() {
    setLoading(true);
    try {
      const res = await routesApi.getForDate(date);
      setRoute(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load route');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoute(); }, [date]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Route Planning</h1>
          <p className="text-sm text-slate-500">Optimized route for scheduled jobs</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print Route
          </button>
          {route?.mapUrl && (
            <a
              href={route.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <Navigation className="w-4 h-4" /> Open in Maps
            </a>
          )}
        </div>
      </div>

      {/* Date picker */}
      <div className="card py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Route Date:</label>
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn-secondary" onClick={loadRoute} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Calculate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Calculating optimal route...
        </div>
      ) : !route ? null : route.stops?.length === 0 ? (
        <div className="card text-center py-12">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No scheduled jobs for {date}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-slate-900">{route.totalStops}</div>
              <div className="text-xs text-slate-500 mt-1">Total Stops</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-slate-900">
                {route.totalMinutes >= 60
                  ? `${Math.floor(route.totalMinutes / 60)}h ${route.totalMinutes % 60}m`
                  : `${route.totalMinutes}m`}
              </div>
              <div className="text-xs text-slate-500 mt-1">Est. Travel Time</div>
            </div>
            <div className="card text-center">
              <div className={`text-2xl font-bold ${route.usedGoogleMaps ? 'text-green-600' : 'text-yellow-600'}`}>
                {route.usedGoogleMaps ? 'Maps' : 'Est.'}
              </div>
              <div className="text-xs text-slate-500 mt-1">Route Source</div>
            </div>
          </div>

          {!route.usedGoogleMaps && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Travel times are estimated (20 min/stop). Add a Google Maps API key in Settings for real directions.
            </div>
          )}

          {/* Stops */}
          <div className="space-y-3">
            {route.stops.map((stop, i) => (
              <React.Fragment key={stop.id}>
                {i > 0 && stop.travelFromPrev && (
                  <div className="flex items-center gap-3 text-xs text-slate-400 pl-4">
                    <div className="w-0.5 h-4 bg-slate-200 ml-2.5" />
                    <Clock className="w-3 h-3" />
                    <span>{stop.travelFromPrev.durationText}</span>
                    {stop.travelFromPrev.distanceKm !== '?' && (
                      <span>· {stop.travelFromPrev.distanceKm} km</span>
                    )}
                  </div>
                )}
                <div className="card flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {stop.order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{stop.tenant_name}</span>
                      <span className="text-xs text-slate-500">Unit {stop.unit_number}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{stop.address}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-slate-600">
                        {ISSUE_TYPE_ICONS[stop.issue_type]} {ISSUE_TYPE_LABELS[stop.issue_type]}
                      </span>
                      {stop.scheduled_time && (
                        <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {stop.scheduled_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                    title="Open in Google Maps"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
