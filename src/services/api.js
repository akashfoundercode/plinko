// ============================================================================
// Production API Client (Fetch-based HTTP Client with Interceptors & Fallback)
// ============================================================================

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.wingo4all.site';

// Token management helper
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  // Priority: URL query param -> sessionStorage -> localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const queryToken = urlParams.get('token') || urlParams.get('auth_token');
  if (queryToken) {
    try {
      localStorage.setItem('auth_token', queryToken);
    } catch {}
    return queryToken;
  }
  try {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || null;
  } catch {
    return null;
  }
};

export const setAuthToken = (token) => {
  try {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  } catch {}
};

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
          token: token,
          'token-id': token,
          token_id: token,
        }
      : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // If HTTP error code returned from server
    if (!response.ok) {
      let errorBody = null;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText };
      }
      const err = new Error(errorBody?.message || `HTTP ${response.status} Error`);
      err.status = response.status;
      err.data = errorBody;
      throw err;
    }

    const data = await response.json();
    return { data, status: response.status, ok: true };
  } catch (error) {
    // If backend server is unreachable (e.g. connection refused / offline)
    // Mark as network/offline error
    return {
      data: null,
      error: error.message || 'Network request failed',
      status: error.status || 0,
      ok: false,
      isOffline: true,
    };
  }
}

export const api = {
  get: (endpoint, params = null, headers = {}) => {
    let url = endpoint;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    return request(url, { method: 'GET', headers });
  },

  post: (endpoint, body = {}, headers = {}) => {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  },

  put: (endpoint, body = {}, headers = {}) => {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers,
    });
  },

  delete: (endpoint, headers = {}) => {
    return request(endpoint, { method: 'DELETE', headers });
  },
};

export default api;
