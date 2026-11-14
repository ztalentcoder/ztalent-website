const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class AdminAuthApiError extends Error {
  constructor(status, code) {
    super('Admin authentication request failed.');
    this.name = 'AdminAuthApiError';
    this.status = status;
    this.code = code;
  }
}

async function requestAdminAuth(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/admin/auth/${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new AdminAuthApiError(response.status, body?.error?.code);
  }

  return body;
}

export function loginAdmin(identifier, password) {
  return requestAdminAuth('login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  }).then(requireAdminResponse);
}

export function getCurrentAdmin() {
  return requestAdminAuth('me').then(requireAdminResponse);
}

export function logoutAdmin() {
  return requestAdminAuth('logout', { method: 'POST' }).then((body) => {
    if (body?.status !== 'success') {
      throw new AdminAuthApiError(502, 'INVALID_RESPONSE');
    }
    return body;
  });
}

function requireAdminResponse(body) {
  const admin = body?.admin;
  if (
    body?.status !== 'success' ||
    !admin ||
    typeof admin.id !== 'string' ||
    typeof admin.username !== 'string' ||
    typeof admin.name !== 'string' ||
    (admin.email !== null && typeof admin.email !== 'string') ||
    typeof admin.role !== 'string'
  ) {
    throw new AdminAuthApiError(502, 'INVALID_RESPONSE');
  }
  return body;
}
