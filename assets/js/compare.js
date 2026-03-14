(function () {
  const root = document.getElementById('compare-root');
  const dataNode = document.getElementById('compare-data');
  const schools = JSON.parse(dataNode?.textContent || '[]');

  const locationSlug = root?.dataset.locationSlug || document.body?.dataset.locationSlug || 'directory';
  const locationName = root?.dataset.locationName || locationSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

  const chooser = document.getElementById('compare-chooser');
  const thead = document.getElementById('compare-thead');
  const tbody = document.getElementById('compare-tbody');
  const tableNote = document.getElementById('compare-table-note');
  const status = document.getElementById('compare-status');
  const pillRow = document.getElementById('compare-pill-row');
  const clearButtons = [document.getElementById('compare-clear'), document.getElementById('compare-clear-top')].filter(Boolean);
  const viewButtons = Array.from(document.querySelectorAll('[data-compare-view]'));

  if (!chooser || !thead || !tbody || !tableNote || !status || !pillRow || !viewButtons.length) return;

  function getSchoolKey(school) {
    return school.schoolSlug || school.id;
  }

  function getQueryIds() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('schools');
    if (!raw) return [];
    return raw.split(',').map((v) => v.trim()).filter(Boolean).slice(0, MAX_SELECTION);
  }

  function loadSelection() {
    const queryIds = getQueryIds();
    if (queryIds.length) return queryIds;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.slice(0, MAX_SELECTION) : [];
    } catch {
      return [];
    }
  }

  function loadView() {
    const params = new URLSearchParams(window.location.search);
    const queryView = params.get('view');
    if (queryView === 'alevel' || queryView === 'overview') return queryView;
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'alevel' ? 'alevel' : 'overview';
  }

  let selected = loadSelection();
  let currentView = loadView();

  function saveSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }

  function saveView() {
    localStorage.setItem(VIEW_STORAGE_KEY, currentView);
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (selected.length) url.searchParams.set('schools', selected.join(','));
    else url.searchParams.delete('schools');
    url.searchParams.set('view', currentView);
    history.replaceState({}, '', url);
  }

  function formatPercent(value) {
    return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : '—';
  }

  function formatCount(value) {
    if (value === null || value === undefined || value === '') return '—';
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString('en-GB') : '—';
  }

  function visibleSchools() {
    if (!selected.length) return schools;
    return selected.map((id) => schools.find((item) => getSchoolKey(item) === id)).filter(Boolean);
  }

  function renderChooser() {
    chooser.innerHTML = '';
    const limitReached = selected.length >= MAX_SELECTION;

    schools.forEach((school) => {
      const key = getSchoolKey(school);
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
    status.textContent = selected.length
      ? `Showing ${selected.length} selected school${selected.length === 1 ? '' : 's'}.`
      : `Showing all ${locationName} schools.`;
  }

  function renderPills() {
    pillRow.innerHTML = '';
    selected.forEach((id) => {
      const school = schools.find((item) => getSchoolKey(item) === id);
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

  function renderTable() {
    const columns = currentView === 'alevel' ? alevelColumns : overviewColumns;
    const rows = visibleSchools();
    thead.innerHTML = `<tr>${columns.map((col) => `<th scope="col">${col.label}</th>`).join('')}</tr>`;

    tbody.innerHTML = rows.map((school) => {
      return `<tr>${columns.map((col) => {
        if (col.key === 'name') return `<th scope="row"><a href="${school.slug}">${school.name}</a></th>`;
        if (currentView === 'alevel') {
          const data = school.alevel || {};
          const value = data[col.key];
          if (col.key === 'totalExams' || col.key === 'uniqueSubjects') return `<td>${formatCount(value)}</td>`;
          return `<td>${formatPercent(value)}</td>`;
        }
        return `<td>${school[col.key] || '—'}</td>`;
      }).join('')}</tr>`;
    }).join('');

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
      currentView = button.getAttribute('data-compare-view') || 'overview';
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

  updateUrl();
  renderAll();
})();
