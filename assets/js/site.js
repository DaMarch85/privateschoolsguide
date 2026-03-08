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
});