// admin.js - backend integration
const API_BASE = 'http://localhost:5000/api'; // pabago na lang po ng backend URL

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
    return response;
}

function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'admin-login.html';
}

// active nav
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