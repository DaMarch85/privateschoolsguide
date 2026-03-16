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
    const dataScriptId = mapTarget && mapTarget.dataset ? mapTarget.dataset.mapDataId : '';
    if (dataScriptId) {
      const parsed = parseMapData(dataScriptId);
      if (parsed.length) return parsed;
    }

    if (Array.isArray(window.locationPageMapData) && window.locationPageMapData.length) {
      return window.locationPageMapData;
    }

    return parseMapData('location-map-data');
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

  function refreshMap(map) {
    if (!map) return;
    try {
      map.invalidateSize({ pan: false, animate: false });
    } catch (err) {}
  }

  function initLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    const emptyState = document.getElementById('location-map-empty');

    if (!mapTarget || !window.L) return false;

    if (mapTarget.dataset.mapReady === 'true') {
      if (mapTarget._leaflet_map_instance) {
        refreshMap(mapTarget._leaflet_map_instance);
      }
      return true;
    }

    const points = getRawMapData(mapTarget).map(normalisePoint).filter(Boolean);
    if (!points.length) {
      if (emptyState) emptyState.hidden = false;
      mapTarget.style.display = 'none';
      return true;
    }

    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false
    });

    mapTarget.dataset.mapReady = 'true';
    mapTarget._leaflet_map_instance = map;

    const tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

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
      map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11 });
    }

    tileLayer.on('load', function () {
      refreshMap(map);
    });

    requestAnimationFrame(function () {
      refreshMap(map);
      requestAnimationFrame(function () { refreshMap(map); });
    });
    setTimeout(function () { refreshMap(map); }, 100);
    setTimeout(function () { refreshMap(map); }, 300);

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bootLocationMap(0); }, { once: true });
  } else {
    bootLocationMap(0);
  }

  window.addEventListener('load', function () { bootLocationMap(0); });
  window.addEventListener('pageshow', function () { bootLocationMap(0); });
})();
