// (function () {
//   "use strict";

//   let currentBookElement = null;
//   let currentPageCallback = null;
//   let totalSpreads = 0;

//   function lockPageScroll() {
//     document.documentElement.classList.add("overflow-hidden");
//     document.body.classList.add("overflow-hidden");
//   }

//   function unlockPageScroll() {
//     const hasOpenPopover = document.querySelector(
//       ".custom-popover:not(.hidden)",
//     );
//     if (!hasOpenPopover) {
//       document.documentElement.classList.remove("overflow-hidden");
//       document.body.classList.remove("overflow-hidden");
//     }
//   }

//   function closeAllPopovers() {
//     document
//       .querySelectorAll(".custom-popover:not(.hidden)")
//       .forEach(function (el) {
//         el.classList.add("hidden");
//       });

//     unlockPageScroll();
//   }
//   function bindPopoverEvents(popover) {
//     const submitBtn = popover.querySelector(".add-to-cart-btn");
//     const variantSelect = popover.querySelector('select[name="id"]');
//     const hiddenInput = popover.querySelector('input[name="id"]');
//     const loadingWrap = popover.querySelector(".tooltip-loading");
//     const loadingBar = popover.querySelector(".loading-bar");
//     const loadingPercent = popover.querySelector(".loading-percent");
//     const loadingText = popover.querySelector(".loading-text");
//     const loadingSpinner = popover.querySelector(".loading-spinner");
//     const loadingSuccess = popover.querySelector(".loading-success");

//     if (!submitBtn) return;

//     const freshBtn = submitBtn.cloneNode(true);
//     submitBtn.replaceWith(freshBtn);

//     const freshBtnText = freshBtn.querySelector(".btn-text");
//     const freshBtnSpinner = freshBtn.querySelector(".btn-spinner");

//     freshBtn.addEventListener("click", function (e) {
//       e.preventDefault();

//       const variantId = variantSelect
//         ? variantSelect.value
//         : hiddenInput
//           ? hiddenInput.value
//           : null;

//       if (!variantId) {
//         console.error("No variant ID found");
//         return;
//       }

//       const originalText = freshBtnText
//         ? freshBtnText.textContent
//         : "Add to cart";

//       let progress = 0;
//       let progressTimer = null;

//       function startLoading() {
//         freshBtn.disabled = true;

//         if (freshBtnText) freshBtnText.textContent = "Adding...";
//         if (freshBtnSpinner) freshBtnSpinner.classList.remove("hidden");

//         if (loadingWrap) loadingWrap.classList.remove("hidden");
//         if (loadingText) loadingText.textContent = "Adding to cart";
//         if (loadingSpinner) loadingSpinner.classList.remove("hidden");
//         if (loadingSuccess) loadingSuccess.classList.add("hidden");

//         progress = 12;
//         if (loadingBar) loadingBar.style.width = progress + "%";
//         if (loadingPercent) loadingPercent.textContent = progress + "%";

//         progressTimer = setInterval(function () {
//           if (progress < 90) {
//             progress += Math.floor(Math.random() * 10) + 5;
//             if (progress > 90) progress = 90;

//             if (loadingBar) loadingBar.style.width = progress + "%";
//             if (loadingPercent) loadingPercent.textContent = progress + "%";
//           }
//         }, 180);
//       }

//       function showSuccessState() {
//         clearInterval(progressTimer);

//         if (loadingBar) loadingBar.style.width = "100%";
//         if (loadingPercent) loadingPercent.textContent = "100%";

//         if (loadingText) loadingText.textContent = "Product added to cart";
//         if (loadingSpinner) loadingSpinner.classList.add("hidden");
//         if (loadingSuccess) loadingSuccess.classList.remove("hidden");

//         if (freshBtnText) freshBtnText.textContent = "Added";
//         if (freshBtnSpinner) freshBtnSpinner.classList.add("hidden");
//       }

//       function resetLoading() {
//         clearInterval(progressTimer);
//         freshBtn.disabled = false;

//         if (freshBtnText) freshBtnText.textContent = originalText;
//         if (freshBtnSpinner) freshBtnSpinner.classList.add("hidden");

//         if (loadingText) loadingText.textContent = "Adding to cart";
//         if (loadingSpinner) loadingSpinner.classList.remove("hidden");
//         if (loadingSuccess) loadingSuccess.classList.add("hidden");

//         if (loadingWrap) loadingWrap.classList.add("hidden");
//         if (loadingBar) loadingBar.style.width = "0%";
//         if (loadingPercent) loadingPercent.textContent = "0%";
//       }

//       startLoading();

//       const formData = new FormData();
//       formData.append("id", variantId);

//       fetch("/cart/add.js", {
//         method: "POST",
//         body: formData,
//       })
//         .then(function (res) {
//           if (!res.ok) {
//             throw new Error("Failed to add to cart");
//           }
//           return res.json();
//         })
//         .then(function () {
//           showSuccessState();

//           setTimeout(function () {
//             resetLoading();
//             popover.classList.add("hidden");
//             unlockPageScroll();
//           }, 1300);
//         })
//         .catch(function (err) {
//           console.error("Error adding to cart:", err);
//           resetLoading();
//           alert("Error adding product. Please try again.");
//         });
//     });
//   }

//   function updateActiveThumbnail(currentSpread) {
//     const thumbnails = document.querySelectorAll(".thumbnail-item");
//     thumbnails.forEach(function (thumb) {
//       const targetSpread = parseInt(thumb.dataset.spread, 10);
//       if (targetSpread === currentSpread) {
//         thumb.classList.add("active");
//       } else {
//         thumb.classList.remove("active");
//       }
//     });
//   }

//   function initFlipbook(bookElement) {
//     let currentSpread = 0;
//     const spreads = bookElement.querySelectorAll(".page");
//     totalSpreads = spreads.length;

//     currentBookElement = bookElement;

//     spreads.forEach(function (spread, idx) {
//       spread.style.setProperty("--i", idx);
//       const frontDiv = spread.querySelector(".front");
//       const backDiv = spread.querySelector(".back");

//       const frontPageNum = idx * 2;
//       const backPageNum = idx * 2 + 1;

//       if (frontDiv && !frontDiv.classList.contains("cover")) {
//         frontDiv.setAttribute("data-page", frontPageNum.toString());
//       }
//       if (backDiv && !backDiv.classList.contains("cover")) {
//         backDiv.setAttribute("data-page", backPageNum.toString());
//       }
//     });

//     function updateSpread(newSpread) {
//       currentSpread = Math.max(0, Math.min(newSpread, totalSpreads - 1));
//       bookElement.style.setProperty("--c", currentSpread);
//       closeAllPopovers();
//       updateActiveThumbnail(currentSpread);
//     }

//     const prevBtn = document.querySelector(".book-prev-next.prev");
//     const nextBtn = document.querySelector(".book-prev-next.next");

//     const newPrevBtn = prevBtn?.cloneNode(true);
//     const newNextBtn = nextBtn?.cloneNode(true);

//     if (prevBtn && prevBtn.parentNode) {
//       prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
//     }
//     if (nextBtn && nextBtn.parentNode) {
//       nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
//     }

//     if (newPrevBtn) {
//       newPrevBtn.addEventListener("click", function (e) {
//         e.preventDefault();
//         updateSpread(currentSpread - 1);
//       });
//     }

//     if (newNextBtn) {
//       newNextBtn.addEventListener("click", function (e) {
//         e.preventDefault();
//         updateSpread(currentSpread + 1);
//       });
//     }

//     currentPageCallback = updateSpread;
//     updateSpread(0);
//   }

//   function initThumbnailNavigation() {
//     const thumbnails = document.querySelectorAll(".thumbnail-item");

//     thumbnails.forEach(function (thumb) {
//       const newThumb = thumb.cloneNode(true);
//       thumb.parentNode.replaceChild(newThumb, thumb);

//       newThumb.addEventListener("click", function (e) {
//         e.preventDefault();
//         if (!currentPageCallback) return;

//         const targetSpread = parseInt(this.dataset.spread, 10);
//         if (
//           !isNaN(targetSpread) &&
//           targetSpread >= 0 &&
//           targetSpread < totalSpreads
//         ) {
//           currentPageCallback(targetSpread);
//         }
//       });
//     });
//   }

//   document.addEventListener("click", function (e) {
//     const hotspot = e.target.closest(".points");
//     if (hotspot) {
//       e.stopPropagation();
//       const hotspotId = hotspot.dataset.id;
//       if (!hotspotId) return;

//       const popover = document.querySelector(
//         '[data-hotspot-id="' + hotspotId + '"]',
//       );

//       if (!popover) {
//         console.warn("No popover for hotspot:", hotspotId);
//         return;
//       }

//       const isOpen = !popover.classList.contains("hidden");
//       closeAllPopovers();

//       if (!isOpen) {
//         popover.classList.remove("hidden");
//         lockPageScroll();
//         bindPopoverEvents(popover);
//       }
//       return;
//     }

//     const crossBtn = e.target.closest(".cross-btn");
//     if (crossBtn) {
//       e.stopPropagation();
//       const popover = crossBtn.closest(".custom-popover");
//       if (popover) {
//         popover.classList.add("hidden");
//         unlockPageScroll();
//       }
//       return;
//     }

//     if (!e.target.closest(".custom-popover")) {
//       closeAllPopovers();
//     }
//   });

//   document.addEventListener("DOMContentLoaded", function () {
//     const book = document.querySelector(".book");
//     if (book) {
//       initFlipbook(book);
//       initThumbnailNavigation();
//     }
//   });
// })();


// My Code

(function () {
  "use strict";

  let currentBookElement = null;
  let currentPageCallback = null;
  let totalSpreads = 0;
let maxSpread = 0;
  function lockPageScroll() {
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");
  }

  function unlockPageScroll() {
    const hasOpenPopover = document.querySelector(
      ".custom-popover:not(.hidden)",
    );
    if (!hasOpenPopover) {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    }
  }

  function closeAllPopovers() {
    document
      .querySelectorAll(".custom-popover:not(.hidden)")
      .forEach(function (el) {
        el.classList.add("hidden");
      });

    unlockPageScroll();
  }

  function bindPopoverEvents(popover) {
    const submitBtn = popover.querySelector(".add-to-cart-btn");
    const variantSelect = popover.querySelector('select[name="id"]');
    const hiddenInput = popover.querySelector('input[name="id"]');
    const loadingWrap = popover.querySelector(".tooltip-loading");
    const loadingBar = popover.querySelector(".loading-bar");
    const loadingPercent = popover.querySelector(".loading-percent");
    const loadingText = popover.querySelector(".loading-text");
    const loadingSpinner = popover.querySelector(".loading-spinner");
    const loadingSuccess = popover.querySelector(".loading-success");

    if (!submitBtn) return;

    const freshBtn = submitBtn.cloneNode(true);
    submitBtn.replaceWith(freshBtn);

    const freshBtnText = freshBtn.querySelector(".btn-text");
    const freshBtnSpinner = freshBtn.querySelector(".btn-spinner");

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

      const originalText = freshBtnText
        ? freshBtnText.textContent
        : "Add to cart";

      let progress = 0;
      let progressTimer = null;

      function startLoading() {
        freshBtn.disabled = true;

        if (freshBtnText) freshBtnText.textContent = "Adding...";
        if (freshBtnSpinner) freshBtnSpinner.classList.remove("hidden");

        if (loadingWrap) loadingWrap.classList.remove("hidden");
        if (loadingText) loadingText.textContent = "Adding to cart";
        if (loadingSpinner) loadingSpinner.classList.remove("hidden");
        if (loadingSuccess) loadingSuccess.classList.add("hidden");

        progress = 12;
        if (loadingBar) loadingBar.style.width = progress + "%";
        if (loadingPercent) loadingPercent.textContent = progress + "%";

        progressTimer = setInterval(function () {
          if (progress < 90) {
            progress += Math.floor(Math.random() * 10) + 5;
            if (progress > 90) progress = 90;

            if (loadingBar) loadingBar.style.width = progress + "%";
            if (loadingPercent) loadingPercent.textContent = progress + "%";
          }
        }, 180);
      }

      function showSuccessState() {
        clearInterval(progressTimer);

        if (loadingBar) loadingBar.style.width = "100%";
        if (loadingPercent) loadingPercent.textContent = "100%";

        if (loadingText) loadingText.textContent = "Product added to cart";
        if (loadingSpinner) loadingSpinner.classList.add("hidden");
        if (loadingSuccess) loadingSuccess.classList.remove("hidden");

        if (freshBtnText) freshBtnText.textContent = "Added";
        if (freshBtnSpinner) freshBtnSpinner.classList.add("hidden");
      }

      function resetLoading() {
        clearInterval(progressTimer);
        freshBtn.disabled = false;

        if (freshBtnText) freshBtnText.textContent = originalText;
        if (freshBtnSpinner) freshBtnSpinner.classList.add("hidden");

        if (loadingText) loadingText.textContent = "Adding to cart";
        if (loadingSpinner) loadingSpinner.classList.remove("hidden");
        if (loadingSuccess) loadingSuccess.classList.add("hidden");

        if (loadingWrap) loadingWrap.classList.add("hidden");
        if (loadingBar) loadingBar.style.width = "0%";
        if (loadingPercent) loadingPercent.textContent = "0%";
      }

      startLoading();

      const formData = new FormData();
      formData.append("id", variantId);

      fetch("/cart/add.js", {
        method: "POST",
        body: formData,
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Failed to add to cart");
          }
          return res.json();
        })
        .then(function () {
          showSuccessState();

          setTimeout(function () {
            resetLoading();
            popover.classList.add("hidden");
            unlockPageScroll();
          }, 1300);
        })
        .catch(function (err) {
          console.error("Error adding to cart:", err);
          resetLoading();
          alert("Error adding product. Please try again.");
        });
    });
  }

  function updateActiveThumbnail(currentSpread) {
    const thumbnails = document.querySelectorAll(".thumbnail-item");
    thumbnails.forEach(function (thumb) {
      const targetSpread = parseInt(thumb.dataset.spread, 10);
      if (targetSpread === currentSpread) {
        thumb.classList.add("active");
      } else {
        thumb.classList.remove("active");
      }
    });
  }
  
  function initFlipbook(bookElement) {
    let currentSpread = 0;
    const spreads = bookElement.querySelectorAll(".page");
    totalSpreads = spreads.length;

    currentBookElement = bookElement;

    spreads.forEach(function (spread, idx) {
      spread.style.setProperty("--i", idx);
      const frontDiv = spread.querySelector(".front");
      const backDiv = spread.querySelector(".back");

      const frontPageNum = idx * 2;
      const backPageNum = idx * 2 + 1;

      if (frontDiv && !frontDiv.classList.contains("cover")) {
        frontDiv.setAttribute("data-page", frontPageNum.toString());
      }
      if (backDiv && !backDiv.classList.contains("cover")) {
        backDiv.setAttribute("data-page", backPageNum.toString());
      }
    });
const hasCover = bookElement.dataset.hasCover === 'true';
const pageCount = parseInt(bookElement.dataset.pageCount || '0', 10);
maxSpread = totalSpreads - 1;

function updateSpread(newSpread) {
  currentSpread = Math.max(0, Math.min(newSpread, maxSpread));
  bookElement.style.setProperty('--c', currentSpread);
  closeAllPopovers();
  updateActiveThumbnail(currentSpread);
}

    const prevBtn = document.querySelector(".book-prev-next.prev");
    const nextBtn = document.querySelector(".book-prev-next.next");

    const newPrevBtn = prevBtn ? prevBtn.cloneNode(true) : null;
    const newNextBtn = nextBtn ? nextBtn.cloneNode(true) : null;

    if (prevBtn && prevBtn.parentNode && newPrevBtn) {
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    }
    if (nextBtn && nextBtn.parentNode && newNextBtn) {
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
if (!hasCover && pageCount === 1) {
  bookElement.style.setProperty('--c', 0);
  currentSpread = 0;
  updateActiveThumbnail(1);
  if (newPrevBtn) newPrevBtn.style.display = 'none';
  if (newNextBtn) newNextBtn.style.display = 'none';
} else if (!hasCover) {
  bookElement.style.setProperty('--c', 0);
  currentSpread = 0;
  updateActiveThumbnail(1);
} else {
  updateSpread(0);
}
  }

  function initThumbnailNavigation() {
    const thumbnails = document.querySelectorAll(".thumbnail-item");

    thumbnails.forEach(function (thumb) {
      const newThumb = thumb.cloneNode(true);
      thumb.parentNode.replaceChild(newThumb, thumb);

      newThumb.addEventListener("click", function (e) {
        e.preventDefault();
        if (!currentPageCallback) return;

        const targetSpread = parseInt(this.dataset.spread, 10);
        if (
          !isNaN(targetSpread) &&
          targetSpread >= 0 &&
          targetSpread <= maxSpread
        ) {
          currentPageCallback(targetSpread);
        }
      });
    });
  }

  function initMobileBook() {
    const mobileViewer = document.querySelector(".mobile-book-viewer");
    if (!mobileViewer) return;

    const pages = mobileViewer.querySelectorAll(".mobile-book-page");
    let prevBtn = mobileViewer.querySelector(".mobile-book-nav.prev");
    let nextBtn = mobileViewer.querySelector(".mobile-book-nav.next");

    if (!pages.length) return;

    let currentIndex = 0;
    let isAnimating = false;

    function clearState(page) {
      page.classList.remove(
        "active",
        "enter-from-right",
        "enter-from-left",
        "slide-in",
        "exit-to-left",
        "exit-to-right",
      );
    }

    function updateButtons() {
      if (prevBtn) prevBtn.disabled = currentIndex === 0;
      if (nextBtn) nextBtn.disabled = currentIndex === pages.length - 1;
    }

    function goToPage(newIndex, direction) {
      if (isAnimating) return;
      if (newIndex < 0 || newIndex >= pages.length) return;
      if (newIndex === currentIndex) return;

      isAnimating = true;
      closeAllPopovers();

      const currentPage = pages[currentIndex];
      const incomingPage = pages[newIndex];

      pages.forEach(function (page, idx) {
        if (idx !== currentIndex && idx !== newIndex) {
          clearState(page);
        }
      });

      clearState(currentPage);
      clearState(incomingPage);

      currentPage.classList.add("active");

      if (direction === "next") {
        incomingPage.classList.add("enter-from-right");
      } else {
        incomingPage.classList.add("enter-from-left");
      }

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          incomingPage.classList.add("slide-in");

          if (direction === "next") {
            currentPage.classList.add("exit-to-left");
          } else {
            currentPage.classList.add("exit-to-right");
          }
        });
      });

      setTimeout(function () {
        clearState(currentPage);
        clearState(incomingPage);
        incomingPage.classList.add("active");

        currentIndex = newIndex;
        updateButtons();
        isAnimating = false;
      }, 460);
    }

    if (prevBtn) {
      const newPrevBtn = prevBtn.cloneNode(true);
      prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
      prevBtn = newPrevBtn;

      prevBtn.addEventListener("click", function (e) {
        e.preventDefault();
        goToPage(currentIndex - 1, "prev");
      });
    }

    if (nextBtn) {
      const newNextBtn = nextBtn.cloneNode(true);
      nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
      nextBtn = newNextBtn;

      nextBtn.addEventListener("click", function (e) {
        e.preventDefault();
        goToPage(currentIndex + 1, "next");
      });
    }

    pages.forEach(function (page, idx) {
      clearState(page);
      if (idx === 0) {
        page.classList.add("active");
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    mobileViewer.addEventListener(
      "touchstart",
      function (e) {
        if (!e.touches || !e.touches.length) return;
        touchStartX = e.touches[0].clientX;
      },
      { passive: true },
    );

    mobileViewer.addEventListener(
      "touchend",
      function (e) {
        if (!e.changedTouches || !e.changedTouches.length) return;
        touchEndX = e.changedTouches[0].clientX;

        const diff = touchEndX - touchStartX;
        const threshold = 40;

        if (Math.abs(diff) < threshold) return;

        if (diff < 0) {
          goToPage(currentIndex + 1, "next");
        } else {
          goToPage(currentIndex - 1, "prev");
        }
      },
      { passive: true },
    );

    updateButtons();
  }

  document.addEventListener("click", function (e) {
    const hotspot = e.target.closest(".points, .mobile-points");
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
        lockPageScroll();
        bindPopoverEvents(popover);
      }
      return;
    }

    const crossBtn = e.target.closest(".cross-btn");
    if (crossBtn) {
      e.stopPropagation();
      const popover = crossBtn.closest(".custom-popover");
      if (popover) {
        popover.classList.add("hidden");
        unlockPageScroll();
      }
      return;
    }

    if (!e.target.closest(".custom-popover")) {
      closeAllPopovers();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    const book = document.querySelector(".book");
    if (book) {
      initFlipbook(book);
      initThumbnailNavigation();
    }

    initMobileBook();
  });
})();