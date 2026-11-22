const ADMIN_SESSION_KEY = 'splenexa-question-bank-admin-session';
const ADMIN_USER_KEY = 'splenexa-admin-user';
const ADMIN_TESTS_KEY = 'fmge-question-bank-tests';
const ADMIN_ENDPOINT = '/api/question-bank/admin';
const REQUEST_TIMEOUT_MS = 15000;
const SESSION_EXPIRED_EVENT = 'splenexa-admin-session-expired';

function getApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  const apiUrl = (configuredUrl || (import.meta.env.DEV ? 'http://127.0.0.1:3000' : '')).replace(/\/+$/, '');
  if (!apiUrl) {
    throw new Error('Admin API is not configured. Set VITE_API_URL in the admin website environment.');
  }
  return apiUrl;
}

async function fetchJson(path, { method = 'GET', body, token, window } = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await window.fetch(`${getApiUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(`Unable to reach the admin API: ${error.message}`);
  } finally {
    window.clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Admin API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const error = new Error(payload.message || `Admin API request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function hasAdminSession(window) {
  return Boolean(window.sessionStorage.getItem(ADMIN_SESSION_KEY));
}

export function getAdminUser(window) {
  try {
    const user = JSON.parse(window.sessionStorage.getItem(ADMIN_USER_KEY) || 'null');
    return user && typeof user.firstName === 'string' && typeof user.lastName === 'string'
      ? user
      : null;
  } catch {
    return null;
  }
}

export async function loginAdmin(email, password, window) {
  const { token, user } = await fetchJson(`${ADMIN_ENDPOINT}/login`, {
    method: 'POST',
    body: { email, password },
    window,
  });
  if (typeof token !== 'string' || !token || !user || typeof user.firstName !== 'string') {
    throw new Error('The backend did not return a valid user session.');
  }
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
  window.sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  return user;
}

export async function signUpAdmin(account, window) {
  return fetchJson(`${ADMIN_ENDPOINT}/signup`, {
    method: 'POST',
    body: account,
    window,
  });
}

export async function logoutAdmin(window) {
  const token = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!token) {
    return;
  }
  try {
    await fetchJson(`${ADMIN_ENDPOINT}/logout`, {
      method: 'POST',
      token,
      window,
    });
  } catch (error) {
    if (error.status !== 401) {
      throw error;
    }
  } finally {
    clearAdminSession(window);
  }
}

export function clearAdminSession(window) {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  window.sessionStorage.removeItem(ADMIN_USER_KEY);
}

function expireAdminSession(window) {
  clearAdminSession(window);
  window.dispatchEvent(new window.Event(SESSION_EXPIRED_EVENT));
}

export async function verifyAdminSession(window) {
  const token = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!token) {
    return false;
  }
  try {
    const response = await fetchJson(`${ADMIN_ENDPOINT}/session`, { token, window });
    if (response.authenticated !== true || !response.user || typeof response.user.firstName !== 'string') {
      throw new Error('The backend returned an invalid user session.');
    }
    window.sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(response.user));
    return response.user;
  } catch (error) {
    if (error.status === 401) {
      expireAdminSession(window);
    }
    throw error;
  }
}

async function request(path, { method = 'GET', body, window } = {}) {
  const token = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!token) {
    throw new Error('Admin sign-in is required to manage the Question Bank.');
  }
  try {
    return await fetchJson(path, { method, body, token, window });
  } catch (error) {
    if (error.status === 401) {
      expireAdminSession(window);
    }
    throw error;
  }
}

export async function loadAdminCatalog(window) {
  const catalog = await request(ADMIN_ENDPOINT, { window });
  if (
    !catalog ||
    !Array.isArray(catalog.products) ||
    !Array.isArray(catalog.subjects) ||
    !Array.isArray(catalog.questions)
  ) {
    throw new Error('The Question Bank API returned an invalid catalog.');
  }
  if (catalog.tests !== undefined && !Array.isArray(catalog.tests)) {
    throw new Error('The Question Bank API returned invalid test data.');
  }
  catalog.tests = Array.isArray(catalog.tests) ? catalog.tests : [];
  return catalog;
}

let saveQueue = Promise.resolve();

export function saveAdminCatalog(catalog, window) {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  if (!Array.isArray(snapshot.tests)) {
    const storedTests = window.sessionStorage.getItem(ADMIN_TESTS_KEY);
    if (storedTests !== null) {
      snapshot.tests = JSON.parse(storedTests);
    }
  }
  const save = saveQueue.catch(() => undefined).then(async () => {
    const savedCatalog = await request(ADMIN_ENDPOINT, { method: 'PUT', body: snapshot, window });
    if (Array.isArray(savedCatalog.tests)) {
      window.sessionStorage.setItem(ADMIN_TESTS_KEY, JSON.stringify(savedCatalog.tests));
    }
    return savedCatalog;
  });
  saveQueue = save;
  return save;
}
