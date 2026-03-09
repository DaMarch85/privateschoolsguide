const PSG_COMPARE_KEY = 'psg-compare-v1';
const PSG_COMPARE_LIMIT = 4;
const PSG_SCHOOLS = [
  {id:'bath-academy', name:'Bath Academy', url:'/bath/schools/bath-academy/'},
  {id:'king-edwards-school', name:'King Edward\'s School', url:'/bath/schools/king-edwards-school/'},
  {id:'kingswood-preparatory-school', name:'Kingswood Preparatory School', url:'/bath/schools/kingswood-preparatory-school/'},
  {id:'kingswood-school', name:'Kingswood School', url:'/bath/schools/kingswood-school/'},
  {id:'monkton-combe-school', name:'Monkton Combe School', url:'/bath/schools/monkton-combe-school/'},
  {id:'paragon-school', name:'Paragon School', url:'/bath/schools/paragon-school/'},
  {id:'prior-park-college', name:'Prior Park College', url:'/bath/schools/prior-park-college/'},
  {id:'royal-high-school-bath-gdst', name:'Royal High School Bath, GDST', url:'/bath/schools/royal-high-school-bath-gdst/'},
  {id:'downside-school', name:'Downside School', url:'/bath/schools/downside-school/'}
];

function readCompareSelection() {
  try {
    const value = window.localStorage.getItem(PSG_COMPARE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function writeCompareSelection(ids) {
  const unique = Array.from(new Set(ids)).slice(0, PSG_COMPARE_LIMIT);
  window.localStorage.setItem(PSG_COMPARE_KEY, JSON.stringify(unique));
  return unique;
}

function updateCompareButtons() {
  const selected = readCompareSelection();
  document.querySelectorAll('[data-compare-toggle]').forEach((button) => {
    const schoolId = button.dataset.schoolId;
    const active = selected.includes(schoolId);
    button.classList.toggle('is-selected', active);
    button.textContent = active ? 'Added to compare' : 'Add to compare';
    button.setAttribute('aria-pressed', String(active));
  });

  document.querySelectorAll('[data-compare-link]').forEach((link) => {
    const count = selected.length;
    link.textContent = count > 0 ? `Compare selected (${count})` : 'Compare schools';
  });

  const shortlistStatus = document.getElementById('compare-shortlist-status');
  if (shortlistStatus) {
    shortlistStatus.textContent = selected.length
      ? `${selected.length} school${selected.length === 1 ? '' : 's'} selected. Go to the compare page to view them side by side.`
      : 'No schools selected yet. Add up to 4 schools to compare them side by side.';
  }
}

function renderComparePicker() {
  const picker = document.getElementById('compare-picker');
  if (!picker) return;
  const selected = readCompareSelection();
  picker.innerHTML = PSG_SCHOOLS.map((school) => `
    <label class="compare-choice">
      <input type="checkbox" data-compare-checkbox value="${school.id}" ${selected.includes(school.id) ? 'checked' : ''}>
      <span>${school.name}</span>
    </label>
  `).join('');

  picker.querySelectorAll('[data-compare-checkbox]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const current = readCompareSelection();
      const schoolId = event.target.value;
      let next = current.slice();
      if (event.target.checked) {
        if (current.length >= PSG_COMPARE_LIMIT) {
          event.target.checked = false;
          window.alert('Please compare up to 4 schools at a time.');
          return;
        }
        next.push(schoolId);
      } else {
        next = current.filter((id) => id !== schoolId);
      }
      writeCompareSelection(next);
      updateCompareButtons();
      renderComparePage();
    });
  });
}

function renderComparePage() {
  const rows = Array.from(document.querySelectorAll('[data-compare-row]'));
  if (!rows.length) return;
  const selected = readCompareSelection();
  const helper = document.getElementById('compare-table-helper');
  const message = document.getElementById('compare-selected-message');

  if (!selected.length) {
    rows.forEach((row) => { row.hidden = false; });
    if (helper) helper.textContent = 'Showing all Bath schools.';
    if (message) message.textContent = 'Select up to 4 schools to focus the comparison table.';
  } else {
    rows.forEach((row) => {
      row.hidden = !selected.includes(row.dataset.schoolId);
    });
    if (helper) helper.textContent = `Showing ${selected.length} selected school${selected.length === 1 ? '' : 's'}.`;
    if (message) message.textContent = `${selected.length} school${selected.length === 1 ? '' : 's'} selected. Adjust your shortlist below.`;
  }

  const clearButton = document.getElementById('compare-clear');
  if (clearButton) {
    clearButton.disabled = !selected.length;
  }

  renderComparePicker();
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  const form = document.getElementById('bath-filter');
  const summary = document.getElementById('bath-results-summary');
  const cards = Array.from(document.querySelectorAll('.school-card'));
  if (form && cards.length) {
    const format = document.getElementById('filter-format');
    const stage = document.getElementById('filter-stage');
    const gender = document.getElementById('filter-gender');

    const applyFilters = (event) => {
      if (event) event.preventDefault();

      const formatValue = format ? format.value : 'all';
      const stageValue = stage ? stage.value : 'all';
      const genderValue = gender ? gender.value : 'all';

      let visible = 0;

      cards.forEach((card) => {
        const matchesFormat = formatValue === 'all'
          || (formatValue === 'day' && card.dataset.day === 'yes')
          || (formatValue === 'boarding' && card.dataset.boarding === 'yes');

        const matchesStage = stageValue === 'all'
          || card.dataset.stage === stageValue;

        const matchesGender = genderValue === 'all'
          || (genderValue === 'single' && card.dataset.gender !== 'coed')
          || card.dataset.gender === genderValue;

        const show = matchesFormat && matchesStage && matchesGender;
        card.hidden = !show;
        if (show) visible += 1;
      });

      if (summary) {
        summary.textContent = visible === cards.length
          ? `Showing all ${cards.length} schools`
          : visible === 0
            ? 'No schools match those filters yet. Try another combination.'
            : `Showing ${visible} of ${cards.length} schools`;
      }
    };

    form.addEventListener('submit', applyFilters);
    [format, stage, gender].forEach((field) => {
      if (field) field.addEventListener('change', applyFilters);
    });
  }

  document.querySelectorAll('[data-compare-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const schoolId = button.dataset.schoolId;
      const selected = readCompareSelection();
      let next;
      if (selected.includes(schoolId)) {
        next = selected.filter((id) => id !== schoolId);
      } else {
        if (selected.length >= PSG_COMPARE_LIMIT) {
          window.alert('Please compare up to 4 schools at a time.');
          return;
        }
        next = [...selected, schoolId];
      }
      writeCompareSelection(next);
      updateCompareButtons();
      renderComparePage();
    });
  });

  const clearCompare = document.getElementById('compare-clear');
  if (clearCompare) {
    clearCompare.addEventListener('click', () => {
      writeCompareSelection([]);
      updateCompareButtons();
      renderComparePage();
    });
  }

  updateCompareButtons();
  renderComparePage();
});
