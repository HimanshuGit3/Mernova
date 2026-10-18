import { Marker, useMapEvents } from 'react-leaflet';
import { BaseMap } from './IssueMap.jsx';
import { statusIcon } from './icons.js';
import { CAMPUS_CENTER } from '../../config.js';

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Click on the map to place a room; the pin shows the current coordinates. */
export function LocationPicker({ lat, lng, onPick, className }) {
  const has = Number.isFinite(lat) && Number.isFinite(lng);
  return (
    <BaseMap
      center={has ? [lat, lng] : CAMPUS_CENTER}
      zoom={18}
      className={className}
      label="Click the map to place the room"
    >
      <ClickToPlace onPick={onPick} />
      {has ? <Marker position={[lat, lng]} icon={statusIcon('assigned', { size: 22 })} /> : null}
    </BaseMap>
  );
}
