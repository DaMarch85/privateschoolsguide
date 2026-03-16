(function () {
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[m];
    });
  }

  function bindLocationSearch() {
    const searchInput = document.getElementById('location-search');
    const locationItems = Array.from(document.querySelectorAll('[data-location-item]'));

    if (!searchInput || !locationItems.length) return;

    function filterLocations() {
      const query = searchInput.value.trim().toLowerCase();
      let firstVisibleHref = '';

      locationItems.forEach(function (item) {
        const searchText = (item.dataset.search || item.dataset.name || '').toLowerCase();
        const match = !query || searchText.includes(query);
        const href = item.getAttribute('href') || '';

        if (item.parentElement) {
          item.parentElement.hidden = !match;
        }

        if (match && href && !firstVisibleHref) {
          firstVisibleHref = href;
        }
      });

      searchInput.dataset.firstVisibleHref = firstVisibleHref;
    }

    searchInput.addEventListener('input', filterLocations);
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        const href = searchInput.dataset.firstVisibleHref;
        if (href) {
          event.preventDefault();
          window.location.href = href;
        }
      }
    });

    filterLocations();
  }

  function getMapPoints() {
    if (!Array.isArray(window.homepageMapData)) return [];

    return window.homepageMapData
      .map(function (item) {
        const lat = Number(item && (item.lat ?? item.latitude));
        const lng = Number(item && (item.lng ?? item.longitude));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          name: item.name || 'School',
          href: item.href || item.slug || '',
          lat,
          lng,
          type: item.type || 'senior',
          note: item.note || ''
        };
      })
      .filter(Boolean);
  }

  function buildIcon(type) {
    return window.L.divIcon({
      className: 'school-map-icon',
      html: '<span class="school-map-marker ' + escapeHtml(type) + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
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

  function initHomepageMap() {
    const mapTarget = document.getElementById('homepage-map');
    const emptyState = document.getElementById('homepage-map-empty');

    if (!mapTarget || !window.L) return false;
    if (mapTarget.dataset.mapReady === 'true') return true;

    const points = getMapPoints();
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

    function sharpenMap() {
      requestAnimationFrame(function () {
        map.invalidateSize({ pan: false, animate: false });
        if (typeof tileLayer.redraw === 'function') tileLayer.redraw();
      });
    }

    if (!points.length) {
      map.setView([51.41, -2.47], 8);
      if (emptyState) emptyState.hidden = false;
      sharpenMap();
      setTimeout(sharpenMap, 80);
      setTimeout(sharpenMap, 260);
      return true;
    }

    if (emptyState) emptyState.hidden = true;

    const markers = points.map(function (point) {
      const marker = window.L.marker([point.lat, point.lng], { icon: buildIcon(point.type) }).addTo(map);
      marker.bindPopup(popupHtml(point));
      return marker;
    });

    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });

    sharpenMap();
    setTimeout(sharpenMap, 80);
    setTimeout(sharpenMap, 260);
    setTimeout(sharpenMap, 600);

    return true;
  }

  function bootHomepageMap(attempt) {
    if (initHomepageMap()) return;
    if (attempt >= 50) return;
    setTimeout(function () { bootHomepageMap(attempt + 1); }, 100);
  }

  function initHomepage() {
    bindLocationSearch();
    bootHomepageMap(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepage, { once: true });
  } else {
    initHomepage();
  }

  window.addEventListener('load', function () { bootHomepageMap(0); });
})();
