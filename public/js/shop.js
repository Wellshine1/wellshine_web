// Global inventory array loaded from backend database
let inventory = [];
let cart = [];
let currentFilter = 'all';

// Load cart from localStorage
if (localStorage.getItem('wellshine_cart')) {
    try {
        cart = JSON.parse(localStorage.getItem('wellshine_cart'));
    } catch(e) {
        cart = [];
    }
}

// 1. FETCH CATALOG FROM API ON STARTUP
async function fetchCatalog() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch catalog from server');
        inventory = await response.json();
        
        updateCategoryBadges();
        renderShop();
        updateCartBadge();
    } catch (err) {
        console.error('Database fetch error:', err);
        // Fallback banner
        const grid = document.getElementById('shop-items');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: rgba(155,27,27,0.1); border: 1px solid var(--brand); border-radius: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; color: var(--brand); margin-bottom: 15px;"></i>
                    <p style="font-weight: 600; font-size: 1.1rem;">Unable to load catalog from database server.</p>
                    <p style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 5px;">Ensure the backend Node server is running and database configuration in .env is correct.</p>
                    <button onclick="fetchCatalog()" class="add-btn-primary" style="width: auto; margin-top: 15px; padding: 8px 25px;">RETRY CONNECTION</button>
                </div>`;
        }
    }
}

// Update Category Filter Badges dynamically based on DB count
function updateCategoryBadges() {
    const counts = {
        all: inventory.length,
        Cashew: inventory.filter(item => item.cat === 'Cashew').length,
        'Dry Fruits': inventory.filter(item => item.cat === 'Dry Fruits').length,
        'Oats & Millets': inventory.filter(item => item.cat === 'Oats & Millets').length,
        'Snacks & Breakfast': inventory.filter(item => item.cat === 'Snacks & Breakfast').length,
        Spices: inventory.filter(item => item.cat === 'Spices').length,
        offers: inventory.filter(item => item.discount_percent > 0).length
    };

    for (const [key, val] of Object.entries(counts)) {
        const el = document.getElementById(`count-${key}`);
        if (el) el.innerText = val;
    }
}

// 2. COMPILER AND RENDERING GRID (Zero-Blink Setup)
function renderShop(searchQuery = "") {
    const grid = document.getElementById('shop-items');
    if (!grid) return;

    const filteredItems = inventory.filter(item => {
        const matchesCategory = (currentFilter === 'all' || 
                                 (currentFilter === 'offers' ? item.discount_percent > 0 : item.cat === currentFilter));
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.tag.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; opacity: 0.5;">No products found matching your search.</div>`;
        return;
    }

    grid.innerHTML = filteredItems.map(item => {
        const stock = parseInt(item.stock === undefined ? 50 : item.stock);
        const isOutOfStock = stock <= 0;
        
        let stockLabelHTML = '';
        if (isOutOfStock) {
            stockLabelHTML = `<span class="stock-badge out" style="display:inline-block; font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:700; background:rgba(255, 77, 77, 0.15); color:#ff4d4d; border:1px solid #ff4d4d; margin-bottom:10px;">Out of Stock</span>`;
        } else if (stock <= 10) {
            stockLabelHTML = `<span class="stock-badge low" style="display:inline-block; font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:700; background:rgba(241, 196, 15, 0.2); color:#f1c40f; border:1px solid #f1c40f; margin-bottom:10px;">Only ${stock} left!</span>`;
        } else {
            stockLabelHTML = `<span class="stock-badge in" style="display:inline-block; font-size:0.7rem; padding:2px 8px; border-radius:10px; font-weight:700; background:rgba(46, 204, 113, 0.15); color:#2ecc71; border:1px solid #2ecc71; margin-bottom:10px;">In Stock (${stock} available)</span>`;
        }

        // Check if item is in cart to display Quantity controls or Add button
        const cartItem = cart.find(c => c.id === item.id);
        const loggedIn = window.isCustomerLoggedIn ? window.isCustomerLoggedIn() : false;
        
        let controlHTML = '';
        if (isOutOfStock) {
            controlHTML = `<button type="button" class="add-btn-primary" disabled style="opacity:0.5; cursor:not-allowed;">Out of Stock</button>`;
        } else if (!loggedIn) {
            controlHTML = `<button type="button" class="add-btn-primary" onclick="openAuthModal()"><i class="fas fa-user-lock"></i> Login to Order</button>`;
        } else if (cartItem) {
            controlHTML = `
               <div class="card-qty-selector">
                 <button type="button" onclick="updateQuantity(${item.id}, -1)" class="card-qty-btn"><i class="fas fa-minus"></i></button>
                 <span class="card-qty-display">${cartItem.quantity}</span>
                 <button type="button" onclick="updateQuantity(${item.id}, 1)" class="card-qty-btn"><i class="fas fa-plus"></i></button>
               </div>`;
        } else {
            controlHTML = `<button type="button" class="add-btn-primary" onclick="addToCart(${item.id})">Add to Order +</button>`;
        }

        const hasDiscount = item.discount_percent > 0;
        const triggerQty = parseInt(item.discount_trigger_qty) || 1;
        const quantity = cartItem ? cartItem.quantity : 0;
        const isDiscountUnlocked = hasDiscount && quantity >= triggerQty;
        const finalPrice = isDiscountUnlocked ? Math.round(item.price * (1 - item.discount_percent / 100)) : item.price;
        let ribbonHTML = '';
        if (hasDiscount) {
            if (triggerQty > 1) {
                ribbonHTML = `<div class="discount-ribbon">Buy ${triggerQty}+: ${item.discount_percent}% OFF</div>`;
            } else {
                ribbonHTML = `<div class="discount-ribbon">${item.discount_percent}% OFF</div>`;
            }
        }

        return `
            <div class="item-card-pro" style="${isOutOfStock ? 'opacity: 0.7;' : ''}">
                <div class="product-image-container">
                    ${ribbonHTML}
                    <img src="${item.img}" class="main-prod-img" onerror="this.src='pics/products/croast.jpg'" onclick="openQuickView(${item.id})">
                    <div class="product-img-overlay" onclick="openQuickView(${item.id})"><i class="fas fa-search-plus"></i> Quick View</div>
                </div>
                <div onclick="openQuickView(${item.id})" style="cursor: pointer;">
                    <div style="text-align: center;">${stockLabelHTML}</div>
                    <span class="tag-label">${item.tag}</span>
                    <h3 class="prod-title">${item.name}</h3>
                </div>
                <p class="prod-desc-preview" onclick="openQuickView(${item.id})">
                    ${item.description || 'Premium select wholesale item.'}
                </p>
                <p class="price-text">
                    ${isDiscountUnlocked ? `
                        <span class="price-original-slashed">₹${item.price}</span>
                        <span class="price-discounted">₹${finalPrice}</span>
                    ` : (hasDiscount && triggerQty === 1) ? `
                        <span class="price-original-slashed">₹${item.price}</span>
                        <span class="price-discounted">₹${Math.round(item.price * (1 - item.discount_percent / 100))}</span>
                    ` : `
                        ₹${item.price}
                    `}
                    <span class="unit-label">/ ${item.unit}</span>
                    ${(hasDiscount && triggerQty > 1 && !isDiscountUnlocked) ? `<span style="font-size:0.65rem; color:#ff1744; display:block; margin-top:2px;">(Buy ${triggerQty}+ to get ${item.discount_percent}% OFF)</span>` : ''}
                </p>
                <div class="card-action-container">${controlHTML}</div>
            </div>
        `;
    }).join('');
}

// 3. LIVE EVENTS INTERFACES
window.filterShop = function(cat, element) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    const searchVal = document.getElementById('search-input') ? document.getElementById('search-input').value : "";
    renderShop(searchVal);
};

window.handleSearch = function(value) {
    renderShop(value);
};

// 4. QUANTITY-AWARE CART ENGINE
window.addToCart = function(id) {
    const item = inventory.find(p => p.id === id);
    if (!item) return;

    const stock = parseInt(item.stock === undefined ? 50 : item.stock);
    if (stock <= 0) {
        alert("This item is currently out of stock!");
        return;
    }

    const cartItem = cart.find(c => c.id === id);
    if (cartItem) {
        if (cartItem.quantity >= stock) {
            alert(`Sorry, only ${stock} units of this item are available in stock.`);
            return;
        }
        cartItem.quantity += 1;
    } else {
        cart.push({ id: id, quantity: 1 });
    }

    saveCart();
    updateCartBadge();
    renderShop(document.getElementById('search-input')?.value || "");
    renderCart();
};

window.updateQuantity = function(id, delta) {
    const cartItem = cart.find(c => c.id === id);
    const item = inventory.find(p => p.id === id);
    
    if (cartItem && item) {
        const stock = parseInt(item.stock === undefined ? 50 : item.stock);
        if (delta > 0 && cartItem.quantity >= stock) {
            alert(`Sorry, only ${stock} units of this item are available in stock.`);
            return;
        }
        
        cartItem.quantity += delta;
        if (cartItem.quantity <= 0) {
            cart = cart.filter(c => c.id !== id);
        }
        saveCart();
        updateCartBadge();
        renderShop(document.getElementById('search-input')?.value || "");
        renderCart();
        
        // Refresh quick view if it is open for the same item
        const qvModal = document.getElementById('quickview-modal');
        if (qvModal && qvModal.style.display === 'flex' && window.currentQuickViewId === id) {
            renderQuickViewQty(id);
        }
    }
};

window.removeFromCart = function(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
    updateCartBadge();
    renderShop(document.getElementById('search-input')?.value || "");
    renderCart();
    
    // Refresh quick view if open
    const qvModal = document.getElementById('quickview-modal');
    if (qvModal && qvModal.style.display === 'flex' && window.currentQuickViewId === id) {
        renderQuickViewQty(id);
    }
};

window.clearCart = function() {
    if (cart.length === 0) return;
    if (confirm("Are you sure you want to clear your wholesale basket?")) {
        cart = [];
        saveCart();
        updateCartBadge();
        renderShop(document.getElementById('search-input')?.value || "");
        renderCart();
    }
};

function saveCart() {
    localStorage.setItem('wellshine_cart', JSON.stringify(cart));
}

function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        badge.innerText = totalItems;
    }
}

// 5. SLIDING SIDEBAR CART
window.openCheckout = function() {
    const sidebar = document.getElementById('order-sidebar');
    if (sidebar) {
        sidebar.classList.add('open');
        renderCart();
    }
};

window.closeCheckout = function() {
    const sidebar = document.getElementById('order-sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
    }
};

function renderCart() {
    const list = document.getElementById('cart-list');
    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; opacity: 0.5;">
                <i class="fas fa-shopping-basket" style="font-size: 3rem; margin-bottom: 15px; display: block; color: var(--gold);"></i>
                Your basket is empty. Add products to get started!
            </div>`;
        const totalContainer = document.getElementById('cart-total-value');
        if (totalContainer) totalContainer.innerText = "₹0";
        // Clear savings notice
        const savingsEl = document.getElementById('cart-savings-notice');
        if (savingsEl) savingsEl.style.display = 'none';
        return;
    }

    let totalSavings = 0;

    list.innerHTML = cart.map(cartItem => {
        const item = inventory.find(p => p.id === cartItem.id);
        if (!item) return '';
        
        const triggerQty = parseInt(item.discount_trigger_qty) || 1;
        const hasDiscountRule = item.discount_percent > 0;
        const isDiscountUnlocked = hasDiscountRule && cartItem.quantity >= triggerQty;
        const finalPrice = isDiscountUnlocked ? Math.round(item.price * (1 - item.discount_percent / 100)) : item.price;
        const itemTotal = finalPrice * cartItem.quantity;
        
        if (isDiscountUnlocked) {
            totalSavings += (item.price - finalPrice) * cartItem.quantity;
        }

        let nudgeHTML = '';
        if (hasDiscountRule && !isDiscountUnlocked) {
            const diff = triggerQty - cartItem.quantity;
            nudgeHTML = `<div style="font-size: 0.72rem; color: #ff1744; font-weight: 700; margin-top: 4px;"><i class="fas fa-fire"></i> Add ${diff} more to unlock ${item.discount_percent}% OFF!</div>`;
        }

        return `
            <div class="cart-item-row">
                <div class="cart-item-info">
                    <p class="cart-item-title">${item.name}</p>
                    <p class="cart-item-meta">
                        ${isDiscountUnlocked ? `
                            <span style="text-decoration: line-through; opacity: 0.5; margin-right: 5px;">₹${item.price}</span>
                            <span style="color:#ff1744; font-weight:600;">₹${finalPrice}</span>
                        ` : `
                            ₹${item.price}
                        `}
                        / ${item.unit}
                    </p>
                    ${nudgeHTML}
                </div>
                <div class="cart-item-controls">
                    <button type="button" onclick="updateQuantity(${item.id}, -1)" class="qty-btn"><i class="fas fa-minus"></i></button>
                    <span class="qty-display">${cartItem.quantity}</span>
                    <button type="button" onclick="updateQuantity(${item.id}, 1)" class="qty-btn"><i class="fas fa-plus"></i></button>
                    <span class="cart-item-subtotal">₹${itemTotal}</span>
                    <button type="button" onclick="removeFromCart(${item.id})" class="trash-btn">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    const grandTotal = cart.reduce((sum, cartItem) => {
        const item = inventory.find(p => p.id === cartItem.id);
        if (!item) return sum;
        const triggerQty = parseInt(item.discount_trigger_qty) || 1;
        const finalPrice = (item.discount_percent > 0 && cartItem.quantity >= triggerQty) 
            ? Math.round(item.price * (1 - item.discount_percent / 100)) 
            : item.price;
        return sum + (finalPrice * cartItem.quantity);
    }, 0);

    const totalContainer = document.getElementById('cart-total-value');
    if (totalContainer) totalContainer.innerText = `₹${grandTotal}`;

    // Handle savings notice display in DOM
    let savingsEl = document.getElementById('cart-savings-notice');
    if (totalSavings > 0) {
        if (!savingsEl) {
            const totalSection = document.querySelector('.sidebar-total-section');
            if (totalSection) {
                savingsEl = document.createElement('div');
                savingsEl.id = 'cart-savings-notice';
                savingsEl.style.cssText = 'margin: 10px 0; padding: 10px; background: rgba(46, 204, 113, 0.15); border: 1px solid #2ecc71; border-radius: 8px; color: #2ecc71; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;';
                totalSection.parentNode.insertBefore(savingsEl, totalSection);
            }
        }
        if (savingsEl) {
            savingsEl.innerHTML = `<i class="fas fa-fire"></i> Wholesale Deal: You save ₹${totalSavings} on this order!`;
            savingsEl.style.display = 'flex';
        }
    } else if (savingsEl) {
        savingsEl.style.display = 'none';
    }
}

// 6. PRODUCT QUICK VIEW MODAL
window.currentQuickViewId = null;

window.openQuickView = function(id) {
    const item = inventory.find(p => p.id === id);
    if (!item) return;

    window.currentQuickViewId = id;
    const modal = document.getElementById('quickview-modal');
    if (!modal) return;

    const stock = parseInt(item.stock === undefined ? 50 : item.stock);
    let stockHTML = '';
    if (stock <= 0) {
        stockHTML = `<p><strong>Stock Status:</strong> <span style="color:#ff4d4d; font-weight:700;">Out of Stock</span></p>`;
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

    // Build Quick-View DOM content
    modal.innerHTML = `
        <div class="qv-modal-card">
            <button class="close-qv-btn" onclick="closeQuickView()"><i class="fas fa-times"></i></button>
            <div class="qv-grid">
                <div class="qv-image-side" style="position: relative;">
                    ${ribbonHTML}
                    <img src="${item.img}" onerror="this.src='pics/products/croast.jpg'">
                </div>
                <div class="qv-details-side">
                    <span class="tag-label" style="font-size: 0.75rem;">${item.tag}</span>
                    <h2 class="qv-title">${item.name}</h2>
                    <div id="qv-price-container-${item.id}"></div>
                    
                    <div class="qv-meta-box">
                        <p><strong>Category:</strong> ${item.cat}</p>
                        ${hasDiscount && triggerQty > 1 ? `<p style="color:#ff1744; font-weight:700; font-size:0.85rem; margin: 8px 0;"><i class="fas fa-percentage"></i> Bulk Offer: Buy ${triggerQty} or more to unlock ${item.discount_percent}% discount!</p>` : ''}
                        ${stockHTML}
                    </div>
                    
                    <div class="qv-desc">
                        <h4>About this Product:</h4>
                        <p>${item.description || 'Premium quality select wholesale item, sourced from traditional agricultural hubs in Kerala and abroad.'}</p>
                    </div>
                    
                    <div class="qv-action-area" id="qv-action-${item.id}">
                        <!-- Rendered by renderQuickViewQty -->
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    renderQuickViewQty(id);
};

window.closeQuickView = function() {
    const modal = document.getElementById('quickview-modal');
    if (modal) {
        modal.style.display = 'none';
        window.currentQuickViewId = null;
    }
};

function renderQuickViewQty(id) {
    const actionArea = document.getElementById(`qv-action-${id}`);
    if (!actionArea) return;

    const item = inventory.find(p => p.id === id);
    if (!item) return;

    const stock = parseInt(item.stock === undefined ? 50 : item.stock);
    if (stock <= 0) {
        actionArea.innerHTML = `
            <button class="add-btn-primary" style="max-width: 280px; opacity: 0.5; cursor: not-allowed;" disabled>Out of Stock</button>
        `;
        return;
    }

    const loggedIn = window.isCustomerLoggedIn ? window.isCustomerLoggedIn() : false;
    if (!loggedIn) {
        actionArea.innerHTML = `
            <button class="add-btn-primary" style="max-width: 280px;" onclick="openAuthModal()"><i class="fas fa-user-lock"></i> Login to Order</button>
        `;
        return;
    }

    const cartItem = cart.find(c => c.id === id);
    const quantity = cartItem ? cartItem.quantity : 0;

    // Dynamically update the price and subtotal inside Quick View modal!
    const priceContainer = document.getElementById(`qv-price-container-${id}`);
    if (priceContainer) {
        const triggerQty = parseInt(item.discount_trigger_qty) || 1;
        const hasDiscount = item.discount_percent > 0;
        const isUnlocked = hasDiscount && quantity >= triggerQty;
        const currentUnitPrice = isUnlocked ? Math.round(item.price * (1 - item.discount_percent / 100)) : item.price;
        const subtotal = currentUnitPrice * quantity;

        let priceHTML = '';
        if (hasDiscount) {
            if (isUnlocked) {
                priceHTML = `
                    <span class="price-original-slashed" style="font-size: 1.1rem; margin-right: 8px;">₹${item.price}</span>
                    <span class="price-discounted" style="font-size: 1.7rem; color: #ff1744; font-weight: 700;">₹${currentUnitPrice}</span>
                `;
            } else {
                priceHTML = `
                    <span class="price-discounted" style="font-size: 1.7rem; color: #fff; font-weight: 700;">₹${item.price}</span>
                    <span style="font-size: 0.8rem; color: #ff1744; margin-left: 8px; font-weight: 700;">(Buy ${triggerQty}+ to get ${item.discount_percent}% OFF)</span>
                `;
            }
        } else {
            priceHTML = `₹${item.price}`;
        }

        let subtotalHTML = '';
        if (quantity > 0) {
            subtotalHTML = `
                <div style="margin-top: 10px; font-size: 1.1rem; font-weight: 700; color: var(--gold);">
                    Subtotal (${quantity} ${quantity > 1 ? 'units' : 'unit'}): ₹${subtotal}
                </div>
            `;
        }

        priceContainer.innerHTML = `
            <p class="qv-price" style="margin:0;">
                ${priceHTML}
                <span class="unit-label">/ ${item.unit}</span>
            </p>
            ${subtotalHTML}
        `;
    }

    if (cartItem) {
        actionArea.innerHTML = `
            <div class="qv-qty-controls">
                <button type="button" onclick="updateQuantity(${id}, -1)" class="qv-qty-btn"><i class="fas fa-minus"></i></button>
                <span class="qv-qty-display">${cartItem.quantity}</span>
                <button type="button" onclick="updateQuantity(${id}, 1)" class="qv-qty-btn"><i class="fas fa-plus"></i></button>
                <span class="qv-in-cart-label">In Basket ✅</span>
            </div>
        `;
    } else {
        actionArea.innerHTML = `
            <button class="add-btn-primary" style="max-width: 280px;" onclick="addToCart(${id})">Add to Order +</button>
        `;
    }
}

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

// 7. ORDER SUBMISSION WITH BACKEND SAVE
document.addEventListener('DOMContentLoaded', () => {
    fetchCatalog();

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

    // Close modals on clicking overlay background
    window.addEventListener('click', (e) => {
        const qvModal = document.getElementById('quickview-modal');
        if (e.target === qvModal) {
            closeQuickView();
        }
    });

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.onsubmit = async (e) => {
            e.preventDefault();
            if (cart.length === 0) {
                alert("Your basket is empty!");
                return;
            }
            const name = document.getElementById('cust-name').value;
            const addr = document.getElementById('cust-address').value;
            const instructions = document.getElementById('cust-instructions').value;
            
            // 1. Calculate grand total and map ordered items
            let grandTotal = 0;
            const orderItems = cart.map(cartItem => {
                const item = inventory.find(p => p.id === cartItem.id);
                let itemPrice = 0;
                if (item) {
                    const triggerQty = parseInt(item.discount_trigger_qty) || 1;
                    itemPrice = (item.discount_percent > 0 && cartItem.quantity >= triggerQty) 
                        ? Math.round(item.price * (1 - item.discount_percent / 100)) 
                        : item.price;
                }
                const subtotal = item ? itemPrice * cartItem.quantity : 0;
                grandTotal += subtotal;
                return {
                    id: cartItem.id,
                    name: item ? item.name : 'Unknown Product',
                    quantity: cartItem.quantity,
                    price: itemPrice,
                    unit: item ? item.unit : '',
                    subtotal: subtotal
                };
            });

            // 2. Post order log to database (with Authorization token)
            try {
                const token = window.getAuthToken ? window.getAuthToken() : '';
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        cust_name: name,
                        cust_address: addr + (instructions ? ` (Notes: ${instructions})` : ''),
                        items: orderItems,
                        total_price: grandTotal
                    })
                });
                
                if (!response.ok) throw new Error('Backend failed to log order');
                console.log('Order successfully logged to DB.');
            } catch (err) {
                console.error('Database logging failed:', err);
                // We will still allow the WhatsApp redirect to succeed so they don't block the user's order!
            }

            // 3. Compile and redirect to WhatsApp
            let msg = `*WELLSHINE WHOLESALE ORDER*%0A%0A`;
            msg += `*Business/Shop Name:* ${name}%0A`;
            msg += `*Delivery Address:* ${addr}%0A`;
            if (instructions) {
                msg += `*Special Instructions:* ${instructions}%0A`;
            }
            msg += `%0A*ORDERED ITEMS:*%0A`;
            
            orderItems.forEach((item, index) => {
                msg += `${index + 1}. ${item.name} (${item.unit})%0A   Quantity: ${item.quantity} x ₹${item.price} = *₹${item.subtotal}*%0A`;
            });
            
            msg += `%0A*TOTAL ESTIMATED PRICE: ₹${grandTotal}*%0A%0A`;
            msg += `Thank you for ordering with Wellshine! We will confirm your delivery shortly.`;
            
            // Clear cart
            cart = [];
            saveCart();
            updateCartBadge();
            closeCheckout();
            await fetchCatalog();

            // Redirect
            window.open(`https://wa.me/919447097212?text=${msg}`, '_blank');
        };
    }
});