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
          lat: lat,
          lng: lng,
          type: item.type || 'senior',
          note: item.note || '',
          provisionCategory: item.provisionCategory === 'sen_specialist' ? 'sen_specialist' : 'mainstream'
        };
      })
      .filter(Boolean)
      .filter(function (point) {
        return point.provisionCategory === 'mainstream';
      });
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

  function schoolCardHtml(point) {
    return (
      '<a class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + '" href="' + escapeHtml(point.href) + '">' +
        '<div class="homepage-school-card__body">' +
          '<h3 class="homepage-school-card__title">' + escapeHtml(point.name) + '</h3>' +
          (point.note ? '<p class="homepage-school-card__meta">' + escapeHtml(point.note) + '</p>' : '') +
        '</div>' +
      '</a>'
    );
  }

  function initHomepageMap() {
    const mapTarget = document.getElementById('homepage-map');
    const emptyState = document.getElementById('homepage-map-empty');
    const cardGrid = document.getElementById('homepage-visible-school-grid');
    const cardEmpty = document.getElementById('homepage-visible-school-empty');

    if (!mapTarget || !window.L) return false;
    if (mapTarget.dataset.mapReady === 'true') return true;

    const points = getMapPoints();
    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: true,
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

    const markerLayer = window.L.layerGroup().addTo(map);

    function sharpenMap() {
      requestAnimationFrame(function () {
        try {
          map.invalidateSize({ pan: false, animate: false });
        } catch (error) {}
        if (typeof tileLayer.redraw === 'function') {
          try {
            tileLayer.redraw();
          } catch (error) {}
        }
      });
    }

    function updateVisibleSchoolCards() {
      if (!cardGrid) return;
      const bounds = map.getBounds();
      const visible = points
        .filter(function (point) {
          return bounds.contains([point.lat, point.lng]);
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, 'en');
        });

      const shown = visible.slice(0, 50);
      cardGrid.innerHTML = shown.map(schoolCardHtml).join('');

      if (cardEmpty) {
        cardEmpty.hidden = shown.length > 0;
        if (!shown.length) {
          cardEmpty.textContent = 'No schools are currently visible on the map.';
        } else if (visible.length > shown.length) {
          cardEmpty.hidden = false;
          cardEmpty.textContent = 'Showing the first 50 schools visible on the map.';
        }
      }
    }

    if (!points.length) {
      map.setView([51.41, -2.47], 8);
      if (emptyState) emptyState.hidden = false;
      if (cardGrid) cardGrid.innerHTML = '';
      if (cardEmpty) {
        cardEmpty.hidden = false;
        cardEmpty.textContent = 'School locations are being updated.';
      }
      sharpenMap();
      return true;
    }

    if (emptyState) emptyState.hidden = true;

    const markers = points.map(function (point) {
      const marker = window.L.marker([point.lat, point.lng], { icon: buildIcon(point.type) });
      marker.bindPopup(popupHtml(point));
      markerLayer.addLayer(marker);
      return marker;
    });

    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });

    map.on('moveend zoomend', updateVisibleSchoolCards);
    map.on('resize', updateVisibleSchoolCards);

    updateVisibleSchoolCards();
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
