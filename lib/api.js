const baseUrl =
  typeof window !== 'undefined' ? '/api' : process.env.NEXT_PUBLIC_API_URL || '/api';

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  } catch {
    throw new Error('Unable to connect. Please try again in a moment.');
  }

  const payload = response.status === 204 ? { success: true } : await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      'Request failed';
    throw new Error(message);
  }

  // Support both new { data } and legacy shapes
  if (payload?.data !== undefined) return payload;
  return payload;
}
