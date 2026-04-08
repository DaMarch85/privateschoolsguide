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
          name: 'Member profile',
          price: 'Free',
          summary: 'Keeps the profile accurate and clearly school-supported.'
        };
    }
  }

  function showPaymentResultFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var checkout = String(params.get('checkout') || '').toLowerCase();
    var section = byId('claim-payment-result');
    var card = byId('claim-payment-result-card');
    var title = byId('claim-payment-result-title');
    var message = byId('claim-payment-result-message');
    var kicker = byId('claim-payment-result-kicker');

    if (!section || !card || !title || !message || !kicker) return;

    if (checkout === 'success') {
      section.hidden = false;
      card.classList.remove('is-error');
      card.classList.add('is-success');
      kicker.textContent = 'Payment update';
      title.textContent = 'Payment successful';
      message.textContent = 'Stripe confirmed the subscription setup. Your school-supported profile request has been recorded and will now continue through the publishing process.';
      return;
    }

    if (checkout === 'cancel' || checkout === 'unsuccessful' || checkout === 'failed') {
      section.hidden = false;
      card.classList.remove('is-success');
      card.classList.add('is-error');
      kicker.textContent = 'Payment update';
      title.textContent = 'Payment unsuccessful';
      message.textContent = 'The payment was not completed, so the paid package has not gone live yet. Your draft request is still saved and you can try again at any time.';
      return;
    }

    section.hidden = true;
  }

  function buildSchoolFilter(selectId, searchId, resultsId, defaultMessage) {
    var select = byId(selectId);
    var search = byId(searchId);
    var results = byId(resultsId);

    if (!select) {
      return {
        options: [],
        filter: function () {},
        syncValue: function () {}
      };
    }

    var originalOptions = Array.from(select.options || []).slice(1).map(function (option) {
      return {
        value: option.value,
        text: option.textContent || '',
        label: option.getAttribute('data-school-label') || option.textContent || '',
        slug: option.getAttribute('data-school-slug') || ''
      };
    });

    function rebuild(filteredOptions, preserveValue) {
      var placeholder = select.options[0]
        ? select.options[0].textContent || 'Select your school'
        : 'Select your school';

      select.innerHTML = '';

      var placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = placeholder;
      select.appendChild(placeholderOption);

      filteredOptions.forEach(function (optionData) {
        var option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.text;
        option.setAttribute('data-school-label', optionData.label);
        option.setAttribute('data-school-slug', optionData.slug);
        select.appendChild(option);
      });

      if (preserveValue && filteredOptions.some(function (optionData) { return optionData.value === preserveValue; })) {
        select.value = preserveValue;
      } else {
        select.value = '';
      }
    }

    function filter() {
      var query = search ? String(search.value || '').trim().toLowerCase() : '';
      var selectedValue = select.value;
      var filtered = !query
        ? originalOptions.slice()
        : originalOptions.filter(function (option) {
            return option.text.toLowerCase().indexOf(query) !== -1;
          });

      rebuild(filtered, selectedValue);

      if (results) {
        if (!query) {
          results.textContent = defaultMessage || 'Schools are listed alphabetically.';
        } else if (!filtered.length) {
          results.textContent = 'No schools match that search yet. Please check the spelling or clear the search.';
        } else if (filtered.length === 1) {
          results.textContent = '1 school matches your search.';
        } else {
          results.textContent = filtered.length + ' schools match your search.';
        }
      }
    }

    function syncValue(value) {
      if (!value) return;
      var directOption = originalOptions.find(function (option) { return option.value === value; });
      if (!directOption) return;
      rebuild(originalOptions, value);
      if (search) search.value = directOption.text;
    }

    if (search) {
      search.addEventListener('input', filter);
      search.addEventListener('search', filter);
    }

    filter();

    return {
      options: originalOptions,
      filter: filter,
      syncValue: syncValue,
      select: select,
      search: search,
      results: results
    };
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        if (!response.ok) {
          throw new Error(data && data.error ? data.error : 'The request could not be completed right now.');
        }
        return data || {};
      });
    });
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
    var schoolFilter = buildSchoolFilter('school-id', 'school-search', 'school-search-results', 'Schools are listed alphabetically.');

    function currentPlan() {
      var selected = form.querySelector('input[name="plan_slug"]:checked');
      return normalizePlan(selected ? selected.value : 'claimed');
    }

    function maxImagesForPlan(plan) {
      return normalizePlan(plan) === 'claimed' ? 1 : 5;
    }

    function shouldContinueToPayment(plan) {
      return plan !== 'claimed' && !(foundingCheckbox && foundingCheckbox.checked);
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
          ? 'Member profiles can upload 1 image.'
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

      if (submitButton) {
        submitButton.textContent = shouldContinueToPayment(plan) ? 'Continue to payment' : 'Submit school profile';
      }
    }

    function prefillFromQuery() {
      var schoolParam = params.get('school');
      var planParam = normalizePlan(params.get('plan') || params.get('package'));

      if (schoolParam) {
        schoolFilter.syncValue(schoolParam);
      }

      if (planParam) {
        planInputs.forEach(function (input) {
          input.checked = input.value === planParam;
        });
      }

      if (params.get('checkout') === 'success') {
        setStatus(status, 'Stripe confirmed the subscription setup. The school-supported profile request has been recorded successfully.', 'is-success');
      } else if (params.get('checkout') === 'cancel') {
        setStatus(status, 'Stripe Checkout was cancelled. The draft school profile request is still saved and can be submitted again whenever you are ready.', 'is-info');
      }

      syncPlanUi();
    }

    planInputs.forEach(function (input) {
      input.addEventListener('change', syncPlanUi);
    });

    if (foundingCheckbox) {
      foundingCheckbox.addEventListener('change', syncPlanUi);
    }

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
          submitButton.textContent = originalButtonText || (shouldContinueToPayment(currentPlan()) ? 'Continue to payment' : 'Submit school profile');
        }
      }
    });
  }

  function initManageForm() {
    var form = byId('school-manage-form');
    if (!form) return;

    var functionsBase = String(form.dataset.functionsBase || '').replace(/\/$/, '');
    var status = byId('school-manage-status');
    var statusButton = byId('school-manage-status-button');
    var schoolSelect = byId('manage-school-id');
    var emailInput = byId('manage-contact-email');
    var summaryPlan = byId('manage-summary-plan');
    var summaryPrice = byId('manage-summary-price');
    var summaryDetail = byId('manage-summary-detail');
    var actionsHost = byId('manage-action-buttons');
    var schoolFilter = buildSchoolFilter('manage-school-id', 'manage-school-search', 'manage-school-search-results', 'Only live school-supported profiles appear here.');
    var isBusy = false;

    function setBusy(nextBusy, buttonText) {
      isBusy = nextBusy;
      if (statusButton) {
        statusButton.disabled = nextBusy;
        if (buttonText) statusButton.textContent = buttonText;
        else if (!nextBusy) statusButton.textContent = 'Check current profile';
      }
      if (actionsHost) {
        Array.from(actionsHost.querySelectorAll('button')).forEach(function (button) {
          button.disabled = nextBusy;
        });
      }
    }

    function selectedSchoolId() {
      return schoolSelect ? schoolSelect.value : '';
    }

    function selectedEmail() {
      return emailInput ? String(emailInput.value || '').trim() : '';
    }

    function renderManageSummary(payload) {
      if (summaryPlan) summaryPlan.textContent = payload.currentPlanLabel || 'Member profile';
      if (summaryPrice) summaryPrice.textContent = payload.currentPriceLabel || '';
      if (summaryDetail) summaryDetail.textContent = payload.currentSummary || '';
    }

    function renderCancelledSummary() {
      if (summaryPlan) summaryPlan.textContent = 'Profile cancelled';
      if (summaryPrice) summaryPrice.textContent = 'No live school-supported package';
      if (summaryDetail) summaryDetail.textContent = 'This school is no longer marked as a school-supported profile.';
    }

    function renderActionButtons(payload) {
      if (!actionsHost) return;
      actionsHost.innerHTML = '';

      var actions = Array.isArray(payload.availableActions) ? payload.availableActions : [];
      if (!actions.length) {
        actionsHost.hidden = true;
        return;
      }

      actions.forEach(function (action) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'claim-manage-action';
        if (action.tone === 'primary') button.classList.add('claim-manage-action--primary');
        if (action.tone === 'danger') button.classList.add('claim-manage-action--danger');
        button.textContent = action.label || 'Continue';
        button.setAttribute('data-manage-action', action.action || 'status');
        if (action.targetPlan) button.setAttribute('data-target-plan', action.targetPlan);
        actionsHost.appendChild(button);
      });

      actionsHost.hidden = false;
    }

    async function runManageRequest(action, targetPlan) {
      if (isBusy) return;
      if (!functionsBase) {
        setStatus(status, 'This page is missing its form endpoint configuration.', 'is-error');
        return null;
      }
      if (!form.reportValidity()) return null;

      var schoolId = selectedSchoolId();
      var contactEmail = selectedEmail();
      if (!schoolId || !contactEmail) {
        setStatus(status, 'Choose your school and enter the school contact email address first.', 'is-error');
        return null;
      }

      setBusy(true, action === 'status' ? 'Checking…' : 'Updating…');
      setStatus(status, '', '');

      try {
        var payload = await postJson(functionsBase + '/school-claim-manage', {
          action: action,
          schoolId: schoolId,
          contactEmail: contactEmail,
          targetPlan: targetPlan || undefined
        });
        return payload;
      } catch (error) {
        setStatus(status, error && error.message ? error.message : 'We could not manage the school profile right now.', 'is-error');
        return null;
      } finally {
        setBusy(false);
      }
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var payload = await runManageRequest('status');
      if (!payload) return;
      renderManageSummary(payload);
      renderActionButtons(payload);
      setStatus(status, 'Current profile loaded for ' + (payload.schoolName || 'this school') + '.', 'is-info');
    });

    if (actionsHost) {
      actionsHost.addEventListener('click', async function (event) {
        var button = event.target && event.target.closest('[data-manage-action]');
        if (!button) return;

        var action = button.getAttribute('data-manage-action') || 'status';
        var targetPlan = button.getAttribute('data-target-plan') || '';
        var confirmMessage = '';

        if (action === 'cancel_profile') {
          confirmMessage = 'Cancel this school-supported profile and remove its live package?';
        } else if (action === 'change_plan' && targetPlan === 'claimed') {
          confirmMessage = 'Downgrade this live package to the free Member profile?';
        }

        if (confirmMessage && !window.confirm(confirmMessage)) {
          return;
        }

        var payload = await runManageRequest(action, targetPlan);
        if (!payload) return;

        if (payload.checkoutUrl) {
          window.location.href = payload.checkoutUrl;
          return;
        }

        if (action === 'cancel_profile') {
          renderCancelledSummary();
          if (actionsHost) {
            actionsHost.innerHTML = '';
            actionsHost.hidden = true;
          }
          setStatus(status, payload.message || 'The live school-supported profile has been cancelled.', 'is-success');
          return;
        }

        var successMessage = payload.message || 'The school-supported profile has been updated.';
        setStatus(status, successMessage, 'is-success');

        var refreshed = await runManageRequest('status');
        if (refreshed) {
          renderManageSummary(refreshed);
          renderActionButtons(refreshed);
          setStatus(status, successMessage, 'is-success');
        }
      });
    }
  }

  function initPage() {
    showPaymentResultFromQuery();
    initClaimForm();
    initManageForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
})();
