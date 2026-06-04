(function () {
  'use strict';

  var WA_PHONE = '8617751189576';
  var STORAGE_KEY = 'kiwl_chat_seen';
  var HINT_KEY = 'kiwl_chat_hint_dismissed';

  function storageGet(key) {
    try {
      if (localStorage.getItem(key) === '1') return true;
    } catch (e) {}
    try {
      if (sessionStorage.getItem(key) === '1') return true;
    } catch (e) {}
    return false;
  }

  function storageSet(key) {
    try {
      localStorage.setItem(key, '1');
    } catch (e) {}
    try {
      sessionStorage.setItem(key, '1');
    } catch (e) {}
  }

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
  var ICON_WA =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function pageUrl() {
    return window.location.href;
  }

  function waLink(extra) {
    var text =
      extra ||
      "Hello, I'm interested in KIWL Plastic packaging products. Page: " + pageUrl();
    return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(text);
  }

  function pageContext() {
    var path = (window.location.pathname || '').toLowerCase();
    var title = document.title || '';
    if (path.indexOf('/product/') !== -1) {
      var h1 = document.querySelector('h1.product_title, h1.entry-title, h1');
      return {
        type: 'product',
        label: h1 ? h1.textContent.trim() : 'this product',
        title: title,
      };
    }
    if (path.indexOf('product-category') !== -1) {
      return { type: 'category', label: 'this category', title: title };
    }
    if (path.indexOf('contact') !== -1) {
      return { type: 'contact', label: 'contact', title: title };
    }
    return { type: 'general', label: 'our website', title: title };
  }

  function injectCriticalCss() {
    if (document.getElementById('kiwl-chat-critical')) return;
    var style = document.createElement('style');
    style.id = 'kiwl-chat-critical';
    style.textContent =
      '#kiwl-chat-root .kiwl-chat-panel{display:none!important;box-shadow:none!important;opacity:1;visibility:visible;transform:none}' +
      '#kiwl-chat-root .kiwl-chat-panel.is-open{display:flex!important}';
    document.head.appendChild(style);
  }

  function loadCss(href) {
    if (document.querySelector('link[data-kiwl-chat-css]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-kiwl-chat-css', '1');
    document.head.appendChild(link);
  }

  function scriptBase() {
    var s = document.currentScript;
    if (s && s.src) {
      return s.src.replace(/[^/]+$/, '');
    }
    return 'wp-content/kiwl-chat/';
  }

  var RESPONSES = {
    products: {
      html:
        '<strong>Our core product lines</strong> (from KIWL Plastic catalog):<ul>' +
        '<li><strong>Plastic Sprayers</strong> — trigger, fine mist, throat &amp; more</li>' +
        '<li><strong>Dispensing Pumps</strong> — lotion, foam, treatment, cosmetic</li>' +
        '<li><strong>Plastic Caps</strong> — flip top, disc top, CRC, screw caps</li>' +
        '<li><strong>Bottles &amp; Jars</strong> — PET/PE/PP bottles and plastic jars</li>' +
        '<li><strong>PET Preforms</strong> — for stretch blow molding</li>' +
        '</ul>Browse categories on this site or tell our sales manager what you need on WhatsApp.',
    },
    samples: {
      html:
        '<strong>Samples &amp; MOQ</strong><ul>' +
        '<li>Many items: <strong>MOQ from 10,000 pcs</strong> (factory direct pricing)</li>' +
        '<li><strong>Free samples</strong> available — use “Add to Free Sample” on product pages</li>' +
        '<li>Custom colors often from <strong>30,000 pcs</strong></li>' +
        '<li>Dip tube length &amp; neck finish can be customized to your bottle</li>' +
        '</ul>Share your target item# or product link on WhatsApp for a quick quote.',
    },
    oem: {
      html:
        '<strong>OEM / ODM support</strong><ul>' +
        '<li>Full <strong>OEM &amp; ODM</strong> for worldwide brands</li>' +
        '<li>Plastic packaging for beauty, personal care, household &amp; pharma</li>' +
        '<li>Based in <strong>Yuyao, Ningbo, Zhejiang, China</strong></li>' +
        '<li>Export-ready quality with competitive factory pricing</li>' +
        '</ul>Send drawings, photos, or reference samples to our sales team on WhatsApp.',
    },
    contact: {
      html:
        '<strong>Talk to our sales manager</strong><br>' +
        'We reply fastest on <strong>WhatsApp</strong>. Click the green button below — your current page link will be included so we know exactly what you are viewing.<br><br>' +
        '<strong>KIWL Plastic</strong><br>China packaging materials manufacturer',
    },
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildWidget() {
    var ctx = pageContext();
    var welcomeExtra =
      ctx.type === 'product'
        ? ' I see you are viewing <strong>' + escapeHtml(ctx.label) + '</strong> — how can we help?'
        : ' How can we help with your packaging project today?';

    var root = document.createElement('div');
    root.id = 'kiwl-chat-root';
    root.innerHTML =
      '<div class="kiwl-chat-panel" id="kiwl-chat-panel" role="dialog" aria-label="KIWL customer chat" hidden>' +
      '  <div class="kiwl-chat-header">' +
      '    <div class="kiwl-chat-avatar" aria-hidden="true">KIWL</div>' +
      '    <div class="kiwl-chat-header-text">' +
      '      <h3>KIWL Sales Team</h3>' +
      '      <p>China Packaging Materials · Online now</p>' +
      '    </div>' +
      '    <button type="button" class="kiwl-chat-close" id="kiwl-chat-close" aria-label="Close chat">&times;</button>' +
      '  </div>' +
      '  <div class="kiwl-chat-messages" id="kiwl-chat-messages"></div>' +
      '  <div class="kiwl-chat-quick" id="kiwl-chat-quick">' +
      '    <button type="button" class="kiwl-chat-chip" data-topic="products">Our products</button>' +
      '    <button type="button" class="kiwl-chat-chip" data-topic="samples">Samples &amp; MOQ</button>' +
      '    <button type="button" class="kiwl-chat-chip" data-topic="oem">OEM / Custom</button>' +
      '    <button type="button" class="kiwl-chat-chip" data-topic="contact">Contact sales</button>' +
      '  </div>' +
      '  <div class="kiwl-chat-footer">' +
      '    <a class="kiwl-chat-wa-btn" id="kiwl-chat-wa" href="' +
      waLink() +
      '" target="_blank" rel="noopener noreferrer">' +
      ICON_WA +
      '<span>Chat on WhatsApp with Sales Manager</span></a>' +
      '  </div>' +
      '</div>' +
      '<div class="kiwl-chat-tooltip" id="kiwl-chat-tooltip">Hi! Need packaging help? 👋</div>' +
      '<button type="button" class="kiwl-chat-fab" id="kiwl-chat-fab" aria-label="Open customer chat">' +
      ICON_CHAT +
      '<span class="kiwl-chat-badge" id="kiwl-chat-badge">1</span>' +
      '</button>';

    document.body.appendChild(root);

    var panel = document.getElementById('kiwl-chat-panel');
    var messages = document.getElementById('kiwl-chat-messages');
    var fab = document.getElementById('kiwl-chat-fab');
    var closeBtn = document.getElementById('kiwl-chat-close');
    var tooltip = document.getElementById('kiwl-chat-tooltip');
    var badge = document.getElementById('kiwl-chat-badge');
    var waBtn = document.getElementById('kiwl-chat-wa');
    var opened = false;
    var greeted = false;

    function scrollMessages() {
      messages.scrollTop = messages.scrollHeight;
    }

    function addBotMessage(html) {
      var wrap = document.createElement('div');
      wrap.className = 'kiwl-chat-msg';
      wrap.innerHTML =
        '<div class="kiwl-chat-msg-avatar">K</div>' +
        '<div class="kiwl-chat-bubble">' +
        html +
        '</div>';
      messages.appendChild(wrap);
      scrollMessages();
    }

    function showTyping(then) {
      var wrap = document.createElement('div');
      wrap.className = 'kiwl-chat-msg';
      wrap.id = 'kiwl-chat-typing-row';
      wrap.innerHTML =
        '<div class="kiwl-chat-msg-avatar">K</div>' +
        '<div class="kiwl-chat-bubble"><span class="kiwl-chat-typing"><span></span><span></span><span></span></span></div>';
      messages.appendChild(wrap);
      scrollMessages();
      setTimeout(function () {
        var row = document.getElementById('kiwl-chat-typing-row');
        if (row) row.remove();
        then();
      }, 700);
    }

    function runGreeting() {
      if (greeted) return;
      greeted = true;
      showTyping(function () {
        addBotMessage(
          'Hello! Welcome to <strong>KIWL Plastic</strong> — your China packaging materials partner.' +
            welcomeExtra
        );
        showTyping(function () {
          addBotMessage(
            'We manufacture <strong>sprayers, pumps, caps, bottles, jars &amp; PET preforms</strong> with OEM/ODM support. ' +
              'Tap a topic below or message our sales manager on WhatsApp.'
          );
        });
      });
    }

    function dismissHint() {
      storageSet(HINT_KEY);
      tooltip.classList.remove('is-visible');
      badge.style.display = 'none';
    }

    function openPanel() {
      panel.hidden = false;
      panel.classList.add('is-open');
      panel.classList.remove('is-animating');
      requestAnimationFrame(function () {
        panel.classList.add('is-animating');
      });
      dismissHint();
      storageSet(STORAGE_KEY);
      opened = true;
      runGreeting();
      waBtn.href = waLink();
    }

    function closePanel() {
      panel.classList.remove('is-open', 'is-animating');
      panel.hidden = true;
    }

    fab.addEventListener('click', function () {
      dismissHint();
      if (panel.classList.contains('is-open')) closePanel();
      else openPanel();
    });

    closeBtn.addEventListener('click', closePanel);

    document.getElementById('kiwl-chat-quick').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-topic]');
      if (!chip) return;
      var topic = chip.getAttribute('data-topic');
      if (!opened) openPanel();
      var data = RESPONSES[topic];
      if (!data) return;
      showTyping(function () {
        addBotMessage(data.html);
        if (topic === 'contact' || topic === 'samples') {
          waBtn.href = waLink(
            "Hello, I'm interested in KIWL Plastic packaging. Topic: " +
              topic +
              '. Page: ' +
              pageUrl()
          );
        }
      });
    });

    waBtn.addEventListener('click', function () {
      waBtn.href = waLink();
    });

    var seen = storageGet(STORAGE_KEY);
    var hintDismissed = storageGet(HINT_KEY);

    if (seen || hintDismissed) {
      badge.style.display = 'none';
    } else {
      setTimeout(function () {
        if (hintDismissed || storageGet(HINT_KEY)) return;
        tooltip.classList.add('is-visible');
        storageSet(HINT_KEY);
        badge.style.display = 'none';
      }, 2500);
      setTimeout(function () {
        tooltip.classList.remove('is-visible');
      }, 9000);
    }
  }

  function init() {
    if (document.getElementById('kiwl-chat-root')) return;
    injectCriticalCss();
    var base = scriptBase();
    loadCss(base + 'kiwl-live-chat.css');
    buildWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
