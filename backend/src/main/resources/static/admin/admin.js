const loginView = document.querySelector('#login-view');
const dashboardView = document.querySelector('#dashboard-view');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const dashboardMessage = document.querySelector('#dashboard-message');
const detailMessage = document.querySelector('#detail-message');
const enquiryRows = document.querySelector('#enquiry-rows');
const detailDialog = document.querySelector('#detail-dialog');

let csrfToken = null;
let activeEnquiryId = null;
let currentPage = 0;
let totalPages = 0;
let searchTimer = null;

function showLogin() {
  dashboardView.hidden = true;
  loginView.hidden = false;
  document.querySelector('#login-email').focus();
}

function showDashboard(email) {
  loginView.hidden = true;
  dashboardView.hidden = false;
  document.querySelector('#admin-email').textContent = email;
  refreshDashboard();
  document.dispatchEvent(new Event('clarigence:admin-ready'));
}

async function loadCsrfToken() {
  const response = await fetch('/api/admin/auth/csrf', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  const payload = await response.json();
  const xsrfCookie = document.cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='));
  if (!response.ok || !payload.token || !xsrfCookie) {
    throw new Error('Could not initialize a secure login. Reload this page and try again.');
  }
  csrfToken = decodeURIComponent(xsrfCookie.slice('XSRF-TOKEN='.length));
}

async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!csrfToken) await loadCsrfToken();
    headers.set('X-XSRF-TOKEN', csrfToken);
  }

  const response = await fetch(path, { cache: 'no-store', ...options, method, headers, credentials: 'same-origin' });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/admin/auth/login') {
    showLogin();
    throw new Error('Your session has ended. Sign in again to continue.');
  }
  if (!response.ok) {
    const error = new Error(payload.message || 'The request could not be completed. Please try again.');
    error.fieldErrors = payload.fieldErrors || {};
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setMessage(element, message, state = '') {
  element.textContent = message;
  if (state) element.dataset.state = state;
  else delete element.dataset.state;
}

function statusClass(status) {
  return `status-badge status-${status}`;
}

function readableStatus(status) {
  return status.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderEnquiries(pageData) {
  enquiryRows.replaceChildren();
  document.querySelector('#empty-state').hidden = pageData.items.length !== 0;
  document.querySelector('#result-count').textContent = `${pageData.totalItems} ${pageData.totalItems === 1 ? 'enquiry' : 'enquiries'}`;
  totalPages = pageData.totalPages;
  document.querySelector('#pagination-label').textContent = totalPages ? `Page ${pageData.page + 1} of ${totalPages}` : 'Page 0 of 0';
  document.querySelector('#previous-page').disabled = pageData.page <= 0;
  document.querySelector('#next-page').disabled = pageData.page + 1 >= totalPages;

  pageData.items.forEach((item) => {
    const row = document.createElement('tr');
    const contactCell = document.createElement('td');
    contactCell.className = 'contact-cell';
    const name = document.createElement('div');
    name.className = 'contact-name';
    name.textContent = item.name;
    const email = document.createElement('div');
    email.className = 'contact-email';
    email.textContent = item.email;
    contactCell.append(name, email);

    const service = document.createElement('td');
    service.className = 'service-cell';
    service.textContent = item.service;
    const received = document.createElement('td');
    received.className = 'received-cell';
    received.textContent = formatDate(item.createdAt);
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = statusClass(item.status);
    badge.textContent = readableStatus(item.status);
    statusCell.append(badge);
    const actionCell = document.createElement('td');
    const viewButton = document.createElement('button');
    viewButton.className = 'view-button';
    viewButton.type = 'button';
    viewButton.textContent = 'View details →';
    viewButton.addEventListener('click', () => openEnquiry(item.id));
    actionCell.append(viewButton);
    row.append(contactCell, service, received, statusCell, actionCell);
    enquiryRows.append(row);
  });
}

async function refreshDashboard() {
  setMessage(dashboardMessage, '');
  const query = document.querySelector('#search-input').value.trim();
  const status = document.querySelector('#status-filter').value;
  const params = new URLSearchParams({ page: String(currentPage), size: '20' });
  if (query) params.set('query', query);
  if (status) params.set('status', status);

  try {
    const [summary, pageData] = await Promise.all([
      apiRequest('/api/admin/dashboard'),
      apiRequest(`/api/admin/enquiries?${params.toString()}`)
    ]);
    document.querySelector('#stat-total').textContent = summary.totalEnquiries;
    document.querySelector('#stat-new').textContent = summary.enquiriesByStatus.NEW || 0;
    document.querySelector('#stat-contacted').textContent = summary.enquiriesByStatus.CONTACTED || 0;
    document.querySelector('#stat-in-progress').textContent = summary.enquiriesByStatus.IN_PROGRESS || 0;
    document.querySelector('#stat-converted').textContent = summary.enquiriesByStatus.CONVERTED || 0;
    document.querySelector('#stat-closed').textContent = summary.enquiriesByStatus.CLOSED || 0;
    renderEnquiries(pageData);
  } catch (error) {
    if (!loginView.hidden) return;
    setMessage(dashboardMessage, error.message, 'error');
  }
}

function addDetailField(container, label, value, options = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = `detail-field${options.full ? ' full' : ''}`;
  const title = document.createElement('span');
  title.className = 'detail-label';
  title.textContent = label;
  const content = document.createElement(options.href ? 'a' : 'div');
  content.className = 'detail-value';
  content.textContent = value || 'Not provided';
  if (options.href && value) content.href = `${options.href}${value}`;
  wrapper.append(title, content);
  container.append(wrapper);
}

async function openEnquiry(id) {
  setMessage(detailMessage, 'Loading enquiry…');
  activeEnquiryId = id;
  document.querySelector('#retry-notification').disabled = true;
  document.querySelector('#detail-content').replaceChildren();
  detailDialog.showModal();
  try {
    const item = await apiRequest(`/api/admin/enquiries/${id}`);
    const content = document.querySelector('#detail-content');
    content.replaceChildren();
    const grid = document.createElement('div');
    grid.className = 'detail-grid';
    addDetailField(grid, 'NAME', item.name);
    addDetailField(grid, 'EMAIL', item.email, { href: 'mailto:' });
    addDetailField(grid, 'PHONE', item.phone, { href: 'tel:' });
    addDetailField(grid, 'COMPANY', item.company);
    addDetailField(grid, 'SERVICE REQUIRED', item.service);
    addDetailField(grid, 'RECEIVED', formatDate(item.createdAt));
    addDetailField(grid, 'MESSAGE', item.message, { full: true });
    addDetailField(grid, 'EMAIL NOTIFICATION', readableStatus(item.notificationStatus));
    addDetailField(grid, 'LAST EMAIL ATTEMPT', formatDate(item.notificationAttemptedAt));
    if (item.notificationError) addDetailField(grid, 'EMAIL DELIVERY NOTE', item.notificationError, { full: true });
    document.querySelector('#retry-notification').disabled = item.notificationStatus === 'SENT';
    content.append(grid);
    document.querySelector('#detail-status').value = item.status;
    setMessage(detailMessage, '');
  } catch (error) {
    setMessage(detailMessage, error.message, 'error');
  }
}

async function initialize() {
  try {
    await loadCsrfToken();
    const session = await apiRequest('/api/admin/auth/session');
    showDashboard(session.email);
  } catch {
    showLogin();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Signing in…';
  setMessage(loginMessage, '');
  try {
    if (!csrfToken) await loadCsrfToken();
    const credentials = Object.fromEntries(new FormData(loginForm).entries());
    const session = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    loginForm.reset();
    showDashboard(session.email);
  } catch (error) {
    setMessage(loginMessage, error.message, 'error');
    if (error.message.toLowerCase().includes('csrf')) csrfToken = null;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Sign in <span aria-hidden="true">↗</span>';
  }
});

document.querySelector('#logout-button').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await apiRequest('/api/admin/auth/logout', { method: 'POST' });
    csrfToken = null;
    await loadCsrfToken();
    showLogin();
    setMessage(loginMessage, 'You have signed out.', 'success');
  } catch (error) {
    setMessage(dashboardMessage, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#refresh-button').addEventListener('click', refreshDashboard);
document.querySelector('#status-filter').addEventListener('change', () => {
  currentPage = 0;
  refreshDashboard();
});
document.querySelector('#search-input').addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    currentPage = 0;
    refreshDashboard();
  }, 260);
});
document.querySelector('#previous-page').addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage -= 1;
    refreshDashboard();
  }
});
document.querySelector('#next-page').addEventListener('click', () => {
  if (currentPage + 1 < totalPages) {
    currentPage += 1;
    refreshDashboard();
  }
});
document.querySelector('#close-detail').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (event) => {
  if (event.target === detailDialog) detailDialog.close();
});

document.querySelector('#save-status').addEventListener('click', async (event) => {
  if (!activeEnquiryId) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await apiRequest(`/api/admin/enquiries/${activeEnquiryId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: document.querySelector('#detail-status').value })
    });
    setMessage(detailMessage, 'Status updated.', 'success');
    await refreshDashboard();
  } catch (error) {
    setMessage(detailMessage, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#delete-enquiry').addEventListener('click', async (event) => {
  if (!activeEnquiryId || !window.confirm('Delete this enquiry permanently? This cannot be undone.')) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await apiRequest(`/api/admin/enquiries/${activeEnquiryId}`, { method: 'DELETE' });
    detailDialog.close();
    activeEnquiryId = null;
    if (currentPage > 0 && enquiryRows.children.length === 1) currentPage -= 1;
    await refreshDashboard();
    setMessage(dashboardMessage, 'Enquiry deleted.', 'success');
  } catch (error) {
    setMessage(detailMessage, error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#retry-notification').addEventListener('click', async event => {
  if (!activeEnquiryId) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const item = await apiRequest(`/api/admin/enquiries/${activeEnquiryId}/notification/retry`, { method: 'POST' });
    detailDialog.close();
    await openEnquiry(item.id);
    setMessage(detailMessage, item.notificationStatus === 'SENT' ? 'Email accepted by the provider.' :
      'Email was not sent. Your enquiry remains saved. Check the delivery note and backend configuration.',
      item.notificationStatus === 'SENT' ? 'success' : 'error');
  } catch (error) {
    setMessage(detailMessage, error.message, 'error');
    button.disabled = false;
  }
});

initialize();
