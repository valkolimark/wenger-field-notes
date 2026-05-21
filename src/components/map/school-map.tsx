"use client";

// Cycle 3 original / Cycle 14 removed / Cycle 15 restored. Leaflet
// pin map for the 39 schools whose lat/lng now ship in src/lib/schools.ts
// (hand-derived; a handful carry `// TODO: verify coords`).

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { School } from "@/lib/schools";

// Simple brand-navy pin (a custom divIcon avoids Leaflet's default blue
// marker, which clashes with the brand, and its broken-image asset path).
const navyPin = L.divIcon({
  className: "",
  html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0A3758;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Leaflet can mis-measure a container that mounts at 0px (fixed/flex layout);
// force a resize once it's ready so tiles paint correctly.
function InvalidateOnReady() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function SchoolMap({
  schools,
  onSelect,
}: {
  schools: School[];
  onSelect: (school: School) => void;
}) {
  return (
    <MapContainer
      center={[34.05, -118.35]}
      zoom={9}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <InvalidateOnReady />
      {schools.map((school) => (
        <Marker
          key={school.id}
          position={[school.lat, school.lng]}
          icon={navyPin}
          eventHandlers={{ click: () => onSelect(school) }}
          alt={school.name}
        />
      ))}
    </MapContainer>
  );
}
