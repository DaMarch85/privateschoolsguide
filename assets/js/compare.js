(function () {
  const root = document.getElementById('compare-root');
  const tables = Array.from(document.querySelectorAll('.compare-matrix'));
  const visibilityBar = document.querySelector('[data-compare-visibility]');
  const tableWraps = Array.from(document.querySelectorAll('.compare-table-wrap'));
  const emptyState = document.querySelector('[data-compare-empty]');

  if (!root || !tables.length || !visibilityBar) return;

  const locationSlug = root.dataset.locationSlug || document.body?.dataset.locationSlug || 'directory';
  const STORAGE_KEY = `psg-${locationSlug}-compare-hidden-columns`;
  const hiddenKeys = new Set(loadHiddenKeys());
  const schoolKeys = [];
  const schoolLabels = new Map();
  const schoolProvision = new Map();
  const columnCellsByKey = new Map();
  const pillsHost = visibilityBar.querySelector('.fees-visibility-pills');
  const showAllButton = visibilityBar.querySelector('.fees-show-all');

  let provisionFilter = normaliseFilter(document.documentElement?.dataset?.provisionFilter || 'mainstream');

  function normaliseKey(value) {
    return String(value || '').trim();
  }

  function normaliseFilter(value) {
    if (value === 'sen_specialist' || value === 'both') return value;
    return 'mainstream';
  }

  function loadHiddenKeys() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.map(normaliseKey).filter(Boolean) : [];
    } catch (error) {
      console.warn('Could not read hidden compare columns from localStorage', error);
      return [];
    }
  }

  function saveHiddenKeys() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hiddenKeys)));
    } catch (error) {
      console.warn('Could not save hidden compare columns to localStorage', error);
    }
  }

  function matchesProvision(key) {
    if (provisionFilter === 'both') return true;
    return (schoolProvision.get(key) || 'mainstream') === provisionFilter;
  }

  function collectTableColumns(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    headerCells.forEach((cell, index) => {
      if (index === 0) return;

      const key = normaliseKey(cell.dataset.schoolKey);
      if (!key) return;

      if (!schoolKeys.includes(key)) {
        schoolKeys.push(key);
        columnCellsByKey.set(key, []);
      }

      if (!schoolLabels.has(key)) {
        schoolLabels.set(
          key,
          normaliseKey(cell.dataset.schoolLabel) || normaliseKey(cell.querySelector('.fees-school-name')?.textContent) || key
        );
      }

      if (!schoolProvision.has(key)) {
        schoolProvision.set(key, cell.dataset.provisionCategory === 'sen_specialist' ? 'sen_specialist' : 'mainstream');
      }

      const cells = rows
        .map((row) => row.children[index])
        .filter(Boolean);

      cells.forEach((entry) => {
        entry.dataset.schoolKey = key;
        if (!entry.dataset.provisionCategory) {
          entry.dataset.provisionCategory = schoolProvision.get(key);
        }
        columnCellsByKey.get(key).push(entry);
      });
    });
  }

  tables.forEach(collectTableColumns);

  function updateHeaderButtons() {
    document.querySelectorAll('.compare-matrix .fees-column-toggle').forEach((button) => {
      const key = normaliseKey(button.dataset.schoolKey);
      if (!key) return;

      const isHidden = hiddenKeys.has(key);
      const isProvisionExcluded = !matchesProvision(key);

      button.classList.toggle('is-hidden', isHidden);
      button.disabled = isProvisionExcluded;
      button.hidden = isProvisionExcluded;
      button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
      button.textContent = isHidden ? 'Show' : 'Hide';

      if (button.dataset.bound === 'true') return;
      button.dataset.bound = 'true';
      button.addEventListener('click', () => {
        if (hiddenKeys.has(key)) hiddenKeys.delete(key);
        else hiddenKeys.add(key);
        applyVisibility();
      });
    });
  }

  function renderVisibilityPills() {
    if (!pillsHost) return;

    pillsHost.innerHTML = '';
    schoolKeys
      .filter(matchesProvision)
      .forEach((key) => {
        const label = schoolLabels.get(key) || key;
        const isHidden = hiddenKeys.has(key);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'fees-visibility-pill';
        pill.dataset.schoolKey = key;
        pill.classList.toggle('is-hidden', isHidden);
        pill.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
        pill.textContent = isHidden ? `Show ${label}` : label;
        pill.addEventListener('click', () => {
          if (isHidden) hiddenKeys.delete(key);
          else hiddenKeys.add(key);
          applyVisibility();
        });
        pillsHost.appendChild(pill);
      });
  }

  function applyVisibility() {
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

    updateHeaderButtons();
    renderVisibilityPills();
    saveHiddenKeys();
    visibilityBar.classList.toggle('has-hidden-schools', hiddenKeys.size > 0);
    visibilityBar.hidden = provisionMatchCount === 0;

    tableWraps.forEach((wrap) => {
      wrap.hidden = visibleCount === 0;
    });

    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  if (showAllButton) {
    showAllButton.addEventListener('click', () => {
      hiddenKeys.clear();
      applyVisibility();
    });
  }

  window.addEventListener('psg:provision-filter-change', function (event) {
    provisionFilter = normaliseFilter(event && event.detail ? event.detail.value : null);
    applyVisibility();
  });

  applyVisibility();
})();
