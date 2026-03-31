(function () {
  "use strict";

  let currentBookElement = null;
  let currentPageCallback = null;
  let totalSpreads = 0;

  // Close all popovers
  function closeAllPopovers() {
    document
      .querySelectorAll(".custom-popover:not(.hidden)")
      .forEach(function (el) {
        el.classList.add("hidden");
      });
  }

  // Bind add-to-cart events
  function bindPopoverEvents(popover) {
    const submitBtn = popover.querySelector(".add-to-cart-btn");
    const variantSelect = popover.querySelector('select[name="id"]');
    const hiddenInput = popover.querySelector('input[name="id"]');

    if (!submitBtn) return;

    const freshBtn = submitBtn.cloneNode(true);
    submitBtn.replaceWith(freshBtn);

    freshBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const variantId = variantSelect
        ? variantSelect.value
        : hiddenInput
          ? hiddenInput.value
          : null;
      if (!variantId) {
        console.error("No variant ID found");
        return;
      }

      const formData = new FormData();
      formData.append("id", variantId);

      fetch("/cart/add.js", { method: "POST", body: formData })
        .then(function (res) {
          return res.json();
        })
        .then(function () {
          popover.classList.add("hidden");
          showCartPopup();
        })
        .catch(function (err) {
          console.error("Error adding to cart:", err);
          alert("Error adding product. Please try again.");
        });
    });
  }

  // Show cart success modal
  function showCartPopup() {
    const cartPopup = document.getElementById("cart-popup");
    if (!cartPopup) return;
    cartPopup.classList.remove("hidden");
    cartPopup.classList.add("flex");

    document
      .getElementById("close-popup")
      ?.addEventListener("click", hideCartPopup, { once: true });
    document
      .getElementById("continue-shopping")
      ?.addEventListener("click", hideCartPopup, { once: true });
  }

  function hideCartPopup() {
    const cartPopup = document.getElementById("cart-popup");
    if (!cartPopup) return;
    cartPopup.classList.add("hidden");
    cartPopup.classList.remove("flex");
  }

  // Update active thumbnail highlight
  function updateActiveThumbnail(currentSpread) {
    const thumbnails = document.querySelectorAll(".thumbnail-item");
    thumbnails.forEach(function (thumb, idx) {
      const targetSpread = parseInt(thumb.dataset.spread, 10);
      if (targetSpread === currentSpread) {
        thumb.classList.add("active");
      } else {
        thumb.classList.remove("active");
      }
    });
  }

  // Flipbook Logic - FIXED to navigate through ALL pages
  function initFlipbook(bookElement) {
    let currentSpread = 0;
    const spreads = bookElement.querySelectorAll(".page");
    totalSpreads = spreads.length;

    currentBookElement = bookElement;

    // Set page numbers for display (each spread has front + back = 2 pages)
    spreads.forEach(function (spread, idx) {
      spread.style.setProperty("--i", idx);
      const frontDiv = spread.querySelector(".front");
      const backDiv = spread.querySelector(".back");

      // Calculate actual page numbers
      const frontPageNum = idx * 2;
      const backPageNum = idx * 2 + 1;

      if (frontDiv && !frontDiv.classList.contains("cover")) {
        frontDiv.setAttribute("data-page", frontPageNum.toString());
      }
      if (backDiv && !backDiv.classList.contains("cover")) {
        backDiv.setAttribute("data-page", backPageNum.toString());
      }
    });

    function updateSpread(newSpread) {
      // Allow navigation through ALL spreads (0 to totalSpreads-1)
      currentSpread = Math.max(0, Math.min(newSpread, totalSpreads - 1));
      bookElement.style.setProperty("--c", currentSpread);
      closeAllPopovers();
      updateActiveThumbnail(currentSpread);
    }

    const prevBtn = document.querySelector(".book-prev-next.prev");
    const nextBtn = document.querySelector(".book-prev-next.next");

    // Remove old listeners and add fresh ones
    const newPrevBtn = prevBtn?.cloneNode(true);
    const newNextBtn = nextBtn?.cloneNode(true);

    if (prevBtn && prevBtn.parentNode) {
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    }
    if (nextBtn && nextBtn.parentNode) {
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    }

    if (newPrevBtn) {
      newPrevBtn.addEventListener("click", function (e) {
        e.preventDefault();
        updateSpread(currentSpread - 1);
      });
    }
    if (newNextBtn) {
      newNextBtn.addEventListener("click", function (e) {
        e.preventDefault();
        updateSpread(currentSpread + 1);
      });
    }

    currentPageCallback = updateSpread;
    updateSpread(0);
  }

  // Thumbnail click navigation - jumps to specific spread
  function initThumbnailNavigation() {
    const thumbnails = document.querySelectorAll(".thumbnail-item");

    thumbnails.forEach(function (thumb) {
      // Remove any existing listeners to avoid duplicates
      const newThumb = thumb.cloneNode(true);
      thumb.parentNode.replaceChild(newThumb, thumb);

      newThumb.addEventListener("click", function (e) {
        e.preventDefault();
        if (!currentPageCallback) return;

        const targetSpread = parseInt(this.dataset.spread, 10);
        if (
          !isNaN(targetSpread) &&
          targetSpread >= 0 &&
          targetSpread < totalSpreads
        ) {
          currentPageCallback(targetSpread);
        }
      });
    });
  }

  // Hotspot click delegation
  document.addEventListener("click", function (e) {
    const hotspot = e.target.closest(".points");
    if (hotspot) {
      e.stopPropagation();
      const hotspotId = hotspot.dataset.id;
      if (!hotspotId) return;

      const popover = document.querySelector(
        '[data-hotspot-id="' + hotspotId + '"]',
      );
      if (!popover) {
        console.warn("No popover for hotspot:", hotspotId);
        return;
      }

      const isOpen = !popover.classList.contains("hidden");
      closeAllPopovers();

      if (!isOpen) {
        popover.classList.remove("hidden");
        bindPopoverEvents(popover);
      }
      return;
    }

    const crossBtn = e.target.closest(".cross-btn");
    if (crossBtn) {
      e.stopPropagation();
      const popover = crossBtn.closest(".custom-popover");
      if (popover) popover.classList.add("hidden");
      return;
    }

    if (!e.target.closest(".custom-popover")) {
      closeAllPopovers();
    }
  });

  // Initialize everything when DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    const book = document.querySelector(".book");
    if (book) {
      initFlipbook(book);
      initThumbnailNavigation();
    }
  });
})();
