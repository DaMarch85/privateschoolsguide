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

  function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
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

  function parseHomepageMapData() {
    const script = document.getElementById('homepage-map-data');
    if (!script) return [];

    try {
      const parsed = JSON.parse(script.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to parse homepage map data.', error);
      return [];
    }
  }

  function normaliseMapPoints(points) {
    return points
      .map(function (item) {
        if (!item || typeof item !== 'object') return null;

        const lat = toNumber(item.lat ?? item.latitude);
        const lng = toNumber(item.lng ?? item.longitude);

        if (lat === null || lng === null) return null;

        return {
          name: item.name || 'School',
          href: item.href || item.slug || '',
          lat: lat,
          lng: lng,
          type: item.type || '',
          note: item.note || item.addressLine1 || item.address_line1 || ''
        };
      })
      .filter(Boolean);
  }

  function getMarkerStyle(type) {
    const value = String(type || '').toLowerCase();

    if (value.includes('boarding')) {
      return {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#b35b2e',
        fillOpacity: 1
      };
    }

    return {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2a2520',
      fillOpacity: 1
    };
  }

  function buildPopupHtml(point) {
    const title = '<h3 class="map-popup-title">' + escapeHtml(point.name) + '</h3>';
    const note = point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '';
    const link = point.href
      ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">Open school page</a>'
      : '';

    return '<div class="map-popup">' + title + note + link + '</div>';
  }

  function showMapMessage(mapTarget, emptyState, message) {
    if (mapTarget) {
      mapTarget.hidden = true;
    }

    if (emptyState) {
      if (message) emptyState.textContent = message;
      emptyState.hidden = false;
    }
  }

  function renderHomepageMap() {
    const mapTarget = document.getElementById('homepage-map');
    const emptyState = document.getElementById('homepage-map-empty');

    if (!mapTarget) return true;

    if (mapTarget.__homepageLeafletMap) {
      setTimeout(function () {
        mapTarget.__homepageLeafletMap.invalidateSize();
      }, 60);
      return true;
    }

    if (!window.L) {
      return false;
    }

    const points = normaliseMapPoints(parseHomepageMapData());

    if (!points.length) {
      showMapMessage(mapTarget, emptyState, 'School locations are being updated.');
      return true;
    }

    if (emptyState) {
      emptyState.hidden = true;
    }
    mapTarget.hidden = false;

    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false,
      preferCanvas: true
    });

    mapTarget.__homepageLeafletMap = map;

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const latLngs = [];

    points.forEach(function (point) {
      const latLng = [point.lat, point.lng];
      latLngs.push(latLng);

      const marker = window.L.circleMarker(latLng, getMarkerStyle(point.type)).addTo(map);
      marker.bindPopup(buildPopupHtml(point));
    });

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
    } else {
      map.fitBounds(latLngs, {
        padding: [28, 28],
        maxZoom: 12
      });
    }

    setTimeout(function () {
      map.invalidateSize();
    }, 60);

    setTimeout(function () {
      map.invalidateSize();
    }, 300);

    return true;
  }

  function bootHomepageMap(attempt) {
    if (renderHomepageMap()) return;

    if (attempt >= 40) {
      showMapMessage(
        document.getElementById('homepage-map'),
        document.getElementById('homepage-map-empty'),
        'The map could not be loaded. Please refresh the page.'
      );
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
