(function () {
  'use strict';

  /* ─────────────────────────────────────────
     Config
  ───────────────────────────────────────── */
  const PRELOAD_WINDOW = 2; // load current page ± this many pages

  /* ─────────────────────────────────────────
     Helpers
  ───────────────────────────────────────── */
  function closeAllPopovers() {
    document.querySelectorAll('.custom-popover:not(.hidden)').forEach(function (el) {
      el.classList.add('hidden');
    });
  }

  /* ─────────────────────────────────────────
     Hotspot → Popover  (event delegation — attached once, works for all pages)
  ───────────────────────────────────────── */
  document.addEventListener('click', function (e) {

    // 1. Clicked a hotspot pin
    const hotspot = e.target.closest('.points');
    if (hotspot) {
      e.stopPropagation();
      const hotspotId = hotspot.dataset.id;
      if (!hotspotId) return;

      const popover = document.querySelector('[data-hotspot-id="' + hotspotId + '"]');
      if (!popover) {
        console.warn('No popover found for hotspot id: ' + hotspotId);
        return;
      }

      const isOpen = !popover.classList.contains('hidden');
      closeAllPopovers();

      if (!isOpen) {
        popover.classList.remove('hidden');
        bindPopoverEvents(popover);
      }
      return;
    }

    // 2. Clicked the close (×) button inside a popover
    const crossBtn = e.target.closest('.cross-btn');
    if (crossBtn) {
      e.stopPropagation();
      const popover = crossBtn.closest('.custom-popover');
      if (popover) popover.classList.add('hidden');
      return;
    }

    // 3. Clicked outside any open popover → close all
    if (!e.target.closest('.custom-popover')) {
      closeAllPopovers();
    }
  });

  /* ─────────────────────────────────────────
     Bind add-to-cart inside a popover.
     Button is cloned on every open to remove stale listeners.
  ───────────────────────────────────────── */
  function bindPopoverEvents(popover) {
    const submitBtn     = popover.querySelector('.add-to-cart-btn');
    const variantSelect = popover.querySelector('select[name="id"]');
    const hiddenInput   = popover.querySelector('input[name="id"]');

    if (!submitBtn) return;

    const freshBtn = submitBtn.cloneNode(true);
    submitBtn.replaceWith(freshBtn);

    freshBtn.addEventListener('click', function (e) {
      e.preventDefault();

      const variantId = variantSelect
        ? variantSelect.value
        : (hiddenInput ? hiddenInput.value : null);

      if (!variantId) {
        console.error('No variant ID found');
        return;
      }

      const formData = new FormData();
      formData.append('id', variantId);

      fetch('/cart/add.js', { method: 'POST', body: formData })
        .then(function (res) { return res.json(); })
        .then(function () {
          popover.classList.add('hidden');
          showCartPopup();
        })
        .catch(function (err) {
          console.error('Error adding to cart:', err);
          alert('There was an error adding the product to the cart. Please try again.');
        });
    });
  }

  /* ─────────────────────────────────────────
     Cart success popup
  ───────────────────────────────────────── */
  function showCartPopup() {
    const cartPopup = document.getElementById('cart-popup');
    if (!cartPopup) return;
    cartPopup.classList.remove('hidden');
    cartPopup.classList.add('flex');

    document.getElementById('close-popup')
      ?.addEventListener('click', hideCartPopup, { once: true });
    document.getElementById('continue-shopping')
      ?.addEventListener('click', hideCartPopup, { once: true });
  }

  function hideCartPopup() {
    const cartPopup = document.getElementById('cart-popup');
    if (!cartPopup) return;
    cartPopup.classList.add('hidden');
    cartPopup.classList.remove('flex');
  }

  /* ─────────────────────────────────────────
     Image lazy-load manager
     - Stores the real src in data-src on every img at startup
     - Only restores src for pages within the load window
     - Clears src for pages that fall outside the window
  ───────────────────────────────────────── */
  function buildImageRegistry(elBook) {
    // Map: pageIndex → array of { img, originalSrc }
    const registry = new Map();

    const pages = elBook.querySelectorAll('.page');
    pages.forEach(function (page, pageIdx) {
      const imgs = page.querySelectorAll('img');
      const entries = [];
      imgs.forEach(function (img) {
        const src = img.getAttribute('src') || '';
        if (src) {
          // Move the real src into data-src so we control when it loads
          img.setAttribute('data-src', src);
          img.removeAttribute('src');
          // Reserve space so the page doesn't collapse (avoids layout shift)
          img.style.minHeight = '400px';
          img.style.background = '#f0f0f0';
        }
        entries.push({ img: img, src: src });
      });
      registry.set(pageIdx, entries);
    });

    return registry;
  }

  function updateImageWindow(registry, currentPage) {
    registry.forEach(function (entries, pageIdx) {
      const inWindow = Math.abs(pageIdx - currentPage) <= PRELOAD_WINDOW;
      entries.forEach(function (entry) {
        if (!entry.src) return;
        if (inWindow) {
          // Restore the src so the browser fetches it
          if (!entry.img.getAttribute('src')) {
            entry.img.setAttribute('src', entry.src);
            entry.img.style.minHeight = '';
            entry.img.style.background = '';
          }
        } else {
          // Clear the src to free memory for distant pages
          entry.img.removeAttribute('src');
          entry.img.style.minHeight = '400px';
          entry.img.style.background = '#f0f0f0';
        }
      });
    });
  }

  /* ─────────────────────────────────────────
     FlipBook
  ───────────────────────────────────────── */
  const flipBook = function (elBook) {
    let currentPage  = 0;
    const pages      = elBook.querySelectorAll('.page');
    const totalPages = pages.length;

    // Build lazy registry before touching any page
    const imageRegistry = buildImageRegistry(elBook);

    const updatePage = function (newPage) {
      currentPage = Math.max(0, Math.min(newPage, totalPages - 1));
      elBook.style.setProperty('--c', currentPage);
      // Update which images are loaded
      updateImageWindow(imageRegistry, currentPage);
      // Close any open popover whenever the page turns
      closeAllPopovers();
    };

    pages.forEach(function (page, idx) {
      page.style.setProperty('--i', idx);
    });

    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');

    if (prevBtn) prevBtn.addEventListener('click', function () { updatePage(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { updatePage(currentPage + 1); });

    // Load the first window immediately
    updatePage(0);
  };

  document.querySelectorAll('.book').forEach(flipBook);

})();
