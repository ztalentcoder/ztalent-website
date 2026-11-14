const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class AdminSettingsApiError extends Error {
  constructor(status, code, message) {
    super(message || 'The settings request could not be completed.');
    this.name = 'AdminSettingsApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${apiBaseUrl}/admin/${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new AdminSettingsApiError(
      response.status,
      payload?.error?.code,
      payload?.error?.message,
    );
  }
  return payload;
}

export function updateAdminUsername(body) {
  return request('account/username', { method: 'PATCH', body });
}

export function changeAdminPassword(body) {
  return request('account/password', { method: 'PATCH', body });
}

export function listAdministrators() {
  return request('administrators');
}

export function createAssistantAdministrator(body) {
  return request('administrators', { method: 'POST', body });
}

export function setAdministratorStatus(id, isActive) {
  return request(`administrators/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
}

export function resetAssistantAdministratorPassword(id, body) {
  return request(`administrators/${encodeURIComponent(id)}/password`, {
    method: 'PUT',
    body,
  });
}
