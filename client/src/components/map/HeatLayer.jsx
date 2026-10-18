import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// leaflet.heat is a classic plugin that extends a global `L`; expose Leaflet before loading it.
let pluginReady = null;
function loadHeatPlugin() {
  if (!pluginReady) {
    window.L = L;
    pluginReady = import('leaflet.heat');
  }
  return pluginReady;
}

/**
 * Campus heatmap (FR-56): one sequential ramp (light → dark navy/gold), weighted by severity.
 * `points` = [[lat, lng, weight 0..1], …].
 */
export function HeatLayer({ points, radius = 28 }) {
  const map = useMap();
  useEffect(() => {
    let layer = null;
    let cancelled = false;
    loadHeatPlugin().then(() => {
      if (cancelled || !L.heatLayer) return;
      layer = L.heatLayer(points, {
        radius,
        blur: 22,
        maxZoom: 18,
        minOpacity: 0.35,
        gradient: { 0.2: '#FBF0D8', 0.45: '#E4BC63', 0.7: '#C9962B', 1: '#7A4A0C' },
      }).addTo(map);
    });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points, radius]);
  return null;
}
