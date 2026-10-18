import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router';
import { CAMPUS_CENTER } from '../../config.js';
import { STATUS } from '../../theme/meta.js';
import { useTheme } from '../../theme/themeContext.js';
import { cn } from '../ui/cn.js';
import { statusIcon } from './icons.js';

const OSM = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** Fit the map to its points once they are known. */
function FitBounds({ points, maxZoom = 18 }) {
  const map = useMap();
  const key = points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], Math.min(maxZoom, 18));
    else map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom });
    // key captures the points
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, maxZoom]);
  return null;
}

/** Leaflet must recompute its size when its container changes (sidebar collapse, tabs). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * OpenStreetMap tiles (no API key). Dark mode inverts the tiles with a CSS filter so the map
 * matches the theme without a second tile provider.
 */
export function BaseMap({
  center = CAMPUS_CENTER,
  zoom = 17,
  className,
  children,
  scrollWheelZoom = false,
  dark: forceDark,
  label = 'Campus map',
}) {
  const { theme } = useTheme();
  const dark = forceDark ?? theme === 'dark';
  return (
    <div
      className={cn('relative isolate overflow-hidden', dark && 'map-dark', className)}
      role="region"
      aria-label={label}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className="size-full"
        attributionControl
      >
        <TileLayer url={OSM.url} attribution={OSM.attribution} maxZoom={19} />
        <InvalidateOnResize />
        {children}
      </MapContainer>
    </div>
  );
}

/** Issues as status-coloured pins with a popup linking to the detail page. */
export function IssueMap({ issues, className, linkPrefix = '/issues', fit = true, highlightId }) {
  const located = useMemo(() => issues.filter((i) => i.location), [issues]);
  const points = useMemo(() => located.map((i) => [i.location.lat, i.location.lng]), [located]);
  return (
    <BaseMap className={className}>
      {fit ? <FitBounds points={points} /> : null}
      {located.map((i) => (
        <Marker
          key={i.id}
          position={[i.location.lat, i.location.lng]}
          icon={statusIcon(i.status, { pulse: i.id === highlightId })}
        >
          <Popup>
            <div className="min-w-44 font-sans">
              <p className="text-sm font-bold">{i.title}</p>
              <p className="mt-0.5 text-xs text-[#5B667C]">
                {STATUS[i.status]?.label} · {i.locationRef?.code ?? i.landmark ?? 'GPS'}
              </p>
              {linkPrefix ? (
                <Link
                  to={`${linkPrefix}/${i.id}`}
                  className="mt-1 inline-block text-xs font-bold text-[#1B3260] underline"
                >
                  Open issue
                </Link>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </BaseMap>
  );
}

/** A single location (issue detail). */
export function PointMap({ lat, lng, status = 'open', className, label }) {
  return (
    <BaseMap center={[lat, lng]} zoom={18} className={className} label={label}>
      <Marker position={[lat, lng]} icon={statusIcon(status, { size: 22 })} />
    </BaseMap>
  );
}
