// ============================================================================
// Auth Service (Authentication & Token Management)
// ============================================================================

import api, { setAuthToken } from './api';

export const authService = {
  /**
   * User Login
   * POST /api/login
   * Payload: { mobile, country_code, password }
   */
  async login({ mobile = '1234567890', country_code = '91', password = '12345678' }) {
    const payload = {
      mobile: String(mobile).trim(),
      country_code: String(country_code).trim(),
      password: String(password).trim(),
    };

    const res = await api.post('/api/login', payload);

    if (res.ok && res.data) {
      const data = res.data;
      // Extract bearer token from response (support all backend schema variations)
      const token =
        data.token ||
        data.data?.token ||
        data.login_token ||
        data.access_token ||
        data.data?.access_token ||
        (typeof data.data === 'string' ? data.data : null);

      if (token) {
        setAuthToken(token);
        try {
          if (data.login_token) localStorage.setItem('login_token', data.login_token);
          const profile = typeof data.data === 'object' && data.data ? { ...data.data } : {};
          const userWallet = data.total_wallet !== undefined ? data.total_wallet : data.wallet;
          if (userWallet !== undefined) {
            profile.total_wallet = Number(userWallet);
            profile.wallet = Number(userWallet);
          }
          localStorage.setItem('user_profile', JSON.stringify(profile));
        } catch {}
      }

      return {
        success: true,
        token,
        wallet: data.total_wallet !== undefined ? data.total_wallet : data.wallet,
        winningWallet: data.winning_wallet || 0,
        user: data.data || {
          username: 'User_' + mobile.slice(-4),
          mobile,
          id: data.id || 1,
        },
        message: data.message || 'Login successful',
        raw: data,
      };
    }

    return {
      success: false,
      error: res.error || res.data?.message || 'Login failed. Please check credentials.',
    };
  },

  /**
   * Logout user
   */
  logout() {
    setAuthToken(null);
    try {
      localStorage.removeItem('login_token');
      localStorage.removeItem('user_profile');
    } catch {}
  },

  /**
   * Check if user has active auth token
   */
  isAuthenticated() {
    try {
      return Boolean(localStorage.getItem('auth_token'));
    } catch {
      return false;
    }
  },

  /**
   * Get cached user profile
   */
  getCachedUser() {
    try {
      const raw = localStorage.getItem('user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

export default authService;
