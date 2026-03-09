(function () {
  const STORAGE_KEY = 'psg-bath-compare';
  const MAX_SELECTION = 4;
  const schools = [
    { id: 'bath-academy', name: 'Bath Academy', slug: '/bath/schools/bath-academy/', ages: '14–19', gender: 'Coeducational', format: 'Day, Full Boarding', dayFee: '£7,226–£8,754/term', boardingFee: '£12,768–£14,295/term', bursaries: 'Yes', location: 'Bath city centre' },
    { id: 'king-edwards-school', name: "King Edward's School", slug: '/bath/schools/king-edwards-school/', ages: '3–18', gender: 'Coeducational', format: 'Day', dayFee: '£3,495–£6,040/term', boardingFee: 'Not listed', bursaries: 'Yes', location: 'Bath' },
    { id: 'kingswood-preparatory-school', name: 'Kingswood Preparatory School', slug: '/bath/schools/kingswood-preparatory-school/', ages: '9 months–11', gender: 'Coeducational', format: 'Day', dayFee: '£1,710–£7,312/term', boardingFee: 'Not listed', bursaries: 'Yes', location: 'Lansdown, Bath' },
    { id: 'kingswood-school', name: 'Kingswood School', slug: '/bath/schools/kingswood-school/', ages: '11–19', gender: 'Coeducational', format: 'Day, Weekly/Flexible Boarding, Full Boarding', dayFee: '£6,125/term', boardingFee: '£11,983–£13,264/term', bursaries: 'Yes', location: 'Lansdown, Bath' },
    { id: 'monkton-combe-school', name: 'Monkton Combe School', slug: '/bath/schools/monkton-combe-school/', ages: '2–19', gender: 'Coeducational', format: 'Day, Weekly/Flexible Boarding, Full Boarding', dayFee: '£1,814–£9,285/term', boardingFee: '£10,145–£14,810/term', bursaries: 'Yes', location: 'Monkton Combe / Bath' },
    { id: 'paragon-school', name: 'Paragon School', slug: '/bath/schools/paragon-school/', ages: '3–11', gender: 'Coeducational', format: 'Day', dayFee: '£540–£4,635/term', boardingFee: 'Not listed', bursaries: 'Yes', location: 'Bath' },
    { id: 'prior-park-college', name: 'Prior Park College', slug: '/bath/schools/prior-park-college/', ages: '11–18', gender: 'Coeducational', format: 'Day, Weekly/Flexible Boarding, Full Boarding', dayFee: '£6,225–£6,754/term', boardingFee: '£10,490–£13,523/term', bursaries: 'Yes', location: 'Prior Park, Bath' },
    { id: 'royal-high-school-bath-gdst', name: 'Royal High School Bath, GDST', slug: '/bath/schools/royal-high-school-bath-gdst/', ages: '3–18', gender: 'Girls only', format: 'Day, Weekly/Flexible Boarding, Full Boarding', dayFee: '£3,875–£5,493/term', boardingFee: '£10,685–£12,561/term', bursaries: 'Yes', location: 'Lansdown, Bath' },
    { id: 'downside-school', name: 'Downside School', slug: '/bath/schools/downside-school/', ages: '11–18', gender: 'Coeducational', format: 'Day, Weekly/Flexible Boarding, Full Boarding', dayFee: '£7,260–£8,790/term', boardingFee: '£8,490–£14,490/term', bursaries: 'Yes', location: 'Bath area (near Radstock)' }
  ];

  const chooser = document.getElementById('compare-chooser');
  const tbody = document.getElementById('compare-tbody');
  const status = document.getElementById('compare-status');
  const pillRow = document.getElementById('compare-pill-row');
  const clearButtons = [document.getElementById('compare-clear'), document.getElementById('compare-clear-top')].filter(Boolean);
  if (!chooser || !tbody || !status || !pillRow) return;

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

  let selected = loadSelection();

  function saveSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
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

  function renderTable() {
    const rows = selected.length ? schools.filter((school) => selected.includes(school.id)) : schools;
    tbody.innerHTML = rows.map((school) => `
      <tr>
        <td><a href="${school.slug}">${school.name}</a></td>
        <td>${school.ages}</td>
        <td>${school.gender}</td>
        <td>${school.format}</td>
        <td>${school.dayFee}</td>
        <td>${school.boardingFee}</td>
        <td>${school.bursaries}</td>
        <td>${school.location}</td>
      </tr>
    `).join('');
  }

  function renderAll() {
    renderChooser();
    renderStatus();
    renderPills();
    renderTable();
  }

  clearButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selected = [];
      saveSelection();
      renderAll();
    });
  });

  renderAll();
})();
