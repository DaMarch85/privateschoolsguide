(function () {
  function injectSchoolFooterLink() {
    var footerLinkLists = Array.from(document.querySelectorAll('.site-footer .footer-links'));
    if (footerLinkLists.length) {
      footerLinkLists.forEach(function (list) {
        if (list.querySelector('a[href="/claim-your-profile/"]')) return;
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = '/claim-your-profile/';
        link.textContent = 'For schools';
        item.appendChild(link);
        list.appendChild(item);
      });
      return;
    }

    var footerGrid = document.querySelector('.site-footer .footer-grid');
    if (!footerGrid || footerGrid.querySelector('[data-school-footer-link]')) return;

    var block = document.createElement('div');
    block.setAttribute('data-school-footer-link', 'true');
    block.innerHTML = '<h3>For schools</h3><p><a href="/claim-your-profile/">Claim or improve your profile</a></p>';
    footerGrid.insertBefore(block, footerGrid.children[1] || null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSchoolFooterLink);
  } else {
    injectSchoolFooterLink();
  }
})();
