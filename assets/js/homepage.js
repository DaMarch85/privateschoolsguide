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

      locationItems.forEach(function (link) {
        const name = (link.dataset.name || '').toLowerCase();
        const match = !query || name.includes(query);

        if (link.parentElement) {
          link.parentElement.hidden = !match;
        }

        if (match && !firstVisibleHref) {
          firstVisibleHref = link.getAttribute('href') || '';
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
        const lat = Number(item && item.lat);
        const lng = Number(item && item.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          name: item.name || 'School',
          href: item.href || '',
          lat: lat,
          lng: lng,
          note: item.note || ''
        };
      })
      .filter(Boolean);
  }

  function popupHtml(point) {
    return '\n      <div class="map-popup">\n        <h3 class="map-popup-title">' + escapeHtml(point.name) + '</h3>\n        ' + (point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '') + '\n        ' + (point.href ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>' : '') + '\n      </div>\n    ';
  }

  function initHomepageMap() {
    const mapTarget = document.getElementById('homepage-map');
    const emptyState = document.getElementById('homepage-map-empty');

    if (!mapTarget || !window.L) return false;
    if (mapTarget.dataset.mapReady === 'true') {
      if (mapTarget._leaflet_map_instance) {
        setTimeout(function () {
          mapTarget._leaflet_map_instance.invalidateSize();
        }, 50);
      }
      return true;
    }

    const points = getMapPoints();
    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false
    });

    mapTarget.dataset.mapReady = 'true';
    mapTarget._leaflet_map_instance = map;

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (!points.length) {
      map.setView([51.39, -2.36], 8);
      if (emptyState) emptyState.hidden = false;
      setTimeout(function () {
        map.invalidateSize();
      }, 80);
      return true;
    }

    if (emptyState) emptyState.hidden = true;

    const markers = points.map(function (point) {
      const marker = window.L.marker([point.lat, point.lng]).addTo(map);
      marker.bindPopup(popupHtml(point));
      return marker;
    });

    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 10 });

    setTimeout(function () {
      map.invalidateSize();
    }, 80);

    setTimeout(function () {
      map.invalidateSize();
    }, 300);

    return true;
  }

  function bootHomepageMap(attempt) {
    if (initHomepageMap()) return;
    if (attempt >= 50) {
      const emptyState = document.getElementById('homepage-map-empty');
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = 'The map could not be loaded. Please refresh the page.';
      }
      return;
    }

    setTimeout(function () {
      bootHomepageMap(attempt + 1);
    }, 100);
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

  window.addEventListener('load', function () {
    bootHomepageMap(0);
  });

  window.addEventListener('pageshow', function () {
    bootHomepageMap(0);
  });
})();
