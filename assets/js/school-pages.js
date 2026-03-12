
(function () {
  const body = document.body;
  const currentSlug = body.dataset.schoolSlug || window.location.pathname.replace(/\/$/, '').split('/').pop();
  const locationSlug = body.dataset.locationSlug || window.location.pathname.split('/').filter(Boolean)[0] || 'bath';
  const mapTarget = document.getElementById('school-page-map');
  const mapTitle = document.querySelector('.school-map-panel .location-map-head h2');
  const mapCaption = document.querySelector('.school-map-panel .map-caption');
  const sideCompareLinks = Array.from(document.querySelectorAll('.school-compare-links a'));
  const main = document.querySelector('.school-profile-main');
  const baseGrid = main ? main.querySelector('.school-feature-grid') : null;
  let compareMount = null;
  let map = null;
  let markerLayer = null;
  const cache = new Map();

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function extractMapData(doc) {
    const script = Array.from(doc.querySelectorAll('script')).find((node) => node.textContent.includes('window.schoolProfileMapData'));
    if (!script) return null;
    const match = script.textContent.match(/window\.schoolProfileMapData\s*=\s*(\{[\s\S]*?\});?/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (err) {
      return null;
    }
  }

  function extractSchoolData(doc, slugHint) {
    const titleEl = doc.querySelector('#school-page-title');
    const subheadEl = doc.querySelector('.school-profile-subhead');
    const grid = doc.querySelector('.school-feature-grid');
    const caption = doc.querySelector('.map-caption');
    const canonical = doc.querySelector('link[rel="canonical"]');
    const path = canonical ? new URL(canonical.getAttribute('href')).pathname : '/'+ locationSlug + '/schools/' + slugHint + '/';
    return {
      slug: slugHint,
      path,
      name: titleEl ? titleEl.textContent.trim() : slugHint,
      subhead: subheadEl ? subheadEl.textContent.trim() : '',
      tiles: grid ? Array.from(grid.children).map((node) => node.outerHTML) : [],
      mapData: extractMapData(doc),
      address: caption ? caption.textContent.trim() : ''
    };
  }

  const currentData = extractSchoolData(document, currentSlug);
  cache.set(currentSlug, currentData);

  function roundPercentString(text) {
    return String(text || '').replace(/(\d+(?:\.\d+)?)%/g, (_, num) => `${Math.round(parseFloat(num))}%`);
  }

  function normalizePercentages(scope) {
    if (!scope) return;
    scope.querySelectorAll('.tile-kpi-value, .metric-value').forEach((node) => {
      node.textContent = roundPercentString(node.textContent.trim());
    });
  }

  function getTileTitleFromHtml(tileHtml) {
    const wrap = document.createElement('div');
    wrap.innerHTML = tileHtml.trim();
    const title = wrap.querySelector('h2');
    return title ? title.textContent.trim() : '';
  }

  function buildTileMap(data) {
    const map = new Map();
    (data.tiles || []).forEach((tileHtml) => {
      const title = getTileTitleFromHtml(tileHtml);
      if (title) map.set(title, tileHtml);
    });
    return map;
  }

  function buildTileOrder(primaryData, secondaryData) {
    const order = [];
    const seen = new Set();
    const pushTitle = (title) => {
      if (title && !seen.has(title)) {
        seen.add(title);
        order.push(title);
      }
    };
    (primaryData.tiles || []).forEach((tileHtml) => pushTitle(getTileTitleFromHtml(tileHtml)));
    (secondaryData.tiles || []).forEach((tileHtml) => pushTitle(getTileTitleFromHtml(tileHtml)));
    return order;
  }

  function tileElementFromHtml(tileHtml) {
    const wrap = document.createElement('div');
    wrap.innerHTML = tileHtml.trim();
    return wrap.firstElementChild || null;
  }

  function createPlaceholderTile(title) {
    const tile = document.createElement('article');
    tile.className = 'school-feature-tile school-feature-tile--placeholder';
    tile.setAttribute('aria-hidden', 'true');
    tile.setAttribute('data-missing-tile', title || '');
    return tile;
  }


  function bindTileInteractions(scope) {
    scope.querySelectorAll('.subjects-details').forEach((details) => {
      const tile = details.closest('.tile-expandable');
      const sync = () => tile && tile.classList.toggle('is-expanded', details.open);
      details.removeEventListener?.('toggle', sync);
      details.addEventListener('toggle', sync);
      sync();
    });

    scope.querySelectorAll('[data-subject-toggle]').forEach((button) => {
      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        const tile = button.closest('.tile-expandable');
        if (!tile) return;
        const extra = tile.querySelector('.subject-extra');
        if (!extra) return;
        const expand = button.getAttribute('data-subject-toggle') === 'expand';
        if (expand) {
          extra.hidden = false;
          tile.classList.add('is-expanded');
          button.hidden = true;
        } else {
          extra.hidden = true;
          tile.classList.remove('is-expanded');
          const opener = tile.querySelector('[data-subject-toggle="expand"]');
          if (opener) opener.hidden = false;
        }
      });
    });

    scope.querySelectorAll('[data-fee-switch]').forEach((switcher) => {
      const tile = switcher.closest('.school-feature-tile');
      if (!tile || switcher.dataset.bound === 'true') return;
      switcher.dataset.bound = 'true';
      const buttons = switcher.querySelectorAll('[data-fee-target]');
      const panes = tile.querySelectorAll('[data-fee-pane]');
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const targetPane = button.getAttribute('data-fee-target');
          buttons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
          panes.forEach((pane) => pane.classList.toggle('is-active', pane.getAttribute('data-fee-pane') === targetPane));
        });
      });
    });

    normalizePercentages(scope);
  }

  bindTileInteractions(document);

  function getMarkerIcon(kind) {
    return window.L.divIcon({
      className: 'school-map-icon',
      html: '<span class="school-map-marker ' + (kind === 'secondary' ? 'school-map-marker--secondary' : '') + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
  }

  function popupHtml(data) {
    return '<div class="map-popup"><h3 class="map-popup-title">' + escapeHtml(data.name) + '</h3>' +
      '<p class="map-popup-meta">' + escapeHtml((data.mapData && data.mapData.note) || '') + '</p>' +
      '<a class="map-popup-link" href="' + escapeHtml(data.path) + '">View school</a></div>';
  }

  function renderMap(primary, secondary) {
    if (!mapTarget || !window.L || !primary || !primary.mapData) return;

    if (!map) {
      map = window.L.map(mapTarget, { zoomControl: true, scrollWheelZoom: false });
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
    }

    if (markerLayer) markerLayer.remove();
    markerLayer = window.L.layerGroup().addTo(map);

    const bounds = [];
    const addMarker = (data, kind) => {
      if (!data || !data.mapData) return;
      const latLng = [data.mapData.lat, data.mapData.lng];
      bounds.push(latLng);
      const marker = window.L.marker(latLng, { icon: getMarkerIcon(kind) }).addTo(markerLayer);
      marker.bindPopup(popupHtml(data));
    };

    addMarker(primary, 'primary');
    if (secondary) addMarker(secondary, 'secondary');

    if (bounds.length === 1) {
      map.setView(bounds[0], primary.mapData.zoom || 13);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    if (mapTitle) mapTitle.textContent = secondary ? 'School locations' : 'School location';
    if (mapCaption) mapCaption.textContent = secondary ? (primary.name + ' and ' + secondary.name + ' in Bath') : (primary.address || 'Bath, Somerset');

    const existingLegend = document.querySelector('.school-map-legend');
    if (existingLegend) existingLegend.remove();
    if (secondary && mapTarget.parentElement) {
      const legend = document.createElement('div');
      legend.className = 'school-map-legend';
      legend.innerHTML = '<span class="school-map-legend-item"><span class="school-map-dot school-map-dot--primary"></span>' + escapeHtml(primary.name) + '</span>' +
        '<span class="school-map-legend-item"><span class="school-map-dot school-map-dot--secondary"></span>' + escapeHtml(secondary.name) + '</span>';
      mapTarget.parentElement.appendChild(legend);
    }

    setTimeout(() => map.invalidateSize(), 60);
  }

  renderMap(currentData, null);

  async function fetchSchool(slug) {
    if (cache.has(slug)) return cache.get(slug);
    const response = await fetch('/' + locationSlug + '/schools/' + slug + '/', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Unable to fetch comparison school');
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const data = extractSchoolData(doc, slug);
    cache.set(slug, data);
    return data;
  }

  function createCompareHeader(data, label, allowClear) {
    const column = document.createElement('section');
    column.className = 'school-compare-column';
    const header = document.createElement('div');
    header.className = 'school-compare-column-head';
    header.innerHTML = '<p class="school-compare-column-kicker">' + escapeHtml(label) + '</p>' +
      '<h2>' + escapeHtml(data.name) + '</h2>' +
      '<p>' + escapeHtml(data.subhead) + '</p>';
    const actions = document.createElement('div');
    actions.className = 'school-compare-column-actions';
    actions.innerHTML = '<a class="school-compare-head-link" href="' + escapeHtml(data.path) + '">Open full page</a>';
    if (allowClear) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'school-compare-clear';
      clearBtn.textContent = 'Clear comparison';
      clearBtn.addEventListener('click', clearComparison);
      actions.appendChild(clearBtn);
    }
    header.appendChild(actions);
    column.appendChild(header);
    return column;
  }

  function createPairedComparison(primaryData, secondaryData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'school-compare-paired';
    const primaryMap = buildTileMap(primaryData);
    const secondaryMap = buildTileMap(secondaryData);
    const titles = buildTileOrder(primaryData, secondaryData);

    titles.forEach((title) => {
      const row = document.createElement('div');
      row.className = 'school-compare-row';
      const primaryTile = primaryMap.has(title) ? tileElementFromHtml(primaryMap.get(title)) : createPlaceholderTile(title);
      const secondaryTile = secondaryMap.has(title) ? tileElementFromHtml(secondaryMap.get(title)) : createPlaceholderTile(title);
      if (primaryTile) row.appendChild(primaryTile);
      if (secondaryTile) row.appendChild(secondaryTile);
      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function setActiveLink(slug) {
    sideCompareLinks.forEach((link) => {
      const target = link.dataset.compareSchool || new URL(link.href, window.location.origin).searchParams.get('compare');
      link.classList.toggle('is-active', target === slug);
    });
  }

  async function applyComparison(slug) {
    if (!slug || slug === currentSlug || !main || !baseGrid) return;
    try {
      const comparisonData = await fetchSchool(slug);
      if (!compareMount) {
        compareMount = document.createElement('div');
        compareMount.className = 'school-compare-columns';
        baseGrid.insertAdjacentElement('afterend', compareMount);
      }
      compareMount.innerHTML = '';
      const headerRow = document.createElement('div');
      headerRow.className = 'school-compare-headers';
      headerRow.appendChild(createCompareHeader(currentData, 'Current school', false));
      headerRow.appendChild(createCompareHeader(comparisonData, 'Comparison school', true));
      compareMount.appendChild(headerRow);
      compareMount.appendChild(createPairedComparison(currentData, comparisonData));
      bindTileInteractions(compareMount);
      baseGrid.style.display = 'none';
      compareMount.style.display = 'block';
      body.classList.add('is-compare-mode');
      setActiveLink(slug);
      renderMap(currentData, comparisonData);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('compare', slug);
      window.history.replaceState({}, '', nextUrl);
    } catch (err) {
      console.error(err);
    }
  }

  function clearComparison() {
    if (baseGrid) baseGrid.style.display = '';
    if (compareMount) compareMount.style.display = 'none';
    body.classList.remove('is-compare-mode');
    setActiveLink('');
    renderMap(currentData, null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('compare');
    nextUrl.searchParams.delete('schools');
    window.history.replaceState({}, '', nextUrl.pathname + (nextUrl.search ? nextUrl.search : ''));
  }

  sideCompareLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href') || '';
      const url = new URL(href, window.location.origin);
      let target = url.searchParams.get('compare');
      if (!target && url.searchParams.get('schools')) {
        const schools = url.searchParams.get('schools').split(',');
        target = schools.find((slug) => slug && slug !== currentSlug);
      }
      if (!target) return;
      event.preventDefault();
      applyComparison(target);
    });
  });

  const params = new URLSearchParams(window.location.search);
  let initialCompare = params.get('compare');
  if (!initialCompare && params.get('schools')) {
    const schools = params.get('schools').split(',');
    initialCompare = schools.find((slug) => slug && slug !== currentSlug);
  }
  if (initialCompare) applyComparison(initialCompare);
})();
