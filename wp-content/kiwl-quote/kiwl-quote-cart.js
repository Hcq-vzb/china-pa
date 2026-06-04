(function () {
  'use strict';

  var STORAGE_KEY = 'kiwl_quote_cart';
  var WA_PHONE = '8617751189576';
  var WA_BASE = 'https://wa.me/' + WA_PHONE;

  function getCart() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateBadge(items.length);
  }

  function addItem(item) {
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === item.id) {
        existing = cart[i];
        break;
      }
    }
    item = normalizeCartItem(item);
    if (existing) {
      existing.quantity = item.quantity;
      existing.price = item.price;
      existing.url = item.url;
      existing.image = item.image;
      existing.title = item.title;
      existing.sku = item.sku;
    } else {
      cart.push(item);
    }
    saveCart(cart);
    return cart;
  }

  function removeItem(id) {
    var cart = getCart().filter(function (item) {
      return item.id !== id;
    });
    saveCart(cart);
    return cart;
  }

  function updateBadge(count) {
    document.querySelectorAll('.cart-contents .number-of-items').forEach(function (el) {
      el.textContent = String(count);
      el.classList.toggle('no-items', count === 0);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function getSiteRootUrl() {
    var href = window.location.href.split('#')[0];
    if (/\/product\/[^/]+\/?(?:index\.html?)?$/i.test(href)) {
      return href.replace(/product\/[^/]+\/?(?:index\.html?)?$/i, '');
    }
    if (/\/request-the-best-price\/?(?:index\.html?)?$/i.test(href)) {
      return href.replace(/request-the-best-price\/?(?:index\.html?)?$/i, '');
    }
    if (/\/quote-list\/?(?:index\.html?)?$/i.test(href)) {
      return href.replace(/quote-list\/?(?:index\.html?)?$/i, '');
    }
    return href.replace(/[^/]*\/?(?:index\.html?)?$/, '');
  }

  function resolveUrl(path) {
    if (!path) return '';
    if (/^(https?:|file:|data:)/i.test(path)) return path;

    var assetPath = path;
    var wpIdx = path.indexOf('wp-content/');
    if (wpIdx !== -1) {
      assetPath = path.slice(wpIdx);
    }

    try {
      return new URL(assetPath, getSiteRootUrl()).href;
    } catch (e) {
      try {
        return new URL(path, window.location.href).href;
      } catch (err) {
        return path;
      }
    }
  }

  function normalizeCartItem(item) {
    if (!item) return item;
    if (item.image) item.image = resolveUrl(item.image);
    if (item.url) item.url = resolveUrl(item.url);
    return item;
  }

  function normalizeCart(items) {
    return items.map(normalizeCartItem);
  }

  function quotePageUrl() {
    var cartLink = document.querySelector('a.cart-contents');
    if (cartLink) {
      var href = cartLink.getAttribute('href') || '';
      if (href.indexOf('quote-list') !== -1) {
        return href.replace(/quote-list\/?(?:index\.html)?/i, 'request-the-best-price/index.html');
      }
      if (href.indexOf('request-the-best-price') !== -1) {
        return href;
      }
    }
    return '/request-the-best-price/';
  }

  function extractProductFromPage(form) {
    var btn = form.querySelector('.single_add_to_cart_button');
    var qtyInput = form.querySelector('input[name="quantity"]');
    var titleEl = document.querySelector('.product_title');
    var skuEl = document.querySelector('.sku');
    var priceEl = document.querySelector('.summary .price') || document.querySelector('.entry-summary .price');
    var imgEl = document.querySelector('.woocommerce-product-gallery img.wp-post-image') ||
      document.querySelector('.woocommerce-product-gallery img');

    return {
      id: btn ? String(btn.value || btn.getAttribute('value') || '') : '',
      title: titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : document.title,
      sku: skuEl ? skuEl.textContent.replace(/\s+/g, ' ').trim() : '',
      price: priceEl ? priceEl.textContent.replace(/\s+/g, ' ').trim() : '',
      quantity: qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1,
      url: window.location.href.split('#')[0],
      image: imgEl ? resolveUrl(imgEl.getAttribute('src') || '') : ''
    };
  }

  function injectQuoteStyles() {
    if (document.getElementById('kiwl-quote-cart-style')) return;
    var style = document.createElement('style');
    style.id = 'kiwl-quote-cart-style';
    style.textContent =
      '.kiwl-quote-cart-wrap{margin:0 0 2em}.kiwl-quote-cart h2{font-size:1.35em;margin:0 0 .75em}' +
      '.kiwl-quote-table{width:100%;border-collapse:collapse;margin-bottom:1em}' +
      '.kiwl-quote-table th,.kiwl-quote-table td{padding:.75em;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:middle}' +
      '.kiwl-quote-table th{font-weight:600}.kiwl-quote-product{display:flex;gap:12px;align-items:center}' +
      '.kiwl-quote-product img{border-radius:4px;object-fit:cover}.kiwl-quote-remove{background:none;border:0;font-size:1.4em;line-height:1;cursor:pointer;color:#666}' +
      '.kiwl-quote-notice{margin:1em 0;padding:.75em 1em;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:4px}' +
      '.kiwl-quote-success-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.kiwl-quote-success-modal{max-width:520px;width:100%;background:#fff;border-radius:12px;padding:32px 28px;text-align:center;box-shadow:0 20px 50px rgba(15,23,42,.25)}' +
      '.kiwl-quote-success-icon{width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:#ecfdf5;color:#059669;font-size:34px;line-height:64px;font-weight:700}' +
      '.kiwl-quote-success-modal h2{margin:0 0 12px;font-size:1.5em;color:#111827}' +
      '.kiwl-quote-success-modal p{margin:0 0 12px;color:#4b5563;line-height:1.6}' +
      '.kiwl-quote-success-gift{margin:16px 0;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-weight:600}' +
      '.kiwl-quote-success-wa{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;padding:14px 22px;background:#25d366;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:1em}' +
      '.kiwl-quote-success-wa:hover{background:#1ebe57;color:#fff}' +
      '.kiwl-quote-success-close{margin-top:14px;background:none;border:0;color:#6b7280;cursor:pointer;font-size:.95em}';
    document.head.appendChild(style);
  }

  function buildTableHtml(cart) {
    var rows = cart.map(function (item) {
      var image = resolveUrl(item.image || '');
      return (
        '<tr>' +
        '<td class="kiwl-quote-product">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="" width="60" height="60" loading="lazy">' : '') +
        '<div><a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.title) + '</a>' +
        (item.sku ? '<div class="product-sku">Item#: ' + escapeHtml(item.sku) + '</div>' : '') +
        '</div></td>' +
        '<td>' + escapeHtml(String(item.quantity)) + '</td>' +
        '<td>' + escapeHtml(item.price) + '</td>' +
        '<td><button type="button" class="kiwl-quote-remove" data-kiwl-remove="' + escapeHtml(item.id) + '" aria-label="Remove">&times;</button></td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div class="kiwl-quote-cart">' +
      '<h2>Your Quote List</h2>' +
      '<table class="shop_table kiwl-quote-table">' +
      '<thead><tr><th>Product</th><th>Qty</th><th>Price</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>'
    );
  }

  function renderQuotePage() {
    var checkoutForm = document.querySelector('form.checkout.woocommerce-checkout');
    if (!checkoutForm) return;

    var raw = getCart();
    var cart = normalizeCart(raw);
    if (JSON.stringify(raw) !== JSON.stringify(cart)) saveCart(cart);
    updateBadge(cart.length);

    var existing = document.getElementById('kiwl-quote-cart-table');
    if (existing) existing.remove();

    if (cart.length === 0) return;

    injectQuoteStyles();

    var emptyMsg = document.querySelector('.cart-empty');
    var emptyList = document.querySelector('.empty-list');
    var returnShop = document.querySelector('.return-to-shop');
    if (emptyMsg) emptyMsg.style.display = 'none';
    if (emptyList) emptyList.style.display = 'none';
    if (returnShop) returnShop.style.display = 'none';

    var table = document.createElement('div');
    table.id = 'kiwl-quote-cart-table';
    table.className = 'kiwl-quote-cart-wrap';
    table.innerHTML = buildTableHtml(cart);
    checkoutForm.parentNode.insertBefore(table, checkoutForm);

    table.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-kiwl-remove]');
      if (!btn) return;
      removeItem(btn.getAttribute('data-kiwl-remove'));
      renderQuotePage();
    });
  }

  function initProductPage() {
    var form = document.querySelector('form.cart');
    if (!form || !form.querySelector('.single_add_to_cart_button')) return;

    form.setAttribute('action', '#');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = extractProductFromPage(form);
      if (!item.id) return;
      addItem(item);
      window.location.href = quotePageUrl();
    });
  }

  function fieldValue(form, selector) {
    var el = form.querySelector(selector);
    return el && el.value ? el.value.trim() : '';
  }

  function buildWhatsAppMessage(details) {
    var text = "Hello, I've submitted a quote request on your website.\n\n";
    text += 'Name: ' + details.name + '\n';
    text += 'Email: ' + details.email + '\n';
    text += 'Country: ' + details.country + '\n';
    if (details.company) text += 'Company: ' + details.company + '\n';
    if (details.phone) text += 'Phone: ' + details.phone + '\n';
    if (details.cart.length) {
      text += '\nProducts:\n';
      details.cart.forEach(function (item, index) {
        text += (index + 1) + '. ' + item.title;
        if (item.sku) text += ' (Item#: ' + item.sku + ')';
        text += ' x ' + item.quantity + '\n';
      });
    }
    text += '\nPlease share the best quote with me. Thank you!';
    return text;
  }

  function showSuccessModal(details) {
    injectQuoteStyles();

    var existing = document.getElementById('kiwl-quote-success-overlay');
    if (existing) existing.remove();

    var waText = buildWhatsAppMessage(details);
    var waHref = WA_BASE + '?text=' + encodeURIComponent(waText);

    var overlay = document.createElement('div');
    overlay.id = 'kiwl-quote-success-overlay';
    overlay.className = 'kiwl-quote-success-overlay';
    overlay.innerHTML =
      '<div class="kiwl-quote-success-modal" role="dialog" aria-labelledby="kiwl-quote-success-title" aria-modal="true">' +
      '<div class="kiwl-quote-success-icon" aria-hidden="true">&#10003;</div>' +
      '<h2 id="kiwl-quote-success-title">Request Submitted Successfully</h2>' +
      '<p>Thank you, <strong>' + escapeHtml(details.name) + '</strong>. Your quote request has been received.</p>' +
      '<p>For the fastest response, please contact our sales manager on WhatsApp.</p>' +
      '<div class="kiwl-quote-success-gift">Visit us in China and enjoy a complimentary airport pickup gift!</div>' +
      '<a class="kiwl-quote-success-wa" href="' + escapeHtml(waHref) + '" target="_blank" rel="noopener noreferrer">' +
      'Chat with Sales on WhatsApp</a>' +
      '<div><button type="button" class="kiwl-quote-success-close">Close</button></div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.kiwl-quote-success-close').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    saveCart([]);
    renderQuotePage();
    formReset(document.querySelector('form.checkout.woocommerce-checkout'));
  }

  function formReset(form) {
    if (!form) return;
    form.reset();
    var terms = form.querySelector('#terms');
    if (terms) terms.checked = false;
  }

  function initCheckoutForm() {
    var form = document.querySelector('form.checkout.woocommerce-checkout');
    if (!form || form.dataset.kiwlQuoteBound === '1') return;
    form.dataset.kiwlQuoteBound = '1';

    form.setAttribute('action', '#');
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var terms = form.querySelector('#terms');
      if (terms && !terms.checked) {
        terms.focus();
        return;
      }

      var cart = normalizeCart(getCart());
      var name = fieldValue(form, '#billing_first_name');
      var company = fieldValue(form, '#billing_company');
      var countrySelect = form.querySelector('#billing_country');
      var country = countrySelect ? countrySelect.options[countrySelect.selectedIndex].text : '';
      var phone = fieldValue(form, '#billing_phone');
      var email = fieldValue(form, '#billing_email');

      if (!name || !email || !countrySelect || !countrySelect.value) {
        if (!name) form.querySelector('#billing_first_name').focus();
        else if (!email) form.querySelector('#billing_email').focus();
        else if (countrySelect) countrySelect.focus();
        return;
      }

      showSuccessModal({
        name: name,
        email: email,
        company: company,
        country: country,
        phone: phone,
        cart: cart
      });
    });
  }

  function init() {
    updateBadge(getCart().length);
    initProductPage();
    renderQuotePage();
    initCheckoutForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
