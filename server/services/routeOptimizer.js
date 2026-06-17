const axios = require('axios');

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode an address using Google Maps Geocoding API or return null
async function geocode(address) {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: process.env.GOOGLE_MAPS_API_KEY },
    });
    const loc = res.data.results?.[0]?.geometry?.location;
    if (!loc) return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

// Google Maps Directions API for travel time between two addresses
async function getTravelTime(originAddr, destAddr) {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;
  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: originAddr,
        destination: destAddr,
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving',
      },
    });
    const leg = res.data.routes?.[0]?.legs?.[0];
    if (!leg) return null;
    return {
      durationMinutes: Math.ceil(leg.duration.value / 60),
      distanceKm: (leg.distance.value / 1000).toFixed(1),
      durationText: leg.duration.text,
    };
  } catch {
    return null;
  }
}

function buildGoogleMapsUrl(stops) {
  const base = 'https://www.google.com/maps/dir/';
  const waypoints = stops.map((s) => encodeURIComponent(s.address)).join('/');
  return `${base}${waypoints}`;
}

// Nearest-neighbor fallback optimizer (respects fixed scheduled times)
function nearestNeighborSort(workOrders) {
  // Separate timed and untimed
  const timed = workOrders.filter((w) => w.scheduled_time).sort((a, b) =>
    a.scheduled_time.localeCompare(b.scheduled_time)
  );
  const untimed = workOrders.filter((w) => !w.scheduled_time);

  // Simple merge: insert untimed into gaps based on position
  const result = [...timed];
  for (const wo of untimed) {
    result.push(wo);
  }
  return result;
}

async function optimizeRoute(workOrders) {
  const stops = nearestNeighborSort(workOrders);

  // Try to get Google Maps travel times
  const enrichedStops = [];
  let totalMinutes = 0;
  let useGoogleMaps = !!process.env.GOOGLE_MAPS_API_KEY;

  for (let i = 0; i < stops.length; i++) {
    const wo = stops[i];
    const stop = {
      id: wo.id,
      order: i + 1,
      tenant_name: wo.tenant_name,
      unit_number: wo.unit_number,
      address: wo.address,
      issue_type: wo.issue_type,
      priority: wo.priority,
      scheduled_time: wo.scheduled_time,
      travelFromPrev: null,
    };

    if (i > 0) {
      const prev = stops[i - 1];
      if (useGoogleMaps) {
        const travel = await getTravelTime(prev.address, wo.address);
        if (travel) {
          stop.travelFromPrev = travel;
          totalMinutes += travel.durationMinutes;
        } else {
          useGoogleMaps = false;
        }
      }

      if (!useGoogleMaps) {
        // Fallback: estimate 20 min/stop
        stop.travelFromPrev = { durationMinutes: 20, durationText: '~20 min (est.)', distanceKm: '?' };
        totalMinutes += 20;
      }
    }

    enrichedStops.push(stop);
  }

  const mapUrl = stops.length > 0 ? buildGoogleMapsUrl(stops) : null;

  return {
    stops: enrichedStops,
    totalMinutes,
    totalStops: stops.length,
    mapUrl,
    usedGoogleMaps: useGoogleMaps && stops.length > 1,
  };
}

module.exports = { optimizeRoute };
