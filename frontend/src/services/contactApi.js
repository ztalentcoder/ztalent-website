const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export async function submitContactMessage(payload) {
  const response = await fetch(`${apiBaseUrl}/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Error responses without JSON are handled by status below.
  }

  return { status: response.status, body };
}
