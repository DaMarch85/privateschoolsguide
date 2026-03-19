(function () {
  const buttons = Array.from(document.querySelectorAll('[data-provision-filter-option]'));
  if (!buttons.length) return;

  function normaliseFilter(value) {
    if (value === 'sen_specialist' || value === 'both') return value;
    return 'mainstream';
  }

  function normaliseCategory(value) {
    return value === 'sen_specialist' ? 'sen_specialist' : 'mainstream';
  }

  function matchesFilter(category, filterValue) {
    if (filterValue === 'both') return true;
    return normaliseCategory(category) === filterValue;
  }

  function setButtons(filterValue) {
    buttons.forEach(function (button) {
      const isActive = normaliseFilter(button.dataset.provisionFilterOption) === filterValue;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function applySimpleGroup(itemSelector, containerSelector, emptySelector, filterValue) {
    const items = Array.from(document.querySelectorAll(itemSelector));
    if (!items.length) return;

    let visibleCount = 0;

    items.forEach(function (item) {
      const shouldShow = matchesFilter(item.dataset.provisionCategory, filterValue);
      item.hidden = !shouldShow;
      if (shouldShow) visibleCount += 1;
    });

    const container = document.querySelector(containerSelector);
    if (container) container.hidden = visibleCount === 0;

    const emptyState = document.querySelector(emptySelector);
    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  function applySimpleFilters(filterValue) {
    applySimpleGroup('[data-school-card]', '[data-provision-container="cards"]', '[data-provision-empty="cards"]', filterValue);
    applySimpleGroup('[data-bursary-card]', '[data-provision-container="bursaries"]', '[data-provision-empty="bursaries"]', filterValue);
    applySimpleGroup('[data-open-day-row]', '[data-provision-container="open-days"]', '[data-provision-empty="open-days"]', filterValue);
  }

  function dispatchFilterChange(filterValue) {
    window.dispatchEvent(new CustomEvent('psg:provision-filter-change', {
      detail: { value: filterValue }
    }));
  }

  function applyFilter(nextValue) {
    const filterValue = normaliseFilter(nextValue);
    document.documentElement.dataset.provisionFilter = filterValue;
    setButtons(filterValue);
    applySimpleFilters(filterValue);
    dispatchFilterChange(filterValue);
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      applyFilter(button.dataset.provisionFilterOption);
    });
  });

  applyFilter(normaliseFilter(document.documentElement.dataset.provisionFilter));
})();
