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

  function parseScriptJson(scriptId) {
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
      const parsed = parseScriptJson(dataScriptId);
      if (parsed.length) return parsed;
    }

    return parseScriptJson('location-map-data');
  }

  function normalisePoint(item) {
    if (!item || typeof item !== 'object') return null;

    const lat = Number(item.lat ?? item.latitude);
    const lng = Number(item.lng ?? item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      name: item.name || 'School',
      href: item.href || item.slug || '',
      type: item.type || 'senior',
      note: item.note || item.addressLine1 || item.address_line1 || '',
      lat,
      lng
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

  function sharpenMap(map, mapTarget, tileLayer) {
    if (!map) return;

    const refresh = function () {
      try {
        map.invalidateSize({ pan: false, animate: false });
        if (tileLayer && typeof tileLayer.redraw === 'function') tileLayer.redraw();
      } catch (err) {}
    };

    requestAnimationFrame(function () {
      refresh();
      requestAnimationFrame(refresh);
    });

    [100, 250, 500, 900].forEach(function (delay) {
      setTimeout(refresh, delay);
    });

    if (tileLayer && !tileLayer._psgSharpnessBound) {
      tileLayer._psgSharpnessBound = true;
      tileLayer.on('load', refresh);
      tileLayer.on('tileload', refresh);
    }

    if (mapTarget && typeof ResizeObserver !== 'undefined' && !mapTarget._psgResizeObserver) {
      const observer = new ResizeObserver(function () {
        refresh();
      });
      observer.observe(mapTarget);
      mapTarget._psgResizeObserver = observer;
    }
  }

  function getFallbackView() {
    const slug = document.body && document.body.dataset ? document.body.dataset.locationSlug : '';

    if (slug === 'bath') return { center: [51.3813, -2.3590], zoom: 11 };
    if (slug === 'bristol') return { center: [51.4545, -2.5879], zoom: 11 };
    return { center: [51.45, -2.48], zoom: 9 };
  }

  function initLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    const emptyState = document.getElementById('location-map-empty');

    if (!mapTarget || !window.L) return false;

    if (mapTarget.dataset.mapReady === 'true') {
      if (mapTarget._leaflet_map_instance) {
        sharpenMap(mapTarget._leaflet_map_instance, mapTarget, mapTarget._psgTileLayer);
      }
      return true;
    }

    const points = getRawMapData(mapTarget).map(normalisePoint).filter(Boolean);

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

    mapTarget._psgTileLayer = tileLayer;

    if (!points.length) {
      const fallbackView = getFallbackView();
      map.setView(fallbackView.center, fallbackView.zoom);
      if (emptyState) emptyState.hidden = false;
      sharpenMap(map, mapTarget, tileLayer);
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

    sharpenMap(map, mapTarget, tileLayer);
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

  function initLocationPage() {
    bootLocationMap(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocationPage, { once: true });
  } else {
    initLocationPage();
  }

  window.addEventListener('load', function () {
    bootLocationMap(0);
  });

  window.addEventListener('pageshow', function () {
    bootLocationMap(0);
  });
})();
