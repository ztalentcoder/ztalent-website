const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class AdminContentApiError extends Error {
  constructor(status, code, message) {
    super(message || 'The content request could not be completed.');
    this.name = 'AdminContentApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${apiBaseUrl}/admin/${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
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
    const message = response.status < 500 && payload?.error?.message
      ? payload.error.message
      : 'The content request could not be completed.';
    throw new AdminContentApiError(response.status, payload?.error?.code, message);
  }

  return payload;
}

export function getAdminDashboard() {
  return request('dashboard');
}

export function listAdminContent(resource, query = {}) {
  return request(resource, { query });
}

export function getAdminContent(resource, id, query) {
  return request(`${resource}/${encodeURIComponent(id)}`, { query });
}

export function createAdminContent(resource, body, query) {
  return request(resource, { method: 'POST', body, query });
}

export function updateAdminContent(resource, id, body, query) {
  return request(`${resource}/${encodeURIComponent(id)}`, { method: 'PUT', body, query });
}

export function deleteAdminContent(resource, id, query) {
  return request(`${resource}/${encodeURIComponent(id)}`, { method: 'DELETE', query });
}

export function getCompanyProfile() {
  return request('company-profile');
}

export function updateCompanyProfile(body) {
  return request('company-profile', { method: 'PUT', body });
}

export function getAboutPageContent() {
  return request('about-page');
}

export function updateAboutPageContent(content) {
  return request('about-page', { method: 'PUT', body: { content } });
}

export function uploadAdminImage(resource, file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${apiBaseUrl}/admin/images/${encodeURIComponent(resource)}`, window.location.origin);
    const body = new FormData();
    body.append('image', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url.toString());
    xhr.withCredentials = true;
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const message = xhr.status < 500 && payload?.error?.message
          ? payload.error.message
          : 'The image could not be uploaded.';
        reject(new AdminContentApiError(xhr.status, payload?.error?.code, message));
        return;
      }
      resolve(payload.image);
    });
    xhr.addEventListener('error', () => reject(new AdminContentApiError(0, 'NETWORK_ERROR', 'The image upload could not be completed.')));
    xhr.addEventListener('abort', () => reject(new AdminContentApiError(0, 'UPLOAD_ABORTED', 'The image upload was cancelled.')));
    xhr.send(body);
  });
}

export function deleteAdminImage(url) {
  return request('images', { method: 'DELETE', body: { url } });
}

export function updateContactMessageStatus(id, status) {
  return request(`contact-messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status },
  });
}

export function listCourseEpisodes(courseId) {
  return request(`academic-courses/${encodeURIComponent(courseId)}/episodes`, {
    query: { page: 1, pageSize: 100 },
  });
}

export function createCourseEpisode(courseId, body) {
  return request(`academic-courses/${encodeURIComponent(courseId)}/episodes`, {
    method: 'POST',
    body,
  });
}

export function updateCourseEpisode(courseId, episodeId, body) {
  return request(`academic-courses/${encodeURIComponent(courseId)}/episodes/${encodeURIComponent(episodeId)}`, {
    method: 'PUT',
    body,
  });
}

export function reorderCourseEpisodes(courseId, episodeIds) {
  return request(`academic-courses/${encodeURIComponent(courseId)}/episodes/reorder`, {
    method: 'PATCH',
    body: { episodeIds },
  });
}

export function deleteCourseEpisode(courseId, episodeId) {
  return request(`academic-courses/${encodeURIComponent(courseId)}/episodes/${encodeURIComponent(episodeId)}`, {
    method: 'DELETE',
  });
}
