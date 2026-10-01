/* ============================================================
   FOLIO Bookstore — fully working frontend + backend version
   Backend: same server by default (http://localhost:3000)
============================================================ */

const API_BASE = window.location.port === "5500" ? "http://localhost:3000" : window.location.origin;
let BOOKS = [];

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadBooks() {
  try {
    const books = await api("/api/books");
    BOOKS = books.map(book => ({
      ...book,
      cover: book.cover || { bg: book.coverBg || "#2D4A5F", accent: book.coverAccent || "#5B9BBF" }
    }));
    return BOOKS;
  } catch (err) {
    console.error(err);
    showToast("Backend is not running. Start it with: npm start");
    BOOKS = [];
    return [];
  }
}

// ── Auth helpers ──────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem("folio_user")) || null; }
  catch { return null; }
}
function setSession(user) {
  sessionStorage.setItem("folio_user", JSON.stringify(user));
}
function clearSession() {
  sessionStorage.removeItem("folio_user");
}

// ── Cart helpers ──────────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem("folio_cart")) || []; }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem("folio_cart", JSON.stringify(cart));
  updateCartBadge();
}
async function syncCartToBackend() {
  const user = getSession();
  if (!user) return;
  try {
    await api("/api/cart", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, cart: getCart() })
    });
  } catch (err) {
    console.warn("Cart sync skipped:", err.message);
  }
}
function addToCart(bookId) {
  const cart = getCart();
  const book = BOOKS.find(b => Number(b.id) === Number(bookId));
  if (!book) return;
  const existing = cart.find(i => Number(i.id) === Number(bookId));
  if (existing) existing.qty += 1;
  else cart.push({ id: Number(bookId), qty: 1 });
  saveCart(cart);
  syncCartToBackend();
  showToast(`📚 "${book.title}" added to cart`);
}
function removeFromCart(bookId) {
  const cart = getCart().filter(i => Number(i.id) !== Number(bookId));
  saveCart(cart);
  syncCartToBackend();
}
function updateQty(bookId, delta) {
  const cart = getCart();
  const item = cart.find(i => Number(i.id) === Number(bookId));
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart(cart);
  syncCartToBackend();
}
function cartTotal(cart) {
  return cart.reduce((sum, item) => {
    const book = BOOKS.find(b => Number(b.id) === Number(item.id));
    return sum + (book ? book.price * item.qty : 0);
  }, 0);
}
function cartCount(cart) {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}
function totalsFor(cart) {
  const subtotal = cartTotal(cart);
  const shipping = subtotal >= 35 || subtotal === 0 ? 0 : 3.99;
  const tax = +(subtotal * 0.08).toFixed(2);
  const total = +(subtotal + shipping + tax).toFixed(2);
  return { subtotal, shipping, tax, total };
}

// ── UI helpers ────────────────────────────────────────────────
function updateCartBadge() {
  const badge = document.querySelector(".nav__cart-count");
  if (!badge) return;
  const count = cartCount(getCart());
  badge.textContent = count;
  badge.style.display = count === 0 ? "none" : "flex";
}
function showToast(msg) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
function renderNav(activePage) {
  const user = getSession();
  const count = cartCount(getCart());
  const pages = [
    { href: "index.html", label: "Browse", id: "home" },
    { href: "cart.html", label: "Cart", id: "cart", isCart: true },
    { href: "checkout.html", label: "Checkout", id: "checkout" }
  ];

  const navEl = document.querySelector(".nav");
  if (!navEl) return;

  navEl.innerHTML = `
    <a href="index.html" class="nav__logo">Fo<span>l</span>io</a>

    <!-- Search -->
    <div class="nav__search" id="navSearch">
      <button class="nav__search-toggle" id="searchToggle" title="Search books">🔍</button>
      <span class="nav__search-icon">🔍</span>
      <input class="nav__search-input" id="searchInput" type="text" placeholder="Search books or authors…" autocomplete="off" />
      <div class="search-dropdown" id="searchDropdown"></div>
    </div>

    <nav class="nav__links">
      ${pages.map(p => p.isCart ? `
        <a href="${p.href}" class="nav__cart-btn${activePage === p.id ? " active" : ""}">
          🛒 Cart
          <span class="nav__cart-count" style="display:${count > 0 ? "flex" : "none"}">${count}</span>
        </a>` : `
        <a href="${p.href}"${activePage === p.id ? " class='active'" : ""}>${p.label}</a>`
      ).join("")}
      ${user
        ? `<div class="nav__user">
             <span class="nav__user-name">Hi, ${user.name.split(" ")[0]}</span>
             <button class="nav__logout" id="logoutBtn">Sign out</button>
           </div>`
        : `<a href="login.html"${activePage === "login" ? " class='active'" : ""}>Sign in</a>`
      }
    </nav>`;

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });

  // ── Search logic ──────────────────────────────
  const searchWrap  = document.getElementById("navSearch");
  const searchToggle = document.getElementById("searchToggle");
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  searchToggle.addEventListener("click", () => {
    searchWrap.classList.add("open");
    setTimeout(() => searchInput.focus(), 50);
  });

  function closeSearch() {
    searchWrap.classList.remove("open");
    searchInput.value = "";
    searchDropdown.classList.remove("visible");
    searchDropdown.innerHTML = "";
  }

  document.addEventListener("click", e => {
    if (!searchWrap.contains(e.target)) closeSearch();
  }, { capture: true });

  searchInput.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSearch();
    if (e.key === "Enter") {
      const q = searchInput.value.trim();
      if (q && window.location.pathname.includes("index")) {
        // trigger filter on index page
        window._searchQuery = q;
        window.dispatchEvent(new CustomEvent("folio:search", { detail: q }));
        closeSearch();
      }
    }
  });

  function highlight(text, query) {
    if (!query) return text;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.replace(re, '<span class="search-highlight">$1</span>');
  }

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q || BOOKS.length === 0) {
      searchDropdown.classList.remove("visible");
      return;
    }
    const results = BOOKS.filter(b =>
      b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    ).slice(0, 6);

    if (results.length === 0) {
      searchDropdown.innerHTML = `<div class="search-dropdown__empty">No books found for "${q}"</div>`;
    } else {
      searchDropdown.innerHTML = results.map(b => `
        <a class="search-dropdown__item" href="details.html?id=${b.id}">
          <div class="search-dropdown__thumb" style="background:${b.cover?.bg || b.coverBg || "#2D4A5F"};color:${b.cover?.accent || b.coverAccent || "#5B9BBF"}">
            ${b.image ? `<img src="${b.image}" alt="${b.title}" />` : b.title.split(" ").slice(0,2).join(" ")}
          </div>
          <div>
            <div class="search-dropdown__title">${highlight(b.title, searchInput.value.trim())}</div>
            <div class="search-dropdown__meta">${highlight(b.author, searchInput.value.trim())} · ${b.genre} · $${b.price.toFixed(2)}</div>
          </div>
        </a>`).join("");
    }
    searchDropdown.classList.add("visible");
  });
}

// ══════════════════════════════════════════════════════════════
// BACK TO TOP
// ══════════════════════════════════════════════════════════════
function initBackToTop() {
  const btn = document.createElement("button");
  btn.className = "back-to-top";
  btn.innerHTML = "↑";
  btn.title = "Back to top";
  document.body.appendChild(btn);

  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ══════════════════════════════════════════════════════════════
// PAGE TRANSITIONS
// ══════════════════════════════════════════════════════════════
function initPageTransitions() {
  const overlay = document.createElement("div");
  overlay.className = "page-transition-overlay";
  document.body.appendChild(overlay);

  document.addEventListener("click", e => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    // Only intercept same-origin, non-hash, non-external links
    if (!href || href.startsWith("#") || href.startsWith("http") ||
        href.startsWith("mailto") || link.target === "_blank") return;

    e.preventDefault();
    overlay.classList.add("fading-out");
    setTimeout(() => { window.location.href = href; }, 260);
  });
}

// ══════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════════════════════════════════
function showSkeletonGrid(gridEl, count = 8) {
  if (!gridEl) return;
  gridEl.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-card__cover"></div>
      <div class="skeleton-card__body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line wide tall"></div>
        <div class="skeleton-line med"></div>
        <div class="skeleton-line short" style="margin-top:.4rem"></div>
      </div>
    </div>`).join("");
}
function stars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let s = "★".repeat(full);
  if (half) s += "½";
  return s;
}
function bookCardHTML(book) {
  const detailUrl = `details.html?id=${book.id}`;
  return `
    <div class="book-card" data-id="${book.id}" style="animation-delay:${(book.id - 1) * .04}s">
      <div class="book-card__cover" style="background:${book.cover.bg};color:${book.cover.accent};position:relative;">
        ${book.image
          ? `<img src="${book.image}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;display:block;">`
          : `
            <div class="book-card__spine" style="background:${book.cover.accent}"></div>
            <div class="book-card__cover-inner">
              <div class="book-card__cover-title">${book.title}</div>
              <div class="book-card__cover-author" style="color:${book.cover.accent}">${book.author}</div>
            </div>`
        }
        ${book.badge ? `<span class="book-card__badge">${book.badge}</span>` : ""}
        <a href="${detailUrl}" class="book-card__cover-link" aria-label="View ${book.title} details" style="position:absolute;inset:0;z-index:3;"></a>
      </div>
      <div class="book-card__body">
        <div class="book-card__genre">${book.genre}</div>
        <a href="${detailUrl}" class="book-card__title" style="display:block;cursor:pointer;text-decoration:none;color:inherit;">${book.title}</a>
        <div class="book-card__author">${book.author}</div>
        <div class="book-card__footer">
          <span class="book-card__price">$${book.price.toFixed(2)}</span>
          <span class="book-card__rating">
            <span class="book-card__stars">${stars(book.rating)}</span>
            ${book.rating} (${book.reviews.toLocaleString()})
          </span>
        </div>
        <button class="btn-add" data-book-id="${book.id}">
          <span>+</span> Add to Cart
        </button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// PAGE: INDEX
// ══════════════════════════════════════════════════════════════
async function initIndex() {
  renderNav("home");

  const grid = document.getElementById("booksGrid");
  const filterBtns = document.querySelectorAll(".filter-pill");
  const sortSelect = document.getElementById("sortSelect");
  let activeGenre = "All";
  let searchQuery = "";

  // Show skeleton while loading
  showSkeletonGrid(grid, 12);

  await loadBooks();

  function renderBooks() {
    if (!grid) return;
    let list = [...BOOKS];
    if (activeGenre !== "All") list = list.filter(b => b.genre === activeGenre);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
    }
    const sort = sortSelect?.value || "default";
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "rating") list.sort((a, b) => b.rating - a.rating);

    if (list.length === 0) {
      grid.innerHTML = `<div class="cart-empty"><div class="cart-empty__title">No books found${searchQuery ? ` for "${searchQuery}"` : ""}</div><button class="btn-browse" onclick="window._clearSearch()">Clear search</button></div>`;
      return;
    }

    grid.innerHTML = list.map(bookCardHTML).join("");
    grid.querySelectorAll(".btn-add").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.bookId);
        addToCart(id);
        btn.classList.add("added");
        btn.innerHTML = "✓ Added";
        setTimeout(() => {
          btn.classList.remove("added");
          btn.innerHTML = "<span>+</span> Add to Cart";
        }, 1200);
      });
    });
  }

  // Listen for search from nav
  window.addEventListener("folio:search", e => {
    searchQuery = e.detail;
    renderBooks();
    // Scroll to grid
    grid?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window._clearSearch = () => {
    searchQuery = "";
    renderBooks();
  };

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeGenre = btn.dataset.genre;
      renderBooks();
    });
  });
  sortSelect?.addEventListener("change", renderBooks);
  renderBooks();
}

// ══════════════════════════════════════════════════════════════
// PAGE: LOGIN
// ══════════════════════════════════════════════════════════════
function initLogin() {
  renderNav("login");
  if (getSession()) { window.location.href = "index.html"; return; }

  const form = document.getElementById("loginForm");
  form?.addEventListener("submit", async e => {
    e.preventDefault();
    const emailInput = document.getElementById("emailInput");
    const passInput = document.getElementById("passInput");
    const email = emailInput.value.trim();
    const password = passInput.value;

    document.querySelectorAll(".form-group").forEach(g => g.classList.remove("has-error"));
    document.getElementById("loginError").style.display = "none";

    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailInput.closest(".form-group").classList.add("has-error");
      valid = false;
    }
    if (!password) {
      passInput.closest(".form-group").classList.add("has-error");
      valid = false;
    }
    if (!valid) return;

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setSession(data.user);
      showToast(`Welcome back, ${data.user.name.split(" ")[0]}! 👋`);
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "index.html";
      setTimeout(() => window.location.href = redirect, 500);
    } catch (err) {
      document.getElementById("loginError").textContent = err.message || "Incorrect email or password.";
      document.getElementById("loginError").style.display = "block";
    }
  });
}

// ══════════════════════════════════════════════════════════════
// PAGE: CART
// ══════════════════════════════════════════════════════════════
async function initCart() {
  renderNav("cart");
  await loadBooks();

  const cartContainer = document.getElementById("cartContainer");
  const orderSummary = document.getElementById("orderSummary");

  function render() {
    const cart = getCart();
    if (!cartContainer) return;

    if (cart.length === 0) {
      cartContainer.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">📦</div>
          <div class="cart-empty__title">Your cart is empty</div>
          <div class="cart-empty__sub">Discover something wonderful to read.</div>
          <a href="index.html" class="btn-browse">Browse Books</a>
        </div>`;
      if (orderSummary) orderSummary.style.display = "none";
      return;
    }

    if (orderSummary) orderSummary.style.display = "block";
    const totals = totalsFor(cart);

    cartContainer.innerHTML = `
      <div class="cart-items">
        ${cart.map(item => {
          const book = BOOKS.find(b => Number(b.id) === Number(item.id));
          if (!book) return "";
          return `
            <div class="cart-item" data-id="${book.id}">
              <div class="cart-item__cover" style="background:${book.cover.bg};color:${book.cover.accent}">
                ${book.image
                  ? `<img src="${book.image}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:2px;">`
                  : book.title.split(" ").slice(0, 2).join(" ")
                }
              </div>
              <div class="cart-item__info">
                <div class="cart-item__title">${book.title}</div>
                <div class="cart-item__author">${book.author}</div>
                <div class="cart-item__controls">
                  <button class="qty-btn" data-action="dec" data-id="${book.id}">−</button>
                  <span class="qty-display">${item.qty}</span>
                  <button class="qty-btn" data-action="inc" data-id="${book.id}">+</button>
                </div>
              </div>
              <div class="cart-item__price-col">
                <span class="cart-item__price">$${(book.price * item.qty).toFixed(2)}</span>
                <button class="cart-item__remove" data-remove="${book.id}">Remove</button>
              </div>
            </div>`;
        }).join("")}
      </div>`;

    document.getElementById("summarySubtotal").textContent = `$${totals.subtotal.toFixed(2)}`;
    document.getElementById("summaryShipping").textContent = totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`;
    document.getElementById("summaryTax").textContent = `$${totals.tax.toFixed(2)}`;
    document.getElementById("summaryTotal").textContent = `$${totals.total.toFixed(2)}`;
    document.getElementById("itemCount").textContent = `${cartCount(cart)} item${cartCount(cart) !== 1 ? "s" : ""}`;

    cartContainer.querySelectorAll(".qty-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        updateQty(Number(btn.dataset.id), btn.dataset.action === "inc" ? 1 : -1);
        render();
      });
    });
    cartContainer.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        removeFromCart(Number(btn.dataset.remove));
        render();
        showToast("Item removed from cart");
      });
    });
  }

  render();

  document.getElementById("checkoutBtn")?.addEventListener("click", () => {
    if (!getSession()) window.location.href = "login.html?redirect=checkout.html";
    else window.location.href = "checkout.html";
  });
}

// ══════════════════════════════════════════════════════════════
// PAGE: CHECKOUT
// ══════════════════════════════════════════════════════════════
async function initCheckout() {
  renderNav("checkout");
  await loadBooks();

  const params = new URLSearchParams(window.location.search);
  if (params.get("confirmed") === "1") {
    showConfirmation(params.get("order") || "FLO-UNKNOWN");
    return;
  }

  const user = getSession();
  if (!user) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    window.location.href = "cart.html";
    return;
  }

  const totals = totalsFor(cart);

  const emailInput = document.getElementById("checkoutEmail");
  if (emailInput) emailInput.value = user.email;

  const miniList = document.getElementById("miniItems");
  if (miniList) {
    miniList.innerHTML = cart.map(item => {
      const book = BOOKS.find(b => Number(b.id) === Number(item.id));
      if (!book) return "";
      return `
        <div class="mini-item">
          <div class="mini-item__cover" style="background:${book.cover.bg}">
              ${book.image
                ? `<img src="${book.image}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;display:block;">`
                : book.title.charAt(0)
              }
            </div>
          <div class="mini-item__info">
            <div class="mini-item__title">${book.title}</div>
            <div class="mini-item__qty">× ${item.qty}</div>
          </div>
          <span class="mini-item__price">$${(book.price * item.qty).toFixed(2)}</span>
        </div>`;
    }).join("");
  }

  document.getElementById("coSubtotal").textContent = `$${totals.subtotal.toFixed(2)}`;
  document.getElementById("coShipping").textContent = totals.shipping === 0 ? "Free" : `$${totals.shipping.toFixed(2)}`;
  document.getElementById("coTax").textContent = `$${totals.tax.toFixed(2)}`;
  document.getElementById("coTotal").textContent = `$${totals.total.toFixed(2)}`;

  document.querySelectorAll(".payment-method").forEach(method => {
    method.addEventListener("click", () => {
      document.querySelectorAll(".payment-method").forEach(m => m.classList.remove("selected"));
      method.classList.add("selected");
      const cardFields = document.getElementById("cardFields");
      if (cardFields) cardFields.style.display = method.dataset.method === "card" ? "block" : "none";
    });
  });

  document.getElementById("payBtn")?.addEventListener("click", async () => {
    const form = document.getElementById("checkoutForm");
    const inputs = form.querySelectorAll("input[required]");
    let valid = true;

    inputs.forEach(input => {
      const group = input.closest(".form-group");
      if (!input.value.trim()) {
        group?.classList.add("has-error");
        valid = false;
      } else {
        group?.classList.remove("has-error");
      }
    });

    const cardNumber = document.getElementById("cardNumber")?.value.replace(/\s/g, "") || "";
    const cvv = document.getElementById("cvv")?.value || "";
    if (document.getElementById("cardFields")?.style.display !== "none") {
      if (cardNumber.length !== 16) { showToast("Card number must be 16 digits"); return; }
      if (cvv.length < 3) { showToast("CVV must be at least 3 digits"); return; }
    }

    if (!valid) { showToast("Please fill in all required fields"); return; }

    const btn = document.getElementById("payBtn");
    btn.innerHTML = "⏳ Processing…";
    btn.disabled = true;
    btn.style.opacity = ".7";

    try {
      const selectedPayment = document.querySelector(".payment-method.selected")?.dataset.method || "card";
      const payload = {
        userId: user.id,
        items: cart.map(item => {
          const book = BOOKS.find(b => Number(b.id) === Number(item.id));
          return { id: item.id, qty: item.qty, title: book?.title || "Unknown", price: book?.price || 0 };
        }),
        customer: {
          firstName: document.getElementById("firstName").value.trim(),
          lastName: document.getElementById("lastName").value.trim(),
          email: document.getElementById("checkoutEmail").value.trim(),
          address: document.getElementById("address").value.trim(),
          city: document.getElementById("city").value.trim(),
          postal: document.getElementById("postal").value.trim(),
          country: document.getElementById("country").value
        },
        totals,
        paymentMethod: selectedPayment
      };

      const data = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      localStorage.setItem("folio_last_order", JSON.stringify(data.order));
      localStorage.removeItem("folio_cart");
      window.location.href = `checkout.html?confirmed=1&order=${encodeURIComponent(data.order.orderId)}`;
    } catch (err) {
      showToast(err.message || "Order failed");
      btn.innerHTML = "🔒 Place Order";
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  });
}

function showConfirmation(orderId) {
  const user = getSession();
  const lastOrder = JSON.parse(localStorage.getItem("folio_last_order") || "null");
  const checkoutContent = document.getElementById("checkoutContent");
  const now = lastOrder?.createdAt ? new Date(lastOrder.createdAt) : new Date();
  const eta = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const total = lastOrder?.totals?.total;

  if (checkoutContent) {
    checkoutContent.innerHTML = `
      <div class="confirmation">
        <div class="confirmation__icon">✓</div>
        <h1 class="confirmation__title">Order Confirmed!</h1>
        <p class="confirmation__sub">Thank you${user ? ", " + user.name.split(" ")[0] : ""}. Your books are on their way.</p>
        <div class="confirmation__order">
          <div>Order ID: <strong>${orderId}</strong></div>
          <div style="margin-top:.5rem">Placed: ${now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}</div>
          <div>Estimated delivery: <strong>${eta.toLocaleDateString("en-US", { weekday:"short", month:"long", day:"numeric" })}</strong></div>
          <div style="margin-top:.5rem">Total charged: <strong>${typeof total === "number" ? "$" + total.toFixed(2) : "Saved in backend"}</strong></div>
        </div>
        <a href="index.html" class="btn-home">Continue Browsing</a>
      </div>`;
  }
  document.getElementById("checkoutSidebar")?.remove();
  document.querySelector(".checkout-steps")?.remove();
}

// ── Auto-init based on page ───────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "index") initIndex();
  if (page === "login") initLogin();
  if (page === "cart") initCart();
  if (page === "checkout") initCheckout();
  // details page has its own inline init in details.html
  updateCartBadge();
  initBackToTop();
  initPageTransitions();
});
