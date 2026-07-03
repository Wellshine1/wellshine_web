// Customer Session & Authentication Management
window.currentCustomer = null;
let pendingRegistration = null;

// Self-contained CSS styles for Auth Modal
const authStyles = `
    .auth-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        animation: authFadeIn 0.3s ease;
    }
    @keyframes authFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    .auth-modal-card {
        background: var(--dropdown-bg, rgba(10, 10, 10, 0.96));
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        border-radius: 25px;
        width: 100%;
        max-width: 450px;
        position: relative;
        overflow: hidden;
        box-shadow: var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.8));
        animation: authSlideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border-top: 3px solid var(--gold, #d4af37);
        padding: 30px;
    }
    @keyframes authSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    .auth-close-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        background: var(--nav-bg, rgba(255, 255, 255, 0.08));
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        color: var(--body-text, #fff);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        transition: 0.3s;
    }
    .auth-close-btn:hover {
        background: rgba(255, 68, 68, 0.2);
        color: #ff4444;
        border-color: #ff4444;
    }
    .auth-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 25px;
        border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        padding-bottom: 10px;
    }
    .auth-tab-btn {
        background: none;
        border: none;
        color: var(--body-text-muted, rgba(255, 255, 255, 0.65));
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        padding: 5px 15px;
        transition: 0.3s;
    }
    .auth-tab-btn.active {
        color: var(--body-text, #fff);
        border-bottom: 2px solid var(--gold, #d4af37);
    }
    .auth-form-panel {
        display: none;
    }
    .auth-form-panel.active {
        display: block;
    }
    .auth-form-panel h3 {
        font-size: 1.3rem;
        margin-bottom: 10px;
        color: var(--body-text, #fff);
    }
    .auth-form-panel p {
        font-size: 0.8rem;
        color: var(--body-text-muted, rgba(255, 255, 255, 0.6));
        margin-bottom: 20px;
        line-height: 1.4;
    }
    .auth-input-wrap {
        position: relative;
        margin-bottom: 15px;
    }
    .auth-input-icon {
        position: absolute;
        left: 15px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--gold, #d4af37);
        font-size: 0.9rem;
        opacity: 0.8;
    }
    .auth-input-wrap input, .auth-input-wrap textarea {
        width: 100%;
        padding: 12px 15px 12px 40px;
        background: var(--input-bg, rgba(255, 255, 255, 0.03));
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        border-radius: 10px;
        color: var(--body-text, #fff);
        font-size: 0.9rem;
        outline: none;
        transition: 0.3s;
        font-family: inherit;
    }
    .auth-input-wrap input:focus, .auth-input-wrap textarea:focus {
        border-color: var(--gold, #d4af37);
        background: rgba(255, 255, 255, 0.05);
    }
    .auth-submit-btn {
        width: 100%;
        background: var(--gold, #d4af37);
        color: #000;
        border: none;
        padding: 12px;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 800;
        cursor: pointer;
        transition: 0.3s;
        text-transform: uppercase;
        margin-top: 10px;
    }
    .auth-submit-btn:hover {
        box-shadow: 0 5px 15px rgba(212, 175, 55, 0.3);
        transform: translateY(-1px);
    }
    .auth-error {
        color: #ff4d4d;
        font-size: 0.8rem;
        margin-top: 10px;
        text-align: center;
        display: none;
    }
    .auth-success-msg {
        color: #2ecc71;
        font-size: 0.85rem;
        text-align: center;
        margin-top: 10px;
        display: none;
    }
    
    /* Login Nav Button Styling */
    .login-pill-btn {
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08)) !important;
        color: var(--body-text, #fff) !important;
        padding: 8px 18px !important;
        border-radius: 50px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        font-size: 0.8rem !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        transition: 0.3s !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
    }
    .login-pill-btn:hover {
        background: var(--gold, #d4af37) !important;
        color: #000 !important;
        border-color: var(--gold, #d4af37) !important;
        box-shadow: 0 0 10px rgba(212, 175, 55, 0.3) !important;
    }
    
    .profile-pill-btn {
        background: var(--nav-bg, rgba(255, 255, 255, 0.08)) !important;
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08)) !important;
        color: var(--gold, #d4af37) !important;
        padding: 8px 18px !important;
        border-radius: 50px !important;
        font-weight: 700 !important;
        font-size: 0.8rem !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        cursor: pointer !important;
    }
    
    .profile-dropdown-container {
        position: relative;
        display: inline-block;
    }
    .profile-dropdown-menu {
        display: none;
        position: absolute;
        top: 100%;
        right: 0;
        transform: translateY(10px);
        background: var(--dropdown-bg, rgba(10, 10, 10, 0.96));
        backdrop-filter: blur(25px);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        min-width: 160px;
        box-shadow: var(--shadow, 0 10px 30px rgba(0,0,0,0.8));
        z-index: 5000;
        padding: 5px 0;
    }
    .profile-dropdown-menu::before {
        content: '';
        position: absolute;
        top: -15px;
        left: 0;
        width: 100%;
        height: 15px;
        background: transparent;
    }
    .profile-dropdown-menu.show {
        display: block;
    }
    .profile-dropdown-menu a, .profile-dropdown-menu button {
        width: 100%;
        background: none;
        border: none;
        text-align: left;
        color: var(--body-text, #fff);
        padding: 10px 15px;
        font-size: 0.8rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: inherit;
        text-decoration: none;
    }
    .profile-dropdown-menu button:hover, .profile-dropdown-menu a:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--gold, #d4af37);
    }
    
    /* Cart Login Prompt */
    .cart-login-prompt {
        text-align: center;
        padding: 25px 15px;
        background: rgba(212, 175, 55, 0.05);
        border: 1px dashed var(--gold, #d4af37);
        border-radius: 12px;
        margin: 20px 0;
        font-size: 0.85rem;
        color: var(--body-text-muted, rgba(255,255,255,0.7));
    }
    .cart-login-prompt a {
        color: var(--gold, #d4af37);
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
    }
    
    /* Account Type Switcher styles */
    .auth-type-selector {
        display: flex;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        padding: 4px;
        margin-bottom: 20px;
    }
    .auth-type-option {
        flex: 1;
        background: none;
        border: none;
        color: var(--body-text-muted, rgba(255, 255, 255, 0.65));
        padding: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        border-radius: 8px;
        transition: 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-family: inherit;
    }
    .auth-type-option.active {
        background: var(--gold, #d4af37);
        color: #000;
    }
`; 

const styleSheet = document.createElement("style");
styleSheet.innerText = authStyles;
document.head.appendChild(styleSheet);

// Inject Auth Modal HTML on load
document.addEventListener("DOMContentLoaded", () => {
    injectAuthModal();
    setupAuthPillButton();
    checkCustomerSession();
});

function injectAuthModal() {
    const overlay = document.createElement("div");
    overlay.id = "auth-modal-overlay";
    overlay.className = "auth-modal-overlay";
    overlay.innerHTML = `
        <div class="auth-modal-card">
            <button class="auth-close-btn" onclick="closeAuthModal()"><i class="fas fa-times"></i></button>
            <div class="auth-tabs">
                <button class="auth-tab-btn active" id="tab-btn-signin" onclick="switchAuthTab('signin')">Sign In</button>
                <button class="auth-tab-btn" id="tab-btn-signup" onclick="switchAuthTab('signup')">Register Account</button>
            </div>
            
            <!-- Tab 1: Sign In -->
            <div class="auth-form-panel active" id="panel-signin">
                <h3>Welcome Back</h3>
                <p>Sign in to view wholesale pricing and submit orders.</p>
                <form id="customer-signin-form">
                    <div class="auth-input-wrap">
                        <i class="fas fa-envelope auth-input-icon"></i>
                        <input type="email" id="signin-email" placeholder="Email Address" required autocomplete="email">
                    </div>
                    <div class="auth-input-wrap">
                        <i class="fas fa-lock auth-input-icon"></i>
                        <input type="password" id="signin-password" placeholder="Password" required autocomplete="current-password">
                    </div>
                    <button type="submit" class="auth-submit-btn">Login to Portal</button>
                    <div class="auth-error" id="signin-error"></div>
                </form>
            </div>
            
            <!-- Tab 2: Register Account -->
            <div class="auth-form-panel" id="panel-signup">
                <h3>Register Account</h3>
                <p>Submit details to create your wholesale or individual account.</p>
                <form id="customer-signup-form">
                    <div class="auth-type-selector">
                        <button type="button" class="auth-type-option active" id="signup-type-business" onclick="setSignupAccountType('Business')">
                            <i class="fas fa-store"></i> Business Shop
                        </button>
                        <button type="button" class="auth-type-option" id="signup-type-individual" onclick="setSignupAccountType('Individual')">
                            <i class="fas fa-user"></i> Individual
                        </button>
                    </div>
                    <input type="hidden" id="signup-account-type" value="Business">
                    
                    <div class="auth-input-wrap">
                        <i class="fas fa-envelope auth-input-icon"></i>
                        <input type="email" id="signup-email" placeholder="Email Address" required autocomplete="email">
                    </div>
                    <div class="auth-input-wrap">
                        <i class="fas fa-lock auth-input-icon"></i>
                        <input type="password" id="signup-password" placeholder="Choose Password (Min. 6 characters)" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="auth-input-wrap">
                        <i class="fas fa-store auth-input-icon" id="signup-shop-icon"></i>
                        <input type="text" id="signup-shop" placeholder="Business / Shop Name" required>
                    </div>
                    <div class="auth-input-wrap">
                        <i class="fas fa-map-marker-alt auth-input-icon"></i>
                        <textarea id="signup-address" placeholder="Full Billing/Delivery Address" rows="2" required></textarea>
                    </div>
                    <div class="auth-input-wrap">
                        <i class="fas fa-map-pin auth-input-icon"></i>
                        <input type="text" id="signup-pincode" placeholder="Delivery Pin Code (6 Digits)" required pattern="[0-9]{6}" maxlength="6" autocomplete="postal-code">
                    </div>
                    <button type="submit" class="auth-submit-btn">Create Account</button>
                    <div class="auth-error" id="signup-error"></div>
                    <div class="auth-success-msg" id="signup-success">Account created! Switch to Sign In to login.</div>
                </form>
            </div>

            <!-- Tab 3: OTP Verification -->
            <div class="auth-form-panel" id="panel-otp">
                <h3>Verify Email Address</h3>
                <p>We've sent a 6-digit code to <strong id="otp-target-email">your email</strong>. Please enter it below to complete signup.</p>
                <form id="customer-otp-form">
                    <div class="auth-input-wrap">
                        <i class="fas fa-key auth-input-icon"></i>
                        <input type="text" id="otp-code-input" placeholder="6-Digit Verification Code" required maxlength="6" pattern="\\d{6}" style="letter-spacing: 5px; text-align: center; font-size: 1.2rem; font-weight: 700;">
                    </div>
                    <button type="submit" class="auth-submit-btn">Verify & Create Account</button>
                    <button type="button" onclick="switchAuthTab('signup')" style="background:none; border:none; color:var(--gold); cursor:pointer; font-size:0.85rem; font-weight:700; margin-top:15px; width:100%; text-align:center;">Back to Registration</button>
                    <div class="auth-error" id="otp-error"></div>
                    <div class="auth-success-msg" id="otp-success">Verification successful! Creating account...</div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Form Submissions
    document.getElementById("customer-signin-form").onsubmit = submitSignIn;
    document.getElementById("customer-signup-form").onsubmit = submitSignUp;
    document.getElementById("customer-otp-form").onsubmit = submitOTP;
}

window.openAuthModal = function() {
    const overlay = document.getElementById("auth-modal-overlay");
    if (overlay) overlay.style.display = "flex";
};

window.closeAuthModal = function() {
    const overlay = document.getElementById("auth-modal-overlay");
    if (overlay) overlay.style.display = "none";
};

window.switchAuthTab = function(tab) {
    const btnSignin = document.getElementById("tab-btn-signin");
    const btnSignup = document.getElementById("tab-btn-signup");
    const panelSignin = document.getElementById("panel-signin");
    const panelSignup = document.getElementById("panel-signup");
    const panelOtp = document.getElementById("panel-otp");
    const tabsContainer = document.querySelector(".auth-tabs");

    if (tab === "signin") {
        if (tabsContainer) tabsContainer.style.display = "flex";
        btnSignin.classList.add("active");
        btnSignup.classList.remove("active");
        panelSignin.classList.add("active");
        panelSignup.classList.remove("active");
        if (panelOtp) panelOtp.classList.remove("active");
    } else if (tab === "signup") {
        if (tabsContainer) tabsContainer.style.display = "flex";
        btnSignup.classList.add("active");
        btnSignin.classList.remove("active");
        panelSignup.classList.add("active");
        panelSignin.classList.remove("active");
        if (panelOtp) panelOtp.classList.remove("active");
    } else if (tab === "otp") {
        if (tabsContainer) tabsContainer.style.display = "none";
        panelSignin.classList.remove("active");
        panelSignup.classList.remove("active");
        if (panelOtp) panelOtp.classList.add("active");
    }
};

window.setSignupAccountType = function(type) {
    const hiddenInput = document.getElementById('signup-account-type');
    if (!hiddenInput) return;
    hiddenInput.value = type;
    
    const btnBusiness = document.getElementById('signup-type-business');
    const btnIndividual = document.getElementById('signup-type-individual');
    const inputShop = document.getElementById('signup-shop');
    const iconShop = document.getElementById('signup-shop-icon');
    
    if (type === 'Individual') {
        if (btnIndividual) btnIndividual.classList.add('active');
        if (btnBusiness) btnBusiness.classList.remove('active');
        if (inputShop) inputShop.placeholder = "Your Full Name";
        if (iconShop) iconShop.className = "fas fa-user auth-input-icon";
    } else {
        if (btnBusiness) btnBusiness.classList.add('active');
        if (btnIndividual) btnIndividual.classList.remove('active');
        if (inputShop) inputShop.placeholder = "Business / Shop Name";
        if (iconShop) iconShop.className = "fas fa-store auth-input-icon";
    }
};

// State checking
function isCustomerLoggedIn() {
    return !!localStorage.getItem("wellshine_customer_token");
}

window.isCustomerLoggedIn = isCustomerLoggedIn;

function getAuthToken() {
    return localStorage.getItem("wellshine_customer_token") || "";
}

window.getAuthToken = getAuthToken;

// Check customer session on page load
async function checkCustomerSession() {
    const token = getAuthToken();
    if (!token) {
        onLoggedOut();
        return;
    }

    try {
        const res = await fetch("/api/auth/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            window.currentCustomer = data;
            onLoggedIn(data);
        } else {
            // Token expired or invalid
            logoutCustomerSilent();
        }
    } catch (err) {
        console.error("Auth check failed:", err);
        onLoggedOut();
    }
}

function onLoggedIn(user) {
    updateAuthPillUI(true, user);
    
    // Auto-fill checkout fields if on shop page
    const custNameInput = document.getElementById("cust-name");
    const custAddrInput = document.getElementById("cust-address");
    if (custNameInput && custAddrInput) {
        custNameInput.value = user.shop_name;
        custAddrInput.value = user.address + (user.pincode ? ` - PIN: ${user.pincode}` : '');
        
        if (user.account_type === 'Individual') {
            custNameInput.placeholder = "Your Full Name";
            const nameIcon = custNameInput.previousElementSibling;
            if (nameIcon && nameIcon.classList.contains('fa-store')) {
                nameIcon.className = "fas fa-user input-icon";
            }
        } else {
            custNameInput.placeholder = "Business / Shop Name";
            const nameIcon = custNameInput.previousElementSibling;
            if (nameIcon && nameIcon.classList.contains('fa-user')) {
                nameIcon.className = "fas fa-store input-icon";
            }
        }
    }
    
    // If shop.js exists and is loaded, refresh shop view to unlock quantities
    if (window.renderShop) {
        // Toggle checkout form display
        const checkoutForm = document.getElementById("checkout-form");
        const cartList = document.getElementById("cart-list");
        
        // Remove old prompt if any
        const oldPrompt = document.getElementById("cart-login-prompt-el");
        if (oldPrompt) oldPrompt.remove();
        
        if (checkoutForm) {
            checkoutForm.style.display = "block";
        }
        
        window.renderShop(document.getElementById("search-input")?.value || "");
    }
}

function onLoggedOut() {
    updateAuthPillUI(false);
    
    if (window.renderShop) {
        const checkoutForm = document.getElementById("checkout-form");
        const cartList = document.getElementById("cart-list");
        
        if (checkoutForm) {
            checkoutForm.style.display = "none";
            
            // Insert login prompt in sidebar cart
            let prompt = document.getElementById("cart-login-prompt-el");
            if (!prompt && cartList) {
                prompt = document.createElement("div");
                prompt.id = "cart-login-prompt-el";
                prompt.className = "cart-login-prompt";
                prompt.innerHTML = `Please <a onclick="openAuthModal()">Log In or Register</a> to submit your wholesale order.`;
                checkoutForm.parentNode.insertBefore(prompt, checkoutForm);
            }
        }
        
        window.renderShop(document.getElementById("search-input")?.value || "");
    }
}

function logoutCustomerSilent() {
    localStorage.removeItem("wellshine_customer_token");
    window.currentCustomer = null;
    onLoggedOut();
}

window.logoutCustomer = function() {
    if (confirm("Are you sure you want to sign out of your wholesale account?")) {
        logoutCustomerSilent();
        location.reload();
    }
};

// Form submissions
async function submitSignIn(e) {
    e.preventDefault();
    const email = document.getElementById("signin-email").value;
    const password = document.getElementById("signin-password").value;
    const errorEl = document.getElementById("signin-error");
    
    errorEl.style.display = "none";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem("wellshine_customer_token", data.token);
            window.currentCustomer = data.user;
            closeAuthModal();
            onLoggedIn(data.user);
            location.reload(); // Reload to refresh views completely
        } else {
            errorEl.innerText = data.error || "Login failed.";
            errorEl.style.display = "block";
        }
    } catch (err) {
        console.error("Login failed:", err);
        errorEl.innerText = "Connection failed. Please try again.";
        errorEl.style.display = "block";
    }
}

async function submitSignUp(e) {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const shop_name = document.getElementById("signup-shop").value.trim();
    const address = document.getElementById("signup-address").value.trim();
    const pincode = document.getElementById("signup-pincode").value.trim();
    const account_type = document.getElementById("signup-account-type").value;
    const errorEl = document.getElementById("signup-error");
    const successEl = document.getElementById("signup-success");
    
    errorEl.style.display = "none";
    if (successEl) successEl.style.display = "none";

    try {
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, shop_name, address, account_type, pincode })
        });
        
        const data = await res.json();
        if (res.ok) {
            if (successEl) successEl.style.display = "block";
            document.getElementById("customer-signup-form").reset();
            
            setTimeout(() => {
                switchAuthTab("signin");
                document.getElementById("signin-email").value = email;
                if (successEl) successEl.style.display = "none";
            }, 2000);
        } else {
            errorEl.innerText = data.error || "Failed to create account.";
            errorEl.style.display = "block";
        }
    } catch (err) {
        console.error("Sign up failed:", err);
        errorEl.innerText = "Connection failed. Please try again.";
        errorEl.style.display = "block";
    }
}

async function submitOTP(e) {
    e.preventDefault();
    if (!pendingRegistration) {
        switchAuthTab("signup");
        return;
    }

    const otp = document.getElementById("otp-code-input").value.trim();
    const errorEl = document.getElementById("otp-error");
    const successEl = document.getElementById("otp-success");
    
    errorEl.style.display = "none";
    successEl.style.display = "none";

    try {
        const payload = { ...pendingRegistration, otp };
        const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (res.ok) {
            successEl.style.display = "block";
            document.getElementById("customer-signup-form").reset();
            document.getElementById("customer-otp-form").reset();
            
            const email = pendingRegistration.email;
            pendingRegistration = null; // clear cache
            
            setTimeout(() => {
                switchAuthTab("signin");
                document.getElementById("signin-email").value = email;
            }, 1500);
        } else {
            errorEl.innerText = data.error || "Verification failed.";
            errorEl.style.display = "block";
        }
    } catch (err) {
        console.error("Verification failed:", err);
        errorEl.innerText = "Connection failed. Please try again.";
        errorEl.style.display = "block";
    }
}

// Navigation injection
function setupAuthPillButton() {
    if (document.getElementById("auth-pill-container")) return;

    const dropdown = document.querySelector(".header-nav .dropdown, .pill-nav .dropdown, .shop-header .header-right");
    if (!dropdown) return;

    const navContainer = dropdown.parentNode;
    const container = document.createElement("div");
    container.id = "auth-pill-container";
    container.className = "profile-dropdown-container";
    
    if (navContainer.classList.contains("header-nav") || navContainer.classList.contains("pill-nav")) {
        // Insert right before theme toggle or at the end
        const themeBtn = document.getElementById("theme-toggle");
        if (themeBtn) {
            navContainer.insertBefore(container, themeBtn);
        } else {
            navContainer.appendChild(container);
        }
    } else if (dropdown.classList.contains("header-right")) {
        // In shop header, prepend to header-right
        dropdown.insertBefore(container, dropdown.firstChild);
    }
}

function updateAuthPillUI(isLoggedIn, user = null) {
    const container = document.getElementById("auth-pill-container");
    if (!container) return;
    
    if (isLoggedIn && user) {
        const iconClass = user.account_type === 'Individual' ? 'fa-user' : 'fa-store';
        const profileTitle = user.account_type === 'Individual' ? 'Customer Profile' : 'Business Profile';
        const nameLabel = user.account_type === 'Individual' ? 'Name' : 'Shop';
        container.innerHTML = `
            <button class="profile-pill-btn" onclick="toggleProfileDropdown()">
                <i class="fas ${iconClass}"></i> <span>${user.shop_name}</span> <i class="fas fa-caret-down" style="font-size:0.7rem;"></i>
            </button>
            <div class="profile-dropdown-menu" id="profile-drop-menu">
                <a href="#" onclick="event.preventDefault(); alert('${profileTitle}:\\n${nameLabel}: ' + window.currentCustomer.shop_name + '\\nType: ' + window.currentCustomer.account_type + '\\nEmail: ' + window.currentCustomer.email + '\\nAddress: ' + window.currentCustomer.address);"><i class="fas fa-info-circle"></i> Info</a>
                <button onclick="logoutCustomer()"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="login-pill-btn" onclick="openAuthModal()">
                <i class="fas fa-user"></i> Login
            </button>
        `;
    }

    // Force browser reflow to recalculate translateX centering (fixes mobile Chrome translation bug on load)
    setTimeout(() => {
        const nav = document.querySelector('.pill-nav');
        if (nav) {
            nav.style.display = 'none';
            nav.offsetHeight; // trigger reflow
            nav.style.display = '';
        }
    }, 150);
}

window.toggleProfileDropdown = function() {
    const menu = document.getElementById("profile-drop-menu");
    if (menu) menu.classList.toggle("show");
};

// Close dropdown on click outside
window.addEventListener("click", (e) => {
    const dropdownBtn = document.querySelector(".profile-pill-btn");
    const menu = document.getElementById("profile-drop-menu");
    if (menu && dropdownBtn && !dropdownBtn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove("show");
    }
});
