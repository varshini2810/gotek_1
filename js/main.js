/**
 * JustLanyards — Main JavaScript
 * Connects frontend to backend API for dynamic data, cart, auth, and search.
 */

(function () {
  'use strict';

  // ==============================
  // TOAST NOTIFICATION
  // ==============================
  function showToast(message, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.style.background = type === 'success' ? '#2e7d32' : type === 'error' ? '#c62828' : '#001b38';
    toast.innerHTML = (type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ') + message;
    toast.style.transform = 'translateX(0)';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function () {
      toast.style.transform = 'translateX(200%)';
    }, 3000);
  }

  // ==============================
  // CART UTILITIES (shared)
  // ==============================
  async function refreshCartHeader() {
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      const countEl = document.getElementById('headerCartCount');
      const totalEl = document.getElementById('headerCartTotal');
      if (countEl) countEl.textContent = data.count || 0;
      if (totalEl) totalEl.textContent = (data.total || 0).toFixed(2);
    } catch (e) { /* silently fail if not on server */ }
  }

  async function addToCart(productId, productName) {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      if (res.ok) {
        showToast(productName + ' added to cart!', 'success');
        refreshCartHeader();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to add to cart.', 'error');
      }
    } catch (e) {
      showToast('Could not connect to server.', 'error');
    }
  }

  // ==============================
  // AUTH STATE
  // ==============================
  async function refreshAuthHeader() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const authLink = document.getElementById('authLink');
      if (!authLink) return;
      if (data.user) {
        authLink.textContent = data.user.isAdmin ? '⚙ Admin' : 'Hi, ' + data.user.name.split(' ')[0];
        authLink.href = data.user.isAdmin ? '/admin' : '/orders';
      } else {
        authLink.textContent = 'Login / Register';
        authLink.href = '/login';
      }
    } catch (e) { /* silently fail */ }
  }

  // ==============================
  // LOAD CATEGORIES FROM API
  // ==============================
  const catBgColors = ['#e8f5e9', '#e3f2fd', '#fff3e0', '#f3e5f5'];
  
  async function loadCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/categories');
      const categories = await res.json();
      if (!categories.length) { grid.innerHTML = '<p style="color:#777;grid-column:1/-1;text-align:center;">No categories found.</p>'; return; }

      grid.innerHTML = categories.map(function (cat, i) {
        return `<a href="/products?category=${cat.slug}" class="category-card animate-ready">
          <img src="${cat.image || 'images/category_plain.png'}" alt="${cat.name}" onerror="this.src='images/category_plain.png'" />
          <div class="category-info">
            <h3>${cat.name.toUpperCase()}</h3>
            <p class="product-count">${cat.product_count} products</p>
          </div>
        </a>`;
      }).join('');

      // Trigger scroll animation
      observeCards(grid.querySelectorAll('.category-card'));
    } catch (e) {
      grid.innerHTML = '<p style="color:#c62828;grid-column:1/-1;text-align:center;">Could not load categories.</p>';
    }
  }

  // ==============================
  // LOAD FEATURED PRODUCTS FROM API
  // ==============================
  async function loadFeaturedProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/products?featured=1');
      const products = await res.json();
      if (!products.length) { grid.innerHTML = '<p style="color:#777;grid-column:1/-1;text-align:center;">No products found.</p>'; return; }

      grid.innerHTML = products.map(function (p) {
        const badgeHtml = p.badge
          ? `<span class="product-badge ${p.badge_type || 'default'}">${p.badge}</span>`
          : '';

        const imgHtml = p.image
          ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none'" />`
          : `<span style="font-size:60px;">🏷️</span>`;

        const ecoBadge = (p.badge_type === 'eco')
          ? `<span class="product-badge eco" style="position:static;display:inline-block;margin-bottom:8px;font-size:10px;">${p.badge}</span><br/>`
          : '';

        return `<div class="product-card animate-ready">
          <div class="product-img-wrap">
            ${imgHtml}
            ${p.badge && p.badge_type !== 'eco' ? badgeHtml : ''}
          </div>
          <div class="product-info">
            <h3>${p.name}</h3>
            ${ecoBadge}
            <p class="product-price">Prices from: <strong>£${parseFloat(p.price_from).toFixed(2)}</strong> <span>| see all prices</span></p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <a href="/product/${p.slug}" class="btn-customise" style="flex:1;">VIEW DETAILS</a>
              <button onclick="window._addToCart(${p.id},'${p.name.replace(/'/g,'\\\'')}')" 
                class="btn-customise" style="flex:1;background:#001b38;border-color:#001b38;">
                <i class="fas fa-cart-plus"></i> ADD
              </button>
            </div>
          </div>
        </div>`;
      }).join('');

      observeCards(grid.querySelectorAll('.product-card'));
    } catch (e) {
      grid.innerHTML = '<p style="color:#c62828;grid-column:1/-1;text-align:center;">Could not load products.</p>';
    }
  }

  // Expose addToCart globally for inline onclick handlers
  window._addToCart = addToCart;

  // ==============================
  // LOAD BLOG POSTS FROM API
  // ==============================
  const blogColors = ['#f07d00', '#1e88e5', '#43a047', '#8e24aa', '#e53935'];
  const blogEmojis = ['✍️', '🏫', '♻️', '🎯', '🏆'];

  async function loadBlogPosts() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/products/blog/posts');
      const posts = await res.json();
      if (!posts.length) { grid.innerHTML = '<p style="color:#777;grid-column:1/-1;text-align:center;">No blog posts yet.</p>'; return; }

      grid.innerHTML = posts.map(function (post, i) {
        const col = blogColors[i % blogColors.length];
        const emoji = blogEmojis[i % blogEmojis.length];
        const colDark = col.replace(/(..)$/, function (m) { return (parseInt(m, 16) - 30).toString(16).padStart(2, '0'); }) || col;
        return `<article class="blog-card animate-ready">
          <div class="blog-img-placeholder" style="background:linear-gradient(135deg,${col},${col}cc);">${emoji}</div>
          <div class="blog-info">
            <span class="blog-tag">${post.tag || 'ID Cards'}</span>
            <h3>${post.title}</h3>
            <p>${post.excerpt || ''}</p>
            <a href="/blog/${post.slug}" class="btn-read-more">CONTINUE READING</a>
          </div>
        </article>`;
      }).join('');

      observeCards(grid.querySelectorAll('.blog-card'));
    } catch (e) {
      grid.innerHTML = '<p style="color:#c62828;grid-column:1/-1;text-align:center;">Could not load posts.</p>';
    }
  }

  // ==============================
  // INTERSECTION OBSERVER ANIMATION
  // ==============================
  function observeCards(els) {
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('animate-in'));
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });
    els.forEach(el => observer.observe(el));
  }

  // ==============================
  // LIVE SEARCH
  // ==============================
  const searchToggle = document.getElementById('searchToggle');
  if (searchToggle) {
    searchToggle.addEventListener('click', function () {
      let overlay = document.getElementById('searchOverlay');
      if (overlay) { overlay.remove(); return; }

      overlay = document.createElement('div');
      overlay.id = 'searchOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,27,56,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;padding-top:15vh;';
      overlay.innerHTML = `
        <div style="background:#fff;padding:30px;border-radius:6px;width:90%;max-width:600px;position:relative;">
          <button id="closeSearch" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#777;">&times;</button>
          <h3 style="font-family:'Ubuntu',sans-serif;color:#001b38;margin-bottom:16px;font-size:20px;">🔍 Search Just Lanyards</h3>
          <div style="display:flex;gap:10px;">
            <input type="text" placeholder="Search for ID cards, accessories..." id="searchInput"
              style="flex:1;padding:13px 16px;border:2px solid #e0e0e0;border-radius:3px;font-size:14px;outline:none;font-family:'Hind',sans-serif;transition:border 0.2s;"
              onfocus="this.style.borderColor='#f07d00'" onblur="this.style.borderColor='#e0e0e0'"
            />
            <button onclick="doSearch()" style="padding:13px 20px;background:#f07d00;color:#fff;border:none;border-radius:3px;font-family:'Ubuntu',sans-serif;font-weight:700;font-size:13px;cursor:pointer;text-transform:uppercase;">
              SEARCH
            </button>
          </div>
          <div id="searchResults" style="margin-top:16px;max-height:50vh;overflow-y:auto;"></div>
        </div>`;
      document.body.appendChild(overlay);

      document.getElementById('closeSearch').onclick = () => overlay.remove();
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

      const input = document.getElementById('searchInput');
      input.focus();

      let debounce;
      input.addEventListener('input', function () {
        clearTimeout(debounce);
        if (input.value.trim().length < 2) {
          document.getElementById('searchResults').innerHTML = '';
          return;
        }
        debounce = setTimeout(doSearch, 400);
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSearch();
      });
    });
  }

  window.doSearch = async function () {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    if (!input || !results) return;
    const q = input.value.trim();
    if (!q) return;
    results.innerHTML = '<p style="color:#777;font-size:13px;padding:10px 0;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Searching...</p>';
    try {
      const res = await fetch('/api/products/search?q=' + encodeURIComponent(q));
      const data = await res.json();
      if (!data.length) {
        results.innerHTML = '<p style="color:#777;font-size:13px;padding:12px 0;">No results found for <em>"' + q + '"</em>. Try different keywords.</p>';
        return;
      }
      results.innerHTML = data.map(p =>
        `<div style="display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:3px;transition:background 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background=''" onclick="window.location='/product/${p.slug}'">
          <img src="${p.image || 'images/category_plain.png'}" style="width:46px;height:46px;object-fit:cover;border-radius:3px;border:1px solid #eee;" onerror="this.src='images/category_plain.png'" />
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:#001b38;">${p.name}</div>
            <div style="font-size:12px;color:#f07d00;font-weight:700;">£${parseFloat(p.price_from).toFixed(2)}</div>
            ${p.category_name ? `<div style="font-size:11px;color:#999;">${p.category_name}</div>` : ''}
          </div>
          <button onclick="event.stopPropagation();window._addToCart(${p.id},'${p.name.replace(/'/g,'\\\'')}')" style="padding:6px 12px;background:#f07d00;color:#fff;border:none;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">ADD</button>
        </div>`
      ).join('');
    } catch (e) {
      results.innerHTML = '<p style="color:#c62828;font-size:13px;">Search failed. Make sure the server is running.</p>';
    }
  };

  // ==============================
  // HERO SLIDER
  // ==============================
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.slider-dot');
  let currentSlide = 0;
  let sliderInterval;

  function showSlide(index) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
  }

  function startAutoPlay() { sliderInterval = setInterval(() => showSlide(currentSlide + 1), 5000); }
  function resetAutoPlay() { clearInterval(sliderInterval); startAutoPlay(); }

  const prevBtn = document.getElementById('sliderPrev');
  const nextBtn = document.getElementById('sliderNext');
  if (prevBtn) prevBtn.addEventListener('click', () => { showSlide(currentSlide - 1); resetAutoPlay(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { showSlide(currentSlide + 1); resetAutoPlay(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { showSlide(i); resetAutoPlay(); }));
  if (slides.length > 1) startAutoPlay();

  // ==============================
  // MOBILE MENU
  // ==============================
  const mobileToggle = document.getElementById('mobileToggle');
  const mainNav = document.getElementById('mainNav');

  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', function () {
      mainNav.classList.toggle('open');
      const spans = mobileToggle.querySelectorAll('span');
      if (mainNav.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });
  }

  document.querySelectorAll('.has-dropdown').forEach(function (item) {
    const link = item.querySelector('a');
    if (link) link.addEventListener('click', function (e) {
      if (window.innerWidth <= 768) { e.preventDefault(); item.classList.toggle('open'); }
    });
  });

  document.addEventListener('click', function (e) {
    if (mainNav && !mainNav.contains(e.target) && mobileToggle && !mobileToggle.contains(e.target)) {
      mainNav.classList.remove('open');
      mobileToggle.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  // ==============================
  // SCROLL TO TOP
  // ==============================
  const scrollTopBtn = document.getElementById('scrollTop');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => scrollTopBtn.classList.toggle('visible', window.scrollY > 300));
    scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // ==============================
  // COOKIE BANNER
  // ==============================
  const cookieBanner = document.getElementById('cookieBanner');
  const cookieAccept = document.getElementById('cookieAccept');
  if (localStorage.getItem('cookiesAccepted') === 'true' && cookieBanner) cookieBanner.style.display = 'none';
  if (cookieAccept) {
    cookieAccept.addEventListener('click', function () {
      localStorage.setItem('cookiesAccepted', 'true');
      if (cookieBanner) {
        cookieBanner.style.opacity = '0';
        cookieBanner.style.transition = 'opacity 0.3s ease';
        setTimeout(() => cookieBanner.style.display = 'none', 300);
      }
    });
  }

  // ==============================
  // VIDEO PLAY BUTTON
  // ==============================
  const designVideo = document.querySelector('.design-video');
  if (designVideo) {
    designVideo.addEventListener('click', function () {
      showToast('Video demonstration — opening!', 'success');
    });
  }

  // ==============================
  // INIT — load all dynamic content
  // ==============================
  refreshCartHeader();
  refreshAuthHeader();
  loadCategories();
  loadFeaturedProducts();
  loadBlogPosts();

  console.log('🚀 Just Lanyards — connected to API backend.');
})();
