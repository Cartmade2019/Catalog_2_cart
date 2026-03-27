(function () {
  'use strict';

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

    // Replace with a fresh clone so old click handlers don't accumulate
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

    // { once: true } ensures these never stack up across multiple cart adds
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
     FlipBook
  ───────────────────────────────────────── */
  const flipBook = function (elBook) {
    let currentPage  = 0;
    const pages      = elBook.querySelectorAll('.page');
    const totalPages = pages.length;

    const updatePage = function (newPage) {
      currentPage = Math.max(0, Math.min(newPage, totalPages - 1));
      elBook.style.setProperty('--c', currentPage);
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

    updatePage(0);
  };

  document.querySelectorAll('.book').forEach(flipBook);

})();