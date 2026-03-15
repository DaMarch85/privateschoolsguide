(function () {
  const root = document.getElementById('compare-root');
  const chooser = document.getElementById('compare-chooser');
  const thead = document.getElementById('compare-thead');
  const tbody = document.getElementById('compare-tbody');
  const tableNote = document.getElementById('compare-table-note');
  const status = document.getElementById('compare-status');
  const pillRow = document.getElementById('compare-pill-row');
  const clearButtons = [document.getElementById('compare-clear'), document.getElementById('compare-clear-top')].filter(Boolean);
  const viewButtons = Array.from(document.querySelectorAll('[data-compare-view]'));

  if (!root || !chooser || !thead || !tbody || !tableNote || !status || !pillRow || !viewButtons.length) return;

  function parseData() {
    try {
      if (window.comparePageData && Array.isArray(window.comparePageData.schools)) {
        return window.comparePageData.schools;
      }
    } catch (error) {
      console.warn('Could not read window.comparePageData', error);
    }

    const dataNode = document.getElementById('compare-data');
    if (!dataNode) return null;

    try {
      const parsed = JSON.parse(dataNode.textContent || '[]');
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      console.warn('Could not parse compare-data JSON', error);
      return null;
    }
  }

  const schools = parseData();
  if (!Array.isArray(schools) || !schools.length) {
    console.warn('Compare page initialised without school data. Leaving server-rendered markup in place.');
    return;
  }

  const locationSlug = root.dataset.locationSlug || document.body?.dataset.locationSlug || (window.comparePageData && window.comparePageData.locationSlug) || 'directory';
  const locationName = root.dataset.locationName || locationSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const STORAGE_KEY = `psg-${locationSlug}-compare`;
  const VIEW_STORAGE_KEY = `psg-${locationSlug}-compare-view`;
  const MAX_SELECTION = 4;

  const overviewColumns = [
    { key: 'name', label: 'School' },
    { key: 'ages', label: 'Ages' },
    { key: 'gender', label: 'Gender' },
    { key: 'format', label: 'Day / boarding' },
    { key: 'dayFee', label: 'Day fees' },
    { key: 'boardingFee', label: 'Boarding fees' },
    { key: 'bursaries', label: 'Bursaries' },
    { key: 'location', label: 'Location' }
  ];

  const alevelColumns = [
    { key: 'name', label: 'School' },
    { key: 'totalExams', label: 'Total exams' },
    { key: 'pctAStarA', label: '%A*/A' },
    { key: 'pctAStarB', label: '%A*-B' },
    { key: 'uniqueSubjects', label: 'Unique subjects' },
    { key: 'coreScience', label: 'Core science' },
    { key: 'mathematics', label: 'Mathematics' },
    { key: 'art', label: 'Art' },
    { key: 'languages', label: 'Languages' },
    { key: 'economics', label: 'Economics' },
    { key: 'english', label: 'English' },
    { key: 'history', label: 'History' },
    { key: 'geography', label: 'Geography' },
    { key: 'psychology', label: 'Psychology' },
    { key: 'other', label: 'Other' }
  ];

  function canonicalKey(school) {
    return String(school.schoolSlug || school.id || school.schoolId || school.slug || '');
  }

  function normaliseToken(value) {
    return String(value || '').trim().replace(/^\/+|\/+$/g, '');
  }

  function aliasesForSchool(school) {
    const aliases = new Set();
    [school.schoolSlug, school.id, school.schoolId, school.slug].forEach((value) => {
      const normalised = normaliseToken(value);
      if (!normalised) return;
      aliases.add(normalised);

      if (normalised.includes('/')) {
        const parts = normalised.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last) aliases.add(last);
      }
    });
    return aliases;
  }

  const aliasIndex = new Map();
  schools.forEach((school) => {
    const canonical = canonicalKey(school);
    aliasesForSchool(school).forEach((alias) => {
      if (!aliasIndex.has(alias)) aliasIndex.set(alias, canonical);
    });
  });

  function normaliseSelection(values) {
    const result = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const alias = normaliseToken(value);
      if (!alias) return;
      const canonical = aliasIndex.get(alias);
      if (!canonical || result.includes(canonical)) return;
      if (result.length < MAX_SELECTION) result.push(canonical);
    });
    return result;
  }

  function getQueryIds() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('schools');
    if (!raw) return [];
    return raw.split(',').map((value) => value.trim()).filter(Boolean);
  }

  function loadSelection() {
    const queryIds = normaliseSelection(getQueryIds());
    if (queryIds.length) return queryIds;

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return normaliseSelection(stored);
    } catch (error) {
      console.warn('Could not read compare selection from localStorage', error);
      return [];
    }
  }

  function loadView() {
    const params = new URLSearchParams(window.location.search);
    const queryView = params.get('view');
    if (queryView === 'alevel' || queryView === 'overview') return queryView;

    const defaultView = root.dataset.defaultView || (window.comparePageData && window.comparePageData.defaultView);
    if (defaultView === 'alevel' || defaultView === 'overview') return defaultView;

    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === 'alevel' ? 'alevel' : 'overview';
    } catch (error) {
      console.warn('Could not read compare view from localStorage', error);
      return 'overview';
    }
  }

  let selected = loadSelection();
  let currentView = loadView();

  function saveSelection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch (error) {
      console.warn('Could not save compare selection', error);
    }
  }

  function saveView() {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, currentView);
    } catch (error) {
      console.warn('Could not save compare view', error);
    }
  }

  function baseComparePath() {
    return currentView === 'alevel'
      ? `/${locationSlug}/compare/a-levels/`
      : `/${locationSlug}/compare/`;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    url.pathname = baseComparePath();
    if (selected.length) url.searchParams.set('schools', selected.join(','));
    else url.searchParams.delete('schools');
    url.searchParams.delete('view');
    history.replaceState({}, '', url);
  }

  function formatPercent(value) {
    const num = Number(value);
    return Number.isFinite(num) ? `${Math.round(num * 100)}%` : '—';
  }

  function formatCount(value) {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('en-GB') : '—';
  }

  function visibleSchools() {
    if (!selected.length) return schools;
    return selected
      .map((id) => schools.find((item) => canonicalKey(item) === id))
      .filter(Boolean);
  }

  function renderChooser() {
    chooser.innerHTML = '';
    const limitReached = selected.length >= MAX_SELECTION;

    schools.forEach((school) => {
      const key = canonicalKey(school);
      const label = document.createElement('label');
      label.className = 'compare-option';
      const isSelected = selected.includes(key);
      const disabled = !isSelected && limitReached;
      if (disabled) label.classList.add('is-disabled');

      label.innerHTML = `
        <input type="checkbox" value="${key}" ${isSelected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span class="compare-option-title">${school.name}</span>
        <span class="compare-option-meta">${school.location || locationName}</span>
      `;

      const input = label.querySelector('input');
      input.addEventListener('change', () => {
        if (input.checked) {
          if (!selected.includes(key) && selected.length < MAX_SELECTION) selected.push(key);
        } else {
          selected = selected.filter((id) => id !== key);
        }
        saveSelection();
        updateUrl();
        renderAll();
      });

      chooser.appendChild(label);
    });
  }

  function renderStatus() {
    const rows = visibleSchools();
    status.textContent = selected.length
      ? `Showing ${rows.length} selected school${rows.length === 1 ? '' : 's'}.`
      : `Showing all ${locationName} schools.`;
  }

  function renderPills() {
    pillRow.innerHTML = '';
    selected.forEach((id) => {
      const school = schools.find((item) => canonicalKey(item) === id);
      if (!school) return;
      const pill = document.createElement('button');
      pill.className = 'compare-pill';
      pill.type = 'button';
      pill.innerHTML = `<span>${school.name}</span><span aria-hidden="true">×</span>`;
      pill.addEventListener('click', () => {
        selected = selected.filter((item) => item !== id);
        saveSelection();
        updateUrl();
        renderAll();
      });
      pillRow.appendChild(pill);
    });
  }

  function renderNoRows(columns) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}">Comparison data is coming soon for ${locationName}.</td></tr>`;
  }

  function renderTable() {
    const columns = currentView === 'alevel' ? alevelColumns : overviewColumns;
    const rows = visibleSchools();
    thead.innerHTML = `<tr>${columns.map((col) => `<th scope="col">${col.label}</th>`).join('')}</tr>`;

    if (!rows.length) {
      renderNoRows(columns);
    } else {
      tbody.innerHTML = rows.map((school) => {
        return `<tr>${columns.map((col) => {
          if (col.key === 'name') {
            const href = school.slug || `/${locationSlug}/schools/${school.schoolSlug || school.id}/`;
            return `<th scope="row"><a href="${href}">${school.name}</a></th>`;
          }

          if (currentView === 'alevel') {
            const data = school.alevel || {};
            const value = data[col.key];
            if (col.key === 'totalExams' || col.key === 'uniqueSubjects') return `<td>${formatCount(value)}</td>`;
            return `<td>${formatPercent(value)}</td>`;
          }

          return `<td>${school[col.key] || '—'}</td>`;
        }).join('')}</tr>`;
      }).join('');
    }

    tableNote.textContent = currentView === 'alevel'
      ? 'A-level view covers total exams, grades, unique subjects and subject mix.'
      : 'Overview view covers ages, gender, day or boarding format, annual fees, bursaries and location.';
  }

  function renderViewButtons() {
    viewButtons.forEach((button) => {
      const active = button.getAttribute('data-compare-view') === currentView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderAll() {
    renderChooser();
    renderStatus();
    renderPills();
    renderTable();
    renderViewButtons();
  }

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.getAttribute('data-compare-view');
      if (nextView !== 'overview' && nextView !== 'alevel') return;
      currentView = nextView;
      saveView();
      updateUrl();
      renderAll();
    });
  });

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selected = [];
      saveSelection();
      updateUrl();
      renderAll();
    });
  });

  saveSelection();
  saveView();
  updateUrl();
  renderAll();
})();
