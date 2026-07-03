let catalog = [];
let currentFilter = 'all';

async function fetchCatalog() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('API server unreachable');
        catalog = await response.json();
        
        updateCategoryBadges();
        renderCatalog();
    } catch (err) {
        console.error('Error fetching catalog:', err);
        const grid = document.getElementById('catalog-items');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: rgba(155,27,27,0.1); border: 1px solid var(--brand); border-radius: 20px; color: white;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: #9b1b1b; margin-bottom: 15px;"></i>
                    <p style="font-weight: 600; font-size: 1.1rem;">Unable to load products from database server.</p>
                    <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 5px;">Ensure the backend Node server is running and your database is configured.</p>
                    <button onclick="fetchCatalog()" class="retry-btn">RETRY CONNECTION</button>
                </div>`;
        }
    }
}

function updateCategoryBadges() {
    const counts = {
        all: catalog.length,
        Cashew: catalog.filter(item => item.cat === 'Cashew').length,
        'Dry Fruits': catalog.filter(item => item.cat === 'Dry Fruits').length,
        'Oats & Millets': catalog.filter(item => item.cat === 'Oats & Millets').length,
        'Snacks & Breakfast': catalog.filter(item => item.cat === 'Snacks & Breakfast').length,
        Spices: catalog.filter(item => item.cat === 'Spices').length,
        offers: catalog.filter(item => item.discount_percent > 0).length
    };

    for (const [key, val] of Object.entries(counts)) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = val;
    }
}

function renderCatalog(searchQuery = "") {
    const grid = document.getElementById('catalog-items');
    if (!grid) return;

    const filteredItems = catalog.filter(item => {
        const matchesCategory = (currentFilter === 'all' || 
                                 (currentFilter === 'offers' ? item.discount_percent > 0 : item.cat === currentFilter));
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.tag.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; opacity: 0.5; color: white;">No products found matching your search.</div>`;
        return;
    }

    grid.innerHTML = filteredItems.map(item => {
        const hasDiscount = item.discount_percent > 0;
        const finalPrice = hasDiscount ? Math.round(item.price * (1 - item.discount_percent / 100)) : item.price;
        const triggerQty = parseInt(item.discount_trigger_qty) || 1;
        const isFlatDiscount = hasDiscount && triggerQty === 1;
        let ribbonHTML = '';
        if (hasDiscount) {
            if (triggerQty > 1) {
                ribbonHTML = `<div class="discount-ribbon">Buy ${triggerQty}+: ${item.discount_percent}% OFF</div>`;
            } else {
                ribbonHTML = `<div class="discount-ribbon">${item.discount_percent}% OFF</div>`;
            }
        }
        return `
            <div class="item-card-pro" onclick="openQuickView(${item.id})">
                <div class="product-image-container">
                    ${ribbonHTML}
                    <img src="${item.img}" class="main-prod-img" onerror="this.src='pics/products/croast.jpg'">
                    <div class="product-img-overlay"><i class="fas fa-search-plus"></i> View Details</div>
                </div>
                <span class="tag-label">${item.tag}</span>
                <h3 class="prod-title">${item.name}</h3>
                <p class="price-text">
                    ${isFlatDiscount ? `
                        <span class="price-original-slashed">₹${item.price}</span>
                        <span class="price-discounted">₹${finalPrice}</span>
                    ` : `
                        ₹${item.price}
                    `}
                    <span class="unit-label">/ ${item.unit}</span>
                </p>
                <p class="prod-desc-preview" style="font-size: 0.75rem; color: var(--body-text-muted); margin: 6px 0 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 32px; line-height: 1.3; text-align: center;">
                    ${item.description || 'Premium select wholesale item.'}
                </p>
            </div>
        `;
    }).join('');
}

window.filterCatalog = function(cat, element) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    const searchVal = document.getElementById('search-input') ? document.getElementById('search-input').value : "";
    renderCatalog(searchVal);
};

window.handleSearch = function(value) {
    renderCatalog(value);
};

// QUICK VIEW MODAL
window.openQuickView = function(id) {
    const item = catalog.find(p => p.id === id);
    if (!item) return;

    const modal = document.getElementById('quickview-modal');
    if (!modal) return;

    const stock = parseInt(item.stock === undefined ? 50 : item.stock);
    let stockHTML = '';
    const loggedIn = window.isCustomerLoggedIn ? window.isCustomerLoggedIn() : false;
    let btnHTML = '';
    if (!loggedIn) {
        btnHTML = `
            <button class="shop-redirect-btn" onclick="openAuthModal()">
                <span>LOGIN TO ORDER</span>
                <i class="fas fa-user-lock"></i>
            </button>`;
    } else {
        btnHTML = `
            <button class="shop-redirect-btn" onclick="location.href='shop.html'">
                <span>ORDER THIS IN PORTAL</span>
                <i class="fas fa-shopping-basket"></i>
            </button>`;
    }

    if (stock <= 0) {
        stockHTML = `<p><strong>Stock Status:</strong> <span style="color:#ff4d4d; font-weight:700;">Out of Stock</span></p>`;
        btnHTML = `
            <button class="shop-redirect-btn" disabled style="opacity:0.5; background:#555; color:#aaa; cursor:not-allowed; box-shadow:none;">
                <span>OUT OF STOCK</span>
                <i class="fas fa-ban"></i>
            </button>`;
    } else if (stock <= 10) {
        stockHTML = `<p><strong>Stock Status:</strong> <span style="color:#f1c40f; font-weight:700;">Only ${stock} left in stock!</span></p>`;
    } else {
        stockHTML = `<p><strong>Stock Status:</strong> <span style="color:#2ecc71; font-weight:700;">In Stock (${stock} available)</span></p>`;
    }

    const hasDiscount = item.discount_percent > 0;
    const finalPrice = hasDiscount ? Math.round(item.price * (1 - item.discount_percent / 100)) : item.price;
    const triggerQty = parseInt(item.discount_trigger_qty) || 1;
    let ribbonHTML = '';
    if (hasDiscount) {
        if (triggerQty > 1) {
            ribbonHTML = `<div class="discount-ribbon" style="top: 15px; left: 15px;">Buy ${triggerQty}+: ${item.discount_percent}% OFF</div>`;
        } else {
            ribbonHTML = `<div class="discount-ribbon" style="top: 15px; left: 15px;">${item.discount_percent}% OFF</div>`;
        }
    }
    modal.innerHTML = `
        <div class="qv-modal-card">
            <button class="close-qv-btn" onclick="closeQuickView()"><i class="fas fa-times"></i></button>
            <div class="qv-grid">
                <div class="qv-image-side" style="position: relative;">
                    ${ribbonHTML}
                    <img src="${item.img}" onerror="this.src='pics/products/croast.jpg'">
                </div>
                <div class="qv-details-side">
                    <div>
                        <span class="tag-label" style="font-size: 0.75rem;">${item.tag}</span>
                        <h2 class="qv-title">${item.name}</h2>
                        <p class="qv-price">
                            ${(hasDiscount && triggerQty === 1) ? `
                                <span class="price-original-slashed" style="font-size: 1.1rem; margin-right: 8px;">₹${item.price}</span>
                                <span class="price-discounted" style="font-size: 1.7rem; color: #ff1744; font-weight: 700;">₹${finalPrice}</span>
                            ` : `
                                ₹${item.price}
                            `}
                            <span class="unit-label">/ ${item.unit}</span>
                        </p>
                        
                        <div class="qv-meta-box">
                            <p><strong>Category:</strong> ${item.cat}</p>
                            ${hasDiscount && triggerQty > 1 ? `<p style="color:#ff1744; font-weight:700; font-size:0.85rem; margin: 8px 0;"><i class="fas fa-percentage"></i> Bulk Offer: Buy ${triggerQty} or more to unlock ${item.discount_percent}% discount!</p>` : ''}
                            ${stockHTML}
                        </div>
                        
                        <div class="qv-desc">
                            <h4>About this Product:</h4>
                            <p>${item.description || 'Premium select wholesale item, sourced from traditional agricultural hubs.'}</p>
                        </div>
                    </div>
                    
                    ${btnHTML}
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeQuickView = function() {
    const modal = document.getElementById('quickview-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

function updateThemeIcon() {
    const icon = document.querySelector('#theme-toggle i');
    if (!icon) return;
    const isLight = document.documentElement.classList.contains('light-theme');
    if (isLight) {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();

    window.addEventListener('click', (e) => {
        const qvModal = document.getElementById('quickview-modal');
        if (e.target === qvModal) {
            closeQuickView();
        }
    });

    // Navigation Shop Dropdown toggle
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    // Theme Toggle Button
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        updateThemeIcon();
        themeBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem('wellshine_theme', isLight ? 'light' : 'dark');
            updateThemeIcon();
        });
    }
});
