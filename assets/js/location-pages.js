(function () {
  const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
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

  function normaliseFilter(value) {
    if (value === 'sen_specialist' || value === 'both') return value;
    return 'mainstream';
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
    if (Array.isArray(window.locationPageMapData)) {
      return window.locationPageMapData;
    }

    const dataScriptId = mapTarget && mapTarget.dataset ? mapTarget.dataset.mapDataId : '';
    if (dataScriptId) {
      return parseMapData(dataScriptId);
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
      lng: lng,
      provisionCategory: item.provisionCategory === 'sen_specialist' ? 'sen_specialist' : 'mainstream'
    };
  }

  function pointMatchesFilter(point, filterValue) {
    if (filterValue === 'both') return true;
    return point.provisionCategory === filterValue;
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

  function createBaseLayer() {
    if (window.L && typeof window.L.maplibreGL === 'function') {
      try {
        return window.L.maplibreGL({
          style: OPENFREEMAP_BRIGHT_STYLE
        });
      } catch (error) {
        console.warn('OpenFreeMap Bright layer failed, falling back to OpenStreetMap raster tiles.', error);
      }
    }

    return window.L.tileLayer(OSM_FALLBACK_URL, {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
      detectRetina: window.devicePixelRatio > 1
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

    requestAnimationFrame(function () {
      try {
        map.invalidateSize({ pan: false, animate: false });
      } catch (error) {}

      if (tileLayer && typeof tileLayer.redraw === 'function') {
        try {
          tileLayer.redraw();
        } catch (error) {}
      }
    });
  }

  function scheduleRefresh(map, tileLayer) {
    refreshMap(map, tileLayer);
    setTimeout(function () { refreshMap(map, tileLayer); }, 80);
    setTimeout(function () { refreshMap(map, tileLayer); }, 260);
    setTimeout(function () { refreshMap(map, tileLayer); }, 600);
  }

  function bindMapReflow(mapTarget, map, tileLayer) {
    if (!mapTarget || mapTarget.dataset.reflowBound === 'true') return;

    mapTarget.dataset.reflowBound = 'true';

    const reflow = function () {
      refreshMap(map, tileLayer);
    };

    window.addEventListener('resize', reflow, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(reflow, 120);
    }, { passive: true });
  }

  function initLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    const emptyState = document.getElementById('location-map-empty');

    if (!mapTarget || !window.L) return false;

    if (mapTarget.dataset.mapReady === 'true') {
      if (typeof mapTarget._applyProvisionFilter === 'function') {
        mapTarget._applyProvisionFilter(normaliseFilter(document.documentElement.dataset.provisionFilter));
      }
      if (mapTarget._leaflet_map_instance) {
        setTimeout(function () {
          try {
            mapTarget._leaflet_map_instance.invalidateSize({ pan: false, animate: false });
          } catch (error) {}
        }, 60);
      }
      return true;
    }

    const points = getRawMapData(mapTarget).map(normalisePoint).filter(Boolean);
    const fallbackView = getFallbackView(mapTarget);

    if (!points.length && !fallbackView) {
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'Map data is unavailable right now. Use the school list below.';
      }
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

    const tileLayer = createBaseLayer().addTo(map);

    mapTarget._leaflet_tile_layer = tileLayer;
    bindMapReflow(mapTarget, map, tileLayer);

    const markerLayer = window.L.layerGroup().addTo(map);

    function showEmptyState() {
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'No schools match the selected school type.';
      }
    }

    function renderPoints(filterValue) {
      markerLayer.clearLayers();
      const visiblePoints = points.filter(function (point) {
        return pointMatchesFilter(point, filterValue);
      });

      if (!visiblePoints.length) {
        if (fallbackView) map.setView(fallbackView.center, fallbackView.zoom);
        showEmptyState();
        scheduleRefresh(map, tileLayer);
        return;
      }

      if (emptyState) emptyState.hidden = true;

      const markers = visiblePoints.map(function (point) {
        const marker = window.L.marker([point.lat, point.lng], {
          icon: markerIcon(point.type)
        });

        marker.bindPopup(popupHtml(point));
        markerLayer.addLayer(marker);
        return marker;
      });

      if (markers.length === 1) {
        map.setView([visiblePoints[0].lat, visiblePoints[0].lng], 13);
      } else {
        const group = window.L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
      }

      scheduleRefresh(map, tileLayer);
    }

    mapTarget._applyProvisionFilter = renderPoints;

    if (mapTarget.dataset.provisionListenerBound !== 'true') {
      mapTarget.dataset.provisionListenerBound = 'true';
      window.addEventListener('psg:provision-filter-change', function (event) {
        const filterValue = normaliseFilter(event && event.detail ? event.detail.value : null);
        renderPoints(filterValue);
      });
    }

    renderPoints(normaliseFilter(document.documentElement.dataset.provisionFilter));
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
