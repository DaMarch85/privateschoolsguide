(function () {
  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

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
      console.error('Failed to parse map data from #' + scriptId, error);
      return [];
    }
  }

  function normalisePoint(item) {
    if (!item || typeof item !== 'object') return null;

    const lat = toNumber(item.lat ?? item.latitude);
    const lng = toNumber(item.lng ?? item.longitude);

    if (lat === null || lng === null) return null;

    return {
      name: item.name || 'School',
      href: item.slug || item.href || '',
      note: item.note || item.addressLine1 || item.address_line1 || '',
      type: item.type || '',
      lat: lat,
      lng: lng
    };
  }

  function buildPopupHtml(point) {
    const title = '<h3 class="map-popup-title">' + escapeHtml(point.name) + '</h3>';
    const note = point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '';
    const link = point.href
      ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>'
      : '';

    return '<div class="map-popup">' + title + note + link + '</div>';
  }

  function buildIcon(type) {
    if (!window.L) return null;

    const typeClass = String(type || '').trim();
    return window.L.divIcon({
      className: 'school-map-icon',
      html: '<span class="school-map-marker ' + escapeHtml(typeClass) + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
  }

  function createMap(mapEl) {
    if (!mapEl || mapEl.dataset.initialized === 'true') return true;

    const dataScriptId = mapEl.dataset.mapDataId;
    if (!dataScriptId) return false;

    const points = parseMapData(dataScriptId).map(normalisePoint).filter(Boolean);
    if (!points.length) {
      mapEl.hidden = true;
      const emptyStateId = mapEl.dataset.emptyStateId;
      if (emptyStateId) {
        const emptyState = document.getElementById(emptyStateId);
        if (emptyState) emptyState.hidden = false;
      }
      return false;
    }

    const map = window.L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    });

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markers = points.map(function (point) {
      const marker = window.L.marker([point.lat, point.lng], {
        icon: buildIcon(point.type)
      });
      marker.bindPopup(buildPopupHtml(point));
      marker.addTo(map);
      return marker;
    });

    const group = window.L.featureGroup(markers);
    const bounds = group.getBounds();

    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 13);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    }

    mapEl.dataset.initialized = 'true';
    setTimeout(function () {
      map.invalidateSize();
    }, 80);

    return true;
  }

  function initAllMaps() {
    if (!window.L) return false;

    const maps = Array.from(document.querySelectorAll('[data-directory-map]'));
    maps.forEach(createMap);
    return true;
  }

  function boot(attempt) {
    if (initAllMaps()) return;
    if (attempt >= 40) return;
    setTimeout(function () {
      boot(attempt + 1);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      boot(0);
    }, { once: true });
  } else {
    boot(0);
  }

  window.addEventListener('pageshow', function () {
    boot(0);
  });
})();
