(function () {
  var MAX_VISIBLE_CARDS = 50;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[match];
    });
  }

  function bindLocationSearch() {
    var searchInput = document.getElementById('location-search');
    var locationItems = Array.from(document.querySelectorAll('[data-location-item]'));

    if (!searchInput || !locationItems.length) return;

    function filterLocations() {
      var query = searchInput.value.trim().toLowerCase();
      var firstVisibleHref = '';

      locationItems.forEach(function (item) {
        var searchText = (item.dataset.search || item.dataset.name || '').toLowerCase();
        var match = !query || searchText.includes(query);
        var href = item.getAttribute('href') || '';

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
        var href = searchInput.dataset.firstVisibleHref;
        if (href) {
          event.preventDefault();
          window.location.href = href;
        }
      }
    });

    filterLocations();
  }

  function normalisePoint(item) {
    if (!item || typeof item !== 'object') return null;

    var lat = Number(item.lat != null ? item.lat : item.latitude);
    var lng = Number(item.lng != null ? item.lng : item.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      name: item.name || 'School',
      href: item.href || item.slug || '',
      lat: lat,
      lng: lng,
      type: item.type || 'senior',
      note: item.note || '',
      locationName: item.locationName || ''
    };
  }

  function getMapPoints() {
    if (!Array.isArray(window.homepageMapData)) return [];
    return window.homepageMapData.map(normalisePoint).filter(Boolean);
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
      (point.locationName ? '<p class="map-popup-location">' + escapeHtml(point.locationName) + '</p>' : '') +
      (point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '') +
      (point.href ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>' : '') +
      '</div>'
    );
  }

  function getResultsElements() {
    return {
      grid: document.getElementById('homepage-school-grid'),
      count: document.getElementById('homepage-results-count'),
      empty: document.getElementById('homepage-results-empty')
    };
  }

  function schoolCardHtml(point) {
    return (
      '<article class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + '">' +
        (point.locationName ? '<p class="homepage-school-card-location">' + escapeHtml(point.locationName) + '</p>' : '') +
        '<h3 class="homepage-school-card-title">' +
          (point.href
            ? '<a href="' + escapeHtml(point.href) + '">' + escapeHtml(point.name) + '</a>'
            : escapeHtml(point.name)) +
        '</h3>' +
        (point.note ? '<p class="homepage-school-card-note">' + escapeHtml(point.note) + '</p>' : '') +
        (point.href ? '<a class="homepage-school-card-link" href="' + escapeHtml(point.href) + '">View school</a>' : '') +
      '</article>'
    );
  }

  function updateResultsCopy(visibleCount, renderedCount) {
    var elements = getResultsElements();
    if (elements.count) {
      if (!visibleCount) {
        elements.count.textContent = 'Showing 0 schools';
      } else if (visibleCount > renderedCount) {
        elements.count.textContent = 'Showing ' + renderedCount + ' of ' + visibleCount + ' schools';
      } else {
        elements.count.textContent = 'Showing ' + visibleCount + ' school' + (visibleCount === 1 ? '' : 's');
      }
    }

    if (elements.empty) {
      elements.empty.hidden = visibleCount > 0;
      if (!visibleCount) {
        elements.empty.textContent = 'No schools are visible in the current map area.';
      }
    }
  }

  function renderVisibleCards(map, points) {
    var elements = getResultsElements();
    if (!elements.grid || !map) return;

    var bounds = map.getBounds();
    var visiblePoints = points.filter(function (point) {
      return bounds.contains([point.lat, point.lng]);
    });

    visiblePoints.sort(function (a, b) {
      var locationCompare = String(a.locationName || '').localeCompare(String(b.locationName || ''), 'en', { sensitivity: 'base' });
      if (locationCompare !== 0) return locationCompare;
      return String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' });
    });

    var renderedPoints = visiblePoints.slice(0, MAX_VISIBLE_CARDS);
    elements.grid.innerHTML = renderedPoints.map(schoolCardHtml).join('');
    updateResultsCopy(visiblePoints.length, renderedPoints.length);
  }

  function initHomepageMap() {
    var mapTarget = document.getElementById('homepage-map');
    var emptyState = document.getElementById('homepage-map-empty');

    if (!mapTarget || !window.L) return false;
    if (mapTarget.dataset.mapReady === 'true') {
      if (mapTarget._leaflet_map_instance) {
        renderVisibleCards(mapTarget._leaflet_map_instance, getMapPoints());
      }
      return true;
    }

    var points = getMapPoints();
    var map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    });

    mapTarget.dataset.mapReady = 'true';
    mapTarget._leaflet_map_instance = map;

    var tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
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

    function syncVisibleCards() {
      renderVisibleCards(map, points);
    }

    if (!points.length) {
      map.setView([54.5, -3.2], 6);
      if (emptyState) emptyState.hidden = false;
      sharpenMap();
      setTimeout(sharpenMap, 80);
      setTimeout(sharpenMap, 260);
      syncVisibleCards();
      return true;
    }

    if (emptyState) emptyState.hidden = true;

    var markers = points.map(function (point) {
      var marker = window.L.marker([point.lat, point.lng], { icon: buildIcon(point.type) }).addTo(map);
      marker.bindPopup(popupHtml(point));
      return marker;
    });

    var group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 10, animate: false });

    map.on('moveend zoomend', syncVisibleCards);
    tileLayer.on('load', syncVisibleCards);

    sharpenMap();
    syncVisibleCards();
    setTimeout(function () {
      sharpenMap();
      syncVisibleCards();
    }, 80);
    setTimeout(function () {
      sharpenMap();
      syncVisibleCards();
    }, 260);
    setTimeout(function () {
      sharpenMap();
      syncVisibleCards();
    }, 600);

    return true;
  }

  function bootHomepageMap(attempt) {
    if (initHomepageMap()) return;
    if (attempt >= 50) return;
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
})();
