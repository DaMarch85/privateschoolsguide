(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(target, message, tone) {
    if (!target) return;
    target.hidden = !message;
    target.textContent = message || '';
    target.classList.remove('is-success', 'is-error', 'is-info');
    if (tone) target.classList.add(tone);
  }

  function normalizePlan(value) {
    var raw = String(value || '').toLowerCase();
    if (raw === 'featured') return 'featured';
    if (raw === 'enhanced') return 'enhanced';
    return 'claimed';
  }

  function packageCopy(plan) {
    switch (normalizePlan(plan)) {
      case 'featured':
        return {
          name: 'Featured profile',
          price: '£99 / month',
          summary: 'Priority placement above Enhanced profiles on browse pages.'
        };
      case 'enhanced':
        return {
          name: 'Enhanced profile',
          price: '£39 / month',
          summary: 'Priority placement above free listings on browse pages.'
        };
      default:
        return {
          name: 'Claimed profile',
          price: 'Free',
          summary: 'Keeps the profile accurate and clearly school-managed.'
        };
    }
  }

  function initClaimForm() {
    var form = byId('school-claim-form');
    if (!form) return;

    var status = byId('school-claim-status');
    var schoolSelect = byId('school-id');
    var imageInput = byId('school-images');
    var imageHelp = byId('school-images-help');
    var foundingWrap = byId('founding-programme-wrap');
    var foundingNote = byId('founding-programme-note');
    var foundingCheckbox = byId('founding-programme');
    var submitButton = form.querySelector('button[type="submit"]');
    var selectedPlanName = document.querySelector('[data-selected-plan-name]');
    var selectedPlanPrice = document.querySelector('[data-selected-plan-price]');
    var selectedPlanSummary = document.querySelector('[data-selected-plan-summary]');
    var planCards = Array.from(document.querySelectorAll('[data-plan-card]'));
    var planInputs = Array.from(form.querySelectorAll('input[name="plan_slug"]'));
    var functionsBase = String(form.dataset.functionsBase || '').replace(/\/$/, '');
    var params = new URLSearchParams(window.location.search);

    function currentPlan() {
      var selected = form.querySelector('input[name="plan_slug"]:checked');
      return normalizePlan(selected ? selected.value : 'claimed');
    }

    function maxImagesForPlan(plan) {
      return normalizePlan(plan) === 'claimed' ? 1 : 5;
    }

    function syncPlanUi() {
      var plan = currentPlan();
      var copy = packageCopy(plan);
      planCards.forEach(function (card) {
        card.classList.toggle('is-selected', card.getAttribute('data-plan-card') === plan);
      });

      if (selectedPlanName) selectedPlanName.textContent = copy.name;
      if (selectedPlanPrice) selectedPlanPrice.textContent = copy.price;
      if (selectedPlanSummary) selectedPlanSummary.textContent = copy.summary;

      if (imageHelp) {
        imageHelp.textContent = plan === 'claimed'
          ? 'Claimed profiles can upload 1 image.'
          : 'Enhanced and Featured profiles can upload up to 5 images.';
      }

      if (imageInput) imageInput.multiple = plan !== 'claimed';

      var allowFounding = plan === 'enhanced';
      if (foundingWrap) foundingWrap.classList.toggle('is-disabled', !allowFounding);
      if (foundingNote) foundingNote.textContent = allowFounding
        ? 'Available when Enhanced is selected.'
        : 'The Founding School Programme only applies to the Enhanced profile.';
      if (foundingCheckbox) {
        foundingCheckbox.disabled = !allowFounding;
        if (!allowFounding) foundingCheckbox.checked = false;
      }
    }

    function prefillFromQuery() {
      var schoolParam = params.get('school');
      var planParam = normalizePlan(params.get('plan') || params.get('package'));

      if (schoolParam && schoolSelect) {
        var options = Array.from(schoolSelect.options || []);
        var directOption = options.find(function (option) { return option.value === schoolParam; });
        if (directOption) schoolSelect.value = schoolParam;
      }

      if (planParam) {
        planInputs.forEach(function (input) {
          input.checked = input.value === planParam;
        });
      }

      if (params.get('checkout') === 'success') {
        setStatus(status, 'Stripe confirmed the subscription setup. The school profile request has been recorded and is ready for publishing.', 'is-success');
      } else if (params.get('checkout') === 'cancel') {
        setStatus(status, 'Stripe Checkout was cancelled. The draft school claim is still saved and can be submitted again whenever you are ready.', 'is-info');
      }

      syncPlanUi();
    }

    planInputs.forEach(function (input) {
      input.addEventListener('change', syncPlanUi);
    });

    if (imageInput) {
      imageInput.addEventListener('change', function () {
        var max = maxImagesForPlan(currentPlan());
        if (imageInput.files && imageInput.files.length > max) {
          imageInput.value = '';
          setStatus(status, 'Please upload no more than ' + max + ' image' + (max === 1 ? '' : 's') + ' for this package.', 'is-error');
        }
      });
    }

    prefillFromQuery();

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      setStatus(status, '', '');

      if (!functionsBase) {
        setStatus(status, 'This page is missing its form endpoint configuration.', 'is-error');
        return;
      }

      var maxImages = maxImagesForPlan(currentPlan());
      if (imageInput && imageInput.files && imageInput.files.length > maxImages) {
        setStatus(status, 'Please upload no more than ' + maxImages + ' image' + (maxImages === 1 ? '' : 's') + ' for this package.', 'is-error');
        return;
      }

      if (!form.reportValidity()) return;

      var originalButtonText = submitButton ? submitButton.textContent : '';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting…';
      }

      try {
        var formData = new FormData(form);
        if (foundingCheckbox && foundingCheckbox.disabled) {
          formData.delete('founding_programme');
        }

        var response = await fetch(functionsBase + '/school-claim-submit', {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json'
          }
        });

        var payload = await response.json().catch(function () { return null; });
        if (!response.ok) {
          throw new Error(payload && payload.error ? payload.error : 'We could not submit the school profile right now.');
        }

        if (payload && payload.checkoutUrl) {
          window.location.href = payload.checkoutUrl;
          return;
        }

        setStatus(status, (payload && payload.message) || 'Your school profile request has been submitted successfully.', 'is-success');
      } catch (error) {
        setStatus(status, error && error.message ? error.message : 'We could not submit the school profile right now.', 'is-error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText || 'Submit school profile';
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClaimForm);
  } else {
    initClaimForm();
  }
})();
