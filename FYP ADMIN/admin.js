const API_BASE = 'http://localhost:5000/api';

function getToken() {
    return localStorage.getItem('adminToken');
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token) throw new Error('No token');
    const headers = {
        'Content-Type': 'application/json',
        'x-auth-token': token,
        ...options.headers
    };
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });
    if (response.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = 'admin-login.html';
        throw new Error('Session expired');
    }
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Fetch error: ${response.status} ${url}`, errorText);
        throw new Error(`HTTP ${response.status}`);
    }
    return response;
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'admin-login.html';
}

function highlightActiveNav() {
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.nav-item').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.includes(currentPage)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function showMessage(elementId, msg, type) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = msg;
        el.className = `message ${type}`;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }
}

let currentCMSSettings = {};

async function loadCMSSettings() {
    try {
        const res = await fetch(`${API_BASE}/cms`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        currentCMSSettings = await res.json();
        applyCMSSettings();
        return currentCMSSettings;
    } catch (err) {
        console.warn('Could not load CMS settings:', err);
        return null;
    }
}

function applyCMSSettings() {
    const logoH2 = document.querySelector('.sidebar .logo h2');
    if (logoH2 && currentCMSSettings.siteTitle) {
        logoH2.innerHTML = `<i class="fas fa-graduation-cap"></i> ${currentCMSSettings.siteTitle}`;
    }
    const pageTitleH1 = document.querySelector('.page-title h1');
    if (pageTitleH1 && currentCMSSettings.siteTitle) {
        pageTitleH1.textContent = currentCMSSettings.siteTitle;
    }
    if (currentCMSSettings.siteTitle) {
        document.title = `${currentCMSSettings.siteTitle} | Admin`;
    }
    if (currentCMSSettings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', currentCMSSettings.primaryColor);
        const buttons = document.querySelectorAll('button:not(.view-more-schools-btn):not(.btn-secondary)');
        buttons.forEach(btn => {
            btn.style.backgroundColor = currentCMSSettings.primaryColor;
        });
    }
}