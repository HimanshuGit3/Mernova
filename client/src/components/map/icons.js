import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { STATUS } from '../../theme/meta.js';

// Leaflet looks for its default marker images relative to its CSS, which breaks under Vite's
// asset hashing. Point it at the imported (hashed) files instead.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const iconCache = new Map();

/** A round pin coloured by status; `pulse` adds the expanding ring used for brand-new reports. */
export function statusIcon(status, { pulse = false, size = 18 } = {}) {
  const key = `${status}-${pulse}-${size}`;
  if (!iconCache.has(key)) {
    const color = STATUS[status]?.color ?? '#3B7BD0';
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
        html: `<span class="${pulse ? 'pulse-pin' : ''}" style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
      }),
    );
  }
  return iconCache.get(key);
}
