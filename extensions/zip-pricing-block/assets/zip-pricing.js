(function () {
  'use strict';

  const STORAGE_KEY = 'zp_recent_zips';
  const MAX_RECENT = 4;
  const PROXY_PATH = '/apps/zip-pricing';

  // Wait for DOM
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveRecent(zips) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zips.slice(0, MAX_RECENT)));
    } catch (e) {
      // private mode etc - silently skip
    }
  }

  function addRecent(zip) {
    const recent = loadRecent().filter(z => z !== zip);
    recent.unshift(zip);
    saveRecent(recent);
    return recent.slice(0, MAX_RECENT);
  }

  function formatCents(cents) {
    return '$' + (cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  function buildUrl(block, params) {
    // App Proxy URL pattern: /apps/{proxy-path}?...
    // Shopify forwards to: {BACKEND_URL}/apps/{proxy-path}?...
    // signature param is added by Shopify automatically
    const qs = new URLSearchParams(params).toString();
    return `${PROXY_PATH}?${qs}`;
  }

  async function fetchPrice(block, zip) {
    const productId = block.dataset.productId;
    const variantId = block.dataset.variantId;
    const baseCents = block.dataset.basePriceCents;

    const params = {
      zip,
      product_id: productId || '',
      variant_id: variantId || '',
      base_price_cents: baseCents || '',
      shop: window.Shopify && window.Shopify.shop ? window.Shopify.shop : ''
    };

    const url = buildUrl(block, params);
    const resp = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Pricing service returned ${resp.status}: ${text.slice(0, 80)}`);
    }

    return resp.json();
  }

  function renderPrice(block, result, zip) {
    const resultEl = block.querySelector('.zp-result');
    const showOriginal = block.dataset.showOriginal === 'true';
    const baseCents = parseInt(block.dataset.basePriceCents, 10);
    const isDiscount = baseCents && result.priceCents < baseCents;

    resultEl.classList.remove('zp-result-success', 'zp-result-error');

    if (!result.ok) {
      resultEl.innerHTML = `
        <div class="zp-result-error">
          <span class="zp-icon">⚠</span>
          <span>${result.message || 'Could not retrieve pricing. Please check your ZIP code.'}</span>
        </div>
      `;
      resultEl.classList.add('zp-result-error');
      return;
    }

    const originalHtml = (showOriginal && isDiscount)
      ? `<span class="zp-result-price-original">${formatCents(baseCents)}</span>
         <span class="zp-result-price-savings">You save ${formatCents(baseCents - result.priceCents)}</span>`
      : '';

    const labelHtml = result.label
      ? `<span class="zp-result-label">${escapeHtml(result.label)}</span>`
      : '';

    resultEl.innerHTML = `
      <div class="zp-result-price">
        <span class="zp-result-price-amount ${result.matched ? 'is-match' : ''}">${result.priceFormatted}</span>
        ${originalHtml}
        ${labelHtml}
        <span class="zp-result-zip">ZIP ${zip}</span>
      </div>
    `;
    resultEl.classList.add('zp-result-success');
  }

  function renderError(block, message) {
    const resultEl = block.querySelector('.zp-result');
    resultEl.classList.remove('zp-result-success');
    resultEl.classList.add('zp-result-error');
    resultEl.innerHTML = `
      <div class="zp-result-error">
        <span class="zp-icon">⚠</span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function renderRecent(block) {
    const recent = loadRecent();
    const wrap = block.querySelector('.zp-recent');
    const chips = block.querySelector('.zp-recent-chips');
    if (recent.length === 0) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    chips.innerHTML = recent
      .map(z => `<button type="button" class="zp-chip" data-zip="${z}">${z}</button>`)
      .join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init(block) {
    const form = block.querySelector('.zp-form');
    const input = block.querySelector('.zp-input');
    const button = block.querySelector('.zp-button');

    renderRecent(block);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const zip = input.value.trim();

      if (!/^\d{5}$/.test(zip)) {
        input.setAttribute('aria-invalid', 'true');
        renderError(block, 'Please enter a valid 5-digit US ZIP code.');
        return;
      }
      input.removeAttribute('aria-invalid');

      button.classList.add('is-loading');
      button.disabled = true;

      try {
        const result = await fetchPrice(block, zip);
        renderPrice(block, result, zip);
        addRecent(zip);
        renderRecent(block);
      } catch (err) {
        console.error('[zip-pricing]', err);
        renderError(block, 'Pricing service is unavailable. Please try again in a moment.');
      } finally {
        button.classList.remove('is-loading');
        button.disabled = false;
      }
    });

    block.addEventListener('click', function (e) {
      const chip = e.target.closest('.zp-chip');
      if (!chip) return;
      input.value = chip.dataset.zip;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    });

    // Allow only digits in input
    input.addEventListener('input', function (e) {
      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 5);
      if (cleaned !== e.target.value) e.target.value = cleaned;
    });
  }

  ready(function () {
    document.querySelectorAll('.zip-pricing-block').forEach(init);
  });
})();