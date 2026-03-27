(function () {
  const DEFAULT_RADIUS_MILES = 10;
  const MAX_VISIBLE_TILES = 60;
  const UK_DEFAULT_CENTER = [54.25, -2.6];
  const UK_DEFAULT_ZOOM = 6;
  const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
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
    tablePage: 0,
    hiddenTableSchoolIds: new Set(),
    debouncedApplyTimer: null,
    mapReady: false
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
          hasDayFees: Boolean(item.hasDayFees),
          hasBoardingFees: Boolean(item.hasBoardingFees),
          dayFeesByYear: item.dayFeesByYear || {},
          boardingFeesByYear: item.boardingFeesByYear || {},
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

    return state.schools
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
      })
      .sort(function (a, b) {
        if (resolvedLocation) {
          const delta = (a.distanceMiles || 0) - (b.distanceMiles || 0);
          if (delta !== 0) return delta;
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
    const wrapperStart = point.href
      ? '<a class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + '" href="' + escapeHtml(point.href) + '">'
      : '<article class="homepage-school-card homepage-school-card--' + escapeHtml(point.type) + ' homepage-school-card--static">';
    const wrapperEnd = point.href ? '</a>' : '</article>';

    return wrapperStart +
      '<div class="homepage-school-card__body">' +
      (eyebrow ? '<p class="homepage-school-card__eyebrow">' + eyebrow + '</p>' : '') +
      '<h3 class="homepage-school-card__title">' + escapeHtml(point.name) + '</h3>' +
      '<p class="homepage-school-card__meta">' + escapeHtml(point.genderLabel + ' · ' + point.boardingLabel + ' · Ages ' + point.ageLabel) + '</p>' +
      (extras.length ? '<p class="homepage-school-card__meta homepage-school-card__meta--secondary">' + escapeHtml(extras.join(' · ')) + '</p>' : '') +
      (!point.href ? '<p class="homepage-school-card__status">Profile coming soon</p>' : '') +
      '</div>' + wrapperEnd;
  }

  function updateError(message) {
    const errorTarget = getErrorTarget();
    if (!errorTarget) return;
    errorTarget.hidden = !message;
    errorTarget.textContent = message || '';
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
      if (!emptyState.hidden) emptyState.textContent = 'No schools match these filters.';
      if (resolvedLocation && results.length === 0) {
        emptyState.hidden = false;
        emptyState.textContent = 'No schools were found within ' + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
      }
    }

    if (boundsLayers.length) {
      map.fitBounds(window.L.featureGroup(boundsLayers).getBounds(), { padding: [28, 28], maxZoom: 11, animate: false });
    } else {
      map.setView(UK_DEFAULT_CENTER, UK_DEFAULT_ZOOM, { animate: false });
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

    if (state.tableSection === 'dayFees') {
      return base.filter(function (school) { return school.hasDayFees; });
    }
    if (state.tableSection === 'boardingFees') {
      return base.filter(function (school) { return school.hasBoardingFees; });
    }
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
    document.querySelectorAll('[data-view-mode]').forEach(function (button) {
      const active = button.getAttribute('data-view-mode') === state.viewMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-table-section]').forEach(function (button) {
      const active = button.getAttribute('data-table-section') === state.tableSection;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

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
      } else {
        resolvedLocation = await resolveSearchLocation(filters.locationQuery);
        if (requestId !== state.activeRequestId) return;
        if (!resolvedLocation) updateError('We could not find that UK location, so the other filters have still been applied.');
      }
    }

    if (requestId !== state.activeRequestId) return;

    state.resolvedLocation = resolvedLocation ? {
      key: searchKey,
      lat: resolvedLocation.lat,
      lng: resolvedLocation.lng,
      label: resolvedLocation.label
    } : null;

    state.tablePage = 0;
    state.filteredSchools = filterSchools(filters, state.resolvedLocation);
    state.visibleSchools = state.filteredSchools.slice();
    renderResultsOnly();
    redrawMap(state.filteredSchools, filters, state.resolvedLocation);
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
        closeFilterDropdowns();
        applyFilters();
      });
    });

    if (locationInput) {
      locationInput.addEventListener('input', function () {
        scheduleApplyFilters(350);
      });
    }

    if (radiusInput) {
      radiusInput.addEventListener('input', function () {
        scheduleApplyFilters(250);
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        state.resolvedLocation = null;
        state.hiddenTableSchoolIds.clear();
        state.tablePage = 0;
        closeFilterDropdowns();
        refreshFilterDropdownLabels();
        updateError('');
        applyFilters();
      });
    }
  }

  function bindResultViewControls() {
    document.querySelectorAll('[data-view-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.viewMode = button.getAttribute('data-view-mode') || 'tiles';
        renderResultsOnly();
      });
    });

    document.querySelectorAll('[data-table-section]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.tableSection = button.getAttribute('data-table-section') || 'glance';
        state.tablePage = 0;
        renderResultsOnly();
      });
    });

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

  function bootHomepageMap(attempt) {
    if (ensureMap()) return;
    if (attempt >= 50) return;
    window.setTimeout(function () { bootHomepageMap(attempt + 1); }, 100);
  }

  function initHomepage() {
    state.schools = getSchoolData();
    bindGuideLocationSearch();
    bindFilterDropdowns();
    bindFilterForm();
    bindResultViewControls();
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
