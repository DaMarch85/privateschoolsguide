(function () {
  const DEFAULT_RADIUS_MILES = 10;
  const MAX_VISIBLE_TILES = 60;
  const UK_DEFAULT_CENTER = [54.25, -2.6];
  const UK_DEFAULT_ZOOM = 6;
  const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
  const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const YEAR_LABELS = [
    'Pre-Reception', 'Reception', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
    'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12', 'Year 13'
  ];

  const state = {
    schools: [],
    filteredSchools: [],
    visibleSchools: [],
    map: null,
    tileLayer: null,
    markerLayer: null,
    searchLayer: null,
    activeRequestId: 0,
    resolvedLocation: null,
    currentFilters: null,
    viewMode: 'tiles',
    tableSection: 'glance',
    sortMode: 'dayFeesDesc',
    tablePage: 0,
    hiddenTableSchoolIds: new Set(),
    debouncedApplyTimer: null,
    mapReady: false,
    markersBySchoolId: new Map(),
    hoveredSchoolId: null,
    initialMapFocus: null,
    mapFocusLocation: null
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function formatCount(value) {
    return new Intl.NumberFormat('en-GB').format(Number(value || 0));
  }

  function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '—';
    return Math.round(num * 100) + '%';
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

  function compareByName(a, b) {
    return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'en');
  }

  function normalizeFeeValue(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function isDayFeeSort(sortMode) {
    return sortMode === 'dayFeesDesc' || sortMode === 'dayFeesAsc' || sortMode === 'dayFees';
  }

  function isBoardingFeeSort(sortMode) {
    return sortMode === 'boardingFeesDesc' || sortMode === 'boardingFeesAsc' || sortMode === 'boardingFees';
  }

  function isFeeSort(sortMode) {
    return isDayFeeSort(sortMode) || isBoardingFeeSort(sortMode);
  }

  function getSortFeeValue(school, sortMode) {
    if (isDayFeeSort(sortMode)) return normalizeFeeValue(school.dayFeeAverage);
    if (isBoardingFeeSort(sortMode)) return normalizeFeeValue(school.boardingFeeAverage);
    return null;
  }

  function sortSchools(schools, sortMode) {
    return schools.slice().sort(function (a, b) {
      if (isFeeSort(sortMode)) {
        const aValue = getSortFeeValue(a, sortMode);
        const bValue = getSortFeeValue(b, sortMode);
        const aMissing = aValue === null;
        const bMissing = bValue === null;

        if (aMissing !== bMissing) {
          return aMissing ? 1 : -1;
        }

        if (aValue !== null && bValue !== null && aValue !== bValue) {
          if (sortMode === 'dayFeesDesc' || sortMode === 'boardingFeesDesc') {
            return bValue - aValue;
          }
          return aValue - bValue;
        }
      }

      return compareByName(a, b);
    });
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

  function getFilterForm() {
    return document.getElementById('homepage-school-filters');
  }

  function getResultsSummary() {
    return document.getElementById('homepage-results-summary');
  }

  function getErrorTarget() {
    return document.getElementById('homepage-school-filter-error');
  }

  function getGuideSearchInput() {
    return document.getElementById('guide-location-search');
  }

  function getSchoolData() {
    if (!Array.isArray(window.homepageSchoolSearchData)) return [];

    return window.homepageSchoolSearchData
      .map(function (item) {
        const lat = Number(item && (item.lat ?? item.latitude));
        const lng = Number(item && (item.lng ?? item.longitude));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const dayFeeAverage = normalizeFeeValue(item.dayFeeAverage);
        const boardingFeeAverage = normalizeFeeValue(item.boardingFeeAverage);

        return {
          id: item.id ? String(item.id) : '',
          slug: item.slug || '',
          name: item.name || 'School',
          href: item.href || '',
          hasProfile: Boolean(item.href),
          locationSlug: item.locationSlug || '',
          lat: lat,
          lng: lng,
          latitude: lat,
          longitude: lng,
          type: item.type || 'senior',
          note: item.note || '',
          displayLocation: item.displayLocation || '',
          ageLabel: item.ageLabel || '—',
          genderLabel: item.genderLabel || 'Mixed',
          genderFilter: item.genderFilter || 'mixed',
          boardingLabel: item.boardingLabel || 'Day only',
          boardingFilter: item.boardingFilter || null,
          hasSixthForm: Boolean(item.hasSixthForm),
          hasNursery: Boolean(item.hasNursery),
          religion: item.religion || '',
          studentsLabel: item.studentsLabel || '',
          boyGirlSplit: item.boyGirlSplit || '',
          hasDayFees: dayFeeAverage !== null || Boolean(item.hasDayFees),
          hasBoardingFees: boardingFeeAverage !== null || Boolean(item.hasBoardingFees),
          dayFeeAverage: dayFeeAverage,
          boardingFeeAverage: boardingFeeAverage,
          dayFeesByYear: item.dayFeesByYear || {},
          boardingFeesByYear: item.boardingFeesByYear || {},
          packageSlug: item.packageSlug || 'organic',
          packagePriority: Number.isFinite(Number(item.packagePriority)) ? Number(item.packagePriority) : 0,
          badgeLabel: item.badgeLabel || '',
          isManaged: Boolean(item.isManaged),
          alevel: item.alevel || null,
          distanceMiles: null
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
        if (item.parentElement) item.parentElement.hidden = !match;
        if (match && href && !firstVisibleHref) firstVisibleHref = href;
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
      headers: { Accept: 'application/json', 'Accept-Language': 'en-GB' }
    }).then(function (response) {
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error('Request failed with status ' + response.status);
      return response.json();
    }).catch(function (error) {
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
        return fetchJson(searchUrl).then(function (payload) {
          const first = payload && Array.isArray(payload.result) ? payload.result[0] : null;
          if (!first) return null;
          return {
            lat: Number(first.latitude),
            lng: Number(first.longitude),
            label: first.postcode || cleanQuery
          };
        }).catch(function () { return null; });
      });
  }

  function resolvePlace(query) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'gb');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('q', String(query || '').trim());

    return fetchJson(String(url)).then(function (payload) {
      const first = Array.isArray(payload) ? payload[0] : null;
      if (!first) return null;
      const label = String(first.display_name || query).split(',').slice(0, 3).map(function (part) {
        return part.trim();
      }).filter(Boolean).join(', ');
      return {
        lat: Number(first.lat),
        lng: Number(first.lon),
        label: label || String(query || '').trim()
      };
    }).catch(function () { return null; });
  }

  function resolveSearchLocation(query) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return Promise.resolve(null);
    if (looksLikeUkPostcode(trimmed) || /\d/.test(trimmed)) {
      return resolvePostcode(trimmed).then(function (result) {
        return result || resolvePlace(trimmed);
      });
    }
    return resolvePlace(trimmed);
  }

  function getFilterDropdowns() {
    return Array.from(document.querySelectorAll('[data-dropdown]'));
  }

  function closeFilterDropdowns(exceptDropdown) {
    getFilterDropdowns().forEach(function (dropdown) {
      if (dropdown !== exceptDropdown) dropdown.open = false;
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
    const valueTarget = dropdown && dropdown.querySelector('[data-dropdown-value]');
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
        if (dropdown.open) closeFilterDropdowns(dropdown);
      });
      dropdown.addEventListener('change', function (event) {
        if (event.target && event.target.matches('input[type="checkbox"]')) updateFilterDropdownLabel(dropdown);
      });
    });

    document.addEventListener('click', function (event) {
      if (!(event.target && event.target.closest('[data-dropdown]'))) closeFilterDropdowns();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeFilterDropdowns();
    });

    refreshFilterDropdownLabels();
  }

  function readFilters() {
    const form = getFilterForm();
    if (!form) {
      return {
        locationQuery: '', radiusMiles: DEFAULT_RADIUS_MILES, genders: [], boarding: [], religions: [], sixthFormOnly: false, nurseryOnly: false
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

  function filterSchools(filters, resolvedLocation) {
    const genders = new Set(filters.genders || []);
    const boarding = new Set(filters.boarding || []);
    const religions = new Set(filters.religions || []);

    const filtered = state.schools
      .map(function (school) {
        const distanceMiles = resolvedLocation ? haversineMiles(resolvedLocation.lat, resolvedLocation.lng, school.lat, school.lng) : null;
        return Object.assign({}, school, { distanceMiles: distanceMiles });
      })
      .filter(function (school) {
        if (genders.size && !genders.has(school.genderFilter)) return false;
        if (boarding.size && !boarding.has(school.boardingFilter)) return false;
        if (filters.sixthFormOnly && !school.hasSixthForm) return false;
        if (filters.nurseryOnly && !school.hasNursery) return false;
        if (religions.size && !religions.has(school.religion)) return false;
        if (resolvedLocation && (!Number.isFinite(school.distanceMiles) || school.distanceMiles > filters.radiusMiles)) return false;
        return true;
      });

    return sortSchools(filtered, state.sortMode);
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
    return '<div class="map-popup">' +
      '<h3 class="map-popup-title">' + escapeHtml(point.name) + '</h3>' +
      (point.displayLocation ? '<p class="map-popup-meta">' + escapeHtml(point.displayLocation) + '</p>' : '') +
      (point.note ? '<p class="map-popup-meta">' + escapeHtml(point.note) + '</p>' : '') +
      (point.href ? '<a class="map-popup-link" href="' + escapeHtml(point.href) + '">View school</a>' : '<p class="map-popup-link map-popup-link--muted">Profile coming soon</p>') +
      '</div>';
  }

  function schoolCardHtml(point) {
    const extras = [point.religion || '', point.hasSixthForm ? 'Sixth form' : '', point.hasNursery ? 'Nursery' : ''].filter(Boolean);
    const eyebrow = point.distanceMiles !== null && Number.isFinite(point.distanceMiles)
      ? (point.displayLocation ? escapeHtml(point.displayLocation) + ' · ' : '') + escapeHtml(formatDistanceLabel(point.distanceMiles))
      : escapeHtml(point.displayLocation || '');
    const sortFeeValue = getSortFeeValue(point, state.sortMode);
    const showNoFeeDataLabel = isFeeSort(state.sortMode) && sortFeeValue === null;
    const sharedAttributes = ' class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + (point.href ? '' : ' homepage-school-card--static') + '" data-school-id="' + escapeHtml(point.id) + '"';
    const wrapperStart = point.href
      ? '<a' + sharedAttributes + ' href="' + escapeHtml(point.href) + '">'
      : '<article' + sharedAttributes + '>';
    const wrapperEnd = point.href ? '</a>' : '</article>';

    return wrapperStart +
      '<div class="homepage-school-card__body">' +
      (eyebrow ? '<p class="homepage-school-card__eyebrow">' + eyebrow + '</p>' : '') +
      (point.badgeLabel ? '<p class="homepage-school-card__badge">' + escapeHtml(point.badgeLabel) + '</p>' : '') +
      '<h3 class="homepage-school-card__title">' + escapeHtml(point.name) + '</h3>' +
      '<p class="homepage-school-card__meta">' + escapeHtml(point.genderLabel + ' · ' + point.boardingLabel + ' · Ages ' + point.ageLabel) + '</p>' +
      (extras.length ? '<p class="homepage-school-card__meta homepage-school-card__meta--secondary">' + escapeHtml(extras.join(' · ')) + '</p>' : '') +
      (showNoFeeDataLabel ? '<p class="homepage-school-card__status homepage-school-card__status--neutral">No fee data</p>' : '') +
      (!point.href ? '<p class="homepage-school-card__status">Profile coming soon</p>' : '') +
      '</div>' + wrapperEnd;
  }

  function setHoveredSchoolId(nextSchoolId) {
    const nextId = nextSchoolId ? String(nextSchoolId) : null;
    if (state.hoveredSchoolId === nextId) return;

    if (state.hoveredSchoolId && state.markersBySchoolId.has(state.hoveredSchoolId)) {
      const previousMarker = state.markersBySchoolId.get(state.hoveredSchoolId);
      const previousElement = previousMarker && previousMarker.getElement ? previousMarker.getElement() : null;
      if (previousElement) previousElement.classList.remove('is-highlighted');
    }

    state.hoveredSchoolId = nextId;

    if (nextId && state.markersBySchoolId.has(nextId)) {
      const nextMarker = state.markersBySchoolId.get(nextId);
      const nextElement = nextMarker && nextMarker.getElement ? nextMarker.getElement() : null;
      if (nextElement) nextElement.classList.add('is-highlighted');
    }
  }

  function bindCardHoverStates() {
    const cardGrid = document.getElementById('homepage-visible-school-grid');
    if (!cardGrid) return;

    Array.from(cardGrid.querySelectorAll('[data-school-id]')).forEach(function (card) {
      const schoolId = card.getAttribute('data-school-id');
      if (!schoolId) return;
      card.addEventListener('mouseenter', function () { setHoveredSchoolId(schoolId); });
      card.addEventListener('mouseleave', function () { setHoveredSchoolId(null); });
      card.addEventListener('focusin', function () { setHoveredSchoolId(schoolId); });
      card.addEventListener('focusout', function (event) {
        if (!card.contains(event.relatedTarget)) setHoveredSchoolId(null);
      });
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

  function updateError(message) {
    const errorTarget = getErrorTarget();
    if (!errorTarget) return;
    errorTarget.hidden = !message;
    errorTarget.textContent = message || '';
  }

  function getCountryBounds() {
    if (!window.L) return null;
    return window.L.latLngBounds([[49.45, -11.75], [61.25, 3.25]]);
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
      preferCanvas: true,
      minZoom: UK_DEFAULT_ZOOM,
      maxBoundsViscosity: 0.65
    });

    state.tileLayer = createBaseLayer().addTo(state.map);

    state.markerLayer = window.L.layerGroup().addTo(state.map);
    state.searchLayer = window.L.layerGroup().addTo(state.map);
    const countryBounds = getCountryBounds();
    if (countryBounds && typeof state.map.setMaxBounds === 'function') {
      state.map.setMaxBounds(countryBounds);
    }
    state.map.setView(UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM);
    state.map.on('moveend zoomend resize', updateVisibleSchoolsFromMap);
    state.mapReady = true;
    return state.map;
  }

  function updateVisibleSchoolsFromMap() {
    if (!state.map || !state.filteredSchools.length) {
      state.visibleSchools = state.filteredSchools.slice();
      renderResultsOnly();
      return;
    }

    const bounds = state.map.getBounds();
    state.visibleSchools = state.filteredSchools.filter(function (school) {
      return bounds.contains([school.lat, school.lng]);
    });
    renderResultsOnly();
  }

  function redrawMap(results, filters, resolvedLocation, mapFocusLocation) {
    const map = ensureMap();
    const emptyState = document.getElementById('homepage-map-empty');
    if (!map || !state.markerLayer || !state.searchLayer) return;

    state.markerLayer.clearLayers();
    state.searchLayer.clearLayers();
    state.markersBySchoolId = new Map();
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
      if (school.id) {
        state.markersBySchoolId.set(String(school.id), marker);
      }
      boundsLayers.push(marker);
    });

    if (emptyState) {
      emptyState.hidden = results.length > 0 || Boolean(resolvedLocation);
      if (!emptyState.hidden) emptyState.textContent = 'No schools match these filters.';
      if (resolvedLocation && results.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = 'No schools were found within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
      }
    }

    if (resolvedLocation && boundsLayers.length) {
      map.fitBounds(window.L.featureGroup(boundsLayers).getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
    } else if (mapFocusLocation) {
      map.setView([mapFocusLocation.lat, mapFocusLocation.lng], mapFocusLocation.zoom || 14, { animate: false });
    } else if (boundsLayers.length) {
      map.fitBounds(window.L.featureGroup(boundsLayers).getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
    } else {
      map.setView(UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM, { animate: false });
    }

    if (state.hoveredSchoolId) {
      setHoveredSchoolId(state.hoveredSchoolId);
    }

    window.requestAnimationFrame(function () {
      try { map.invalidateSize({ pan: false, animate: false }); } catch (error) {}
      if (state.tileLayer && typeof state.tileLayer.redraw === 'function') {
        try { state.tileLayer.redraw(); } catch (error) {}
      }
    });
  }

  function getTableColumnCount() {
    const width = window.innerWidth || 1400;
    if (width <= 900) return 2;
    if (width <= 1220) return 4;
    return 6;
  }

  function getSectionSchools() {
    const base = state.visibleSchools.filter(function (school) {
      return !state.hiddenTableSchoolIds.has(school.id);
    });

    if (state.tableSection === 'alevel') {
      return base.filter(function (school) { return school.alevel; });
    }
    return base;
  }

  function getTableRowsForSection(section, schools) {
    if (section === 'dayFees') {
      return YEAR_LABELS.map(function (label) {
        return {
          label: label,
          values: schools.map(function (school) { return school.dayFeesByYear[label] || '—'; })
        };
      });
    }

    if (section === 'boardingFees') {
      return YEAR_LABELS.map(function (label) {
        return {
          label: label,
          values: schools.map(function (school) { return school.boardingFeesByYear[label] || '—'; })
        };
      });
    }

    if (section === 'alevel') {
      return [
        { label: 'Total exams', values: schools.map(function (school) { return school.alevel && school.alevel.totalExams !== null ? formatCount(school.alevel.totalExams) : '—'; }) },
        { label: '% A*–A', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.pctAStarA) : '—'; }) },
        { label: '% A*–B', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.pctAStarB) : '—'; }) },
        { label: 'Unique subjects', values: schools.map(function (school) { return school.alevel && school.alevel.uniqueSubjects !== null ? formatCount(school.alevel.uniqueSubjects) : '—'; }) },
        { label: 'Core science', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.coreScience) : '—'; }) },
        { label: 'Mathematics', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.mathematics) : '—'; }) },
        { label: 'Art', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.art) : '—'; }) },
        { label: 'Languages', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.languages) : '—'; }) },
        { label: 'Economics', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.economics) : '—'; }) },
        { label: 'English', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.english) : '—'; }) },
        { label: 'History', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.history) : '—'; }) },
        { label: 'Geography', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.geography) : '—'; }) },
        { label: 'Psychology', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.psychology) : '—'; }) },
        { label: 'Other', values: schools.map(function (school) { return school.alevel ? formatPercent(school.alevel.other) : '—'; }) }
      ];
    }

    return [
      { label: 'Ages', values: schools.map(function (school) { return school.ageLabel || '—'; }) },
      { label: 'Students', values: schools.map(function (school) { return school.studentsLabel || '—'; }) },
      { label: 'Boy/girl split', values: schools.map(function (school) { return school.boyGirlSplit || '—'; }) },
      { label: 'Gender', values: schools.map(function (school) { return school.genderLabel || '—'; }) },
      { label: 'Boarding', values: schools.map(function (school) { return school.boardingLabel || '—'; }) },
      { label: 'Religion', values: schools.map(function (school) { return school.religion || '—'; }) },
      { label: 'Sixth form', values: schools.map(function (school) { return school.hasSixthForm ? 'Yes' : '—'; }) },
      { label: 'Nursery', values: schools.map(function (school) { return school.hasNursery ? 'Yes' : '—'; }) }
    ];
  }

  function renderTable() {
    const table = document.getElementById('homepage-school-table');
    const prevButton = document.getElementById('homepage-table-prev');
    const nextButton = document.getElementById('homepage-table-next');
    const pageLabel = document.getElementById('homepage-table-page-label');
    const showAllButton = document.getElementById('homepage-table-show-all');
    if (!table || !prevButton || !nextButton || !pageLabel || !showAllButton) return;

    const sectionSchools = getSectionSchools();
    if (!sectionSchools.length) {
      table.innerHTML = '';
      pageLabel.textContent = 'No schools';
      prevButton.disabled = true;
      nextButton.disabled = true;
      showAllButton.hidden = state.hiddenTableSchoolIds.size === 0;
      return;
    }

    const columnCount = getTableColumnCount();
    const maxPage = Math.max(0, Math.ceil(sectionSchools.length / columnCount) - 1);
    if (state.tablePage > maxPage) state.tablePage = maxPage;
    const start = state.tablePage * columnCount;
    const schools = sectionSchools.slice(start, start + columnCount);
    const rows = getTableRowsForSection(state.tableSection, schools);

    const headCells = schools.map(function (school) {
      const link = school.href ? '<a href="' + escapeHtml(school.href) + '">' + escapeHtml(school.name) + '</a>' : escapeHtml(school.name);
      return '<th><div class="homepage-school-table__school">' +
        '<span class="homepage-school-table__school-name">' + link + '</span>' +
        '<button class="homepage-school-table__hide" data-hide-school="' + escapeHtml(school.id) + '" type="button">Hide</button>' +
        '</div></th>';
    }).join('');

    const bodyRows = rows.map(function (row) {
      return '<tr><th scope="row">' + escapeHtml(row.label) + '</th>' + row.values.map(function (value) {
        return '<td>' + escapeHtml(value || '—') + '</td>';
      }).join('') + '</tr>';
    }).join('');

    table.innerHTML = '<thead><tr><th>School</th>' + headCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';
    pageLabel.textContent = 'Schools ' + formatCount(start + 1) + '–' + formatCount(Math.min(start + schools.length, sectionSchools.length)) + ' of ' + formatCount(sectionSchools.length);
    prevButton.disabled = state.tablePage === 0;
    nextButton.disabled = state.tablePage >= maxPage;
    showAllButton.hidden = state.hiddenTableSchoolIds.size === 0;

    Array.from(table.querySelectorAll('[data-hide-school]')).forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.getAttribute('data-hide-school');
        if (!id) return;
        state.hiddenTableSchoolIds.add(id);
        renderResultsOnly();
      });
    });
  }

  function renderSchoolCards() {
    const cardGrid = document.getElementById('homepage-visible-school-grid');
    if (!cardGrid) return;
    const shown = state.visibleSchools.slice(0, MAX_VISIBLE_TILES);
    cardGrid.innerHTML = shown.map(schoolCardHtml).join('');
    bindCardHoverStates();
  }

  function updateResultsSummary() {
    const target = getResultsSummary();
    if (!target) return;
    const filteredCount = state.filteredSchools.length;
    const visibleCount = state.visibleSchools.length;

    if (!filteredCount) {
      if (state.resolvedLocation && state.currentFilters) {
        target.textContent = 'No schools found within ' + formatMiles(state.currentFilters.radiusMiles) + ' miles of ' + state.resolvedLocation.label + '.';
      } else {
        target.textContent = 'No schools match these filters.';
      }
      return;
    }

    if (visibleCount === filteredCount) {
      target.textContent = 'Showing ' + formatCount(visibleCount) + ' ' + pluralize(visibleCount, 'school') + ' in the current map view.';
      return;
    }

    target.textContent = 'Showing ' + formatCount(visibleCount) + ' of ' + formatCount(filteredCount) + ' matching schools in the current map view.';
  }

  function updateEmptyState() {
    const empty = document.getElementById('homepage-visible-school-empty');
    if (!empty) return;

    if (state.viewMode === 'tiles') {
      if (!state.visibleSchools.length) {
        empty.hidden = false;
        empty.textContent = 'No schools are currently visible on the map.';
        return;
      }

      if (state.visibleSchools.length > MAX_VISIBLE_TILES) {
        empty.hidden = false;
        empty.textContent = 'Showing the first ' + formatCount(MAX_VISIBLE_TILES) + ' schools visible on the map.';
        return;
      }

      empty.hidden = true;
      empty.textContent = '';
      return;
    }

    const sectionSchools = getSectionSchools();
    if (!state.visibleSchools.length) {
      empty.hidden = false;
      empty.textContent = 'No schools are currently visible on the map.';
      return;
    }
    if (!sectionSchools.length) {
      const labels = {
        glance: 'No visible schools are available for this view.',
        dayFees: 'No visible schools currently show annual day fees.',
        boardingFees: 'No visible schools currently show annual boarding fees.',
        alevel: 'No visible schools currently show A-level data.'
      };
      empty.hidden = false;
      empty.textContent = labels[state.tableSection] || labels.glance;
      return;
    }
    empty.hidden = true;
    empty.textContent = '';
  }

  function syncViewControls() {
    document.querySelectorAll('[data-result-view]').forEach(function (button) {
      const view = button.getAttribute('data-result-view') || 'tiles';
      const active = view === 'tiles'
        ? state.viewMode === 'tiles'
        : (state.viewMode === 'table' && state.tableSection === view);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const sortSelect = document.getElementById('homepage-school-sort');
    if (sortSelect) sortSelect.value = state.sortMode;

    const cards = document.getElementById('homepage-visible-school-grid');
    const tableWrap = document.getElementById('homepage-school-table-wrap');
    const tableControls = document.getElementById('homepage-table-controls');
    if (cards) cards.hidden = state.viewMode !== 'tiles';
    if (tableWrap) tableWrap.hidden = state.viewMode !== 'table';
    if (tableControls) tableControls.hidden = state.viewMode !== 'table';
  }

  function renderResultsOnly() {
    syncViewControls();
    updateResultsSummary();
    if (state.viewMode === 'tiles') {
      renderSchoolCards();
    } else {
      renderTable();
    }
    updateEmptyState();
  }

  function scheduleApplyFilters(delayMs) {
    window.clearTimeout(state.debouncedApplyTimer);
    state.debouncedApplyTimer = window.setTimeout(function () {
      applyFilters();
    }, delayMs);
  }

  async function applyFilters() {
    const filters = readFilters();
    const requestId = ++state.activeRequestId;
    const searchKey = normalizeSearchQuery(filters.locationQuery);
    state.currentFilters = filters;
    updateError('');

    let resolvedLocation = null;
    if (searchKey) {
      if (state.resolvedLocation && state.resolvedLocation.key === searchKey) {
        resolvedLocation = state.resolvedLocation;
      } else if (state.mapFocusLocation && state.mapFocusLocation.key === searchKey) {
        resolvedLocation = state.mapFocusLocation;
      } else {
        resolvedLocation = await resolveSearchLocation(filters.locationQuery);
        if (requestId !== state.activeRequestId) return;
        if (!resolvedLocation) updateError('We could not find that UK location, so the other filters have still been applied.');
      }
    }

    if (requestId !== state.activeRequestId) return;

    const useCenterOnlyMap = Boolean(
      resolvedLocation && state.initialMapFocus && state.initialMapFocus.key === searchKey
    );

    state.mapFocusLocation = useCenterOnlyMap && resolvedLocation ? {
      key: searchKey,
      lat: resolvedLocation.lat,
      lng: resolvedLocation.lng,
      label: resolvedLocation.label,
      zoom: state.initialMapFocus.zoom
    } : null;

    state.resolvedLocation = !useCenterOnlyMap && resolvedLocation ? {
      key: searchKey,
      lat: resolvedLocation.lat,
      lng: resolvedLocation.lng,
      label: resolvedLocation.label
    } : null;

    state.tablePage = 0;
    state.filteredSchools = filterSchools(filters, state.resolvedLocation);
    state.visibleSchools = state.filteredSchools.slice();
    renderResultsOnly();
    redrawMap(state.filteredSchools, filters, state.resolvedLocation, state.mapFocusLocation);
  }

  function bindFilterForm() {
    const form = getFilterForm();
    const resetButton = document.getElementById('homepage-school-filter-reset');
    if (!form) return;

    const locationInput = form.querySelector('#school-filter-location');
    const radiusInput = form.querySelector('#school-filter-radius');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      closeFilterDropdowns();
      applyFilters();
    });

    form.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.addEventListener('change', function () {
        refreshFilterDropdownLabels();
        applyFilters();
      });
    });

    if (locationInput) {
      locationInput.addEventListener('input', function () {
        state.initialMapFocus = null;
        scheduleApplyFilters(350);
      });
    }

    if (radiusInput) {
      radiusInput.addEventListener('input', function () {
        state.initialMapFocus = null;
        scheduleApplyFilters(250);
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        state.resolvedLocation = null;
        state.mapFocusLocation = null;
        state.initialMapFocus = null;
        state.hiddenTableSchoolIds.clear();
        state.tablePage = 0;
        closeFilterDropdowns();
        refreshFilterDropdownLabels();
        updateError('');
        applyFilters();
      });
    }
  }


  function applyInitialQueryParams() {
    const form = getFilterForm();
    if (!form || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search || '');
    const locationValue = params.get('location');
    const radiusValue = params.get('radius');
    const mapMode = params.get('map');
    const zoomValue = parsePositiveNumber(params.get('zoom'), 14);
    const locationInput = form.querySelector('#school-filter-location');
    const radiusInput = form.querySelector('#school-filter-radius');

    if (locationInput && locationValue) {
      locationInput.value = locationValue;
    }

    if (radiusInput && radiusValue) {
      const parsedRadius = parsePositiveNumber(radiusValue, DEFAULT_RADIUS_MILES);
      radiusInput.value = String(parsedRadius);
    }

    if (locationValue && mapMode === 'centered') {
      state.initialMapFocus = {
        key: normalizeSearchQuery(locationValue),
        zoom: zoomValue
      };
    }
  }

  function bindResultViewControls() {
    document.querySelectorAll('[data-result-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        const nextView = button.getAttribute('data-result-view') || 'tiles';
        state.viewMode = nextView === 'tiles' ? 'tiles' : 'table';
        if (nextView !== 'tiles') state.tableSection = nextView;
        state.tablePage = 0;
        renderResultsOnly();
      });
    });

    const sortSelect = document.getElementById('homepage-school-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sortMode = sortSelect.value || 'az';
        state.hiddenTableSchoolIds.clear();
        state.tablePage = 0;
        applyFilters();
      });
    }

    const prevButton = document.getElementById('homepage-table-prev');
    const nextButton = document.getElementById('homepage-table-next');
    const showAllButton = document.getElementById('homepage-table-show-all');

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        state.tablePage = Math.max(0, state.tablePage - 1);
        renderResultsOnly();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        state.tablePage += 1;
        renderResultsOnly();
      });
    }

    if (showAllButton) {
      showAllButton.addEventListener('click', function () {
        state.hiddenTableSchoolIds.clear();
        state.tablePage = 0;
        renderResultsOnly();
      });
    }

    window.addEventListener('resize', function () {
      if (state.viewMode === 'table') renderResultsOnly();
    });
  }

  function bindFilterPanelToggle() {
    const form = getFilterForm();
    const toggleButton = document.querySelector('[data-filter-toggle]');
    const collapsible = document.querySelector('[data-filter-collapsible]');
    if (!form || !toggleButton || !collapsible) return;

    let lastIsMobile = null;

    function setCollapsed(collapsed) {
      form.classList.toggle('is-collapsed', collapsed);
      collapsible.hidden = collapsed;
      toggleButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggleButton.textContent = collapsed ? 'Apply filters' : 'Hide filters';
    }

    function syncForViewport() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile !== lastIsMobile) {
        setCollapsed(isMobile);
        lastIsMobile = isMobile;
      } else if (!isMobile) {
        setCollapsed(false);
      }
    }

    toggleButton.addEventListener('click', function () {
      setCollapsed(!form.classList.contains('is-collapsed'));
    });

    syncForViewport();
    window.addEventListener('resize', syncForViewport);
  }

  function bindLocationPanelToggle() {
    const locationsPanel = document.querySelector('.finder-locations');
    const toggleButton = document.querySelector('[data-location-toggle]');
    if (!locationsPanel || !toggleButton) return;

    let lastIsMobile = null;

    function setCollapsed(collapsed) {
      locationsPanel.classList.toggle('is-collapsed', collapsed);
      toggleButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggleButton.textContent = collapsed ? 'Show locations' : 'Hide locations';
    }

    function syncCollapseForViewport() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      if (isMobile !== lastIsMobile) {
        setCollapsed(isMobile);
        lastIsMobile = isMobile;
      } else if (!isMobile) {
        setCollapsed(false);
      }
    }

    toggleButton.addEventListener('click', function () {
      setCollapsed(!locationsPanel.classList.contains('is-collapsed'));
    });

    syncCollapseForViewport();
    window.addEventListener('resize', syncCollapseForViewport);
  }

  function bindResponsiveFinderLayout() {
    const filterBar = document.querySelector('.home-school-filter-bar');
    const finderLeftInner = document.querySelector('.finder-left-inner');
    const mapPanel = finderLeftInner ? finderLeftInner.querySelector('.finder-map-panel') : null;
    if (!filterBar || !finderLeftInner || !mapPanel) return;

    const originalParent = filterBar.parentElement;
    const originalNextSibling = filterBar.nextElementSibling;

    function syncLayout() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;

      if (isMobile) {
        if (filterBar.parentElement !== finderLeftInner) {
          finderLeftInner.insertBefore(filterBar, mapPanel.nextSibling);
        }
        filterBar.classList.add('finder-filter-panel');
      } else {
        if (originalParent && filterBar.parentElement !== originalParent) {
          if (originalNextSibling && originalNextSibling.parentElement === originalParent) {
            originalParent.insertBefore(filterBar, originalNextSibling);
          } else {
            originalParent.appendChild(filterBar);
          }
        }
        filterBar.classList.remove('finder-filter-panel');
      }

      if (state.map) {
        window.requestAnimationFrame(function () {
          try { state.map.invalidateSize({ pan: false, animate: false }); } catch (error) {}
        });
      }
    }

    syncLayout();
    window.addEventListener('resize', syncLayout);
  }

  function bootHomepageMap(attempt) {
    if (ensureMap()) return;
    if (attempt >= 50) return;
    window.setTimeout(function () { bootHomepageMap(attempt + 1); }, 100);
  }

  function initHomepage() {
    state.schools = getSchoolData();
    bindResponsiveFinderLayout();
    bindLocationPanelToggle();
    bindGuideLocationSearch();
    bindFilterDropdowns();
    bindFilterForm();
    bindFilterPanelToggle();
    bindResultViewControls();
    applyInitialQueryParams();
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
