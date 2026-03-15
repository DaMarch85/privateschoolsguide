(function () {
  const root = document.getElementById('compare-root');
  const tables = Array.from(document.querySelectorAll('.compare-matrix'));
  const visibilityBar = document.querySelector('[data-compare-visibility]');

  if (!root || !tables.length || !visibilityBar) return;

  const locationSlug = root.dataset.locationSlug || document.body?.dataset.locationSlug || 'directory';
  const STORAGE_KEY = `psg-${locationSlug}-compare-hidden-columns`;
  const hiddenKeys = new Set(loadHiddenKeys());
  const schoolKeys = [];
  const schoolLabels = new Map();
  const columnCellsByKey = new Map();

  const pillsHost = visibilityBar.querySelector('.fees-visibility-pills');
  const showAllButton = visibilityBar.querySelector('.fees-show-all');

  function normaliseKey(value) {
    return String(value || '').trim();
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
        schoolLabels.set(key, normaliseKey(cell.dataset.schoolLabel) || normaliseKey(cell.querySelector('.fees-school-name')?.textContent) || key);
      }

      const cells = rows
        .map((row) => row.children[index])
        .filter(Boolean);

      cells.forEach((entry) => {
        entry.dataset.schoolKey = key;
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
      button.classList.toggle('is-hidden', isHidden);
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
    schoolKeys.forEach((key) => {
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
    schoolKeys.forEach((key) => {
      const shouldHide = hiddenKeys.has(key);
      (columnCellsByKey.get(key) || []).forEach((cell) => {
        cell.hidden = shouldHide;
      });
    });

    updateHeaderButtons();
    renderVisibilityPills();
    saveHiddenKeys();
    visibilityBar.classList.toggle('has-hidden-schools', hiddenKeys.size > 0);
  }

  if (showAllButton) {
    showAllButton.addEventListener('click', () => {
      hiddenKeys.clear();
      applyVisibility();
    });
  }

  applyVisibility();
})();
