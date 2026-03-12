(function () {
  const STORAGE_KEY = 'psg-bath-compare';
  const VIEW_STORAGE_KEY = 'psg-bath-compare-view';
  const MAX_SELECTION = 4;

  const schools = [
    {
      id: 'bath-academy',
      name: 'Bath Academy',
      slug: '/bath/schools/bath-academy/',
      ages: '14–19',
      gender: 'Coeducational',
      format: 'Day, Full Boarding',
      dayFee: '£7,226–£8,754/term',
      boardingFee: '£12,768–£14,295/term',
      bursaries: 'Yes',
      location: 'Bath city centre',
      alevel: {"totalExams": 102, "pctAStarA": 0.2549019607843137, "pctAStarB": 0.3627450980392157, "uniqueSubjects": 19, "coreScience": 0.4117647058823529, "mathematics": 0.23529411764705882, "art": 0.00980392156862745, "languages": 0.06862745098039216, "economics": 0.029411764705882353, "english": 0.0196078431372549, "history": 0.00980392156862745, "geography": 0.0392156862745098, "psychology": 0.0784313725490196, "other": 0.09803921568627451}
    },
    {
      id: 'king-edwards-school',
      name: "King Edward's School",
      slug: '/bath/schools/king-edwards-school/',
      ages: '3–18',
      gender: 'Coeducational',
      format: 'Day',
      dayFee: '£3,495–£6,040/term',
      boardingFee: 'Not listed',
      bursaries: 'Yes',
      location: 'Bath',
      alevel: {"totalExams": 455, "pctAStarA": 0.6197802197802198, "pctAStarB": 0.8967032967032967, "uniqueSubjects": 28, "coreScience": 0.1934065934065934, "mathematics": 0.2, "art": 0.05054945054945055, "languages": 0.07472527472527472, "economics": 0.07692307692307693, "english": 0.08791208791208792, "history": 0.05054945054945055, "geography": 0.046153846153846156, "psychology": 0.04835164835164835, "other": 0.17142857142857143}
    },
    {
      id: 'kingswood-preparatory-school',
      name: 'Kingswood Preparatory School',
      slug: '/bath/schools/kingswood-preparatory-school/',
      ages: '9 months–11',
      gender: 'Coeducational',
      format: 'Day',
      dayFee: '£1,710–£7,312/term',
      boardingFee: 'Not listed',
      bursaries: 'Yes',
      location: 'Lansdown, Bath',
      alevel: null
    },
    {
      id: 'kingswood-school',
      name: 'Kingswood School',
      slug: '/bath/schools/kingswood-school/',
      ages: '11–19',
      gender: 'Coeducational',
      format: 'Day, Weekly/Flexible Boarding, Full Boarding',
      dayFee: '£6,125/term',
      boardingFee: '£11,983–£13,264/term',
      bursaries: 'Yes',
      location: 'Lansdown, Bath',
      alevel: {"totalExams": 411, "pctAStarA": 0.48661800486618007, "pctAStarB": 0.7688564476885644, "uniqueSubjects": 26, "coreScience": 0.20924574209245742, "mathematics": 0.17518248175182483, "art": 0.024330900243309004, "languages": 0.0681265206812652, "economics": 0.08759124087591241, "english": 0.06082725060827251, "history": 0.038929440389294405, "geography": 0.09732360097323602, "psychology": 0.0705596107055961, "other": 0.1678832116788321}
    },
    {
      id: 'monkton-combe-school',
      name: 'Monkton Combe School',
      slug: '/bath/schools/monkton-combe-school/',
      ages: '2–19',
      gender: 'Coeducational',
      format: 'Day, Weekly/Flexible Boarding, Full Boarding',
      dayFee: '£1,814–£9,285/term',
      boardingFee: '£10,145–£14,810/term',
      bursaries: 'Yes',
      location: 'Monkton Combe / Bath',
      alevel: {"totalExams": 199, "pctAStarA": 0.37185929648241206, "pctAStarB": 0.6683417085427136, "uniqueSubjects": 24, "coreScience": 0.135678391959799, "mathematics": 0.10552763819095477, "art": 0.271356783919598, "languages": 0.020100502512562814, "economics": 0.04522613065326633, "english": 0.08542713567839195, "history": 0.04522613065326633, "geography": 0, "psychology": 0.08040201005025126, "other": 0.21105527638190955}
    },
    {
      id: 'paragon-school',
      name: 'Paragon School',
      slug: '/bath/schools/paragon-school/',
      ages: '3–11',
      gender: 'Coeducational',
      format: 'Day',
      dayFee: '£540–£4,635/term',
      boardingFee: 'Not listed',
      bursaries: 'Yes',
      location: 'Bath',
      alevel: null
    },
    {
      id: 'prior-park-college',
      name: 'Prior Park College',
      slug: '/bath/schools/prior-park-college/',
      ages: '11–18',
      gender: 'Coeducational',
      format: 'Day, Weekly/Flexible Boarding, Full Boarding',
      dayFee: '£6,225–£6,754/term',
      boardingFee: '£10,490–£13,523/term',
      bursaries: 'Yes',
      location: 'Prior Park, Bath',
      alevel: {"totalExams": 319, "pctAStarA": 0.3573667711598746, "pctAStarB": 0.6300940438871473, "uniqueSubjects": 28, "coreScience": 0.20376175548589343, "mathematics": 0.12225705329153605, "art": 0.12852664576802508, "languages": 0.08150470219435736, "economics": 0.03761755485893417, "english": 0.034482758620689655, "history": 0.06269592476489028, "geography": 0.025078369905956112, "psychology": 0.06583072100313479, "other": 0.23824451410658307}
    },
    {
      id: 'royal-high-school-bath-gdst',
      name: 'Royal High School Bath, GDST',
      slug: '/bath/schools/royal-high-school-bath-gdst/',
      ages: '3–18',
      gender: 'Girls only',
      format: 'Day, Weekly/Flexible Boarding, Full Boarding',
      dayFee: '£3,875–£5,493/term',
      boardingFee: '£10,685–£12,561/term',
      bursaries: 'Yes',
      location: 'Lansdown, Bath',
      alevel: {"totalExams": 134, "pctAStarA": 0.41044776119402987, "pctAStarB": 0.7238805970149254, "uniqueSubjects": 25, "coreScience": 0.20149253731343283, "mathematics": 0.11940298507462686, "art": 0.09701492537313433, "languages": 0.08208955223880597, "economics": 0.014925373134328358, "english": 0.05970149253731343, "history": 0.03731343283582089, "geography": 0.04477611940298507, "psychology": 0.12686567164179105, "other": 0.21641791044776118}
    },
    {
      id: 'downside-school',
      name: 'Downside School',
      slug: '/bath/schools/downside-school/',
      ages: '11–18',
      gender: 'Coeducational',
      format: 'Day, Weekly/Flexible Boarding, Full Boarding',
      dayFee: '£7,260–£8,790/term',
      boardingFee: '£8,490–£14,490/term',
      bursaries: 'Yes',
      location: 'Bath area (near Radstock)',
      alevel: {"totalExams": 125, "pctAStarA": 0.272, "pctAStarB": 0.48, "uniqueSubjects": 21, "coreScience": 0.176, "mathematics": 0.152, "art": 0.096, "languages": 0.072, "economics": 0.128, "english": 0.064, "history": 0.032, "geography": 0.04, "psychology": 0.048, "other": 0.192}
    }
  ];

  const overviewColumns = [
    { key: 'name', label: 'School' },
    { key: 'ages', label: 'Ages' },
    { key: 'gender', label: 'Gender' },
    { key: 'format', label: 'Day / boarding' },
    { key: 'dayFee', label: 'Day fee' },
    { key: 'boardingFee', label: 'Boarding fee' },
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
  const table = document.getElementById('compare-table');
  const tableNote = document.getElementById('compare-table-note');
  const status = document.getElementById('compare-status');
  const pillRow = document.getElementById('compare-pill-row');
  const clearButtons = [document.getElementById('compare-clear'), document.getElementById('compare-clear-top')].filter(Boolean);
  const viewButtons = Array.from(document.querySelectorAll('[data-compare-view]'));

  if (!chooser || !thead || !tbody || !table || !status || !pillRow || !tableNote || !viewButtons.length) return;

  function getQueryIds() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('schools');
    if (!raw) return [];
    return raw.split(',').map(v => v.trim()).filter(Boolean).slice(0, MAX_SELECTION);
  }

  function loadSelection() {
    const queryIds = getQueryIds();
    if (queryIds.length) return queryIds;
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.slice(0, MAX_SELECTION) : [];
    } catch (err) {
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

  function formatPercent(value) {
    return typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : '—';
  }

  function formatCount(value) {
    if (value === null || value === undefined || value === '') return '—';
    return Number(value).toLocaleString('en-GB');
  }

  function renderChooser() {
    chooser.innerHTML = '';
    const limitReached = selected.length >= MAX_SELECTION;

    schools.forEach((school) => {
      const label = document.createElement('label');
      label.className = 'compare-option';
      const isSelected = selected.includes(school.id);
      const disabled = !isSelected && limitReached;
      if (disabled) label.classList.add('is-disabled');

      label.innerHTML = `
        <input type="checkbox" value="${school.id}" ${isSelected ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <span class="compare-option-title">${school.name}</span>
        <span class="compare-option-meta">${school.location}</span>
      `;

      const input = label.querySelector('input');
      input.addEventListener('change', () => {
        if (input.checked) {
          if (!selected.includes(school.id) && selected.length < MAX_SELECTION) {
            selected.push(school.id);
          }
        } else {
          selected = selected.filter((id) => id !== school.id);
        }
        saveSelection();
        renderAll();
      });

      chooser.appendChild(label);
    });
  }

  function renderStatus() {
    status.textContent = selected.length
      ? `Showing ${selected.length} selected school${selected.length === 1 ? '' : 's'}.`
      : 'Showing all Bath schools.';
  }

  function renderPills() {
    pillRow.innerHTML = '';
    if (!selected.length) return;
    selected.forEach((id) => {
      const school = schools.find((item) => item.id === id);
      if (!school) return;
      const pill = document.createElement('div');
      pill.className = 'compare-pill';
      pill.innerHTML = `<span>${school.name}</span><button type="button" aria-label="Remove ${school.name}">×</button>`;
      pill.querySelector('button').addEventListener('click', () => {
        selected = selected.filter((item) => item !== id);
        saveSelection();
        renderAll();
      });
      pillRow.appendChild(pill);
    });
  }

  function renderViewButtons() {
    viewButtons.forEach((button) => {
      const isActive = button.dataset.compareView === currentView;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    table.dataset.view = currentView;
    tableNote.textContent = currentView === 'overview'
      ? 'Overview view covers ages, gender, day or boarding format, fees, bursaries and location.'
      : 'A-level view uses the 2025 senior school spreadsheet. Subject columns show share of total A-level entries, and Other is the combined share of columns W to AL. Schools without A-level data show —.';
  }

  function schoolRows() {
    return selected.length ? schools.filter((school) => selected.includes(school.id)) : schools;
  }

  function renderHead() {
    const columns = currentView === 'overview' ? overviewColumns : alevelColumns;
    thead.innerHTML = `<tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr>`;
  }

  function alevelValue(school, key) {
    if (!school.alevel) return null;
    return school.alevel[key];
  }

  function renderOverviewCell(school, key) {
    if (key === 'name') {
      return `<td><a href="${school.slug}">${school.name}</a></td>`;
    }
    return `<td>${school[key] || '—'}</td>`;
  }

  function renderAlevelCell(school, key) {
    if (key === 'name') {
      return `<td><a href="${school.slug}">${school.name}</a>${school.alevel ? '' : '<span class="compare-cell-note">No A-level data</span>'}</td>`;
    }

    const value = alevelValue(school, key);
    const isPercent = !['totalExams', 'uniqueSubjects'].includes(key);
    const output = isPercent ? formatPercent(value) : formatCount(value);
    const klass = (value === null || value === undefined) ? ' class="compare-na"' : '';
    return `<td${klass}>${output}</td>`;
  }

  function renderTable() {
    const rows = schoolRows();
    const columns = currentView === 'overview' ? overviewColumns : alevelColumns;

    tbody.innerHTML = rows.map((school) => {
      const cells = columns.map((column) => {
        return currentView === 'overview'
          ? renderOverviewCell(school, column.key)
          : renderAlevelCell(school, column.key);
      }).join('');

      return `<tr>${cells}</tr>`;
    }).join('');
  }

  function renderAll() {
    renderChooser();
    renderStatus();
    renderPills();
    renderViewButtons();
    renderHead();
    renderTable();
  }

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selected = [];
      saveSelection();
      renderAll();
    });
  });

  viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.compareView;
      if (!nextView || nextView === currentView) return;
      currentView = nextView;
      saveView();
      renderAll();
    });
  });

  renderAll();
})();
