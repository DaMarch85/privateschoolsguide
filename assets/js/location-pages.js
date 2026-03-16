(function () {
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[match];
    });
  }

  function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function parseMapData(scriptId) {
    const script = document.getElementById(scriptId);
    if (!script) return [];

    try {
      const parsed = JSON.parse(script.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse location map data from #' + scriptId, error);
      return [];
    }
  }

  function getRawMapData(mapTarget) {
    if (Array.isArray(window.locationPageMapData) && window.locationPageMapData.length) {
      return window.locationPageMapData;
    }

    const dataScriptId = mapTarget && mapTarget.dataset ? mapTarget.dataset.mapDataId : '';
    if (dataScriptId) {
      const parsed = parseMapData(dataScriptId);
      if (parsed.length) return parsed;
    }

    return parseMapData('location-map-data');
  }

  function normalisePoint(item) {
    if (!item || typeof item !== 'object') return null;

    const lat = toFiniteNumber(item.lat ?? item.latitude);
    const lng = toFiniteNumber(item.lng ?? item.longitude);
    if (lat === null || lng === null) return null;

    return {
      name: item.name || 'School',
      href: item.href || item.slug || '',
      type: item.type || 'senior',
      note: item.note || item.addressLine1 || item.address_line1 || '',
      lat: lat,
      lng: lng
    };
  }

  function popupHtml(point) {
    return (
      '<div class="map-popup">' +
        '<h3 class="map-popup-title">' + escapeHtml(point.name) + '</h3>' +
        (point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '') +
        (point.href ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>' : '') +
      '</div>'
    );
  }

  function markerIcon(type) {
    return window.L.divIcon({
      className: 'school-map-icon',
      html: '<span class="school-map-marker ' + escapeHtml(type) + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
  }

  function getFallbackView(mapTarget) {
    if (!mapTarget || !mapTarget.dataset) return null;

    const lat = toFiniteNumber(mapTarget.dataset.fallbackLat);
    const lng = toFiniteNumber(mapTarget.dataset.fallbackLng);
    const zoom = toFiniteNumber(mapTarget.dataset.fallbackZoom) || 11;

    if (lat === null || lng === null) return null;

    return {
      center: [lat, lng],
      zoom: zoom
    };
  }

  function refreshMap(map, tileLayer) {
    if (!map) return;

    try {
      map.invalidateSize({ pan: false, animate: false });
    } catch (error) {}

    if (tileLayer && typeof tileLayer.redraw === 'function') {
      try {
        tileLayer.redraw();
      } catch (error) {}
    }
  }

  function scheduleRefresh(map, tileLayer) {
    requestAnimationFrame(function () {
      refreshMap(map, tileLayer);
      requestAnimationFrame(function () {
        refreshMap(map, tileLayer);
      });
    });

    setTimeout(function () { refreshMap(map, tileLayer); }, 90);
    setTimeout(function () { refreshMap(map, tileLayer); }, 260);
    setTimeout(function () { refreshMap(map, tileLayer); }, 600);
  }

  function initLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    const emptyState = document.getElementById('location-map-empty');

    if (!mapTarget || !window.L) return false;

    if (mapTarget.dataset.mapReady === 'true') {
      refreshMap(mapTarget._leaflet_map_instance, mapTarget._leaflet_tile_layer);
      return true;
    }

    const points = getRawMapData(mapTarget).map(normalisePoint).filter(Boolean);
    const fallbackView = getFallbackView(mapTarget);

    if (!points.length && !fallbackView) {
      if (emptyState) emptyState.hidden = false;
      mapTarget.style.display = 'none';
      return true;
    }

    mapTarget.style.display = '';

    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    });

    mapTarget.dataset.mapReady = 'true';
    mapTarget._leaflet_map_instance = map;

    const tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
      detectRetina: window.devicePixelRatio > 1
    }).addTo(map);

    mapTarget._leaflet_tile_layer = tileLayer;

    tileLayer.on('load', function () {
      refreshMap(map, tileLayer);
    });

    if (!points.length && fallbackView) {
      map.setView(fallbackView.center, fallbackView.zoom);
      if (emptyState) emptyState.hidden = false;
      scheduleRefresh(map, tileLayer);
      return true;
    }

    if (emptyState) emptyState.hidden = true;

    const markers = points.map(function (point) {
      const marker = window.L.marker([point.lat, point.lng], {
        icon: markerIcon(point.type)
      });

      marker.bindPopup(popupHtml(point));
      marker.addTo(map);
      return marker;
    });

    if (markers.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
    } else {
      const group = window.L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
    }

    scheduleRefresh(map, tileLayer);
    return true;
  }

  function bootLocationMap(attempt) {
    if (initLocationMap()) return;

    if (attempt >= 50) {
      const emptyState = document.getElementById('location-map-empty');
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'The map could not be loaded. Please refresh the page.';
      }
      return;
    }

    setTimeout(function () {
      bootLocationMap(attempt + 1);
    }, 100);
  }

  function reflowLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    if (!mapTarget || mapTarget.dataset.mapReady !== 'true') return;
    refreshMap(mapTarget._leaflet_map_instance, mapTarget._leaflet_tile_layer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootLocationMap(0); }, { once: true });
  } else {
    bootLocationMap(0);
  }

  window.addEventListener('load', function () { bootLocationMap(0); });
  window.addEventListener('pageshow', function () { bootLocationMap(0); });
  window.addEventListener('resize', reflowLocationMap);
})();
