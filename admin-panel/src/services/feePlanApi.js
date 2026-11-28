const ADMIN_SESSION_KEY = 'splenexa-question-bank-admin-session';
const ADMIN_ENDPOINT = '/api/fee-plans/admin';
const REQUEST_TIMEOUT_MS = 15000;
const SESSION_EXPIRED_EVENT = 'splenexa-admin-session-expired';

function getApiUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL?.trim();
  const defaultUrl = import.meta.env.DEV
    ? 'http://127.0.0.1:3000'
    : 'https://r3wi4h0vwr.c35.airoapp.ai';
  const configuredLocalUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i
    .test(configuredUrl || '');
  const apiUrl = !import.meta.env.DEV && configuredLocalUrl
    ? defaultUrl
    : configuredUrl || defaultUrl;
  return apiUrl.replace(/\/+$/, '');
}

async function request(path, { method = 'GET', body, window }) {
  const token = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!token) throw new Error('Admin sign-in is required to manage fee plans.');

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await window.fetch(`${getApiUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(`Unable to reach the fee plan API: ${error.message}`);
  } finally {
    window.clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Fee plan API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.dispatchEvent(new window.Event(SESSION_EXPIRED_EVENT));
    }
    const error = new Error(payload.message || `Fee plan API request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function loadAdminFeePlans(window) {
  const response = await request(ADMIN_ENDPOINT, { window });
  if (!response || !Array.isArray(response.plans)) {
    throw new Error('Fee plan API returned invalid plan data.');
  }
  return response.plans;
}

export async function saveAdminFeePlan(plan, window) {
  const path = plan.id
    ? `${ADMIN_ENDPOINT}/${encodeURIComponent(plan.id)}`
    : ADMIN_ENDPOINT;
  const response = await request(path, {
    method: plan.id ? 'PUT' : 'POST',
    body: plan,
    window,
  });
  if (!response?.plan || typeof response.plan.id !== 'string') {
    throw new Error('Fee plan API did not return the saved plan.');
  }
  return response.plan;
}

export async function deleteAdminFeePlan(planId, window) {
  await request(`${ADMIN_ENDPOINT}/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
    window,
  });
}
