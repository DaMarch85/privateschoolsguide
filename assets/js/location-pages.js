function parseMapData(scriptId) {
  const script = document.getElementById(scriptId);
  if (!script) return [];

  try {
    const parsed = JSON.parse(script.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to parse map data from #${scriptId}`, error);
    return [];
  }
}

function normalisePoint(item) {
  const lat = Number(item.latitude);
  const lng = Number(item.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    name: item.name || "School",
    slug: item.slug || "",
    locationSlug: item.locationSlug || "",
    href: item.href || "",
    addressLine1: item.addressLine1 || "",
    latitude: lat,
    longitude: lng,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPopupHtml(point) {
  const title = escapeHtml(point.name);
  const address = point.addressLine1 ? `<div>${escapeHtml(point.addressLine1)}</div>` : "";
  const link = point.href
    ? `<div style="margin-top:6px;"><a href="${escapeHtml(point.href)}">View school</a></div>`
    : "";

  return `<strong>${title}</strong>${address}${link}`;
}

function createMap(mapEl) {
  const dataScriptId = mapEl.dataset.mapDataId;
  if (!dataScriptId) {
    console.warn("Map container missing data-map-data-id:", mapEl);
    return;
  }

  const rawData = parseMapData(dataScriptId);
  const points = rawData.map(normalisePoint).filter(Boolean);

  if (!points.length) {
    mapEl.style.display = "none";
    const emptyStateId = mapEl.dataset.emptyStateId;
    if (emptyStateId) {
      const emptyStateEl = document.getElementById(emptyStateId);
      if (emptyStateEl) emptyStateEl.hidden = false;
    }
    return;
  }

  const map = L.map(mapEl, {
    scrollWheelZoom: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const markers = points.map((point) => {
    const marker = L.marker([point.latitude, point.longitude]).addTo(map);
    marker.bindPopup(buildPopupHtml(point));
    return marker;
  });

  const latLngs = markers.map((marker) => marker.getLatLng());
  const bounds = L.latLngBounds(latLngs);

  if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
  } else {
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function initDirectoryMaps() {
  if (typeof window === "undefined") return;
  if (typeof window.L === "undefined") {
    console.error("Leaflet is not available on this page.");
    return;
  }

  const mapEls = document.querySelectorAll("[data-directory-map]");
  mapEls.forEach(createMap);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDirectoryMaps);
} else {
  initDirectoryMaps();
}
