const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('main-nav');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

const filterButton = document.getElementById('filter-button');
const schoolGrid = document.getElementById('school-grid');
const status = document.getElementById('filter-status');

function applyFilters() {
  if (!schoolGrid) return;
  const format = document.getElementById('format-filter').value;
  const age = document.getElementById('age-filter').value;
  const gender = document.getElementById('gender-filter').value;
  const cards = [...schoolGrid.querySelectorAll('.school-card')];

  let visible = 0;
  cards.forEach(card => {
    const matchFormat = !format || card.dataset.format === format || (format === 'boarding' && card.dataset.format === 'boarding');
    const matchAge = !age || card.dataset.age === age;
    const matchGender = !gender || card.dataset.gender === gender;
    const show = matchFormat && matchAge && matchGender;
    card.style.display = show ? '' : 'none';
    if (show) visible += 1;
  });

  if (status) {
    status.classList.add('is-visible');
    status.textContent = visible
      ? `Showing ${visible} highlighted school${visible === 1 ? '' : 's'}. Use the full directory to broaden the search.`
      : 'No highlighted school matches those filters. Use the full Bath directory to widen the search.';
  }
}

if (filterButton) filterButton.addEventListener('click', applyFilters);
