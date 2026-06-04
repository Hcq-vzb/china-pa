(function () {
  'use strict';

  function assetBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('kiwl-header.js') !== -1) {
        return src.replace(/kiwl-header\.js.*$/, '');
      }
    }
    return 'wp-content/kiwl-header/';
  }

  function loadCss(href) {
    if (document.querySelector('link[data-kiwl-header-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-kiwl-header-css', '1');
    document.head.appendChild(link);
  }

  function enhanceHeader() {
    var header = document.querySelector('.inside-header');
    if (!header) return;

    var logo = header.querySelector(':scope > .site-logo');
    if (!logo || header.querySelector('.kiwl-logo-group')) return;

    var group = document.createElement('div');
    group.className = 'kiwl-logo-group';

    var brand = document.createElement('div');
    brand.className = 'kiwl-header-brand';
    brand.innerHTML =
      '<div class="kiwl-brand-title">CHINA PACKAGING MATERIALS</div>' +
      '<div class="kiwl-brand-sub">Powered by <span class="kiwl-brand-kiwl">KIWL</span></div>';

    header.insertBefore(group, logo);
    group.appendChild(logo);
    group.appendChild(brand);
  }

  function init() {
    loadCss(assetBase() + 'kiwl-header.css');
    enhanceHeader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
