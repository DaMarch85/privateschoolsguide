(function () {
  const DEFAULT_RADIUS_MILES = 5;
  const ALL_RADIUS_MILES = 10000;
  const SEARCH_RESULTS_STORAGE_KEY = 'psg-search-results-v1';
  const POSTCODE_REGEX = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;
  const MIN_SIGNIFICANT_AGE_RANGE_OVERLAP_YEARS = 2;

  const state = {
    schools: [],
    filteredSchools: [],
    currentFilters: null,
    resolvedLocation: null,
    activeRequestId: 0,
    applyTimer: null,
    locationCache: new Map(),
    rangeBounds: {
      fee: {
        day: { min: 1000, max: 1000, step: 1 },
        boarding: { min: 1000, max: 1000, step: 1 }
      },
      alevel: { min: 0, max: 100, step: 1 }
    }
  };

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function getRoot() {
    return document.querySelector('[data-mobile-homepage]');
  }

  function getFilterForm() {
    return document.getElementById('mobile-homepage-filters');
  }

  function getErrorTarget() {
    return document.getElementById('mobile-homepage-error');
  }

  function normalizeSearchQuery(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function formatCount(value) {
    return new Intl.NumberFormat('en-GB').format(Number(value || 0));
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : (plural || singular + 's');
  }

  function parsePositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function parseFiniteNumber(value, fallback) {
    if (value === '' || value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseRadiusMilesValue(value, fallback) {
    const raw = String(value == null ? '' : value).trim().toLowerCase();
    if (raw === 'all') return ALL_RADIUS_MILES;
    return parsePositiveNumber(raw, fallback);
  }

  function isAllRadius(value) {
    return Number(value) >= ALL_RADIUS_MILES;
  }

  function normalizeFeeValue(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function formatCurrencyRangeValue(value) {
    return '£' + formatCount(Math.round(parseFiniteNumber(value, 0)));
  }

  function formatPercentRangeValue(value) {
    return Math.round(parseFiniteNumber(value, 0)) + '%';
  }

  function looksLikeUkPostcode(query) {
    return POSTCODE_REGEX.test(String(query || '').trim());
  }

  function formatPostcode(postcode) {
    const compact = String(postcode || '').replace(/\s+/g, '').trim().toUpperCase();
    if (compact.length < 5) return compact;
    return compact.slice(0, -3) + ' ' + compact.slice(-3);
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
        }).catch(function () {
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
    }).catch(function () {
      return null;
    });
  }

  function resolveSearchLocation(query) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return Promise.resolve(null);

    const cacheKey = normalizeSearchQuery(trimmed);
    if (state.locationCache.has(cacheKey)) {
      return Promise.resolve(state.locationCache.get(cacheKey));
    }

    const promise = (looksLikeUkPostcode(trimmed) || /\d/.test(trimmed)
      ? resolvePostcode(trimmed).then(function (result) {
          return result || resolvePlace(trimmed);
        })
      : resolvePlace(trimmed)
    ).then(function (result) {
      state.locationCache.set(cacheKey, result || null);
      return result || null;
    }).catch(function () {
      state.locationCache.set(cacheKey, null);
      return null;
    });

    return promise;
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

  function compareByName(a, b) {
    return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'en');
  }

  function sortSchools(schools, boardingMode) {
    const sortMode = boardingMode === 'boardingProvision' ? 'boarding' : 'day';

    return schools.slice().sort(function (a, b) {
      const aValue = sortMode === 'boarding' ? normalizeFeeValue(a.boardingFeeAverage) : normalizeFeeValue(a.dayFeeAverage);
      const bValue = sortMode === 'boarding' ? normalizeFeeValue(b.boardingFeeAverage) : normalizeFeeValue(b.dayFeeAverage);
      const aMissing = aValue === null;
      const bMissing = bValue === null;

      if (aMissing !== bMissing) {
        return aMissing ? 1 : -1;
      }

      if (aValue !== null && bValue !== null && aValue !== bValue) {
        return bValue - aValue;
      }

      return compareByName(a, b);
    });
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
          hasDayFees: dayFeeAverage !== null || Boolean(item.hasDayFees),
          hasBoardingFees: boardingFeeAverage !== null || Boolean(item.hasBoardingFees),
          dayFeeAverage: dayFeeAverage,
          boardingFeeAverage: boardingFeeAverage,
          alevel: item.alevel || null,
          distanceMiles: null
        };
      })
      .filter(Boolean);
  }

  function buildFeeBounds(values) {
    const valid = values
      .filter(function (value) { return Number.isFinite(Number(value)) && Number(value) > 0; })
      .map(Number);
    if (!valid.length) return { min: 1000, max: 1000, step: 1 };
    const maxValue = Math.max.apply(null, valid);
    const max = Math.max(1000, Math.ceil(maxValue));
    return { min: 1000, max: max, step: 1 };
  }

  function clampRangePair(low, high, bounds) {
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, minBound);
    let nextLow = parseFiniteNumber(low, minBound);
    let nextHigh = parseFiniteNumber(high, maxBound);
    nextLow = Math.max(minBound, Math.min(nextLow, maxBound));
    nextHigh = Math.max(minBound, Math.min(nextHigh, maxBound));
    if (nextLow > nextHigh) {
      const swap = nextLow;
      nextLow = nextHigh;
      nextHigh = swap;
    }
    return [nextLow, nextHigh];
  }

  function setRangeFill(fill, bounds, low, high) {
    if (!fill) return;
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, 100);
    const span = Math.max(1, maxBound - minBound);
    const safe = clampRangePair(low, high, bounds);
    const start = ((safe[0] - minBound) / span) * 100;
    const end = ((safe[1] - minBound) / span) * 100;
    fill.style.left = start + '%';
    fill.style.width = Math.max(0, end - start) + '%';
    fill.style.background = 'linear-gradient(90deg, rgba(41,36,33,.82) 0%, rgba(179,91,46,.96) 100%)';
  }


  function buildHistogramCounts(values, bounds, binCount) {
    const safeValues = Array.isArray(values)
      ? values.map(function (value) { return Number(value); }).filter(function (value) { return Number.isFinite(value); })
      : [];
    const minBound = parseFiniteNumber(bounds && bounds.min, 0);
    const maxBound = parseFiniteNumber(bounds && bounds.max, minBound + 1);
    const safeMax = maxBound > minBound ? maxBound : minBound + 1;
    const bins = Math.max(10, Math.min(24, Number(binCount) || 16));
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
      const height = count > 0 ? Math.max(18, Math.round((count / maxCount) * 100)) : 18;
      const start = minBound + (index * binSize);
      const end = index === counts.length - 1 ? maxBound : start + binSize;
      const isSelected = end > safeLow && start <= safeHigh;
      return '<span class="mobile-range__histogram-bar' +
        (isSelected ? ' is-selected' : '') +
        (count === 0 ? ' is-empty' : '') +
        '" style="height:' + height + '%" aria-hidden="true"></span>';
    }).join('');
  }

  function setHistogramCaption(selector, text) {
    const target = document.querySelector(selector);
    if (!target) return;
    target.textContent = text || '';
  }

  function clearRangeHistograms() {
    [
      ['[data-mobile-day-fee-histogram]', '[data-mobile-day-fee-histogram-count]'],
      ['[data-mobile-boarding-fee-histogram]', '[data-mobile-boarding-fee-histogram-count]'],
      ['[data-mobile-alevel-histogram]', '[data-mobile-alevel-histogram-count]']
    ].forEach(function (entry) {
      const container = document.querySelector(entry[0]);
      if (container) container.innerHTML = '';
      setHistogramCaption(entry[1], '');
    });
  }

  function refreshRangeHistograms(filters) {
    const activeFilters = filters || readFilters();
    const configs = [
      {
        containerSelector: '[data-mobile-day-fee-histogram]',
        countSelector: '[data-mobile-day-fee-histogram-count]',
        histogramFilters: Object.assign({}, activeFilters, { dayFeeActive: false }),
        bounds: state.rangeBounds.fee.day,
        readValue: function (school) { return normalizeFeeValue(school.dayFeeAverage); },
        low: activeFilters.dayFeeMin,
        high: activeFilters.dayFeeMax,
        emptyText: 'No day fees in these results'
      },
      {
        containerSelector: '[data-mobile-boarding-fee-histogram]',
        countSelector: '[data-mobile-boarding-fee-histogram-count]',
        histogramFilters: Object.assign({}, activeFilters, { boardingFeeActive: false }),
        bounds: state.rangeBounds.fee.boarding,
        readValue: function (school) { return normalizeFeeValue(school.boardingFeeAverage); },
        low: activeFilters.boardingFeeMin,
        high: activeFilters.boardingFeeMax,
        emptyText: 'No boarding fees in these results'
      },
      {
        containerSelector: '[data-mobile-alevel-histogram]',
        countSelector: '[data-mobile-alevel-histogram-count]',
        histogramFilters: Object.assign({}, activeFilters, { alevelActive: false }),
        bounds: state.rangeBounds.alevel,
        readValue: function (school) { return getAlevelAStarAValue(school); },
        low: activeFilters.alevelMin,
        high: activeFilters.alevelMax,
        emptyText: 'No A-level results in these results'
      }
    ];

    configs.forEach(function (config) {
      const container = document.querySelector(config.containerSelector);
      if (!container) return;
      const schools = filterSchools(config.histogramFilters, state.resolvedLocation);
      const values = schools.map(config.readValue).filter(function (value) { return value !== null; });
      if (!values.length) {
        container.innerHTML = '';
        setHistogramCaption(config.countSelector, config.emptyText);
        return;
      }
      const histogram = buildHistogramCounts(values, config.bounds, 16);
      renderHistogram(container, histogram, config.low, config.high);
      setHistogramCaption(config.countSelector, formatCount(histogram.valueCount) + ' schools in range');
    });
  }

  function syncRangeControl(config) {
    const form = getFilterForm();
    if (!form) return;

    const bounds = config.bounds;
    const minInput = form.querySelector(config.minSelector);
    const maxInput = form.querySelector(config.maxSelector);
    const minDisplay = form.querySelector(config.minDisplaySelector);
    const maxDisplay = form.querySelector(config.maxDisplaySelector);
    const fill = form.querySelector(config.fillSelector);
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
    setRangeFill(fill, bounds, pair[0], pair[1]);
  }

  function syncDayFeeRangeUi(resetValues) {
    syncRangeControl({
      bounds: state.rangeBounds.fee.day,
      minSelector: '[data-mobile-day-fee-min]',
      maxSelector: '[data-mobile-day-fee-max]',
      minDisplaySelector: '[data-mobile-day-fee-min-display]',
      maxDisplaySelector: '[data-mobile-day-fee-max-display]',
      fillSelector: '[data-mobile-day-fee-fill]',
      formatValue: formatCurrencyRangeValue,
      resetValues: Boolean(resetValues)
    });
  }

  function syncBoardingFeeRangeUi(resetValues) {
    syncRangeControl({
      bounds: state.rangeBounds.fee.boarding,
      minSelector: '[data-mobile-boarding-fee-min]',
      maxSelector: '[data-mobile-boarding-fee-max]',
      minDisplaySelector: '[data-mobile-boarding-fee-min-display]',
      maxDisplaySelector: '[data-mobile-boarding-fee-max-display]',
      fillSelector: '[data-mobile-boarding-fee-fill]',
      formatValue: formatCurrencyRangeValue,
      resetValues: Boolean(resetValues)
    });
  }

  function syncAlevelRangeUi(resetValues) {
    syncRangeControl({
      bounds: state.rangeBounds.alevel,
      minSelector: '[data-mobile-alevel-min]',
      maxSelector: '[data-mobile-alevel-max]',
      minDisplaySelector: '[data-mobile-alevel-min-display]',
      maxDisplaySelector: '[data-mobile-alevel-max-display]',
      fillSelector: '[data-mobile-alevel-fill]',
      formatValue: formatPercentRangeValue,
      resetValues: Boolean(resetValues)
    });
  }

  function initializeRanges() {
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
    refreshRangeHistograms(readFilters());
  }

  function getMobileDropdowns() {
    return Array.from(document.querySelectorAll('[data-mobile-dropdown]'));
  }

  function closeDropdowns(except) {
    getMobileDropdowns().forEach(function (dropdown) {
      if (dropdown !== except) dropdown.open = false;
    });
  }

  function getDropdownSelectionLabel(labels, fallback) {
    if (!labels.length) return fallback || 'Any';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) {
      const joined = labels.join(', ');
      if (joined.length <= 22) return joined;
    }
    return labels.length + ' selected';
  }

  function updateDropdownLabel(dropdown) {
    const valueTarget = dropdown && dropdown.querySelector('[data-mobile-dropdown-value]');
    if (!valueTarget) return;
    const checkedLabels = Array.from(dropdown.querySelectorAll('input:checked')).map(function (input) {
      return input.dataset.optionLabel || '';
    }).filter(Boolean);
    const defaultLabel = valueTarget.dataset.defaultLabel || 'Any';
    const filterLabel = valueTarget.dataset.filterLabel || '';
    const selectionLabel = getDropdownSelectionLabel(checkedLabels, defaultLabel);
    valueTarget.textContent = filterLabel ? filterLabel + ': ' + selectionLabel : selectionLabel;
  }

  function refreshDropdownLabels() {
    getMobileDropdowns().forEach(updateDropdownLabel);
  }

  function getSelectedAgeRanges() {
    const form = getFilterForm();
    if (!form) return [];
    return Array.from(form.querySelectorAll('input[name="ageRange"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function getSelectedBoardingMode() {
    const form = getFilterForm();
    if (!form) return 'dayProvision';
    const input = form.querySelector('#mobile-filter-boarding-mode');
    const value = input ? String(input.value || '').trim() : '';
    return value === 'boardingProvision' ? 'boardingProvision' : 'dayProvision';
  }

  function updateRadiusButtons() {
    const form = getFilterForm();
    if (!form) return;
    const radiusInput = form.querySelector('#mobile-filter-radius');
    const currentRadius = parseRadiusMilesValue(radiusInput ? radiusInput.value : DEFAULT_RADIUS_MILES, DEFAULT_RADIUS_MILES);
    document.querySelectorAll('[data-mobile-radius-option]').forEach(function (button) {
      const rawValue = String(button.getAttribute('data-value') || '').trim().toLowerCase();
      const active = rawValue === 'all'
        ? isAllRadius(currentRadius)
        : parsePositiveNumber(rawValue, DEFAULT_RADIUS_MILES) === currentRadius;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function updateBoardingButtons() {
    const mode = getSelectedBoardingMode();
    document.querySelectorAll('[data-mobile-boarding-option]').forEach(function (button) {
      const value = String(button.getAttribute('data-value') || '').trim();
      const active = value === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function updateConditionalPanels() {
    const form = getFilterForm();
    if (!form) return;

    const showAlevel = getSelectedAgeRanges().includes('senior');
    const alevelPanel = form.querySelector('[data-mobile-conditional-alevel]');
    if (alevelPanel) alevelPanel.hidden = !showAlevel;

    const mode = getSelectedBoardingMode();
    const dayPanel = form.querySelector('[data-mobile-fee-panel="day"]');
    const boardingPanel = form.querySelector('[data-mobile-fee-panel="boarding"]');
    if (dayPanel) dayPanel.hidden = mode === 'boardingProvision';
    if (boardingPanel) boardingPanel.hidden = mode !== 'boardingProvision';

    updateBoardingButtons();
  }

  function readFilters() {
    const form = getFilterForm();
    if (!form) {
      return {
        locationQuery: '',
        radiusMiles: DEFAULT_RADIUS_MILES,
        gender: '',
        ageRanges: [],
        religions: [],
        boardingMode: 'dayProvision',
        sixthFormOnly: false,
        nurseryOnly: false,
        dayFeeMin: state.rangeBounds.fee.day.min,
        dayFeeMax: state.rangeBounds.fee.day.max,
        dayFeeActive: false,
        boardingFeeMin: state.rangeBounds.fee.boarding.min,
        boardingFeeMax: state.rangeBounds.fee.boarding.max,
        boardingFeeActive: false,
        alevelMin: state.rangeBounds.alevel.min,
        alevelMax: state.rangeBounds.alevel.max,
        alevelActive: false
      };
    }

    const locationInput = form.querySelector('#mobile-filter-location');
    const radiusInput = form.querySelector('#mobile-filter-radius');
    const genderInput = form.querySelector('input[name="gender"]:checked');
    const dayFeeMinInput = form.querySelector('[data-mobile-day-fee-min]');
    const dayFeeMaxInput = form.querySelector('[data-mobile-day-fee-max]');
    const boardingFeeMinInput = form.querySelector('[data-mobile-boarding-fee-min]');
    const boardingFeeMaxInput = form.querySelector('[data-mobile-boarding-fee-max]');
    const alevelMinInput = form.querySelector('[data-mobile-alevel-min]');
    const alevelMaxInput = form.querySelector('[data-mobile-alevel-max]');

    const dayFeePair = clampRangePair(dayFeeMinInput ? dayFeeMinInput.value : state.rangeBounds.fee.day.min, dayFeeMaxInput ? dayFeeMaxInput.value : state.rangeBounds.fee.day.max, state.rangeBounds.fee.day);
    const boardingFeePair = clampRangePair(boardingFeeMinInput ? boardingFeeMinInput.value : state.rangeBounds.fee.boarding.min, boardingFeeMaxInput ? boardingFeeMaxInput.value : state.rangeBounds.fee.boarding.max, state.rangeBounds.fee.boarding);
    const alevelPair = clampRangePair(alevelMinInput ? alevelMinInput.value : state.rangeBounds.alevel.min, alevelMaxInput ? alevelMaxInput.value : state.rangeBounds.alevel.max, state.rangeBounds.alevel);

    const boardingMode = getSelectedBoardingMode();
    const ageRanges = Array.from(form.querySelectorAll('input[name="ageRange"]:checked')).map(function (input) { return input.value; });
    const showAlevel = ageRanges.includes('senior');

    return {
      locationQuery: locationInput ? locationInput.value.trim() : '',
      radiusMiles: parseRadiusMilesValue(radiusInput ? radiusInput.value : DEFAULT_RADIUS_MILES, DEFAULT_RADIUS_MILES),
      gender: genderInput ? genderInput.value : '',
      ageRanges: ageRanges,
      religions: Array.from(form.querySelectorAll('input[name="religion"]:checked')).map(function (input) { return input.value; }),
      boardingMode: boardingMode,
      sixthFormOnly: Boolean(form.querySelector('#mobile-filter-sixth-form:checked')),
      nurseryOnly: Boolean(form.querySelector('#mobile-filter-nursery:checked')),
      dayFeeMin: dayFeePair[0],
      dayFeeMax: dayFeePair[1],
      dayFeeActive: boardingMode !== 'boardingProvision' && (dayFeePair[0] > state.rangeBounds.fee.day.min || dayFeePair[1] < state.rangeBounds.fee.day.max),
      boardingFeeMin: boardingFeePair[0],
      boardingFeeMax: boardingFeePair[1],
      boardingFeeActive: boardingMode === 'boardingProvision' && (boardingFeePair[0] > state.rangeBounds.fee.boarding.min || boardingFeePair[1] < state.rangeBounds.fee.boarding.max),
      alevelMin: alevelPair[0],
      alevelMax: alevelPair[1],
      alevelActive: showAlevel && (alevelPair[0] > state.rangeBounds.alevel.min || alevelPair[1] < state.rangeBounds.alevel.max)
    };
  }

  function filterSchools(filters, resolvedLocation) {
    const ageRanges = new Set(filters.ageRanges || []);
    const religions = new Set(filters.religions || []);
    const gender = String(filters.gender || '').trim();

    return sortSchools(
      state.schools
        .map(function (school) {
          const distanceMiles = resolvedLocation ? haversineMiles(resolvedLocation.lat, resolvedLocation.lng, school.lat, school.lng) : null;
          return Object.assign({}, school, { distanceMiles: distanceMiles });
        })
        .filter(function (school) {
          if (gender && school.genderFilter !== gender) return false;

          if (ageRanges.size) {
            let ageMatch = false;
            if (ageRanges.has('preprep') && schoolSupportsAgeRange(school, 3, 7)) ageMatch = true;
            if (ageRanges.has('prep') && schoolSupportsAgeRange(school, 7, 11)) ageMatch = true;
            if (ageRanges.has('senior') && schoolSupportsAgeRange(school, 13, 18)) ageMatch = true;
            if (!ageMatch) return false;
          }

          if (filters.boardingMode === 'boardingProvision') {
            if (!school.hasBoardingProvision) return false;
          } else if (!school.hasDayProvision) {
            return false;
          }

          if (filters.sixthFormOnly && !school.hasSixthForm) return false;
          if (filters.nurseryOnly && !school.hasNursery) return false;
          if (religions.size && !religions.has(school.religion)) return false;

          const dayFeeValue = normalizeFeeValue(school.dayFeeAverage);
          const boardingFeeValue = normalizeFeeValue(school.boardingFeeAverage);

          if (filters.dayFeeActive) {
            if (dayFeeValue === null || dayFeeValue < filters.dayFeeMin || dayFeeValue > filters.dayFeeMax) return false;
          }

          if (filters.boardingFeeActive) {
            if (boardingFeeValue === null || boardingFeeValue < filters.boardingFeeMin || boardingFeeValue > filters.boardingFeeMax) return false;
          }

          if (filters.alevelActive) {
            const alevelValue = getAlevelAStarAValue(school);
            if (alevelValue === null || alevelValue < filters.alevelMin || alevelValue > filters.alevelMax) return false;
          }

          if (resolvedLocation && (!Number.isFinite(school.distanceMiles) || school.distanceMiles > filters.radiusMiles)) return false;
          return true;
        }),
      filters.boardingMode
    );
  }

  function getFirstNavigableSchool() {
    return state.filteredSchools.find(function (school) {
      return school && school.href;
    }) || null;
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
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
      // ignore
    }
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

  function saveHomepageSearchState(filters) {
    if (!window.PSGSearchState || typeof window.PSGSearchState.save !== 'function') return;
    const activeFilters = filters || readFilters();

    window.PSGSearchState.save({
      mode: 'mobile-form',
      restoreUrl: '/?restoreSearch=1',
      locationLabel: (state.resolvedLocation && state.resolvedLocation.label) || activeFilters.locationQuery || '',
      locationQuery: activeFilters.locationQuery || '',
      resolvedLocationLabel: (state.resolvedLocation && state.resolvedLocation.label) || '',
      radiusMiles: activeFilters.radiusMiles,
      genders: activeFilters.gender ? [activeFilters.gender] : [],
      gender: activeFilters.gender || '',
      ageRanges: activeFilters.ageRanges || [],
      boarding: [activeFilters.boardingMode],
      boardingMode: activeFilters.boardingMode,
      religions: activeFilters.religions || [],
      sixthFormOnly: Boolean(activeFilters.sixthFormOnly),
      nurseryOnly: Boolean(activeFilters.nurseryOnly),
      dayFeeMin: activeFilters.dayFeeMin,
      dayFeeMax: activeFilters.dayFeeMax,
      boardingFeeMin: activeFilters.boardingFeeMin,
      boardingFeeMax: activeFilters.boardingFeeMax,
      alevelMin: activeFilters.alevelMin,
      alevelMax: activeFilters.alevelMax
    });
  }

  function applyRestoredSearchStateFromStorage() {
    if (!window.PSGSearchState || typeof window.PSGSearchState.get !== 'function') return;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('restoreSearch') !== '1') return;

    const savedState = window.PSGSearchState.get();
    const form = getFilterForm();
    if (!savedState || !form) return;

    const locationInput = form.querySelector('#mobile-filter-location');
    const radiusInput = form.querySelector('#mobile-filter-radius');
    if (locationInput) locationInput.value = savedState.locationQuery || '';
    if (radiusInput) {
      const savedRadius = savedState.radiusMiles;
      radiusInput.value = isAllRadius(savedRadius) ? 'all' : String(savedRadius || DEFAULT_RADIUS_MILES);
    }

    form.querySelectorAll('input[name="gender"]').forEach(function (input) {
      const matches = (savedState.gender && savedState.gender === input.value)
        || (!savedState.gender && Array.isArray(savedState.genders) && savedState.genders.includes(input.value))
        || (!savedState.gender && !Array.isArray(savedState.genders) && input.value === '');
      input.checked = Boolean(matches);
    });
    if (!form.querySelector('input[name="gender"]:checked')) {
      const anyGender = form.querySelector('input[name="gender"][value=""]');
      if (anyGender) anyGender.checked = true;
    }

    form.querySelectorAll('input[name="ageRange"]').forEach(function (input) {
      input.checked = Array.isArray(savedState.ageRanges) && savedState.ageRanges.includes(input.value);
    });

    form.querySelectorAll('input[name="religion"]').forEach(function (input) {
      input.checked = Array.isArray(savedState.religions) && savedState.religions.includes(input.value);
    });

    const boardingInput = form.querySelector('#mobile-filter-boarding-mode');
    if (boardingInput) {
      boardingInput.value = savedState.boardingMode === 'boardingProvision'
        || (Array.isArray(savedState.boarding) && savedState.boarding.includes('boardingProvision'))
        ? 'boardingProvision'
        : 'dayProvision';
    }

    const sixthFormInput = form.querySelector('#mobile-filter-sixth-form');
    const nurseryInput = form.querySelector('#mobile-filter-nursery');
    if (sixthFormInput) sixthFormInput.checked = Boolean(savedState.sixthFormOnly);
    if (nurseryInput) nurseryInput.checked = Boolean(savedState.nurseryOnly);

    const dayFeeMinInput = form.querySelector('[data-mobile-day-fee-min]');
    const dayFeeMaxInput = form.querySelector('[data-mobile-day-fee-max]');
    if (dayFeeMinInput && savedState.dayFeeMin != null) dayFeeMinInput.value = String(savedState.dayFeeMin);
    if (dayFeeMaxInput && savedState.dayFeeMax != null) dayFeeMaxInput.value = String(savedState.dayFeeMax);

    const boardingFeeMinInput = form.querySelector('[data-mobile-boarding-fee-min]');
    const boardingFeeMaxInput = form.querySelector('[data-mobile-boarding-fee-max]');
    if (boardingFeeMinInput && savedState.boardingFeeMin != null) boardingFeeMinInput.value = String(savedState.boardingFeeMin);
    if (boardingFeeMaxInput && savedState.boardingFeeMax != null) boardingFeeMaxInput.value = String(savedState.boardingFeeMax);

    const alevelMinInput = form.querySelector('[data-mobile-alevel-min]');
    const alevelMaxInput = form.querySelector('[data-mobile-alevel-max]');
    if (alevelMinInput && savedState.alevelMin != null) alevelMinInput.value = String(savedState.alevelMin);
    if (alevelMaxInput && savedState.alevelMax != null) alevelMaxInput.value = String(savedState.alevelMax);

    updateRadiusButtons();
    refreshDropdownLabels();
    updateConditionalPanels();
    syncDayFeeRangeUi(false);
    syncBoardingFeeRangeUi(false);
    syncAlevelRangeUi(false);

    if (window.history && typeof window.history.replaceState === 'function') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('restoreSearch');
      const nextSearch = nextUrl.searchParams.toString();
      const nextPath = nextUrl.pathname + (nextSearch ? '?' + nextSearch : '') + nextUrl.hash;
      window.history.replaceState({}, '', nextPath);
    }
  }

  function applyInitialQueryParams() {
    const form = getFilterForm();
    if (!form) return;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('restoreSearch') === '1') return;

    const locationInput = form.querySelector('#mobile-filter-location');
    const radiusInput = form.querySelector('#mobile-filter-radius');
    const locationValue = params.get('location');
    const radiusValue = params.get('radius');

    if (locationInput && locationValue) locationInput.value = locationValue;
    if (radiusInput && radiusValue) {
      const parsedRadius = parseRadiusMilesValue(radiusValue, DEFAULT_RADIUS_MILES);
      radiusInput.value = isAllRadius(parsedRadius) ? 'all' : String(parsedRadius);
    }

    updateRadiusButtons();
  }

  function setError(message) {
    const target = getErrorTarget();
    if (!target) return;
    target.hidden = !message;
    target.textContent = message || '';
  }

  function updateActionButton(options) {
    const button = document.querySelector('[data-mobile-open-first-result]');
    if (!button) return;

    if (options && options.pending) {
      button.disabled = true;
      button.textContent = 'Searching…';
      return;
    }

    const firstSchool = getFirstNavigableSchool();
    if (!firstSchool) {
      button.disabled = true;
      button.textContent = 'No schools found';
      return;
    }

    button.disabled = false;
    button.textContent = 'Show ' + formatCount(state.filteredSchools.length) + ' ' + pluralize(state.filteredSchools.length, 'school');
  }

  async function applyFilters() {
    const requestId = ++state.activeRequestId;
    const filters = readFilters();
    state.currentFilters = filters;
    setError('');

    const hasLocationQuery = Boolean(filters.locationQuery);
    if (hasLocationQuery) {
      updateActionButton({ pending: true });
    }

    let resolvedLocation = null;
    if (hasLocationQuery) {
      resolvedLocation = await resolveSearchLocation(filters.locationQuery);
      if (requestId !== state.activeRequestId) return;
      if (!resolvedLocation) {
        state.resolvedLocation = null;
        state.filteredSchools = [];
        clearSearchResultsContext();
        clearRangeHistograms();
        setError('Enter a UK town or postcode we can find.');
        updateActionButton();
        return;
      }
    }

    state.resolvedLocation = resolvedLocation;
    state.filteredSchools = filterSchools(filters, resolvedLocation);
    saveHomepageSearchState(filters);
    saveSearchResultsContext();
    updateActionButton();
    refreshRangeHistograms(filters);
  }

  function scheduleApplyFilters(delay) {
    if (state.applyTimer) window.clearTimeout(state.applyTimer);
    state.applyTimer = window.setTimeout(function () {
      applyFilters();
    }, Number(delay) || 160);
  }

  function bindDropdowns() {
    getMobileDropdowns().forEach(function (dropdown) {
      dropdown.addEventListener('toggle', function () {
        if (dropdown.open) closeDropdowns(dropdown);
      });
      dropdown.addEventListener('change', function () {
        updateDropdownLabel(dropdown);
        updateConditionalPanels();
        applyFilters();
      });
    });

    document.addEventListener('click', function (event) {
      if (!(event.target && event.target.closest && event.target.closest('[data-mobile-dropdown]'))) closeDropdowns();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDropdowns();
    });

    refreshDropdownLabels();
  }

  function bindRadiusButtons() {
    const form = getFilterForm();
    if (!form) return;
    const radiusInput = form.querySelector('#mobile-filter-radius');
    if (!radiusInput) return;

    document.querySelectorAll('[data-mobile-radius-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        const rawValue = String(button.getAttribute('data-value') || '').trim().toLowerCase();
        radiusInput.value = rawValue === 'all' ? 'all' : String(parsePositiveNumber(rawValue, DEFAULT_RADIUS_MILES));
        updateRadiusButtons();
        applyFilters();
      });
    });

    updateRadiusButtons();
  }

  function bindBoardingButtons() {
    const form = getFilterForm();
    if (!form) return;
    const boardingInput = form.querySelector('#mobile-filter-boarding-mode');
    if (!boardingInput) return;

    document.querySelectorAll('[data-mobile-boarding-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        const value = String(button.getAttribute('data-value') || '').trim();
        boardingInput.value = value === 'boardingProvision' ? 'boardingProvision' : 'dayProvision';
        updateConditionalPanels();
        applyFilters();
      });
    });

    updateBoardingButtons();
  }

  function bindRangeControls() {
    const form = getFilterForm();
    if (!form) return;

    [
      { selectors: ['[data-mobile-day-fee-min]', '[data-mobile-day-fee-max]'], sync: function () { syncDayFeeRangeUi(false); } },
      { selectors: ['[data-mobile-boarding-fee-min]', '[data-mobile-boarding-fee-max]'], sync: function () { syncBoardingFeeRangeUi(false); } },
      { selectors: ['[data-mobile-alevel-min]', '[data-mobile-alevel-max]'], sync: function () { syncAlevelRangeUi(false); } }
    ].forEach(function (group) {
      group.selectors.forEach(function (selector) {
        const input = form.querySelector(selector);
        if (!input) return;
        input.addEventListener('input', function () {
          group.sync();
          scheduleApplyFilters(120);
        });
        input.addEventListener('change', function () {
          group.sync();
          applyFilters();
        });
      });
    });
  }

  function bindBasicInputs() {
    const form = getFilterForm();
    if (!form) return;

    const locationInput = form.querySelector('#mobile-filter-location');
    if (locationInput) {
      locationInput.addEventListener('input', function () {
        scheduleApplyFilters(350);
      });
      locationInput.addEventListener('blur', function () {
        applyFilters();
      });
    }

    form.querySelectorAll('#mobile-filter-sixth-form, #mobile-filter-nursery').forEach(function (input) {
      input.addEventListener('change', function () {
        applyFilters();
      });
    });
  }


  function initBrandBanner() {
    const banner = document.querySelector('[data-mobile-brand-banner]');
    if (!banner) return;
    const video = banner.querySelector('[data-mobile-brand-video]');
    if (!video) return;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      banner.classList.add('is-video-ended');
      try { video.pause(); } catch (error) { /* ignore */ }
      return;
    }

    function markEnded() {
      banner.classList.add('is-video-ended');
    }

    video.addEventListener('ended', markEnded, { once: true });
    video.addEventListener('error', markEnded, { once: true });

    const playPromise = typeof video.play === 'function' ? video.play() : null;
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        // Leave the poster frame visible if autoplay is blocked.
      });
    }
  }

  function bindSubmitAction() {
    const button = document.querySelector('[data-mobile-open-first-result]');
    if (!button) return;

    button.addEventListener('click', async function () {
      await applyFilters();
      const firstSchool = getFirstNavigableSchool();
      if (!firstSchool || !firstSchool.href) return;
      saveHomepageSearchState(readFilters());
      saveSearchResultsContext();
      const targetUrl = new URL(firstSchool.href, window.location.origin);
      targetUrl.searchParams.set('section', 'overview');
      window.location.href = targetUrl.pathname + targetUrl.search + targetUrl.hash;
    });
  }

  function init() {
    if (!isMobileViewport()) return;
    if (!getRoot()) return;

    state.schools = getSchoolData();
    initializeRanges();
    applyInitialQueryParams();
    bindDropdowns();
    bindRadiusButtons();
    bindBoardingButtons();
    bindRangeControls();
    bindBasicInputs();
    bindSubmitAction();
    initBrandBanner();
    applyRestoredSearchStateFromStorage();
    updateConditionalPanels();
    refreshDropdownLabels();
    applyFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
