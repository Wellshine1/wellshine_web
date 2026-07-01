// Global arrays
let adminProducts = [];
let adminOrders = [];
let csvParsedRows = []; // 2D array of CSV lines
let currentTab = 'inventory';
let activePreviewFilter = 'all';

// Toast Notification Helper
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    // Set icon
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <span>${message}</span>`;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// Authentication Helpers
function getAdminPasscode() {
    return localStorage.getItem('wellshine_admin_pass') || '';
}

function setAdminPasscode(pass) {
    localStorage.setItem('wellshine_admin_pass', pass);
}

function clearAdminPasscode() {
    localStorage.removeItem('wellshine_admin_pass');
}

// Check if authenticated on load
document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    const storedPass = getAdminPasscode();
    if (storedPass) {
        verifyPasscode(storedPass, true);
    } else {
        showLoginScreen();
    }
    
    // Login form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const passcode = document.getElementById('passcode-input').value;
            verifyPasscode(passcode);
        };
    }

    // Set up Drag and Drop for CSV file
    initCSVDragDrop();

    // Live update preview price in modal
    const priceInput = document.getElementById('edit-product-price');
    const discountInput = document.getElementById('edit-product-discount');
    if (priceInput && discountInput) {
        priceInput.addEventListener('input', window.updatePreviewPrice);
        discountInput.addEventListener('input', window.updatePreviewPrice);
    }

    // Live update preview price in add modal
    const addPriceInput = document.getElementById('add-product-price');
    const addDiscountInput = document.getElementById('add-product-discount');
    if (addPriceInput && addDiscountInput) {
        addPriceInput.addEventListener('input', window.updateAddPreviewPrice);
        addDiscountInput.addEventListener('input', window.updateAddPreviewPrice);
    }
});

// Theme Toggle Coordinator
function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        updateThemeIcon();
        themeBtn.addEventListener('click', () => {
            const isLight = document.documentElement.classList.toggle('light-theme');
            localStorage.setItem('wellshine_theme', isLight ? 'light' : 'dark');
            updateThemeIcon();
        });
    }
}

function updateThemeIcon() {
    const icon = document.querySelector('#theme-toggle i');
    if (!icon) return;
    const isLight = document.documentElement.classList.contains('light-theme');
    icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
}

function showLoginScreen() {
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('dashboard-container').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'block';
    
    // Load initial tab
    switchTab(currentTab);
}

// Verify passcode with backend API
async function verifyPasscode(passcode, isAutoLogin = false) {
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.style.display = 'none';
    
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode })
        });
        
        if (res.ok) {
            setAdminPasscode(passcode);
            showDashboard();
            if (!isAutoLogin) showToast('Access Granted. Welcome back!', 'success');
        } else {
            clearAdminPasscode();
            showLoginScreen();
            if (!isAutoLogin) {
                if (errorEl) {
                    errorEl.innerText = 'Incorrect admin passcode. Access denied.';
                    errorEl.style.display = 'block';
                }
            }
        }
    } catch (err) {
        console.error('Login error:', err);
        if (isAutoLogin) {
            // Offline or server down, show login anyway
            showLoginScreen();
        } else {
            if (errorEl) {
                errorEl.innerText = 'Server connection failed. Try again.';
                errorEl.style.display = 'block';
            }
        }
    }
}

window.logoutAdmin = function() {
    if (confirm('Are you sure you want to log out of Portal Management?')) {
        clearAdminPasscode();
        showLoginScreen();
        showToast('Logged out successfully.', 'success');
    }
};

// --- TAB ROUTING ---
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Update active state in sidebar
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Show correct section
    document.querySelectorAll('.tab-section').forEach(section => {
        if (section.id === `tab-${tabName}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    // Fetch tab data
    if (tabName === 'inventory') {
        fetchInventory();
    } else if (tabName === 'orders') {
        fetchOrders();
    } else if (tabName === 'users') {
        fetchRegisteredUsers();
    }
};

// --- INVENTORY LOGIC ---
async function fetchInventory() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Unreachable');
        adminProducts = await response.json();
        renderInventoryTable(adminProducts);
    } catch (err) {
        console.error('Error fetching inventory:', err);
        showToast('Failed to load products list from server.', 'error');
    }
}

function renderInventoryTable(items) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 50px; opacity: 0.5;">No products found.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const stock = parseInt(item.stock || 0);
        let badgeClass = 'in';
        let badgeText = 'In Stock';
        if (stock === 0) {
            badgeClass = 'out';
            badgeText = 'Out of Stock';
        } else if (stock <= 10) {
            badgeClass = 'low';
            badgeText = `Low: ${stock}`;
        }
        
        return `
            <tr id="inv-row-${item.id}">
                <td><strong>#${item.id}</strong></td>
                <td>
                    <div class="prod-info-cell">
                        <img src="${item.img}" onerror="this.src='pics/products/croast.jpg'">
                        <div>
                            <div class="prod-name-title">${item.name}</div>
                            <span class="prod-meta-label">${item.tag}</span>
                        </div>
                    </div>
                </td>
                <td><span style="font-weight:600;">${item.cat}</span></td>
                <td>
                    ${item.discount_percent > 0 ? `
                        <div style="font-size:0.8rem; text-decoration: line-through; opacity: 0.6;">₹${item.price}</div>
                        <div style="font-weight:600; color: #ff1744;">₹${Math.round(item.price * (1 - item.discount_percent / 100))} / ${item.unit}</div>
                        <span style="font-size:0.75rem; background:rgba(255, 23, 68, 0.15); color:#ff1744; padding:1px 6px; border-radius:10px; font-weight:700;">
                            ${item.discount_percent}% OFF ${item.discount_trigger_qty > 1 ? `(Min: ${item.discount_trigger_qty})` : ''}
                        </span>
                    ` : `
                        <div style="font-weight:600;">₹${item.price} / ${item.unit}</div>
                    `}
                </td>
                <td>
                    <div class="stock-edit-wrap">
                        <button class="stock-btn-adjust" onclick="adjustStockInput(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                        <input type="number" id="stock-input-${item.id}" class="stock-input" value="${stock}" min="0" oninput="onStockInputChanged(${item.id})">
                        <button class="stock-btn-adjust" onclick="adjustStockInput(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                        <span class="stock-badge ${badgeClass}" id="stock-badge-${item.id}" style="margin-left: 10px;">${badgeText}</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; gap: 6px;">
                        <button class="save-row-btn" id="save-btn-${item.id}" onclick="saveProductStock(${item.id})">
                            <i class="fas fa-save"></i> Save
                        </button>
                        <button class="edit-row-btn" onclick="openEditModal(${item.id})" style="background: var(--gold); color: #000; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 0.8rem; transition: 0.2s;">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.openEditModal = function(id) {
    const item = adminProducts.find(p => p.id === id);
    if (!item) return;
    
    document.getElementById('edit-product-id').value = item.id;
    document.getElementById('edit-product-name').value = item.name;
    document.getElementById('edit-product-category').value = item.cat;
    document.getElementById('edit-product-price').value = item.price;
    document.getElementById('edit-product-discount').value = item.discount_percent || 0;
    document.getElementById('edit-product-discount-trigger').value = item.discount_trigger_qty || 1;
    document.getElementById('edit-product-unit').value = item.unit;
    document.getElementById('edit-product-tag').value = item.tag;
    document.getElementById('edit-product-img').value = item.img;
    document.getElementById('edit-product-desc').value = item.description || '';
    
    // Live update preview price
    updatePreviewPrice();
    
    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
};

window.updatePreviewPrice = function() {
    const price = parseInt(document.getElementById('edit-product-price').value) || 0;
    const discount = parseInt(document.getElementById('edit-product-discount').value) || 0;
    const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;
    document.getElementById('edit-product-preview-price').innerText = finalPrice;
};

window.saveProductDetails = async function(event) {
    event.preventDefault();
    
    const id = parseInt(document.getElementById('edit-product-id').value);
    const name = document.getElementById('edit-product-name').value.trim();
    const cat = document.getElementById('edit-product-category').value;
    const price = parseInt(document.getElementById('edit-product-price').value);
    const discount_percent = parseInt(document.getElementById('edit-product-discount').value) || 0;
    const discount_trigger_qty = parseInt(document.getElementById('edit-product-discount-trigger').value) || 1;
    const unit = document.getElementById('edit-product-unit').value.trim();
    const tag = document.getElementById('edit-product-tag').value.trim();
    const img = document.getElementById('edit-product-img').value.trim();
    const description = document.getElementById('edit-product-desc').value.trim();
    
    try {
        const res = await fetch('/api/admin/products/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({
                productId: id,
                name,
                cat,
                price,
                discount_percent,
                discount_trigger_qty,
                unit,
                tag,
                img,
                description
            })
        });
        
        if (res.ok) {
            showToast('Product details updated successfully!', 'success');
            // Update in memory
            const originalItem = adminProducts.find(p => p.id === id);
            if (originalItem) {
                originalItem.name = name;
                originalItem.cat = cat;
                originalItem.price = price;
                originalItem.discount_percent = discount_percent;
                originalItem.discount_trigger_qty = discount_trigger_qty;
                originalItem.unit = unit;
                originalItem.tag = tag;
                originalItem.img = img;
                originalItem.description = description;
            }
            closeEditModal();
            // Re-render table with current search/filter state
            filterInventory();
        } else {
            let errorMsg = 'Failed to update product details.';
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch (e) {}
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error('Update product details error:', err);
        showToast('Connection error during product update.', 'error');
    }
};

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    const modal = document.getElementById('edit-modal');
    if (e.target === modal) {
        closeEditModal();
    }
});

window.adjustStockInput = function(id, delta) {
    const input = document.getElementById(`stock-input-${id}`);
    if (input) {
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val + delta);
        input.value = val;
        onStockInputChanged(id);
    }
};

window.onStockInputChanged = function(id) {
    const input = document.getElementById(`stock-input-${id}`);
    const saveBtn = document.getElementById(`save-btn-${id}`);
    const badge = document.getElementById(`stock-badge-${id}`);
    const originalItem = adminProducts.find(p => p.id === id);
    
    if (!input || !saveBtn || !originalItem) return;
    
    const newVal = parseInt(input.value) || 0;
    const origVal = parseInt(originalItem.stock || 0);
    
    // Enable/disable save button
    if (newVal !== origVal) {
        saveBtn.classList.add('changed');
    } else {
        saveBtn.classList.remove('changed');
    }
    
    // Dynamically update badge text/class during editing
    let badgeClass = 'in';
    let badgeText = 'In Stock';
    if (newVal === 0) {
        badgeClass = 'out';
        badgeText = 'Out of Stock';
    } else if (newVal <= 10) {
        badgeClass = 'low';
        badgeText = `Low: ${newVal}`;
    }
    badge.className = `stock-badge ${badgeClass}`;
    badge.innerText = badgeText;
};

window.saveProductStock = async function(id) {
    const input = document.getElementById(`stock-input-${id}`);
    if (!input) return;
    
    const stockVal = parseInt(input.value) || 0;
    
    try {
        const res = await fetch('/api/admin/products/update-stock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({ productId: id, stock: stockVal })
        });
        
        if (res.ok) {
            showToast('Stock level updated successfully!', 'success');
            // Update local memory
            const originalItem = adminProducts.find(p => p.id === id);
            if (originalItem) originalItem.stock = stockVal;
            // Disable button
            document.getElementById(`save-btn-${id}`).classList.remove('changed');
        } else {
            showToast('Failed to update stock. Check permissions.', 'error');
        }
    } catch (err) {
        console.error('Update stock error:', err);
        showToast('Connection error during update.', 'error');
    }
};

window.filterInventory = function() {
    const searchVal = document.getElementById('inventory-search').value.toLowerCase();
    const catVal = document.getElementById('inventory-cat-filter').value;
    
    const filtered = adminProducts.filter(item => {
        const matchesCategory = (catVal === 'all' || item.cat === catVal);
        const matchesSearch = item.name.toLowerCase().includes(searchVal) || 
                              item.tag.toLowerCase().includes(searchVal) ||
                              item.id.toString() === searchVal;
        return matchesCategory && matchesSearch;
    });
    
    renderInventoryTable(filtered);
};


// --- CUSTOMER ORDERS LOG LOGIC ---
async function fetchOrders() {
    try {
        const response = await fetch('/api/admin/orders', {
            headers: { 'Authorization': `Bearer ${getAdminPasscode()}` }
        });
        if (!response.ok) throw new Error('Unreachable');
        adminOrders = await response.json();
        renderOrdersTable(adminOrders);
    } catch (err) {
        console.error('Error fetching orders:', err);
        showToast('Failed to load orders list from database.', 'error');
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 50px; opacity: 0.5;">No customer orders logged in database.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = orders.map(order => {
        const dateStr = new Date(order.created_at).toLocaleString();
        
        // Parse items list
        let itemsHTML = '';
        if (Array.isArray(order.items)) {
            itemsHTML = `
                <ul class="order-details-list">
                    ${order.items.map(item => `
                        <li>
                            <span><strong>${item.name}</strong> (${item.unit})</span>
                            <span>${item.quantity} x ₹${item.price} = <strong>₹${item.subtotal}</strong></span>
                        </li>
                    `).join('')}
                </ul>
            `;
        } else {
            itemsHTML = `<span style="font-size: 0.8rem; opacity: 0.5;">Raw Data: ${order.items}</span>`;
        }
        
        // Status Badge
        const status = order.status || 'Pending';
        const isConfirmed = status === 'Confirmed';
        const badgeClass = isConfirmed ? 'in' : 'low';
        
        // Action buttons
        let actionsHTML = `<div class="order-actions-wrap">`;
        if (!isConfirmed) {
            actionsHTML += `
                <button class="order-confirm-btn" onclick="confirmOrder(${order.id})" title="Confirm & Deduct Stock">
                    <i class="fas fa-check-double"></i> Confirm
                </button>`;
        }
        actionsHTML += `
            <button class="order-delete-btn" onclick="deleteOrder(${order.id})" title="Delete Order Log">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>`;
        
        return `
            <tr id="order-row-${order.id}">
                <td><strong>#ORD-${order.id}</strong></td>
                <td>
                    <div class="order-cust-info" style="font-size: 0.85rem;">
                        <p><strong>Shop:</strong> ${order.cust_name}</p>
                        <p style="color:var(--body-text-muted);"><i class="fas fa-map-marker-alt" style="font-size:0.75rem; color:var(--gold); margin-right:5px;"></i> ${order.cust_address}</p>
                    </div>
                </td>
                <td>${itemsHTML}</td>
                <td><strong style="color: var(--gold); font-size:1rem;">₹${order.total_price}</strong></td>
                <td><span class="stock-badge ${badgeClass}">${status}</span></td>
                <td><span style="font-size: 0.8rem; font-weight:600;">${dateStr}</span></td>
                <td>${actionsHTML}</td>
            </tr>
        `;
    }).join('');
}

window.confirmOrder = async function(id) {
    if (!confirm(`Are you sure you want to confirm order #ORD-${id}? This will deduct the items from product stock levels.`)) return;
    
    try {
        const res = await fetch('/api/admin/orders/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({ orderId: id })
        });
        
        if (res.ok) {
            showToast(`Order #ORD-${id} confirmed and stock updated!`, 'success');
            fetchOrders();
            fetchInventory();
        } else {
            let errorMsg = 'Failed to confirm order.';
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch (jsonErr) {
                try {
                    errorMsg = await res.text();
                } catch (textErr) {
                    // fallback
                }
            }
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error('Confirm order error:', err);
        showToast('Connection error during confirmation.', 'error');
    }
};

window.deleteOrder = async function(id) {
    if (!confirm(`Are you sure you want to permanently delete order log #ORD-${id}?`)) return;
    
    try {
        const res = await fetch('/api/admin/orders/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({ orderId: id })
        });
        
        if (res.ok) {
            showToast(`Order #ORD-${id} deleted successfully.`, 'success');
            fetchOrders();
            fetchInventory();
        } else {
            let errorMsg = 'Failed to delete order.';
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch (jsonErr) {
                try {
                    errorMsg = await res.text();
                } catch (textErr) {
                    // fallback
                }
            }
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error('Delete order error:', err);
        showToast('Connection error during deletion.', 'error');
    }
};


// --- REGISTERED SHOPS LOGIC ---
async function fetchRegisteredUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${getAdminPasscode()}` }
        });
        if (!response.ok) throw new Error('Unreachable');
        const users = await response.json();
        renderUsersTable(users);
    } catch (err) {
        console.error('Error fetching registered users:', err);
        showToast('Failed to load registered users from database.', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 50px; opacity: 0.5;">No registered users or shops found in database.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const dateStr = new Date(user.created_at).toLocaleString();
        const typeClass = user.account_type === 'Individual' ? 'low' : 'in';
        const typeIcon = user.account_type === 'Individual' ? 'fa-user' : 'fa-store';
        
        return `
            <tr>
                <td><strong>#USER-${user.id}</strong></td>
                <td><strong>${user.shop_name}</strong></td>
                <td>
                    <span class="stock-badge ${typeClass}" style="margin: 0; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fas ${typeIcon}"></i> ${user.account_type || 'Business'}
                    </span>
                </td>
                <td><a href="mailto:${user.email}" style="color: var(--gold); text-decoration: none;"><i class="fas fa-envelope"></i> ${user.email}</a></td>
                <td><i class="fas fa-map-marker-alt" style="font-size:0.8rem; color:var(--gold); margin-right:5px;"></i> ${user.address}</td>
                <td><span style="font-size: 0.8rem; font-weight:600;">${dateStr}</span></td>
            </tr>
        `;
    }).join('');
}


// --- VYAPAR CSV SYNC LOGIC ---

// Custom quotes-aware CSV parser
function parseCSV(text) {
    let lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') {
                i++;
            }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') {
        lines.push(row);
    }
    return lines;
}

function initCSVDragDrop() {
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input');
    
    if (!dropZone || !fileInput) return;
    
    dropZone.onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            handleCSVFile(e.target.files[0]);
        }
    };
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleCSVFile(e.dataTransfer.files[0]);
        }
    });
}

function handleCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('Please upload a valid .csv file.', 'error');
        return;
    }
    
    // Update file UI
    const info = document.getElementById('file-info');
    const nameSpan = document.getElementById('file-name');
    nameSpan.innerText = file.name;
    info.style.display = 'inline-flex';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        csvParsedRows = parseCSV(text);
        if (csvParsedRows.length < 2) {
            showToast('CSV file is empty or lacks header rows.', 'error');
            return;
        }
        
        setupColumnMapper();
    };
    reader.readAsText(file);
}

function setupColumnMapper() {
    const headers = csvParsedRows[0].map(h => h.trim());
    const mapNameSelect = document.getElementById('map-name');
    const mapStockSelect = document.getElementById('map-stock');
    const mapperPanel = document.getElementById('mapper-panel');
    
    if (!mapNameSelect || !mapStockSelect || !mapperPanel) return;
    
    // Populate selectors
    const optionsHTML = headers.map((h, i) => `<option value="${i}">${h || `Column ${i+1}`}</option>`).join('');
    mapNameSelect.innerHTML = optionsHTML;
    mapStockSelect.innerHTML = optionsHTML;
    
    // Auto-detect columns
    let nameIndex = 0;
    let stockIndex = 0;
    
    headers.forEach((h, i) => {
        const hL = h.toLowerCase();
        // Look for Item Name, Product Name, Name
        if (hL.includes('name') || hL.includes('item') || hL.includes('product') || hL.includes('particular')) {
            nameIndex = i;
        }
        // Look for Qty, Quantity, Stock, Available, Closing
        if (hL.includes('qty') || hL.includes('quantity') || hL.includes('stock') || hL.includes('avail') || hL.includes('closing')) {
            stockIndex = i;
        }
    });
    
    // If they were auto-detected to the same index, offset stock to column 1 if possible
    if (nameIndex === stockIndex && headers.length > 1) {
        stockIndex = 1;
    }
    
    mapNameSelect.value = nameIndex;
    mapStockSelect.value = stockIndex;
    
    // Enable panel
    mapperPanel.classList.remove('disabled');
    
    // Pre-load product directory if empty
    if (adminProducts.length === 0) {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                adminProducts = data;
                processCSVData();
            });
    } else {
        processCSVData();
    }
}

// Normalized fuzzy string matcher for item names
function findBestMatch(vyaparName, products) {
    if (!vyaparName) return null;
    
    const normalize = str => str.toLowerCase()
                                .replace(/[^a-z0-9]/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                                
    const vNorm = normalize(vyaparName);
    if (!vNorm) return null;
    
    // 1. Try exact normalized match
    let match = products.find(p => normalize(p.name) === vNorm);
    if (match) return match;
    
    // 2. Try substring match (e.g. Vyapar name contains website name or vice versa)
    match = products.find(p => {
        const pNorm = normalize(p.name);
        return vNorm.includes(pNorm) || pNorm.includes(vNorm);
    });
    if (match) return match;
    
    // 3. Word overlap match (fuzzy matching by keywords)
    const vWords = vNorm.split(' ').filter(w => w.length > 2); // only key words > 2 chars
    if (vWords.length > 0) {
        let bestMatch = null;
        let maxOverlap = 0;
        
        for (const p of products) {
            const pWords = normalize(p.name).split(' ').filter(w => w.length > 2);
            const overlapCount = vWords.filter(w => pWords.includes(w)).length;
            
            if (overlapCount > maxOverlap && overlapCount >= 2) {
                maxOverlap = overlapCount;
                bestMatch = p;
            }
        }
        if (bestMatch) return bestMatch;
    }
    
    return null;
}

// Process data from CSV rows and generate preview matching
let processedSyncRows = []; // Keep cache of processed rows

window.processCSVData = function() {
    const nameColIdx = parseInt(document.getElementById('map-name').value);
    const stockColIdx = parseInt(document.getElementById('map-stock').value);
    const previewBody = document.getElementById('preview-table-body');
    const previewPanel = document.getElementById('preview-panel');
    
    if (isNaN(nameColIdx) || isNaN(stockColIdx) || !previewBody || !previewPanel) return;
    
    processedSyncRows = [];
    let matchedCount = 0;
    
    // Loop through CSV rows (skipping header row 0)
    for (let i = 1; i < csvParsedRows.length; i++) {
        const row = csvParsedRows[i];
        if (row.length <= Math.max(nameColIdx, stockColIdx)) continue;
        
        const vyaparName = row[nameColIdx].trim();
        const rawStock = row[stockColIdx].trim();
        
        // Skip empty lines
        if (!vyaparName) continue;
        
        // Clean stock number
        const stockQty = Math.max(0, parseInt(rawStock.replace(/[^0-9-]/g, '')) || 0);
        
        // Match product
        const matchedProduct = findBestMatch(vyaparName, adminProducts);
        if (matchedProduct) matchedCount++;
        
        processedSyncRows.push({
            vyaparName,
            stockQty,
            matchedProduct, // Product object or null
            id: matchedProduct ? matchedProduct.id : null,
            webName: matchedProduct ? matchedProduct.name : '',
            webCurrentStock: matchedProduct ? parseInt(matchedProduct.stock || 0) : 0
        });
    }
    
    // Update stats label
    document.getElementById('preview-stats').innerHTML = `Found <strong>${processedSyncRows.length}</strong> items in CSV. Successfully matched <strong>${matchedCount}</strong> to website products.`;
    
    // Show preview panel
    previewPanel.style.display = 'block';
    
    // Render preview table
    renderPreviewTable();
};

function renderPreviewTable() {
    const tbody = document.getElementById('preview-table-body');
    if (!tbody) return;
    
    const filteredRowsWithIndex = processedSyncRows
        .map((row, index) => ({ row, index }))
        .filter(item => {
            if (activePreviewFilter === 'matched') return item.row.matchedProduct !== null;
            if (activePreviewFilter === 'unmatched') return item.row.matchedProduct === null;
            return true;
        });
    
    if (filteredRowsWithIndex.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; opacity: 0.5;">No rows match the filter.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filteredRowsWithIndex.map(item => {
        const row = item.row;
        const index = item.index;
        const isMatched = row.matchedProduct !== null;
        
        const statusHTML = isMatched 
            ? `<span class="match-tag matched"><i class="fas fa-check-circle"></i> Matched</span>`
            : `<span class="match-tag unmatched"><i class="fas fa-exclamation-triangle"></i> No Match</span>`;
            
        // Build product dropdown selector with all website products
        let selectHTML = `<select onchange="changeRowMatch(${index}, this.value)" style="width: 100%; max-width: 300px; padding: 8px; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--body-text); border-radius: 8px; font-family: inherit; font-size: 0.85rem; outline: none; cursor: pointer;">`;
        selectHTML += `<option value="">-- Skip / Unmatched --</option>`;
        adminProducts.forEach(p => {
            const isSelected = (row.matchedProduct && row.matchedProduct.id === p.id) ? 'selected' : '';
            selectHTML += `<option value="${p.id}" ${isSelected}>${p.name}</option>`;
        });
        selectHTML += `</select>`;
        
        const currentStockHTML = isMatched ? row.webCurrentStock : '-';
        
        return `
            <tr style="${!isMatched ? 'background: rgba(255, 68, 68, 0.02);' : ''}">
                <td><strong>${row.vyaparName}</strong></td>
                <td>${selectHTML}</td>
                <td style="text-align:center; font-weight: 600;">${currentStockHTML}</td>
                <td style="text-align:center;"><strong style="color:var(--gold); font-size: 1rem;">${row.stockQty}</strong></td>
                <td>${statusHTML}</td>
            </tr>
        `;
    }).join('');
}

window.changeRowMatch = function(index, productId) {
    const row = processedSyncRows[index];
    if (!row) return;
    
    if (productId === '') {
        row.matchedProduct = null;
        row.id = null;
        row.webName = '';
        row.webCurrentStock = 0;
    } else {
        const prod = adminProducts.find(p => p.id === parseInt(productId));
        row.matchedProduct = prod;
        row.id = prod.id;
        row.webName = prod.name;
        row.webCurrentStock = parseInt(prod.stock || 0);
    }
    
    updateSyncStats();
    renderPreviewTable();
};

function updateSyncStats() {
    const totalCount = processedSyncRows.length;
    const matchedCount = processedSyncRows.filter(r => r.matchedProduct !== null).length;
    document.getElementById('preview-stats').innerHTML = `Found <strong>${totalCount}</strong> items in CSV. Successfully matched <strong>${matchedCount}</strong> to website products.`;
}

window.filterPreview = function(filterType) {
    activePreviewFilter = filterType;
    
    // Toggle active state in buttons
    document.querySelectorAll('.preview-filter-btn').forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (text.includes(filterType)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    renderPreviewTable();
};

window.executeSync = async function() {
    const matchedUpdates = processedSyncRows
        .filter(row => row.matchedProduct !== null)
        .map(row => ({
            id: row.id,
            name: row.webName,
            stock: row.stockQty
        }));
        
    if (matchedUpdates.length === 0) {
        showToast('No matched products to synchronize.', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to update stock levels for ${matchedUpdates.length} matched products using Vyapar counts?`)) {
        return;
    }
    
    const syncBtn = document.getElementById('sync-btn');
    const origBtnHTML = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Syncing...`;
    
    try {
        const res = await fetch('/api/admin/products/bulk-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({ updates: matchedUpdates })
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast(data.message || `Stock levels synced for ${matchedUpdates.length} products!`, 'success');
            
            // Clear file uploader and preview
            document.getElementById('csv-file-input').value = '';
            document.getElementById('file-info').style.display = 'none';
            document.getElementById('mapper-panel').classList.add('disabled');
            document.getElementById('preview-panel').style.display = 'none';
            
            // Reload product catalog cache
            await fetchInventory();
        } else {
            showToast('Synchronization failed. Check permissions.', 'error');
        }
    } catch (err) {
        console.error('Sync error:', err);
        showToast('Connection error during synchronization.', 'error');
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerHTML = origBtnHTML;
    }
};

window.openAddModal = function() {
    document.getElementById('add-product-name').value = '';
    document.getElementById('add-product-category').value = 'Cashew';
    document.getElementById('add-product-price').value = '';
    document.getElementById('add-product-discount').value = '0';
    document.getElementById('add-product-discount-trigger').value = '1';
    document.getElementById('add-product-unit').value = '';
    document.getElementById('add-product-stock').value = '50';
    document.getElementById('add-product-tag').value = 'Premium Quality';
    document.getElementById('add-product-img').value = 'pics/products/croast.jpg';
    document.getElementById('add-product-desc').value = '';
    updateAddPreviewPrice();
    document.getElementById('add-modal').style.display = 'flex';
};

window.closeAddModal = function() {
    document.getElementById('add-modal').style.display = 'none';
};

window.updateAddPreviewPrice = function() {
    const price = parseInt(document.getElementById('add-product-price').value) || 0;
    const discount = parseInt(document.getElementById('add-product-discount').value) || 0;
    const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;
    document.getElementById('add-product-preview-price').innerText = finalPrice;
};

window.saveNewProduct = async function(event) {
    event.preventDefault();
    
    const name = document.getElementById('add-product-name').value.trim();
    const cat = document.getElementById('add-product-category').value;
    const price = parseInt(document.getElementById('add-product-price').value);
    const discount_percent = parseInt(document.getElementById('add-product-discount').value) || 0;
    const discount_trigger_qty = parseInt(document.getElementById('add-product-discount-trigger').value) || 1;
    const unit = document.getElementById('add-product-unit').value.trim();
    const stock = parseInt(document.getElementById('add-product-stock').value) || 0;
    const tag = document.getElementById('add-product-tag').value.trim();
    const img = document.getElementById('add-product-img').value.trim();
    const description = document.getElementById('add-product-desc').value.trim();
    
    try {
        const res = await fetch('/api/admin/products/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAdminPasscode()}`
            },
            body: JSON.stringify({
                name,
                cat,
                price,
                discount_percent,
                discount_trigger_qty,
                unit,
                stock,
                tag,
                img,
                description
            })
        });
        
        if (res.ok) {
            showToast('New product added successfully!', 'success');
            closeAddModal();
            await fetchInventory();
        } else {
            let errorMsg = 'Failed to add new product.';
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch (e) {}
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Server connection error adding product.', 'error');
    }
};
