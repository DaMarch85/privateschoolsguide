(function () {
  const DEFAULT_RADIUS_MILES = 5;
  const ALL_RADIUS_MILES = 10000;
  const SEARCH_RESULTS_STORAGE_KEY = 'psg-search-results-v1';
  const MAX_VISIBLE_TILES = 60;
  const UK_DEFAULT_CENTER = [54.25, -2.6];
  const UK_DEFAULT_ZOOM = 6;
  const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
  const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const MIN_SIGNIFICANT_AGE_RANGE_OVERLAP_YEARS = 2;
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
    mapFocusLocation: null,
    restoredMapView: null,
    rangeBounds: {
      fee: {
        day: { min: 1000, max: 1000, step: 1 },
        boarding: { min: 1000, max: 1000, step: 1 }
      },
      alevel: { min: 0, max: 100, step: 1 }
    },
    feeMode: 'day',
    shortlistPage: false,
    hasMapViewInitialized: false
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


  function parseRadiusMilesValue(value, fallback) {
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    if (raw === 'all') return ALL_RADIUS_MILES;
    return parsePositiveNumber(raw, fallback);
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function readSearchResultsContext() {
    const storage = getSessionStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(SEARCH_RESULTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSearchResultsContext(payload) {
    const storage = getSessionStorage();
    if (!storage) return null;
    try {
      storage.setItem(SEARCH_RESULTS_STORAGE_KEY, JSON.stringify(payload));
      return payload;
    } catch (error) {
      return null;
    }
  }

  function clearSearchResultsContext() {
    const storage = getSessionStorage();
    if (!storage) return;
    try {
      storage.removeItem(SEARCH_RESULTS_STORAGE_KEY);
    } catch (error) {
      // ignore storage failures
    }
  }

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function isAllRadius(value) {
    return Number(value) >= ALL_RADIUS_MILES;
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


  function getRadiusButtons() {
    return Array.from(document.querySelectorAll('[data-radius-option]'));
  }

  function updateRadiusButtons() {
    const form = getFilterForm();
    if (!form) return;
    const radiusInput = form.querySelector('#school-filter-radius');
    const currentRadius = parseRadiusMilesValue(radiusInput ? radiusInput.value : DEFAULT_RADIUS_MILES, DEFAULT_RADIUS_MILES);
    getRadiusButtons().forEach(function (button) {
      const rawValue = String(button.getAttribute('data-value') || '').trim().toLowerCase();
      const active = rawValue === 'all'
        ? currentRadius >= ALL_RADIUS_MILES
        : parsePositiveNumber(rawValue, DEFAULT_RADIUS_MILES) === currentRadius;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function getSelectedAgeRanges() {
    const form = getFilterForm();
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[name="ageRange"]:checked')).map(function (input) { return input.value; });
  }

  function getSelectedBoardingFilters() {
    const form = getFilterForm();
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[name="boarding"]:checked')).map(function (input) { return input.value; });
  }

  function updateConditionalFilterPanels() {
    const form = getFilterForm();
    if (!form) return;

    const alevelPanel = form.querySelector('[data-conditional-alevel]');
    const ageRanges = getSelectedAgeRanges();
    const showAlevel = ageRanges.includes('senior');
    if (alevelPanel) {
      alevelPanel.hidden = !showAlevel;
      alevelPanel.classList.toggle('is-hidden', !showAlevel);
    }

    const boardingSelections = getSelectedBoardingFilters();
    const showDayOnly = boardingSelections.length === 1 && boardingSelections[0] === 'dayProvision';
    const showBoardingOnly = boardingSelections.length === 1 && boardingSelections[0] === 'boardingProvision';
    const dayPanel = form.querySelector('[data-fee-panel="day"]');
    const boardingPanel = form.querySelector('[data-fee-panel="boarding"]');
    if (dayPanel) {
      dayPanel.hidden = showBoardingOnly;
      dayPanel.classList.toggle('is-hidden', showBoardingOnly);
    }
    if (boardingPanel) {
      boardingPanel.hidden = showDayOnly;
      boardingPanel.classList.toggle('is-hidden', showDayOnly);
    }
  }

  function getFirstNavigableSchool() {
    return state.filteredSchools.find(function (school) {
      return school && school.href;
    }) || null;
  }

  function saveSearchResultsContext() {
    const items = state.filteredSchools
      .filter(function (school) { return school && school.href && school.slug; })
      .map(function (school) {
        return {
          id: school.id,
          slug: school.slug,
          name: school.name,
          href: school.href,
          path: school.href,
          lat: school.lat,
          lng: school.lng,
          latitude: school.lat,
          longitude: school.lng,
          note: school.note || [school.displayLocation, school.genderLabel, school.boardingLabel, school.ageLabel ? 'Ages ' + school.ageLabel : ''].filter(Boolean).join(' · ')
        };
      });

    if (!items.length) {
      clearSearchResultsContext();
      return;
    }

    writeSearchResultsContext({
      count: items.length,
      updatedAt: Date.now(),
      items: items,
      locationLabel: state.resolvedLocation && state.resolvedLocation.label ? state.resolvedLocation.label : '',
      filters: state.currentFilters || null
    });
  }

  function updateMobileActionButtons() {
    const filteredCount = state.filteredSchools.length;
    const firstSchool = getFirstNavigableSchool();
    document.querySelectorAll('[data-open-first-result]').forEach(function (button) {
      const disabled = !firstSchool;
      button.disabled = disabled;
      button.textContent = disabled ? 'No schools found' : 'Show ' + formatCount(filteredCount) + ' ' + pluralize(filteredCount, 'school') ;
    });
    document.querySelectorAll('[data-view-full-results]').forEach(function (button) {
      const disabled = !filteredCount;
      button.disabled = disabled;
      button.textContent = disabled ? 'View full list' : 'View full list (' + formatCount(filteredCount) + ')';
    });
  }

  function openMobileResultsPanel() {
    document.body.classList.add('mobile-results-open');
    const panel = document.getElementById('homepage-results-panel');
    if (panel && typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function closeMobileResultsPanel() {
    document.body.classList.remove('mobile-results-open');
    const form = getFilterForm();
    if (form && typeof form.scrollIntoView === 'function' && isMobileViewport()) {
      form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
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
          ageMin: Number.isFinite(Number(item.ageMin)) ? Number(item.ageMin) : null,
          ageMax: Number.isFinite(Number(item.ageMax)) ? Number(item.ageMax) : null,
          hasSixthForm: Boolean(item.hasSixthForm),
          hasNursery: Boolean(item.hasNursery),
          hasDayProvision: Boolean(item.hasDayProvision),
          hasBoardingProvision: Boolean(item.hasBoardingProvision),
          hasBursaries: Boolean(item.hasBursaries),
          hasScholarships: Boolean(item.hasScholarships),
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

  function parseFiniteNumber(value, fallback) {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatCurrencyRangeValue(value) {
    return '£' + formatCount(Math.round(parseFiniteNumber(value, 0)));
  }

  function formatPercentRangeValue(value) {
    return Math.round(parseFiniteNumber(value, 0)) + '%';
  }

  function schoolSupportsAgeRange(school, bandMin, bandMax) {
    const ageMin = Number(school && school.ageMin);
    const ageMax = Number(school && school.ageMax);
    if (!Number.isFinite(ageMin) && !Number.isFinite(ageMax)) return false;
    const safeMin = Number.isFinite(ageMin) ? ageMin : ageMax;
    const safeMax = Number.isFinite(ageMax) ? ageMax : ageMin;
    if (!Number.isFinite(safeMin) || !Number.isFinite(safeMax)) return false;

    const overlapStart = Math.max(safeMin, bandMin);
    const overlapEnd = Math.min(safeMax, bandMax);
    if (overlapEnd < overlapStart) return false;

    const overlapYears = (overlapEnd - overlapStart) + 1;
    return overlapYears >= MIN_SIGNIFICANT_AGE_RANGE_OVERLAP_YEARS;
  }

  function getAlevelAStarAValue(school) {
    const value = school && school.alevel ? Number(school.alevel.pctAStarA) : NaN;
    return Number.isFinite(value) && value >= 0 ? value * 100 : null;
  }

  function buildFeeBounds(values) {
    const valid = values.filter(function (value) { return Number.isFinite(Number(value)) && Number(value) > 0; }).map(Number);
    if (!valid.length) return { min: 1000, max: 1000, step: 1 };
    const maxValue = Math.max.apply(null, valid);
    const minimumFloor = 1000;
    const max = Math.max(minimumFloor, Math.ceil(maxValue));
    return { min: minimumFloor, max: max, step: 1 };
  }

  function getFeeBounds(type) {
    const feeType = type === 'boarding' ? 'boarding' : 'day';
    return (state.rangeBounds.fee && state.rangeBounds.fee[feeType]) || { min: 1000, max: 1000, step: 1 };
  }

  function clampRangePair(low, high, bounds) {
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, minBound);
    let nextLow = parseFiniteNumber(low, minBound);
    let nextHigh = parseFiniteNumber(high, maxBound);
    nextLow = Math.max(minBound, Math.min(nextLow, maxBound));
    nextHigh = Math.max(minBound, Math.min(nextHigh, maxBound));
    if (nextLow > nextHigh) {
      const middle = nextLow;
      nextLow = nextHigh;
      nextHigh = middle;
    }
    return [nextLow, nextHigh];
  }

  function setRangeTrackBackground(track, bounds, low, high) {
    if (!track) return;
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, 100);
    const span = Math.max(1, maxBound - minBound);
    const safe = clampRangePair(low, high, bounds);
    const start = ((safe[0] - minBound) / span) * 100;
    const end = ((safe[1] - minBound) / span) * 100;
    track.style.background = 'linear-gradient(90deg, rgba(41,36,33,.12) 0%, rgba(41,36,33,.12) ' + start + '%, rgba(179,91,46,.92) ' + start + '%, rgba(179,91,46,.92) ' + end + '%, rgba(41,36,33,.12) ' + end + '%, rgba(41,36,33,.12) 100%)';
  }

  function getShortlistIds() {
    if (!window.PSGShortlist || typeof window.PSGShortlist.getAll !== 'function') return [];
    return window.PSGShortlist.getAll().map(String);
  }

  function buildHistogramCounts(values, bounds, binCount) {
    const safeValues = Array.isArray(values)
      ? values.map(function (value) { return Number(value); }).filter(function (value) { return Number.isFinite(value); })
      : [];
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, minBound + 1);
    const safeMax = maxBound > minBound ? maxBound : minBound + 1;
    const bins = Math.max(8, Math.min(24, Number(binCount) || 16));
    const span = safeMax - minBound;
    const counts = new Array(bins).fill(0);

    safeValues.forEach(function (value) {
      const clamped = Math.max(minBound, Math.min(value, safeMax));
      const position = span <= 0 ? 0 : ((clamped - minBound) / span) * bins;
      const index = Math.max(0, Math.min(bins - 1, Math.floor(position === bins ? bins - 1 : position)));
      counts[index] += 1;
    });

    return {
      counts: counts,
      maxCount: Math.max.apply(null, counts.concat([1])),
      minBound: minBound,
      maxBound: safeMax,
      bins: bins,
      valueCount: safeValues.length
    };
  }

  function renderHistogram(container, histogram, selectedLow, selectedHigh) {
    if (!container) return;
    const counts = histogram && Array.isArray(histogram.counts) ? histogram.counts : [];
    const maxCount = histogram && Number(histogram.maxCount) > 0 ? Number(histogram.maxCount) : 1;
    const minBound = histogram ? histogram.minBound : 0;
    const maxBound = histogram ? histogram.maxBound : 1;
    const span = Math.max(1, maxBound - minBound);
    const safeLow = parseFiniteNumber(selectedLow, minBound);
    const safeHigh = parseFiniteNumber(selectedHigh, maxBound);
    const binSize = counts.length ? span / counts.length : span;

    container.innerHTML = counts.map(function (count, index) {
      const height = count > 0 ? Math.max(10, Math.round((count / maxCount) * 100)) : 8;
      const start = minBound + (index * binSize);
      const end = index === counts.length - 1 ? maxBound : start + binSize;
      const isSelected = end > safeLow && start <= safeHigh;
      return '<span class="school-range-filter__histogram-bar' +
        (isSelected ? ' is-selected' : '') +
        (count === 0 ? ' is-empty' : '') +
        '" style="height:' + height + '%" aria-hidden="true"></span>';
    }).join('');
  }

  function refreshRangeHistograms(filters) {
    const form = getFilterForm();
    if (!form) return;
    const activeFilters = filters || readFilters();

    const dayContainer = form.querySelector('[data-day-fee-histogram]');
    const dayCount = form.querySelector('[data-day-fee-histogram-count]');
    if (dayContainer) {
      const dayFilters = Object.assign({}, activeFilters, { dayFeeActive: false });
      const daySchools = getSchoolsWithinCurrentMapBounds(filterSchools(dayFilters, state.resolvedLocation));
      const dayBounds = getFeeBounds('day');
      const dayValues = daySchools.map(function (school) {
        return normalizeFeeValue(school.dayFeeAverage);
      }).filter(function (value) { return value !== null; });
      const dayHistogram = buildHistogramCounts(dayValues, dayBounds, 16);
      renderHistogram(dayContainer, dayHistogram, activeFilters.dayFeeMin, activeFilters.dayFeeMax);
      if (dayCount) {
        dayCount.textContent = dayHistogram.valueCount
          ? formatCount(dayHistogram.valueCount) + ' schools with published day fees'
          : 'No published day fees in this view';
      }
    }

    const boardingContainer = form.querySelector('[data-boarding-fee-histogram]');
    const boardingCount = form.querySelector('[data-boarding-fee-histogram-count]');
    if (boardingContainer) {
      const boardingFilters = Object.assign({}, activeFilters, { boardingFeeActive: false });
      const boardingSchools = getSchoolsWithinCurrentMapBounds(filterSchools(boardingFilters, state.resolvedLocation));
      const boardingBounds = getFeeBounds('boarding');
      const boardingValues = boardingSchools.map(function (school) {
        return normalizeFeeValue(school.boardingFeeAverage);
      }).filter(function (value) { return value !== null; });
      const boardingHistogram = buildHistogramCounts(boardingValues, boardingBounds, 16);
      renderHistogram(boardingContainer, boardingHistogram, activeFilters.boardingFeeMin, activeFilters.boardingFeeMax);
      if (boardingCount) {
        boardingCount.textContent = boardingHistogram.valueCount
          ? formatCount(boardingHistogram.valueCount) + ' schools with published boarding fees'
          : 'No published boarding fees in this view';
      }
    }

    const alevelContainer = form.querySelector('[data-alevel-histogram]');
    const alevelCount = form.querySelector('[data-alevel-histogram-count]');
    if (alevelContainer) {
      const alevelFilters = Object.assign({}, activeFilters, { alevelActive: false });
      const alevelSchools = getSchoolsWithinCurrentMapBounds(filterSchools(alevelFilters, state.resolvedLocation));
      const alevelBounds = state.rangeBounds.alevel || { min: 0, max: 100, step: 1 };
      const alevelValues = alevelSchools.map(getAlevelAStarAValue).filter(function (value) { return value !== null; });
      const alevelHistogram = buildHistogramCounts(alevelValues, alevelBounds, 16);
      renderHistogram(alevelContainer, alevelHistogram, activeFilters.alevelMin, activeFilters.alevelMax);
      if (alevelCount) {
        alevelCount.textContent = alevelHistogram.valueCount
          ? formatCount(alevelHistogram.valueCount) + ' schools with published A*–A results'
          : 'No published A-level results in this view';
      }
    }
  }

  function saveHomepageSearchState(filters) {
    if (state.shortlistPage || window.location.pathname !== '/' || !window.PSGSearchState || typeof window.PSGSearchState.save !== 'function') return;
    const activeFilters = filters || readFilters();
    const mapCenter = state.map && typeof state.map.getCenter === 'function' ? state.map.getCenter() : null;
    const mapZoom = state.map && typeof state.map.getZoom === 'function' ? state.map.getZoom() : null;

    window.PSGSearchState.save({
      mode: 'form',
      restoreUrl: '/?restoreSearch=1',
      locationLabel: (state.resolvedLocation && state.resolvedLocation.label) || activeFilters.locationQuery || '',
      locationQuery: activeFilters.locationQuery || '',
      resolvedLocationLabel: (state.resolvedLocation && state.resolvedLocation.label) || '',
      radiusMiles: activeFilters.radiusMiles,
      genders: activeFilters.genders || [],
      ageRanges: activeFilters.ageRanges || [],
      boarding: activeFilters.boarding || [],
      religions: activeFilters.religions || [],
      sixthFormOnly: Boolean(activeFilters.sixthFormOnly),
      nurseryOnly: Boolean(activeFilters.nurseryOnly),
      bursariesOnly: Boolean(activeFilters.bursariesOnly),
      scholarshipsOnly: Boolean(activeFilters.scholarshipsOnly),
      feeMode: 'day',
      feeMin: activeFilters.dayFeeMin,
      feeMax: activeFilters.dayFeeMax,
      dayFeeMin: activeFilters.dayFeeMin,
      dayFeeMax: activeFilters.dayFeeMax,
      boardingFeeMin: activeFilters.boardingFeeMin,
      boardingFeeMax: activeFilters.boardingFeeMax,
      alevelMin: activeFilters.alevelMin,
      alevelMax: activeFilters.alevelMax,
      sortMode: state.sortMode || 'dayFeesDesc',
      centeredMap: Boolean(state.mapFocusLocation && activeFilters.locationQuery),
      centeredMapZoom: state.mapFocusLocation && state.mapFocusLocation.zoom ? state.mapFocusLocation.zoom : null,
      mapCenterLat: mapCenter && Number.isFinite(mapCenter.lat) ? mapCenter.lat : null,
      mapCenterLng: mapCenter && Number.isFinite(mapCenter.lng) ? mapCenter.lng : null,
      mapZoom: Number.isFinite(mapZoom) ? mapZoom : null
    });
  }

  function applyRestoredSearchStateFromStorage() {
    if (state.shortlistPage || window.location.pathname !== '/' || !window.PSGSearchState || typeof window.PSGSearchState.get !== 'function') return;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('restoreSearch') !== '1') return;

    const savedState = window.PSGSearchState.get();
    const form = getFilterForm();
    if (!savedState || savedState.mode !== 'form' || !form) return;

    const locationInput = form.querySelector('#school-filter-location');
    const radiusInput = form.querySelector('#school-filter-radius');
    if (locationInput) locationInput.value = savedState.locationQuery || '';
    if (radiusInput) {
      const restoredRadius = Number(savedState.radiusMiles);
      radiusInput.value = isAllRadius(restoredRadius)
        ? 'all'
        : String(restoredRadius || DEFAULT_RADIUS_MILES);
    }

    form.querySelectorAll('input[name="gender"]').forEach(function (input) {
      input.checked = (savedState.genders || []).includes(input.value);
    });
    form.querySelectorAll('input[name="ageRange"]').forEach(function (input) {
      input.checked = (savedState.ageRanges || []).includes(input.value);
    });
    form.querySelectorAll('input[name="boarding"]').forEach(function (input) {
      input.checked = (savedState.boarding || []).includes(input.value);
    });
    form.querySelectorAll('input[name="religion"]').forEach(function (input) {
      input.checked = (savedState.religions || []).includes(input.value);
    });

    const sixthFormInput = form.querySelector('#school-filter-sixth-form');
    const nurseryInput = form.querySelector('#school-filter-nursery');
    const bursariesInput = form.querySelector('#school-filter-bursaries');
    const scholarshipsInput = form.querySelector('#school-filter-scholarships');
    if (sixthFormInput) sixthFormInput.checked = Boolean(savedState.sixthFormOnly);
    if (nurseryInput) nurseryInput.checked = Boolean(savedState.nurseryOnly);
    if (bursariesInput) bursariesInput.checked = Boolean(savedState.bursariesOnly);
    if (scholarshipsInput) scholarshipsInput.checked = Boolean(savedState.scholarshipsOnly);

    const dayFeeMinInput = form.querySelector('[data-day-fee-min]');
    const dayFeeMaxInput = form.querySelector('[data-day-fee-max]');
    if (dayFeeMinInput && savedState.dayFeeMin !== null) dayFeeMinInput.value = String(savedState.dayFeeMin);
    if (dayFeeMaxInput && savedState.dayFeeMax !== null) dayFeeMaxInput.value = String(savedState.dayFeeMax);

    const boardingFeeMinInput = form.querySelector('[data-boarding-fee-min]');
    const boardingFeeMaxInput = form.querySelector('[data-boarding-fee-max]');
    if (boardingFeeMinInput && savedState.boardingFeeMin !== null) boardingFeeMinInput.value = String(savedState.boardingFeeMin);
    if (boardingFeeMaxInput && savedState.boardingFeeMax !== null) boardingFeeMaxInput.value = String(savedState.boardingFeeMax);

    syncDayFeeRangeUi(false);
    syncBoardingFeeRangeUi(false);

    const alevelMinInput = form.querySelector('[data-alevel-min]');
    const alevelMaxInput = form.querySelector('[data-alevel-max]');
    if (alevelMinInput && savedState.alevelMin !== null) alevelMinInput.value = String(savedState.alevelMin);
    if (alevelMaxInput && savedState.alevelMax !== null) alevelMaxInput.value = String(savedState.alevelMax);
    syncAlevelRangeUi(false);

    state.sortMode = savedState.sortMode || 'dayFeesDesc';
    const sortSelect = document.getElementById('homepage-school-sort');
    if (sortSelect) sortSelect.value = state.sortMode;

    refreshFilterDropdownLabels();
    updateRadiusButtons();
    updateConditionalFilterPanels();
    state.initialMapFocus = savedState.centeredMap && savedState.locationQuery ? {
      key: normalizeSearchQuery(savedState.locationQuery),
      zoom: savedState.centeredMapZoom || 14
    } : null;

    const restoredLat = Number(savedState.mapCenterLat);
    const restoredLng = Number(savedState.mapCenterLng);
    const restoredZoom = Number(savedState.mapZoom);
    state.restoredMapView = (Number.isFinite(restoredLat) && Number.isFinite(restoredLng))
      ? { lat: restoredLat, lng: restoredLng, zoom: Number.isFinite(restoredZoom) ? restoredZoom : null }
      : null;

    if (window.history && typeof window.history.replaceState === 'function') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('restoreSearch');
      const nextSearch = nextUrl.searchParams.toString();
      const nextPath = nextUrl.pathname + (nextSearch ? '?' + nextSearch : '') + nextUrl.hash;
      window.history.replaceState({}, '', nextPath);
    }
  }

  function syncRangeControl(config) {
    const form = getFilterForm();
    if (!form) return;

    const bounds = config.bounds;
    const minInput = form.querySelector(config.minSelector);
    const maxInput = form.querySelector(config.maxSelector);
    const minDisplay = form.querySelector(config.minDisplaySelector);
    const maxDisplay = form.querySelector(config.maxDisplaySelector);
    const track = form.querySelector(config.trackSelector);
    if (!minInput || !maxInput) return;

    minInput.min = String(bounds.min);
    minInput.max = String(bounds.max);
    minInput.step = String(bounds.step);
    maxInput.min = String(bounds.min);
    maxInput.max = String(bounds.max);
    maxInput.step = String(bounds.step);

    if (config.resetValues) {
      minInput.value = String(bounds.min);
      maxInput.value = String(bounds.max);
    }

    const pair = clampRangePair(minInput.value, maxInput.value, bounds);
    minInput.value = String(pair[0]);
    maxInput.value = String(pair[1]);

    if (minDisplay) minDisplay.textContent = config.formatValue(pair[0]);
    if (maxDisplay) maxDisplay.textContent = config.formatValue(pair[1]);
    setRangeTrackBackground(track, bounds, pair[0], pair[1]);
  }

  function syncDayFeeRangeUi(resetValues) {
    syncRangeControl({
      bounds: getFeeBounds('day'),
      minSelector: '[data-day-fee-min]',
      maxSelector: '[data-day-fee-max]',
      minDisplaySelector: '[data-day-fee-min-display]',
      maxDisplaySelector: '[data-day-fee-max-display]',
      trackSelector: '[data-day-fee-filter] .school-range-filter__slider-wrap',
      formatValue: formatCurrencyRangeValue,
      resetValues: Boolean(resetValues)
    });
    refreshRangeHistograms(readFilters());
  }

  function syncBoardingFeeRangeUi(resetValues) {
    syncRangeControl({
      bounds: getFeeBounds('boarding'),
      minSelector: '[data-boarding-fee-min]',
      maxSelector: '[data-boarding-fee-max]',
      minDisplaySelector: '[data-boarding-fee-min-display]',
      maxDisplaySelector: '[data-boarding-fee-max-display]',
      trackSelector: '[data-boarding-fee-filter] .school-range-filter__slider-wrap',
      formatValue: formatCurrencyRangeValue,
      resetValues: Boolean(resetValues)
    });
    refreshRangeHistograms(readFilters());
  }

  function syncAlevelRangeUi(resetValues) {
    syncRangeControl({
      bounds: state.rangeBounds.alevel || { min: 0, max: 100, step: 1 },
      minSelector: '[data-alevel-min]',
      maxSelector: '[data-alevel-max]',
      minDisplaySelector: '[data-alevel-min-display]',
      maxDisplaySelector: '[data-alevel-max-display]',
      trackSelector: '[data-alevel-filter] .school-range-filter__slider-wrap',
      formatValue: formatPercentRangeValue,
      resetValues: Boolean(resetValues)
    });
    refreshRangeHistograms(readFilters());
  }

  function initializeAdvancedFilterControls() {
    const dayValues = state.schools.map(function (school) { return school.dayFeeAverage; }).filter(function (value) { return value !== null; });
    const boardingValues = state.schools.map(function (school) { return school.boardingFeeAverage; }).filter(function (value) { return value !== null; });
    state.rangeBounds = {
      fee: {
        day: buildFeeBounds(dayValues),
        boarding: buildFeeBounds(boardingValues)
      },
      alevel: { min: 0, max: 100, step: 1 }
    };
    syncDayFeeRangeUi(true);
    syncBoardingFeeRangeUi(true);
    syncAlevelRangeUi(true);
  }

  function bindAdvancedFilterControls() {
    const form = getFilterForm();
    if (!form) return;

    [
      { selectors: ['[data-day-fee-min]', '[data-day-fee-max]'], sync: function () { syncDayFeeRangeUi(false); } },
      { selectors: ['[data-boarding-fee-min]', '[data-boarding-fee-max]'], sync: function () { syncBoardingFeeRangeUi(false); } },
      { selectors: ['[data-alevel-min]', '[data-alevel-max]'], sync: function () { syncAlevelRangeUi(false); } }
    ].forEach(function (group) {
      group.selectors.forEach(function (selector) {
        const input = form.querySelector(selector);
        if (!input) return;
        input.addEventListener('input', function () {
          group.sync();
          scheduleApplyFilters(60);
        });
        input.addEventListener('change', function () {
          group.sync();
          applyFilters();
        });
      });
    });
  }

  function bindHomeHeroPlayback() {
    const hero = document.querySelector('[data-home-hero]');
    if (!hero) return;
    const videos = Array.from(hero.querySelectorAll('[data-home-hero-video]'));
    if (!videos.length) return;

    function collapseHero() {
      if (hero.classList.contains('is-condensed')) return;
      const beforeHeight = hero.offsetHeight || 0;
      const heroTop = hero.getBoundingClientRect().top + window.scrollY;
      const scrolledPastHero = window.scrollY > heroTop + beforeHeight - 24;

      if (scrolledPastHero) hero.classList.add('is-condensing-instant');
      hero.classList.add('is-condensed');

      videos.forEach(function (video) {
        try {
          video.pause();
        } catch (error) {}
      });

      if (scrolledPastHero) {
        const afterHeight = hero.offsetHeight || 0;
        const delta = Math.max(0, beforeHeight - afterHeight);
        if (delta > 0) {
          window.scrollTo({ top: Math.max(0, window.scrollY - delta), left: window.scrollX, behavior: 'auto' });
        }
        window.requestAnimationFrame(function () {
          hero.classList.remove('is-condensing-instant');
        });
      }
    }

    videos.forEach(function (video) {
      try { video.loop = false; } catch (error) {}
      video.addEventListener('ended', collapseHero, { once: true });
    });
  }

  function readFilters() {
    const form = getFilterForm();
    const dayFeeBounds = getFeeBounds('day');
    const boardingFeeBounds = getFeeBounds('boarding');
    const alevelBounds = state.rangeBounds.alevel || { min: 0, max: 100, step: 1 };
    if (!form) {
      return {
        locationQuery: '',
        radiusMiles: DEFAULT_RADIUS_MILES,
        genders: [],
        ageRanges: [],
        boarding: [],
        religions: [],
        sixthFormOnly: false,
        nurseryOnly: false,
        bursariesOnly: false,
        scholarshipsOnly: false,
        dayFeeMin: dayFeeBounds.min,
        dayFeeMax: dayFeeBounds.max,
        dayFeeActive: false,
        boardingFeeMin: boardingFeeBounds.min,
        boardingFeeMax: boardingFeeBounds.max,
        boardingFeeActive: false,
        alevelMin: alevelBounds.min,
        alevelMax: alevelBounds.max,
        alevelActive: false
      };
    }

    const locationInput = form.querySelector('#school-filter-location');
    const radiusInput = form.querySelector('#school-filter-radius');
    const dayFeeMinInput = form.querySelector('[data-day-fee-min]');
    const dayFeeMaxInput = form.querySelector('[data-day-fee-max]');
    const boardingFeeMinInput = form.querySelector('[data-boarding-fee-min]');
    const boardingFeeMaxInput = form.querySelector('[data-boarding-fee-max]');
    const alevelMinInput = form.querySelector('[data-alevel-min]');
    const alevelMaxInput = form.querySelector('[data-alevel-max]');

    const dayFeePair = clampRangePair(dayFeeMinInput ? dayFeeMinInput.value : dayFeeBounds.min, dayFeeMaxInput ? dayFeeMaxInput.value : dayFeeBounds.max, dayFeeBounds);
    const boardingFeePair = clampRangePair(boardingFeeMinInput ? boardingFeeMinInput.value : boardingFeeBounds.min, boardingFeeMaxInput ? boardingFeeMaxInput.value : boardingFeeBounds.max, boardingFeeBounds);
    const alevelPair = clampRangePair(alevelMinInput ? alevelMinInput.value : alevelBounds.min, alevelMaxInput ? alevelMaxInput.value : alevelBounds.max, alevelBounds);

    const genders = Array.from(form.querySelectorAll('input[name="gender"]:checked')).map(function (input) { return input.value; });
    const ageRanges = Array.from(form.querySelectorAll('input[name="ageRange"]:checked')).map(function (input) { return input.value; });
    const boarding = Array.from(form.querySelectorAll('input[name="boarding"]:checked')).map(function (input) { return input.value; });
    const religions = Array.from(form.querySelectorAll('input[name="religion"]:checked')).map(function (input) { return input.value; });
    const showDayFees = !(boarding.length === 1 && boarding[0] === 'boardingProvision');
    const showBoardingFees = !(boarding.length === 1 && boarding[0] === 'dayProvision');
    const showAlevel = ageRanges.includes('senior');

    return {
      locationQuery: locationInput ? locationInput.value.trim() : '',
      radiusMiles: parseRadiusMilesValue(radiusInput ? radiusInput.value : DEFAULT_RADIUS_MILES, DEFAULT_RADIUS_MILES),
      genders: genders,
      ageRanges: ageRanges,
      boarding: boarding,
      religions: religions,
      sixthFormOnly: Boolean(form.querySelector('#school-filter-sixth-form:checked')),
      nurseryOnly: Boolean(form.querySelector('#school-filter-nursery:checked')),
      bursariesOnly: Boolean(form.querySelector('#school-filter-bursaries:checked')),
      scholarshipsOnly: Boolean(form.querySelector('#school-filter-scholarships:checked')),
      dayFeeMin: dayFeePair[0],
      dayFeeMax: dayFeePair[1],
      dayFeeActive: showDayFees && (dayFeePair[0] > dayFeeBounds.min || dayFeePair[1] < dayFeeBounds.max),
      boardingFeeMin: boardingFeePair[0],
      boardingFeeMax: boardingFeePair[1],
      boardingFeeActive: showBoardingFees && (boardingFeePair[0] > boardingFeeBounds.min || boardingFeePair[1] < boardingFeeBounds.max),
      alevelMin: alevelPair[0],
      alevelMax: alevelPair[1],
      alevelActive: showAlevel && (alevelPair[0] > alevelBounds.min || alevelPair[1] < alevelBounds.max)
    };
  }

  function filterSchools(filters, resolvedLocation) {
    const genders = new Set(filters.genders || []);
    const ageRanges = new Set(filters.ageRanges || []);
    const boarding = new Set(filters.boarding || []);
    const religions = new Set(filters.religions || []);
    const shortlistIds = state.shortlistPage ? new Set(getShortlistIds()) : null;
    const sourceSchools = shortlistIds
      ? state.schools.filter(function (school) { return shortlistIds.has(String(school.id)); })
      : state.schools;

    const filtered = sourceSchools
      .map(function (school) {
        const distanceMiles = resolvedLocation ? haversineMiles(resolvedLocation.lat, resolvedLocation.lng, school.lat, school.lng) : null;
        return Object.assign({}, school, { distanceMiles: distanceMiles });
      })
      .filter(function (school) {
        if (genders.size && !genders.has(school.genderFilter)) return false;

        if (ageRanges.size) {
          let ageMatch = false;
          if (ageRanges.has('preprep') && schoolSupportsAgeRange(school, 3, 7)) ageMatch = true;
          if (ageRanges.has('prep') && schoolSupportsAgeRange(school, 7, 11)) ageMatch = true;
          if (ageRanges.has('senior') && schoolSupportsAgeRange(school, 13, 18)) ageMatch = true;
          if (!ageMatch) return false;
        }

        if (boarding.size) {
          const matchesDayProvision = boarding.has('dayProvision') && school.hasDayProvision;
          const matchesBoardingProvision = boarding.has('boardingProvision') && school.hasBoardingProvision;
          if (!matchesDayProvision && !matchesBoardingProvision) return false;
        }

        if (filters.sixthFormOnly && !school.hasSixthForm) return false;
        if (filters.nurseryOnly && !school.hasNursery) return false;
        if (filters.bursariesOnly && !school.hasBursaries) return false;
        if (filters.scholarshipsOnly && !school.hasScholarships) return false;
        if (religions.size && !religions.has(school.religion)) return false;

        const dayFeeValue = normalizeFeeValue(school.dayFeeAverage);
        const boardingFeeValue = normalizeFeeValue(school.boardingFeeAverage);
        const hasDayFeeValue = dayFeeValue !== null;
        const hasBoardingFeeValue = boardingFeeValue !== null;

        if (filters.dayFeeActive || filters.boardingFeeActive) {
          if (hasDayFeeValue && hasBoardingFeeValue) {
            if (filters.dayFeeActive && (dayFeeValue < filters.dayFeeMin || dayFeeValue > filters.dayFeeMax)) return false;
            if (filters.boardingFeeActive && (boardingFeeValue < filters.boardingFeeMin || boardingFeeValue > filters.boardingFeeMax)) return false;
          } else if (hasDayFeeValue) {
            if (filters.dayFeeActive && (dayFeeValue < filters.dayFeeMin || dayFeeValue > filters.dayFeeMax)) return false;
          } else if (hasBoardingFeeValue) {
            if (filters.boardingFeeActive && (boardingFeeValue < filters.boardingFeeMin || boardingFeeValue > filters.boardingFeeMax)) return false;
          } else {
            return false;
          }
        }

        if (filters.alevelActive) {
          const alevelValue = getAlevelAStarAValue(school);
          if (alevelValue === null || alevelValue < filters.alevelMin || alevelValue > filters.alevelMax) return false;
        }

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
    const articleClasses = 'homepage-school-card homepage-school-card--' + escapeHtml(point.type) + (point.href ? '' : ' homepage-school-card--static');
    const mainStart = point.href
      ? '<a class="homepage-school-card__main" href="' + escapeHtml(point.href) + '">'
      : '<div class="homepage-school-card__main">';
    const mainEnd = point.href ? '</a>' : '</div>';
    return '<article class="' + articleClasses + '" data-school-id="' + escapeHtml(point.id) + '">' +
      mainStart +
      '<div class="homepage-school-card__body">' +
      (eyebrow ? '<p class="homepage-school-card__eyebrow">' + eyebrow + '</p>' : '') +
      (point.badgeLabel ? '<p class="homepage-school-card__badge">' + escapeHtml(point.badgeLabel) + '</p>' : '') +
      '<h3 class="homepage-school-card__title">' + escapeHtml(point.name) + '</h3>' +
      '<p class="homepage-school-card__meta">' + escapeHtml(point.genderLabel + ' · ' + point.boardingLabel + ' · Ages ' + point.ageLabel) + '</p>' +
      (extras.length ? '<p class="homepage-school-card__meta homepage-school-card__meta--secondary">' + escapeHtml(extras.join(' · ')) + '</p>' : '') +
      (showNoFeeDataLabel ? '<p class="homepage-school-card__status homepage-school-card__status--neutral">No fee data</p>' : '') +
      (!point.href ? '<p class="homepage-school-card__status">Profile coming soon</p>' : '') +
      '</div>' + mainEnd +
      '<div class="homepage-school-card__actions">' +
      '<button class="homepage-school-card__shortlist homepage-school-card__shortlist--banner" data-shortlist-add-label="Add to shortlist" data-shortlist-button data-shortlist-remove-label="Shortlisted" data-shortlist-school-id="' + escapeHtml(point.id) + '" type="button">Add to shortlist</button>' +
      '</div>' +
      '</article>';
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
    state.map.on('moveend zoomend resize', function () {
      updateVisibleSchoolsFromMap();
      if (state.currentFilters) saveHomepageSearchState(state.currentFilters);
    });
    state.mapReady = true;
    return state.map;
  }

  function getSchoolsWithinCurrentMapBounds(schools) {
    if (!state.map || !state.mapReady) {
      return (schools || []).slice();
    }
    const sourceSchools = Array.isArray(schools) ? schools : [];
    if (!sourceSchools.length) return [];
    const bounds = state.map.getBounds();
    return sourceSchools.filter(function (school) {
      return bounds.contains([school.lat, school.lng]);
    });
  }

  function updateVisibleSchoolsFromMap() {
    if (!state.map || !state.filteredSchools.length) {
      state.visibleSchools = state.filteredSchools.slice();
      renderResultsOnly();
      return;
    }

    state.visibleSchools = getSchoolsWithinCurrentMapBounds(state.filteredSchools);
    renderResultsOnly();
  }

  function redrawMap(results, filters, resolvedLocation, mapFocusLocation, options) {
    const map = ensureMap();
    const emptyState = document.getElementById('homepage-map-empty');
    if (!map || !state.markerLayer || !state.searchLayer) return;
    const preserveView = Boolean(options && options.preserveView && state.mapReady && state.hasMapViewInitialized);
    const preservedCenter = preserveView && map.getCenter ? map.getCenter() : null;
    const preservedZoom = preserveView && map.getZoom ? map.getZoom() : null;

    state.markerLayer.clearLayers();
    state.searchLayer.clearLayers();
    state.markersBySchoolId = new Map();
    const boundsLayers = [];

    if (resolvedLocation) {
      let radiusCircle = null;
      if (!isAllRadius(filters.radiusMiles)) {
        radiusCircle = window.L.circle([resolvedLocation.lat, resolvedLocation.lng], {
          radius: filters.radiusMiles * 1609.34,
          color: '#b35b2e',
          weight: 1.5,
          fillColor: '#b35b2e',
          fillOpacity: 0.08
        }).addTo(state.searchLayer);
      }
      const centreMarker = window.L.circleMarker([resolvedLocation.lat, resolvedLocation.lng], {
        radius: 7,
        color: '#b35b2e',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1
      }).bindPopup('<div class="map-popup"><h3 class="map-popup-title">' + escapeHtml(resolvedLocation.label) + '</h3><p class="map-popup-meta">Search centre</p></div>').addTo(state.searchLayer);
      if (radiusCircle) boundsLayers.push(radiusCircle);
      boundsLayers.push(centreMarker);
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
      if (!emptyState.hidden) emptyState.textContent = state.shortlistPage ? 'No shortlisted schools match these filters.' : 'No schools match these filters.';
      if (resolvedLocation && results.length === 0) {
        emptyState.hidden = false;
        if (isAllRadius(filters.radiusMiles)) {
          emptyState.textContent = (state.shortlistPage ? 'No shortlisted schools were found near ' : 'No schools were found near ') + resolvedLocation.label + '.';
        } else {
          emptyState.textContent = (state.shortlistPage ? 'No shortlisted schools were found within ' : 'No schools were found within ') + formatMiles(filters.radiusMiles) + ' miles of ' + resolvedLocation.label + '.';
        }
      }
    }

    if (preserveView && preservedCenter && Number.isFinite(preservedZoom)) {
      map.setView(preservedCenter, preservedZoom, { animate: false });
    } else if (state.restoredMapView && Number.isFinite(state.restoredMapView.lat) && Number.isFinite(state.restoredMapView.lng)) {
      map.setView([state.restoredMapView.lat, state.restoredMapView.lng], state.restoredMapView.zoom || UK_DEFAULT_ZOOM, { animate: false });
      state.restoredMapView = null;
    } else if (resolvedLocation && boundsLayers.length) {
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

    state.hasMapViewInitialized = true;

    window.requestAnimationFrame(function () {
      try { map.invalidateSize({ pan: false, animate: false }); } catch (error) {}
      if (state.tileLayer && typeof state.tileLayer.redraw === 'function') {
        try { state.tileLayer.redraw(); } catch (error) {}
      }
      updateVisibleSchoolsFromMap();
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
    const sourceSchools = isMobileViewport() ? state.filteredSchools : state.visibleSchools;
    const shown = isMobileViewport() ? sourceSchools.slice() : sourceSchools.slice(0, MAX_VISIBLE_TILES);
    cardGrid.innerHTML = shown.map(schoolCardHtml).join('');
    bindCardHoverStates();
    if (window.PSGShortlist && typeof window.PSGShortlist.refreshUi === 'function') {
      window.PSGShortlist.refreshUi(document);
    }
  }

  function updateResultsSummary() {
    const target = getResultsSummary();
    if (!target) return;
    const filteredCount = state.filteredSchools.length;
    const visibleCount = state.visibleSchools.length;
    const shortlistCount = state.shortlistPage ? getShortlistIds().length : 0;

    if (state.shortlistPage && !shortlistCount) {
      target.textContent = 'You have not added any schools to your shortlist yet.';
      return;
    }

    if (!filteredCount) {
      if (state.shortlistPage) {
        target.textContent = 'No shortlisted schools match these filters.';
        return;
      }
      if (state.resolvedLocation && state.currentFilters) {
        target.textContent = isAllRadius(state.currentFilters.radiusMiles)
          ? 'No schools found near ' + state.resolvedLocation.label + '.'
          : 'No schools found within ' + formatMiles(state.currentFilters.radiusMiles) + ' miles of ' + state.resolvedLocation.label + '.';
      } else {
        target.textContent = 'No schools match these filters.';
      }
      return;
    }

    if (visibleCount === filteredCount) {
      target.textContent = 'Showing ' + formatCount(visibleCount) + ' ' + pluralize(visibleCount, state.shortlistPage ? 'shortlisted school' : 'school') + ' in the current map view.';
      return;
    }

    target.textContent = 'Showing ' + formatCount(visibleCount) + ' of ' + formatCount(filteredCount) + ' ' + (state.shortlistPage ? 'shortlisted schools' : 'matching schools') + ' in the current map view.';
  }

  function updateEmptyState() {
    const empty = document.getElementById('homepage-visible-school-empty');
    if (!empty) return;
    const shortlistCount = state.shortlistPage ? getShortlistIds().length : 0;

    if (state.shortlistPage && !shortlistCount) {
      empty.hidden = false;
      empty.textContent = 'Shortlist schools from the directory or from any school page to see them here.';
      return;
    }

    if (state.viewMode === 'tiles') {
      const sourceSchools = isMobileViewport() ? state.filteredSchools : state.visibleSchools;
      if (!sourceSchools.length) {
        empty.hidden = false;
        empty.textContent = state.shortlistPage ? 'No shortlisted schools match these filters.' : 'No schools match these filters.';
        return;
      }

      if (!isMobileViewport() && state.visibleSchools.length > MAX_VISIBLE_TILES) {
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
      empty.textContent = state.shortlistPage ? 'No shortlisted schools are currently visible on the map.' : 'No schools are currently visible on the map.';
      return;
    }
    if (!sectionSchools.length) {
      const labels = {
        glance: state.shortlistPage ? 'No visible shortlisted schools are available for this view.' : 'No visible schools are available for this view.',
        dayFees: state.shortlistPage ? 'No visible shortlisted schools currently show annual day fees.' : 'No visible schools currently show annual day fees.',
        boardingFees: state.shortlistPage ? 'No visible shortlisted schools currently show annual boarding fees.' : 'No visible schools currently show annual boarding fees.',
        alevel: state.shortlistPage ? 'No visible shortlisted schools currently show A-level data.' : 'No visible schools currently show A-level data.'
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
    updateMobileActionButtons();
    refreshRangeHistograms(state.currentFilters || readFilters());
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
    const previousSearchKey = (state.resolvedLocation && state.resolvedLocation.key) || (state.mapFocusLocation && state.mapFocusLocation.key) || '';
    const previousRadiusMiles = state.currentFilters && Number.isFinite(Number(state.currentFilters.radiusMiles))
      ? Number(state.currentFilters.radiusMiles)
      : DEFAULT_RADIUS_MILES;
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

    const preserveMapView = Boolean(
      state.map && state.mapReady && state.hasMapViewInitialized && previousSearchKey === searchKey && previousRadiusMiles === filters.radiusMiles
    );

    state.tablePage = 0;
    state.filteredSchools = filterSchools(filters, state.resolvedLocation);
    state.visibleSchools = preserveMapView ? getSchoolsWithinCurrentMapBounds(state.filteredSchools) : state.filteredSchools.slice();
    saveHomepageSearchState(filters);
    saveSearchResultsContext();
    renderResultsOnly();
    redrawMap(state.filteredSchools, filters, state.resolvedLocation, state.mapFocusLocation, { preserveView: preserveMapView });
  }

  function bindFilterForm() {
    const form = getFilterForm();
    const resetButton = document.getElementById('homepage-school-filter-reset');
    if (!form) return;

    bindAdvancedFilterControls();

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
        updateConditionalFilterPanels();
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
        const hiddenRadiusInput = form.querySelector('#school-filter-radius');
        if (hiddenRadiusInput) hiddenRadiusInput.value = String(DEFAULT_RADIUS_MILES);
        state.resolvedLocation = null;
        state.mapFocusLocation = null;
        state.initialMapFocus = null;
        state.hiddenTableSchoolIds.clear();
        state.tablePage = 0;
        closeFilterDropdowns();
        closeMobileResultsPanel();
        refreshFilterDropdownLabels();
        updateRadiusButtons();
        updateConditionalFilterPanels();
        syncDayFeeRangeUi(true);
        syncBoardingFeeRangeUi(true);
        syncAlevelRangeUi(true);
        updateError('');
        applyFilters();
      });
    }
  }

  function bindRadiusButtons() {
    const form = getFilterForm();
    if (!form) return;
    const radiusInput = form.querySelector('#school-filter-radius');
    if (!radiusInput) return;

    getRadiusButtons().forEach(function (button) {
      button.addEventListener('click', function () {
        const rawValue = String(button.getAttribute('data-value') || '').trim().toLowerCase();
        radiusInput.value = rawValue === 'all' ? 'all' : String(parsePositiveNumber(rawValue, DEFAULT_RADIUS_MILES));
        state.initialMapFocus = null;
        updateRadiusButtons();
        applyFilters();
      });
    });
  }

  function bindMobileResultActions() {
    document.querySelectorAll('[data-view-full-results]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.viewMode = 'tiles';
        renderResultsOnly();
        openMobileResultsPanel();
      });
    });

    document.querySelectorAll('[data-hide-full-results]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeMobileResultsPanel();
      });
    });

    document.querySelectorAll('[data-open-first-result]').forEach(function (button) {
      button.addEventListener('click', function () {
        const firstSchool = getFirstNavigableSchool();
        if (!firstSchool || !firstSchool.href) return;
        saveHomepageSearchState(readFilters());
        saveSearchResultsContext();
        const targetUrl = new URL(firstSchool.href, window.location.origin);
        targetUrl.searchParams.set('section', 'overview');
        window.location.href = targetUrl.pathname + targetUrl.search + targetUrl.hash;
      });
    });
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
      const parsedRadius = parseRadiusMilesValue(radiusValue, DEFAULT_RADIUS_MILES);
      radiusInput.value = isAllRadius(parsedRadius) ? 'all' : String(parsedRadius);
    }

    updateRadiusButtons();
    updateConditionalFilterPanels();

    if (locationValue && mapMode === 'centered') {
      state.initialMapFocus = {
        key: normalizeSearchQuery(locationValue),
        zoom: zoomValue
      };
    }
  }

  function seedHomepageSearchStateFromCurrentForm() {
    if (state.shortlistPage || window.location.pathname !== '/' || !window.PSGSearchState || typeof window.PSGSearchState.save !== 'function') return;

    const params = new URLSearchParams(window.location.search || '');
    if (params.get('restoreSearch') === '1') return;

    state.resolvedLocation = null;
    state.mapFocusLocation = null;
    saveHomepageSearchState(readFilters());
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
    if (!document.querySelector('.home-school-filter-bar')) return;

    function syncLayout() {
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
    state.shortlistPage = document.body.classList.contains('shortlist-page');
    state.schools = getSchoolData();
    initializeAdvancedFilterControls();
    bindResponsiveFinderLayout();
    bindLocationPanelToggle();
    bindGuideLocationSearch();
    bindFilterDropdowns();
    bindFilterForm();
    bindRadiusButtons();
    bindMobileResultActions();
    bindFilterPanelToggle();
    bindResultViewControls();
    bindHomeHeroPlayback();
    applyInitialQueryParams();
    seedHomepageSearchStateFromCurrentForm();
    applyRestoredSearchStateFromStorage();
    updateRadiusButtons();
    updateConditionalFilterPanels();
    bootHomepageMap(0);
    applyFilters();

    window.addEventListener('psg:shortlist-change', function () {
      if (state.shortlistPage) {
        applyFilters();
      } else if (window.PSGShortlist && typeof window.PSGShortlist.refreshUi === 'function') {
        window.PSGShortlist.refreshUi(document);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomepage, { once: true });
  } else {
    initHomepage();
  }

  window.addEventListener('load', function () { bootHomepageMap(0); });
})();
