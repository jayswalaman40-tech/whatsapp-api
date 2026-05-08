/**
 * WhatsApp API — Frontend Dashboard Application
 * SPA with hash-based routing, JWT auth, Socket.io real-time updates.
 */

// ============================================
// API Service Class
// ============================================

class ApiService {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  getToken() {
    return localStorage.getItem('wa_token');
  }

  setToken(token) {
    localStorage.setItem('wa_token', token);
  }

  clearToken() {
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_user');
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('wa_user'));
    } catch { return null; }
  }

  setUser(user) {
    localStorage.setItem('wa_user', JSON.stringify(user));
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, options);
    const data = await res.json();

    if (res.status === 401) {
      this.clearToken();
      window.location.hash = '#/login';
      throw new Error('Session expired. Please login again.');
    }

    return data;
  }

  // Auth
  login(username, password) {
    return this.request('POST', '/api/auth/login', { username, password });
  }

  register(username, password) {
    return this.request('POST', '/api/auth/register', { username, password });
  }

  // API Keys
  getApiKeys() {
    return this.request('GET', '/api/auth/api-keys');
  }

  createApiKey(name) {
    return this.request('POST', '/api/auth/api-key', { name });
  }

  deleteApiKey(id) {
    return this.request('DELETE', `/api/auth/api-key/${id}`);
  }

  // Instances
  listInstances() {
    return this.request('GET', '/api/instance/list');
  }

  createInstance(name) {
    return this.request('POST', '/api/instance/create', { name });
  }

  getInstanceStatus(id) {
    return this.request('GET', `/api/instance/${id}/status`);
  }

  getQrCode(id) {
    return this.request('GET', `/api/instance/${id}/qr`);
  }

  deleteInstance(id) {
    return this.request('DELETE', `/api/instance/${id}`);
  }

  // Messages
  sendMessage(instanceId, to, message) {
    return this.request('POST', '/api/message/send', { instanceId, to, message });
  }

  sendMedia(instanceId, to, mediaUrl, caption) {
    return this.request('POST', '/api/message/send-media', { instanceId, to, mediaUrl, caption });
  }
}

// ============================================
// App State
// ============================================

const api = new ApiService();
let socket = null;
let currentQrInstanceId = null;

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// Socket.io Connection
// ============================================

function connectSocket() {
  if (socket) return;

  socket = io(window.location.origin);

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected');
  });
}

function subscribeToInstance(instanceId) {
  if (!socket) connectSocket();

  // Listen for QR code updates
  socket.on(`qr:${instanceId}`, (data) => {
    console.log('📱 QR received for:', instanceId);
    if (currentQrInstanceId === instanceId) {
      updateQrModal(data.qr, 'qr');
    }
    refreshInstanceList();
  });

  // Listen for status updates
  socket.on(`status:${instanceId}`, (data) => {
    console.log('📊 Status update:', data);
    if (data.status === 'connected') {
      showToast(`Instance ${instanceId} connected! Phone: ${data.phone}`, 'success');
      closeQrModal();
    } else if (data.status === 'timeout') {
      showToast('QR code expired. Please create a new instance.', 'warning');
      closeQrModal();
    } else if (data.status === 'disconnected') {
      showToast(`Instance ${instanceId} disconnected.`, 'warning');
    }
    refreshInstanceList();
  });
}

// ============================================
// Router
// ============================================

function router() {
  const hash = window.location.hash || '#/login';

  // Protect routes
  if (!api.isAuthenticated() && hash !== '#/login') {
    window.location.hash = '#/login';
    return;
  }

  if (api.isAuthenticated() && hash === '#/login') {
    window.location.hash = '#/dashboard';
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Update nav
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  switch (hash) {
    case '#/login':
      document.getElementById('page-login').classList.add('active');
      document.getElementById('app-nav').style.display = 'none';
      break;

    case '#/dashboard':
      document.getElementById('page-dashboard').classList.add('active');
      document.getElementById('app-nav').style.display = 'flex';
      document.querySelector('[href="#/dashboard"]')?.classList.add('active');
      connectSocket();
      loadDashboard();
      break;

    case '#/api-keys':
      document.getElementById('page-apikeys').classList.add('active');
      document.getElementById('app-nav').style.display = 'flex';
      document.querySelector('[href="#/api-keys"]')?.classList.add('active');
      loadApiKeys();
      break;

    default:
      window.location.hash = api.isAuthenticated() ? '#/dashboard' : '#/login';
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', () => {
  router();
  updateUserDisplay();
});

// ============================================
// Auth Functions
// ============================================

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value;
  const btn = form.querySelector('button[type="submit"]');

  if (!username || !password) {
    showToast('Please enter username and password.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';

  try {
    const result = await api.login(username, password);

    if (result.success) {
      api.setToken(result.data.token);
      api.setUser(result.data.user);
      showToast('Login successful!', 'success');
      updateUserDisplay();
      window.location.hash = '#/dashboard';
    } else {
      showToast(result.error || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Login failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔑</span> Login';
  }
}

function handleLogout() {
  api.clearToken();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  showToast('Logged out.', 'info');
  window.location.hash = '#/login';
}

function updateUserDisplay() {
  const user = api.getUser();
  const el = document.getElementById('user-display');
  if (el && user) {
    el.textContent = user.username;
  }
}

// ============================================
// Dashboard — Instance Management
// ============================================

async function loadDashboard() {
  const container = document.getElementById('instances-list');
  container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading instances...</div>';

  try {
    const result = await api.listInstances();

    if (result.success && result.data.length > 0) {
      container.innerHTML = result.data.map(inst => createInstanceCard(inst)).join('');
      // Subscribe to updates for each instance
      result.data.forEach(inst => subscribeToInstance(inst.id));
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📱</div>
          <h3>No Instances Yet</h3>
          <p>Create your first WhatsApp instance to get started.</p>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div class="error-state">❌ Failed to load instances: ${err.message}</div>`;
  }
}

function refreshInstanceList() {
  // Debounce refresh
  clearTimeout(window._refreshTimeout);
  window._refreshTimeout = setTimeout(loadDashboard, 500);
}

function createInstanceCard(inst) {
  const statusColors = {
    connected: '#25D366',
    disconnected: '#ff4757',
    qr: '#ffa502',
    initializing: '#3498db',
    error: '#ff4757',
    timeout: '#95a5a6'
  };

  const statusLabels = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    qr: 'Scanning QR',
    initializing: 'Initializing...',
    error: 'Error',
    timeout: 'Timed Out'
  };

  const color = statusColors[inst.status] || '#95a5a6';
  const label = statusLabels[inst.status] || inst.status;

  return `
    <div class="instance-card" id="card-${inst.id}">
      <div class="instance-header">
        <div class="instance-info">
          <h3 class="instance-name">${escapeHtml(inst.name)}</h3>
          <span class="instance-id">${inst.id}</span>
        </div>
        <span class="status-badge" style="--status-color: ${color}">
          <span class="status-dot"></span>
          ${label}
        </span>
      </div>
      <div class="instance-details">
        ${inst.phone ? `<div class="detail-item"><span class="detail-label">📞 Phone</span><span class="detail-value">+${inst.phone}</span></div>` : ''}
        <div class="detail-item">
          <span class="detail-label">📅 Created</span>
          <span class="detail-value">${new Date(inst.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="instance-actions">
        ${inst.status === 'qr' || inst.status === 'initializing' || inst.status === 'disconnected' ?
      `<button class="btn btn-primary btn-sm" onclick="openQrModal('${inst.id}')">
            <span class="btn-icon">📱</span> View QR
          </button>` : ''
    }
        ${inst.status === 'connected' ?
      `<button class="btn btn-outline btn-sm" onclick="refreshStatus('${inst.id}')">
            <span class="btn-icon">🔄</span> Refresh
          </button>` : ''
    }
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteInstance('${inst.id}')">
          <span class="btn-icon">🗑️</span> Delete
        </button>
      </div>
    </div>
  `;
}

async function handleCreateInstance(e) {
  e.preventDefault();
  const input = document.getElementById('new-instance-name');
  const name = input.value.trim();
  const btn = e.target.querySelector('button[type="submit"]');

  if (!name) {
    showToast('Please enter an instance name.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const result = await api.createInstance(name);

    if (result.success) {
      showToast(`Instance "${name}" created! Waiting for QR code...`, 'success');
      input.value = '';
      // Subscribe to this new instance
      subscribeToInstance(result.data.instanceId);
      // Open QR modal
      setTimeout(() => openQrModal(result.data.instanceId), 1500);
      loadDashboard();
    } else {
      showToast(result.error || 'Failed to create instance.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Failed to create instance.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">➕</span> Create Instance';
  }
}

async function confirmDeleteInstance(id) {
  if (!confirm(`Are you sure you want to delete instance ${id}? This action cannot be undone.`)) return;

  try {
    const result = await api.deleteInstance(id);
    if (result.success) {
      showToast('Instance deleted.', 'success');
      loadDashboard();
    } else {
      showToast(result.error || 'Failed to delete.', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshStatus(id) {
  try {
    const result = await api.getInstanceStatus(id);
    if (result.success) {
      showToast(`Status: ${result.data.status}${result.data.phone ? ' | Phone: ' + result.data.phone : ''}`, 'info');
      loadDashboard();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================
// QR Code Modal
// ============================================

function openQrModal(instanceId) {
  currentQrInstanceId = instanceId;
  const modal = document.getElementById('qr-modal');
  const qrImage = document.getElementById('qr-image');
  const qrStatus = document.getElementById('qr-status');

  modal.classList.add('active');
  qrImage.src = '';
  qrImage.style.display = 'none';
  qrStatus.textContent = 'Loading QR code...';
  qrStatus.className = 'qr-status loading';

  // Subscribe to real-time updates
  subscribeToInstance(instanceId);

  // Fetch current QR
  fetchQrCode(instanceId);
}

async function fetchQrCode(instanceId) {
  try {
    const result = await api.getQrCode(instanceId);
    if (result.success && result.data.qr) {
      updateQrModal(result.data.qr, 'qr');
    } else {
      document.getElementById('qr-status').textContent = 'Waiting for QR code... Please wait.';
    }
  } catch (err) {
    document.getElementById('qr-status').textContent = 'QR code not ready yet. It will appear automatically.';
  }
}

function updateQrModal(qrDataUrl, status) {
  const qrImage = document.getElementById('qr-image');
  const qrStatus = document.getElementById('qr-status');

  if (status === 'qr' && qrDataUrl) {
    qrImage.src = qrDataUrl;
    qrImage.style.display = 'block';
    qrStatus.textContent = 'Scan this QR code with WhatsApp on your phone';
    qrStatus.className = 'qr-status ready';
  } else if (status === 'connected') {
    qrImage.style.display = 'none';
    qrStatus.textContent = '✅ Connected successfully!';
    qrStatus.className = 'qr-status connected';
    setTimeout(closeQrModal, 2000);
  }
}

function closeQrModal() {
  document.getElementById('qr-modal').classList.remove('active');
  currentQrInstanceId = null;
}

// ============================================
// API Keys Page
// ============================================

async function loadApiKeys() {
  const container = document.getElementById('apikeys-list');
  container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading API keys...</div>';

  try {
    const result = await api.getApiKeys();

    if (result.success && result.data.length > 0) {
      container.innerHTML = `
        <div class="apikeys-grid">
          ${result.data.map(key => createApiKeyCard(key)).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <h3>No API Keys</h3>
          <p>Generate an API key to authenticate your mobile app or external services.</p>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div class="error-state">❌ Failed to load API keys: ${err.message}</div>`;
  }
}

function createApiKeyCard(key) {
  return `
    <div class="apikey-card">
      <div class="apikey-header">
        <h4 class="apikey-name">${escapeHtml(key.name)}</h4>
        <button class="btn btn-danger btn-xs" onclick="confirmDeleteApiKey(${key.id})">
          <span class="btn-icon">🗑️</span>
        </button>
      </div>
      <div class="apikey-value" id="key-${key.id}">
        <code class="key-masked">${key.key_masked}</code>
        <div class="apikey-actions">
          <button class="btn btn-outline btn-xs" onclick="toggleKeyVisibility(${key.id}, '${key.key_full}')">
            👁️ Show
          </button>
          <button class="btn btn-primary btn-xs" onclick="copyToClipboard('${key.key_full}')">
            📋 Copy
          </button>
        </div>
      </div>
      <div class="apikey-meta">
        <span>Created: ${new Date(key.created_at).toLocaleDateString()}</span>
        <span>Last used: ${key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}</span>
      </div>
    </div>
  `;
}

async function handleCreateApiKey(e) {
  e.preventDefault();
  const input = document.getElementById('new-apikey-name');
  const name = input.value.trim();
  const btn = e.target.querySelector('button[type="submit"]');

  if (!name) {
    showToast('Please enter a name for the API key.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const result = await api.createApiKey(name);

    if (result.success) {
      showToast('API key generated! Copy it now — it won\'t be shown in full again.', 'success');
      input.value = '';

      // Show the key in a temporary alert
      const alertDiv = document.createElement('div');
      alertDiv.className = 'new-key-alert';
      alertDiv.innerHTML = `
        <div class="new-key-content">
          <strong>🔑 New API Key:</strong>
          <code>${result.data.key}</code>
          <button class="btn btn-primary btn-xs" onclick="copyToClipboard('${result.data.key}'); this.parentElement.parentElement.remove();">
            📋 Copy & Close
          </button>
        </div>
      `;
      document.getElementById('apikeys-list').prepend(alertDiv);

      loadApiKeys();
    } else {
      showToast(result.error || 'Failed to generate API key.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Failed to generate.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔑</span> Generate Key';
  }
}

async function confirmDeleteApiKey(id) {
  if (!confirm('Delete this API key? Any apps using it will stop working.')) return;

  try {
    const result = await api.deleteApiKey(id);
    if (result.success) {
      showToast('API key deleted.', 'success');
      loadApiKeys();
    } else {
      showToast(result.error || 'Failed to delete.', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleKeyVisibility(id, fullKey) {
  const el = document.querySelector(`#key-${id} .key-masked`);
  if (el.textContent === fullKey) {
    el.textContent = fullKey.substring(0, 8) + '...' + fullKey.substring(fullKey.length - 4);
  } else {
    el.textContent = fullKey;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard!', 'success');
  });
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
