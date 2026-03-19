(function () {
  const feeSwitch = document.querySelector('[data-fees-switch]');
  const tables = Array.from(document.querySelectorAll('[data-fees-table]'));
  const emptyState = document.querySelector('[data-fees-empty]');

  if (!tables.length) return;

  const buttons = feeSwitch ? Array.from(feeSwitch.querySelectorAll('[data-fees-view]')) : [];
  const tableElements = tables
    .map((wrap) => wrap.querySelector('.fees-matrix'))
    .filter(Boolean);

  const schoolKeys = [];
  const schoolLabels = new Map();
  const schoolProvision = new Map();
  const columnCellsByKey = new Map();
  const hiddenKeys = new Set();
  let provisionFilter = normaliseFilter(document.documentElement?.dataset?.provisionFilter || 'mainstream');
  let activeView = buttons.find((button) => button.classList.contains('is-active'))?.getAttribute('data-fees-view')
    || tables[0]?.getAttribute('data-fees-table')
    || '';

  function normaliseFilter(value) {
    if (value === 'sen_specialist' || value === 'both') return value;
    return 'mainstream';
  }

  function normaliseSchoolKey(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function matchesProvision(key) {
    if (provisionFilter === 'both') return true;
    return (schoolProvision.get(key) || 'mainstream') === provisionFilter;
  }

  function collectColumns(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    headerCells.forEach((cell, index) => {
      if (index === 0) return;

      const schoolKey = cell.dataset.schoolKey || normaliseSchoolKey(cell.textContent);
      cell.dataset.schoolKey = schoolKey;

      if (!schoolKeys.includes(schoolKey)) {
        schoolKeys.push(schoolKey);
        columnCellsByKey.set(schoolKey, []);
      }

      if (!schoolLabels.has(schoolKey)) {
        schoolLabels.set(schoolKey, cell.dataset.schoolLabel || normaliseSchoolKey(cell.textContent) || schoolKey);
      }

      if (!schoolProvision.has(schoolKey)) {
        schoolProvision.set(schoolKey, cell.dataset.provisionCategory === 'sen_specialist' ? 'sen_specialist' : 'mainstream');
      }

      const cells = rows
        .map((row) => row.children[index])
        .filter(Boolean);

      cells.forEach((entry) => {
        entry.dataset.schoolKey = schoolKey;
        if (!entry.dataset.provisionCategory) {
          entry.dataset.provisionCategory = schoolProvision.get(schoolKey);
        }
        columnCellsByKey.get(schoolKey).push(entry);
      });
    });
  }

  tableElements.forEach(collectColumns);

  const visibilityBar = document.createElement('div');
  visibilityBar.className = 'fees-visibility-bar';
  visibilityBar.innerHTML = `
    <div class="fees-visibility-head">
      <p class="fees-visibility-label">School columns</p>
      <button type="button" class="fees-show-all">Show all schools</button>
    </div>
    <div class="fees-visibility-pills" aria-live="polite"></div>
  `;

  const firstWrap = tables[0];
  if (firstWrap && firstWrap.parentElement) {
    firstWrap.parentElement.insertBefore(visibilityBar, firstWrap);
  }

  const pillsHost = visibilityBar.querySelector('.fees-visibility-pills');
  const showAllButton = visibilityBar.querySelector('.fees-show-all');

  function setHeaderToggleState() {
    document.querySelectorAll('.fees-column-toggle').forEach((button) => {
      const key = button.dataset.schoolKey;
      const isHidden = hiddenKeys.has(key);
      const isProvisionExcluded = !matchesProvision(key);
      button.classList.toggle('is-hidden', isHidden);
      button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
      button.textContent = isHidden ? 'Show' : 'Hide';
      button.hidden = isProvisionExcluded;
      button.disabled = isProvisionExcluded;
    });
  }

  function renderPills() {
    pillsHost.innerHTML = '';
    schoolKeys
      .filter(matchesProvision)
      .forEach((key) => {
        const isHidden = hiddenKeys.has(key);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'fees-visibility-pill';
        pill.dataset.schoolKey = key;
        pill.classList.toggle('is-hidden', isHidden);
        pill.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
        pill.textContent = isHidden ? `Show ${schoolLabels.get(key) || key}` : (schoolLabels.get(key) || key);
        pill.addEventListener('click', () => {
          if (isHidden) hiddenKeys.delete(key);
          else hiddenKeys.add(key);
          applyColumnVisibility();
        });
        pillsHost.appendChild(pill);
      });

    visibilityBar.classList.toggle('has-hidden-schools', hiddenKeys.size > 0);
  }

  function attachHeaderButtons() {
    tableElements.forEach((table) => {
      const headerCells = Array.from(table.querySelectorAll('thead th'));
      headerCells.forEach((cell, index) => {
        if (index === 0 || cell.dataset.toggleReady === 'true') return;
        cell.dataset.toggleReady = 'true';

        const schoolKey = cell.dataset.schoolKey || normaliseSchoolKey(cell.textContent);
        const schoolLabel = cell.dataset.schoolLabel || normaliseSchoolKey(cell.textContent) || schoolKey;
        const headerNameHtml = cell.innerHTML;
        cell.innerHTML = `
          <span class="fees-school-name">${headerNameHtml}</span>
          <button type="button" class="fees-column-toggle" data-school-key="${schoolKey}" aria-pressed="false">Hide</button>
        `;
        cell.dataset.schoolKey = schoolKey;
        cell.dataset.schoolLabel = schoolLabel;

        const button = cell.querySelector('.fees-column-toggle');
        if (button) {
          button.addEventListener('click', () => {
            if (hiddenKeys.has(schoolKey)) hiddenKeys.delete(schoolKey);
            else hiddenKeys.add(schoolKey);
            applyColumnVisibility();
          });
        }
      });
    });
  }

  function syncTableVisibility(visibleCount) {
    tables.forEach((table) => {
      const matchesView = table.getAttribute('data-fees-table') === activeView;
      table.hidden = !matchesView || visibleCount === 0;
    });

    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  function applyColumnVisibility() {
    let provisionMatchCount = 0;
    let visibleCount = 0;

    schoolKeys.forEach((key) => {
      const inProvisionScope = matchesProvision(key);
      const shouldHide = !inProvisionScope || hiddenKeys.has(key);

      if (inProvisionScope) provisionMatchCount += 1;
      if (!shouldHide) visibleCount += 1;

      (columnCellsByKey.get(key) || []).forEach((cell) => {
        cell.hidden = shouldHide;
      });
    });

    visibilityBar.hidden = provisionMatchCount === 0;
    setHeaderToggleState();
    renderPills();
    syncTableVisibility(visibleCount);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      activeView = button.getAttribute('data-fees-view') || activeView;
      buttons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
      applyColumnVisibility();
    });
  });

  if (showAllButton) {
    showAllButton.addEventListener('click', () => {
      hiddenKeys.clear();
      applyColumnVisibility();
    });
  }

  attachHeaderButtons();

  window.addEventListener('psg:provision-filter-change', function (event) {
    provisionFilter = normaliseFilter(event && event.detail ? event.detail.value : null);
    applyColumnVisibility();
  });

  applyColumnVisibility();
})();
