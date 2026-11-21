import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  ExternalLink,
  Globe,
  Layers,
  MapPin,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "../api";
import { EmptyState, ErrorBanner, LoadingState } from "../components/PageState";
import type { Hackathon } from "../types";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ATTRIBUTION_TEXT = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap";
const GEOJSON_SOURCE_ID = "uploaded-project-area";

type GeoJsonObject = {
  type: string;
  features?: Array<{ geometry?: { coordinates?: unknown } }>;
  geometry?: { coordinates?: unknown };
  coordinates?: unknown;
};

function collectCoords(node: unknown, out: [number, number][]): void {
  if (!Array.isArray(node)) return;
  if (
    node.length >= 2 &&
    typeof node[0] === "number" &&
    typeof node[1] === "number"
  ) {
    out.push([node[0], node[1]]);
    return;
  }
  for (const child of node) {
    collectCoords(child, out);
  }
}

function normalizeGeoJson(raw: GeoJsonObject): GeoJsonObject {
  if (raw.type === "FeatureCollection") return raw;
  if (raw.type === "Feature") {
    return { type: "FeatureCollection", features: [raw] };
  }
  if (
    [
      "Point",
      "MultiPoint",
      "LineString",
      "MultiLineString",
      "Polygon",
      "MultiPolygon",
    ].includes(raw.type)
  ) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: raw } as never],
    };
  }
  throw new Error("File must be a valid GeoJSON FeatureCollection, Feature, or Geometry.");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function MapPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");

  const [geojsonName, setGeojsonName] = useState<string | null>(null);
  const [geojsonData, setGeojsonData] = useState<GeoJsonObject | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadHackathons = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listHackathons();
      setHackathons(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hackathons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHackathons();
  }, [loadHackathons]);

  const applyGeoJsonToMap = useCallback((map: maplibregl.Map, data: GeoJsonObject | null) => {
    const layerIds = [
      `${GEOJSON_SOURCE_ID}-fill`,
      `${GEOJSON_SOURCE_ID}-line`,
      `${GEOJSON_SOURCE_ID}-point`,
    ];
    for (const id of layerIds) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(GEOJSON_SOURCE_ID)) {
      map.removeSource(GEOJSON_SOURCE_ID);
    }
    if (!data) return;

    map.addSource(GEOJSON_SOURCE_ID, {
      type: "geojson",
      data: data as never,
    });

    map.addLayer({
      id: `${GEOJSON_SOURCE_ID}-fill`,
      type: "fill",
      source: GEOJSON_SOURCE_ID,
      filter: ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]],
      paint: {
        "fill-color": "#22D3EE",
        "fill-opacity": 0.25,
      },
    });

    map.addLayer({
      id: `${GEOJSON_SOURCE_ID}-line`,
      type: "line",
      source: GEOJSON_SOURCE_ID,
      paint: {
        "line-color": "#22D3EE",
        "line-width": 2.5,
      },
    });

    map.addLayer({
      id: `${GEOJSON_SOURCE_ID}-point`,
      type: "circle",
      source: GEOJSON_SOURCE_ID,
      filter: ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]],
      paint: {
        "circle-radius": 6,
        "circle-color": "#22D3EE",
        "circle-stroke-color": "#04131C",
        "circle-stroke-width": 2,
      },
    });

    const coords: [number, number][] = [];
    if (data.features) {
      for (const f of data.features) {
        collectCoords(f.geometry?.coordinates, coords);
      }
    }
    if (coords.length > 0) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 700 });
    }
  }, []);

  // Initialize MapLibre instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [20, 20],
      zoom: 1.5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution: ATTRIBUTION_TEXT,
      }),
      "bottom-right"
    );

    map.on("load", () => {
      mapLoadedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, []);

  // Sync in-person markers whenever hackathons change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const inPerson = hackathons.filter(
      (h) => !h.is_online && h.lat !== null && h.lon !== null
    );

    inPerson.forEach((h) => {
      const safeName = escapeHtml(h.name);
      const safeLoc = escapeHtml(h.display_name || h.location);
      const safeDate = h.date ? `<div style="font-size:12px;color:#9EB0CC;margin-top:4px;">Date: ${escapeHtml(h.date)}</div>` : "";
      const safeLink =
        h.link && /^https?:\/\//i.test(h.link)
          ? `<div style="margin-top:6px;"><a href="${escapeHtml(h.link)}" target="_blank" rel="noopener noreferrer" style="color:#22D3EE;font-size:12px;text-decoration:underline;">Open event link</a></div>`
          : "";

      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(
        `<div style="max-width:240px;">
          <strong style="font-size:14px;color:#EEF4FC;">${safeName}</strong>
          <div style="font-size:12px;color:#CBD7EA;margin-top:2px;">${safeLoc}</div>
          ${safeDate}
          ${safeLink}
        </div>`
      );

      const marker = new maplibregl.Marker({ color: "#22D3EE" })
        .setLngLat([h.lon!, h.lat!])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.set(h.id, marker);
    });

    if (inPerson.length === 1) {
      map.flyTo({ center: [inPerson[0].lon!, inPerson[0].lat!], zoom: 8, duration: 700 });
    } else if (inPerson.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      inPerson.forEach((h) => bounds.extend([h.lon!, h.lat!]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 700 });
    }
  }, [hackathons]);

  // Apply GeoJSON whenever uploaded/cleared
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mapLoadedRef.current || map.isStyleLoaded()) {
      applyGeoJsonToMap(map, geojsonData);
    } else {
      map.once("load", () => applyGeoJsonToMap(map, geojsonData));
    }
  }, [geojsonData, applyGeoJsonToMap]);

  const handleAddHackathon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setError("Enter both a hackathon name and a location (city or 'online').");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.addHackathon({
        name: name.trim(),
        link: link.trim(),
        date: date.trim(),
        location: location.trim(),
      });
      setHackathons((prev) => [created, ...prev]);
      setName("");
      setLink("");
      setDate("");
      setLocation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add hackathon.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteHackathon(id);
      setHackathons((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete hackathon.");
    }
  };

  const handleFocusMarker = (h: Hackathon) => {
    const map = mapRef.current;
    const marker = markersRef.current.get(h.id);
    if (!map || h.lat === null || h.lon === null) return;
    map.flyTo({ center: [h.lon, h.lat], zoom: 10, duration: 700 });
    if (marker && !marker.getPopup()?.isOpen()) {
      marker.togglePopup();
    }
  };

  const handleGeoJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as GeoJsonObject;
      const normalized = normalizeGeoJson(parsed);
      setGeojsonData(normalized);
      setGeojsonName(file.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? `GeoJSON error: ${err.message}`
          : "Could not parse the uploaded GeoJSON file."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const inPersonList = hackathons.filter((h) => !h.is_online);
  const onlineList = hackathons.filter((h) => h.is_online);

  return (
    <section aria-labelledby="map-heading" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="map-heading" className="text-2xl sm:text-3xl font-bold text-[#EEF4FC]">
            Hackathon Map
          </h1>
          <p className="text-base text-[#A8B9D4] mt-1">
            Pin in-person hackathons on the map, track online events, and draw GeoJSON project areas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            id="geojson-upload"
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            onChange={handleGeoJsonUpload}
            className="sr-only"
          />
          <label
            htmlFor="geojson-upload"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A253D] hover:bg-[#223150] border border-[#2F4165] text-sm font-medium text-[#EEF4FC] cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
            Upload GeoJSON
          </label>
          {geojsonName ? (
            <button
              type="button"
              onClick={() => {
                setGeojsonData(null);
                setGeojsonName(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#121A2B] border border-[#22D3EE]/60 text-xs font-mono text-[#22D3EE] hover:bg-[#1A253D] cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              {geojsonName}
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {/* Add Hackathon Form */}
      <form
        onSubmit={handleAddHackathon}
        className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
      >
        <div>
          <label htmlFor="hack-name" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
            Hackathon name *
          </label>
          <input
            id="hack-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pune AI Hack"
            className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
          />
        </div>

        <div>
          <label htmlFor="hack-location" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
            City or &quot;online&quot; *
          </label>
          <input
            id="hack-location"
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Pune, India or online"
            className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
          />
        </div>

        <div>
          <label htmlFor="hack-date" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
            Event date
          </label>
          <input
            id="hack-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC]"
          />
        </div>

        <div>
          <label htmlFor="hack-link" className="block text-sm font-medium text-[#CBD7EA] mb-1.5">
            Website link
          </label>
          <input
            id="hack-link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg bg-[#0B101B] border border-[#2D3E5E] px-3.5 py-2.5 text-base text-[#EEF4FC] placeholder-[#6E82A3]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22D3EE] hover:bg-[#38DFEE] disabled:opacity-60 text-[#04131C] font-semibold px-4 py-2.5 text-base transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {submitting ? "Adding..." : "Add Event"}
        </button>
      </form>

      {/* Interactive Map */}
      <div className="rounded-xl border border-[#263452] bg-[#121A2B] overflow-hidden">
        <div
          ref={mapContainerRef}
          aria-label="Interactive hackathon map"
          className="w-full h-[420px] sm:h-[460px]"
        />
        <div className="px-4 py-2.5 bg-[#0E1525] border-t border-[#24324E] flex flex-wrap items-center justify-between gap-2 text-xs text-[#A8B9D4]">
          <span>
            {inPersonList.length} in-person {inPersonList.length === 1 ? "marker" : "markers"} on map
            {geojsonName ? ` • GeoJSON overlay active (${geojsonName})` : ""}
          </span>
          <span data-testid="map-attribution" className="font-mono text-[#CBD7EA]">
            {ATTRIBUTION_TEXT}
          </span>
        </div>
      </div>

      {/* Lists */}
      {loading ? (
        <LoadingState label="Loading saved hackathons..." />
      ) : hackathons.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-6 h-6" />}
          title="No hackathons tracked yet"
          description="Add a city like 'Pune, India' to pin an in-person event on the map, or enter 'online' to track virtual hackathons."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* In-person */}
          <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#EEF4FC] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#22D3EE]" aria-hidden="true" />
                In-Person Hackathons ({inPersonList.length})
              </h2>
            </div>
            {inPersonList.length === 0 ? (
              <p className="text-sm text-[#9EB0CC]">
                No in-person hackathons added yet. Enter a city above to place a marker.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {inPersonList.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg bg-[#0B101B] border border-[#24324E] p-3.5 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleFocusMarker(h)}
                      className="text-left flex-1 min-w-0 cursor-pointer group"
                    >
                      <p className="font-semibold text-[#EEF4FC] group-hover:text-[#22D3EE] transition-colors">
                        {h.name}
                      </p>
                      <p className="text-sm text-[#A8B9D4] truncate">
                        {h.display_name || h.location}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#9EB0CC]">
                        {h.date ? <span>Date: {h.date}</span> : null}
                        {h.lat !== null && h.lon !== null ? (
                          <span className="font-mono">
                            {h.lat.toFixed(3)}, {h.lon.toFixed(3)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {h.link ? (
                        <a
                          href={h.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open website for ${h.name}`}
                          className="p-2 rounded-lg bg-[#1A253D] text-[#22D3EE] hover:bg-[#233252]"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        aria-label={`Delete ${h.name}`}
                        className="p-2 rounded-lg bg-[#1A253D] text-[#CBD7EA] hover:text-red-300 hover:bg-red-950/50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Online */}
          <div className="rounded-xl border border-[#263452] bg-[#121A2B] p-5 space-y-3">
            <h2 className="text-lg font-semibold text-[#EEF4FC] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#22D3EE]" aria-hidden="true" />
              Online Hackathons ({onlineList.length})
            </h2>
            {onlineList.length === 0 ? (
              <p className="text-sm text-[#9EB0CC]">
                No online hackathons added yet. Enter &quot;online&quot; as the location to list one here.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {onlineList.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-lg bg-[#0B101B] border border-[#24324E] p-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#EEF4FC]">{h.name}</p>
                      <p className="text-sm text-[#A8B9D4]">Online / Remote</p>
                      {h.date ? <p className="text-xs text-[#9EB0CC] mt-1">Date: {h.date}</p> : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {h.link ? (
                        <a
                          href={h.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open website for ${h.name}`}
                          className="p-2 rounded-lg bg-[#1A253D] text-[#22D3EE] hover:bg-[#233252]"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id)}
                        aria-label={`Delete ${h.name}`}
                        className="p-2 rounded-lg bg-[#1A253D] text-[#CBD7EA] hover:text-red-300 hover:bg-red-950/50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
