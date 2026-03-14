const searchInput = document.getElementById('location-search');
const locationItems = Array.from(document.querySelectorAll('[data-location-item]'));

function filterLocations() {
  if (!searchInput || !locationItems.length) return;
  const query = searchInput.value.trim().toLowerCase();

  let firstVisible = null;

  locationItems.forEach((link) => {
    const name = (link.dataset.name || '').toLowerCase();
    const match = !query || name.includes(query);
    if (link.parentElement) {
      link.parentElement.hidden = !match;
    }
    if (match && !firstVisible) firstVisible = link;
  });

  searchInput.dataset.firstVisibleHref = firstVisible ? firstVisible.getAttribute('href') || '' : '';
}

if (searchInput) {
  searchInput.addEventListener('input', filterLocations);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const href = searchInput.dataset.firstVisibleHref;
      if (href) {
        event.preventDefault();
        window.location.href = href;
      }
    }
  });

  filterLocations();
}
