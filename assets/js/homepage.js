(function () {
  const DEFAULT_RADIUS_MILES = 10;
  const MAX_VISIBLE_CARDS = 120;
  const UK_DEFAULT_CENTER = [54.25, -2.6];
  const UK_DEFAULT_ZOOM = 6;
  const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

  const state = {
    schools: [],
    map: null,
    tileLayer: null,
    markerLayer: null,
    searchLayer: null,
    activeRequestId: 0,
    resolvedLocation: null
  };

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

  function formatCount(value) {
    return new Intl.NumberFormat('en-GB').format(Number(value || 0));
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : (plural || singular + 's');
  }

  function normalizeSearchQuery(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function parsePositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function formatMiles(value) {
    if (!Number.isFinite(value)) return '';
    if (value < 10) return value.toFixed(1);
    return String(Math.round(value));
  }

  function formatDistanceLabel(value) {
    if (!Number.isFinite(value)) return '';
    return formatMiles(value) + ' miles away';
  }

  function haversineMiles(lat1, lng1, lat2, lng2) {
    const toRadians = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRadians;
    const dLng = (lng2 - lng1) * toRadians;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 3958.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function getGuideSearchInput() {
    return document.getElementById('guide-location-search');
  }

  function getFilterForm() {
    return document.getElementById('homepage-school-filters');
  }

  function getResultsSummary() {
    return document.getElementById('homepage-results-summary');
  }

  function getErrorTarget() {
    return document.getElementById('homepage-school-filter-error');
  }

  function getSubmitButton() {
    return document.getElementById('homepage-school-filter-submit');
  }

  function getSchoolData() {
    if (!Array.isArray(window.homepageSchoolSearchData)) return [];

    return window.homepageSchoolSearchData
      .map(function (item) {
        const lat = Number(item && (item.lat ?? item.latitude));
        const lng = Number(item && (item.lng ?? item.longitude));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          id: item.id ? String(item.id) : '',
          name: item.name || 'School',
          slug: item.slug || '',
          href: item.href || '',
          hasProfile: Boolean(item.href),
          lat: lat,
          lng: lng,
          type: item.type || 'senior',
          note: item.note || '',
          displayLocation: item.displayLocation || '',
          ageLabel: item.ageLabel || '',
          genderLabel: item.genderLabel || 'Mixed',
          genderFilter: item.genderFilter || 'mixed',
          boardingLabel: item.boardingLabel || 'Day only',
          boardingFilter: item.boardingFilter || null,
          hasSixthForm: Boolean(item.hasSixthForm),
          hasNursery: Boolean(item.hasNursery),
          religion: item.religion || '',
          town: item.town || '',
          county: item.county || '',
          postcode: item.postcode || ''
        };
      })
      .filter(Boolean);
  }

  function bindGuideLocationSearch() {
    const searchInput = getGuideSearchInput();
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

  function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, 8000);

    return fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en-GB'
      }
    })
      .then(function (response) {
        window.clearTimeout(timeout);
        if (!response.ok) {
          throw new Error('Request failed with status ' + response.status);
        }
        return response.json();
      })
      .catch(function (error) {
        window.clearTimeout(timeout);
        throw error;
      });
  }

  function looksLikeUkPostcode(query) {
    return POSTCODE_REGEX.test(String(query || '').trim());
  }

  function formatPostcode(postcode) {
    const compact = String(postcode || '').replace(/\s+/g, '').trim().toUpperCase();
    if (compact.length < 5) return compact;
    return compact.slice(0, -3) + ' ' + compact.slice(-3);
  }

  function resolvePostcode(query) {
    const cleanQuery = formatPostcode(query);
    const exactUrl = 'https://api.postcodes.io/postcodes/' + encodeURIComponent(cleanQuery);
    const searchUrl = 'https://api.postcodes.io/postcodes?q=' + encodeURIComponent(cleanQuery);

    return fetchJson(exactUrl)
      .then(function (payload) {
        if (payload && payload.status === 200 && payload.result) {
          return {
            lat: Number(payload.result.latitude),
            lng: Number(payload.result.longitude),
            label: payload.result.postcode || cleanQuery
          };
        }
        return null;
      })
      .catch(function () {
        return fetchJson(searchUrl)
          .then(function (payload) {
            const first = payload && Array.isArray(payload.result) ? payload.result[0] : null;
            if (!first) return null;
            return {
              lat: Number(first.latitude),
              lng: Number(first.longitude),
              label: first.postcode || cleanQuery
            };
          })
          .catch(function () {
            return null;
          });
      });
  }

  function resolvePlace(query) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'gb');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('q', String(query || '').trim());

    return fetchJson(String(url))
      .then(function (payload) {
        const first = Array.isArray(payload) ? payload[0] : null;
        if (!first) return null;

        const label = String(first.display_name || query)
          .split(',')
          .slice(0, 3)
          .map(function (part) { return part.trim(); })
          .filter(Boolean)
          .join(', ');

        return {
          lat: Number(first.lat),
          lng: Number(first.lon),
          label: label || String(query || '').trim()
        };
      })
      .catch(function () {
        return null;
      });
  }

  function resolveSearchLocation(query) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return Promise.resolve(null);

    if (looksLikeUkPostcode(trimmed)) {
      return resolvePostcode(trimmed).then(function (result) {
        return result || resolvePlace(trimmed);
      });
    }

    if (/\d/.test(trimmed)) {
      return resolvePostcode(trimmed).then(function (result) {
        return result || resolvePlace(trimmed);
      });
    }

    return resolvePlace(trimmed);
  }

  function readFilters() {
    const form = getFilterForm();
    if (!form) {
      return {
        locationQuery: '',
        radiusMiles: DEFAULT_RADIUS_MILES,
        genders: [],
        boarding: [],
        religions: [],
        sixthFormOnly: false,
        nurseryOnly: false
      };
    }

    const locationInput = form.querySelector('#school-filter-location');
    const radiusInput = form.querySelector('#school-filter-radius');

    return {
      locationQuery: locationInput ? locationInput.value.trim() : '',
      radiusMiles: parsePositiveNumber(radiusInput ? radiusInput.value : DEFAULT_RADIUS_MILES, DEFAULT_RADIUS_MILES),
      genders: Array.from(form.querySelectorAll('input[name="gender"]:checked')).map(function (input) { return input.value; }),
      boarding: Array.from(form.querySelectorAll('input[name="boarding"]:checked')).map(function (input) { return input.value; }),
      religions: Array.from(form.querySelectorAll('input[name="religion"]:checked')).map(function (input) { return input.value; }),
      sixthFormOnly: Boolean(form.querySelector('#school-filter-sixth-form:checked')),
      nurseryOnly: Boolean(form.querySelector('#school-filter-nursery:checked'))
    };
  }

  function getFilterDropdowns() {
    return Array.from(document.querySelectorAll('[data-dropdown]'));
  }

  function closeFilterDropdowns(exceptDropdown) {
    getFilterDropdowns().forEach(function (dropdown) {
      if (dropdown !== exceptDropdown) {
        dropdown.open = false;
      }
    });
  }

  function getDropdownSelectionLabel(labels, fallback) {
    if (!labels.length) return fallback || 'Any';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) {
      const joined = labels.join(', ');
      if (joined.length <= 26) return joined;
    }
    return labels.length + ' selected';
  }

  function updateFilterDropdownLabel(dropdown) {
    if (!dropdown) return;
    const valueTarget = dropdown.querySelector('[data-dropdown-value]');
    if (!valueTarget) return;

    const checkedLabels = Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked')).map(function (input) {
      return input.dataset.optionLabel || '';
    }).filter(Boolean);

    valueTarget.textContent = getDropdownSelectionLabel(checkedLabels, valueTarget.dataset.defaultLabel || 'Any');
  }

  function refreshFilterDropdownLabels() {
    getFilterDropdowns().forEach(updateFilterDropdownLabel);
  }

  function bindFilterDropdowns() {
    const dropdowns = getFilterDropdowns();
    if (!dropdowns.length) return;

    dropdowns.forEach(function (dropdown) {
      dropdown.addEventListener('toggle', function () {
        if (dropdown.open) {
          closeFilterDropdowns(dropdown);
        }
      });

      dropdown.addEventListener('change', function (event) {
        if (event.target && event.target.matches('input[type="checkbox"]')) {
          updateFilterDropdownLabel(dropdown);
        }
      });
    });

    document.addEventListener('click', function (event) {
      const clickedInsideDropdown = event.target && event.target.closest('[data-dropdown]');
      if (!clickedInsideDropdown) {
        closeFilterDropdowns();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeFilterDropdowns();
      }
    });

    refreshFilterDropdownLabels();
  }

  function filterSchools(filters, resolvedLocation) {
    const genders = new Set(filters.genders || []);
    const boarding = new Set(filters.boarding || []);
    const religions = new Set(filters.religions || []);

    return state.schools
      .map(function (school) {
        const distanceMiles = resolvedLocation
          ? haversineMiles(resolvedLocation.lat, resolvedLocation.lng, school.lat, school.lng)
          : null;

        return Object.assign({}, school, {
          distanceMiles: distanceMiles
        });
      })
      .filter(function (school) {
        if (genders.size && !genders.has(school.genderFilter)) return false;
        if (boarding.size && !boarding.has(school.boardingFilter)) return false;
        if (filters.sixthFormOnly && !school.hasSixthForm) return false;
        if (filters.nurseryOnly && !school.hasNursery) return false;
        if (religions.size && !religions.has(school.religion)) return false;
        if (resolvedLocation && (!Number.isFinite(school.distanceMiles) || school.distanceMiles > filters.radiusMiles)) return false;
        return true;
      })
      .sort(function (a, b) {
        if (resolvedLocation) {
          const distanceDelta = (a.distanceMiles || 0) - (b.distanceMiles || 0);
          if (distanceDelta !== 0) return distanceDelta;
        }
        return a.name.localeCompare(b.name, 'en');
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
      (point.displayLocation ? '<p class="map-popup-meta">' + escapeHtml(point.displayLocation) + '</p>' : '') +
      (point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '') +
      (point.href
        ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>'
        : '<p class="map-popup-link map-popup-link--muted">Profile coming soon</p>') +
      '</div>'
    );
  }

  function schoolCardHtml(point) {
    const extras = [
      point.religion || '',
      point.hasSixthForm ? 'Sixth form' : '',
      point.hasNursery ? 'Nursery' : ''
    ].filter(Boolean);
    const eyebrow = point.distanceMiles !== null && Number.isFinite(point.distanceMiles)
      ? (point.displayLocation ? escapeHtml(point.displayLocation) + ' · ' : '') + escapeHtml(formatDistanceLabel(point.distanceMiles))
      : escapeHtml(point.displayLocation || point.postcode || '');
    const wrapperStart = point.href
      ? '<a class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + '" href="' + escapeHtml(point.href) + '">'
      : '<article class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + ' homepage-school-card--static">';
    const wrapperEnd = point.href ? '</a>' : '</article>';

    return (
      wrapperStart +
        '<div class="homepage-school-card__body">' +
          (eyebrow ? '<p class="homepage-school-card__eyebrow">' + eyebrow + '</p>' : '') +
          '<h3 class="homepage-school-card__title">' + escapeHtml(point.name) + '</h3>' +
          '<p class="homepage-school-card__meta">' + escapeHtml(point.genderLabel + ' · ' + point.boardingLabel + ' · Ages ' + point.ageLabel) + '</p>' +
          (extras.length ? '<p class="homepage-school-card__meta homepage-school-card__meta--secondary">' + escapeHtml(extras.join(' · ')) + '</p>' : '') +
          (!point.href ? '<p class="homepage-school-card__status">Profile coming soon</p>' : '') +
        '</div>' +
      wrapperEnd
    );
  }

  function updateError(message) {
    const errorTarget = getErrorTarget();
    if (!errorTarget) return;
    errorTarget.hidden = !message;
    errorTarget.textContent = message || '';
  }

  function updateResultsSummary(results, filters, resolvedLocation) {
    const target = getResultsSummary();
    if (!target) return;

    const total = results.length;
    const shown = Math.min(total, MAX_VISIBLE_CARDS);
    const hasOtherFilters =
      filters.genders.length ||
      filters.boarding.length ||
      filters.religions.length ||
      filters.sixthFormOnly ||
      filters.nurseryOnly;

    if (!total) {
      if (resolvedLocation) {
        target.textContent = 'No schools found within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
      } else {
        target.textContent = 'No schools match these filters.';
      }
      return;
    }

    if (resolvedLocation) {
      target.textContent =
        (total > shown ? 'Showing first ' + formatCount(shown) + ' of ' + formatCount(total) : 'Showing ' + formatCount(total)) +
        ' ' + pluralize(total, 'school') +
        ' within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
      return;
    }

    if (hasOtherFilters) {
      target.textContent =
        (total > shown ? 'Showing first ' + formatCount(shown) + ' of ' + formatCount(total) : 'Showing ' + formatCount(total)) +
        ' ' + pluralize(total, 'school') +
        ' matching these filters nationwide.';
      return;
    }

    target.textContent =
      (total > shown ? 'Showing first ' + formatCount(shown) + ' of ' + formatCount(total) : 'Showing all ' + formatCount(total)) +
      ' schools with map coordinates.';
  }

  function renderSchoolCards(results, filters, resolvedLocation) {
    const cardGrid = document.getElementById('homepage-visible-school-grid');
    const cardEmpty = document.getElementById('homepage-visible-school-empty');
    if (!cardGrid) return;

    const shown = results.slice(0, MAX_VISIBLE_CARDS);
    cardGrid.innerHTML = shown.map(schoolCardHtml).join('');

    if (!cardEmpty) return;

    if (!shown.length) {
      cardEmpty.hidden = false;
      cardEmpty.textContent = resolvedLocation
        ? 'No schools were found within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.'
        : 'No schools match these filters.';
      return;
    }

    if (results.length > shown.length) {
      cardEmpty.hidden = false;
      cardEmpty.textContent = 'Showing the first ' + formatCount(shown.length) + ' of ' + formatCount(results.length) + ' matching schools. Narrow the filters to see more.';
      return;
    }

    cardEmpty.hidden = true;
    cardEmpty.textContent = '';
  }

  function ensureMap() {
    const mapTarget = document.getElementById('homepage-map');
    if (!mapTarget || !window.L) return null;
    if (state.map) return state.map;

    state.map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      preferCanvas: true
    });

    state.tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
      detectRetina: window.devicePixelRatio > 1
    }).addTo(state.map);

    state.markerLayer = window.L.layerGroup().addTo(state.map);
    state.searchLayer = window.L.layerGroup().addTo(state.map);
    state.map.setView(UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM);

    return state.map;
  }

  function redrawMap(results, filters, resolvedLocation) {
    const map = ensureMap();
    const emptyState = document.getElementById('homepage-map-empty');
    if (!map || !state.markerLayer || !state.searchLayer) return;

    state.markerLayer.clearLayers();
    state.searchLayer.clearLayers();

    const boundsLayers = [];

    if (resolvedLocation) {
      const radiusCircle = window.L.circle([resolvedLocation.lat, resolvedLocation.lng], {
        radius: filters.radiusMiles * 1609.34,
        color: '#b35b2e',
        weight: 1.5,
        fillColor: '#b35b2e',
        fillOpacity: 0.08
      }).addTo(state.searchLayer);

      const centreMarker = window.L.circleMarker([resolvedLocation.lat, resolvedLocation.lng], {
        radius: 7,
        color: '#b35b2e',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1
      }).bindPopup('<div class="map-popup"><h3 class="map-popup-title">' + escapeHtml(resolvedLocation.label) + '</h3><p class="map-popup-meta">Search centre</p></div>').addTo(state.searchLayer);

      boundsLayers.push(radiusCircle, centreMarker);
    }

    results.forEach(function (school) {
      const marker = window.L.marker([school.lat, school.lng], { icon: buildIcon(school.type) });
      marker.bindPopup(popupHtml(school));
      state.markerLayer.addLayer(marker);
      boundsLayers.push(marker);
    });

    if (emptyState) {
      emptyState.hidden = results.length > 0 || Boolean(resolvedLocation);
      if (!emptyState.hidden) {
        emptyState.textContent = 'No schools match these filters.';
      } else if (resolvedLocation && results.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = 'No schools were found within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
      }
    }

    if (resolvedLocation && boundsLayers.length) {
      const group = window.L.featureGroup(boundsLayers);
      map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
    } else {
      map.setView(UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM, { animate: false });
    }

    window.requestAnimationFrame(function () {
      try {
        map.invalidateSize({ pan: false, animate: false });
      } catch (error) {}
      if (state.tileLayer && typeof state.tileLayer.redraw === 'function') {
        try {
          state.tileLayer.redraw();
        } catch (error) {}
      }
    });
  }

  function setSubmitting(isSubmitting) {
    const submitButton = getSubmitButton();
    if (!submitButton) return;
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? 'Searching…' : 'Apply filters';
  }

  async function applyFilters() {
    const filters = readFilters();
    const requestId = ++state.activeRequestId;
    const searchKey = normalizeSearchQuery(filters.locationQuery);

    updateError('');
    setSubmitting(Boolean(searchKey));

    let resolvedLocation = null;

    if (searchKey) {
      if (state.resolvedLocation && state.resolvedLocation.key === searchKey) {
        resolvedLocation = state.resolvedLocation;
      } else {
        resolvedLocation = await resolveSearchLocation(filters.locationQuery);
        if (requestId !== state.activeRequestId) return;

        if (!resolvedLocation) {
          updateError('We could not find that UK location, so the other filters have still been applied.');
        }
      }
    }

    if (requestId !== state.activeRequestId) return;

    state.resolvedLocation = resolvedLocation
      ? {
          key: searchKey,
          lat: resolvedLocation.lat,
          lng: resolvedLocation.lng,
          label: resolvedLocation.label
        }
      : null;

    const results = filterSchools(filters, state.resolvedLocation);
    renderSchoolCards(results, filters, state.resolvedLocation);
    redrawMap(results, filters, state.resolvedLocation);
    updateResultsSummary(results, filters, state.resolvedLocation);
    setSubmitting(false);
  }

  function initHomepageMap() {
    if (ensureMap()) return true;
    return false;
  }

  function bootHomepageMap(attempt) {
    if (initHomepageMap()) return;
    if (attempt >= 50) return;
    window.setTimeout(function () { bootHomepageMap(attempt + 1); }, 100);
  }

  function bindFilterForm() {
    const form = getFilterForm();
    const resetButton = document.getElementById('homepage-school-filter-reset');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      closeFilterDropdowns();
      applyFilters();
    });

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        state.resolvedLocation = null;
        closeFilterDropdowns();
        refreshFilterDropdownLabels();
        updateError('');
        applyFilters();
      });
    }
  }

  function initHomepage() {
    state.schools = getSchoolData();
    bindGuideLocationSearch();
    bindFilterDropdowns();
    bindFilterForm();
    bootHomepageMap(0);
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepage, { once: true });
  } else {
    initHomepage();
  }

  window.addEventListener('load', function () { bootHomepageMap(0); });
})();
