export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';

const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function getAdminSessionCookieValue(request) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => {
    const separatorIndex = part.indexOf('=');
    return separatorIndex !== -1 && part.slice(0, separatorIndex) === ADMIN_SESSION_COOKIE_NAME;
  });

  return cookie ? cookie.slice(cookie.indexOf('=') + 1) : null;
}

export function getAdminSessionToken(request) {
  const token = getAdminSessionCookieValue(request);
  return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
}

function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
  };
}

export function setAdminSessionCookie(response, token) {
  return response.cookie(ADMIN_SESSION_COOKIE_NAME, token, getAdminSessionCookieOptions());
}

export function clearAdminSessionCookie(response) {
  return response.clearCookie(ADMIN_SESSION_COOKIE_NAME, getAdminSessionCookieOptions());
}
