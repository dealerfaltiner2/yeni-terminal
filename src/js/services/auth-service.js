/**
 * Authentication Service
 * Handle user authentication and authorization
 */

import { apiService } from './api-service.js';
import { serviceLogger } from '../utils/logger.js';
import { AuthError, ValidationError } from '../utils/error-handler.js';
import { storageService } from './storage-service.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.refreshTimer = null;
    this.listeners = [];
    this.loadFromStorage();
  }

  /**
   * Load auth from storage
   */
  loadFromStorage() {
    try {
      const saved = storageService.get('auth');
      if (saved) {
        this.currentUser = saved.user;
        this.token = saved.token;
        apiService.setAuthorization(this.token);
        this.startRefreshTimer();
      }
    } catch (error) {
      serviceLogger.debug('No saved auth found');
    }
  }

  /**
   * Register user
   */
  async register(email, password, name) {
    if (!email || !password || !name) {
      throw new ValidationError('Email, password, and name are required');
    }

    try {
      const data = await apiService.post('/auth/register', {
        email,
        password,
        name
      });

      this.setAuth(data.user, data.token);
      serviceLogger.info('User registered', { email });
      return data;
    } catch (error) {
      serviceLogger.error('Registration failed', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    try {
      const data = await apiService.post('/auth/login', {
        email,
        password
      });

      this.setAuth(data.user, data.token);
      serviceLogger.info('User logged in', { email });
      return data;
    } catch (error) {
      serviceLogger.error('Login failed', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await apiService.post('/auth/logout', {});
    } catch (error) {
      serviceLogger.warn('Logout API call failed', { error: error.message });
    } finally {
      this.clearAuth();
      serviceLogger.info('User logged out');
    }
  }

  /**
   * Refresh token
   */
  async refreshToken() {
    if (!this.token) {
      throw new AuthError('No token available');
    }

    try {
      const data = await apiService.post('/auth/refresh', {
        token: this.token
      });

      this.token = data.token;
      apiService.setAuthorization(this.token);
      storageService.set('auth', {
        user: this.currentUser,
        token: this.token
      });

      serviceLogger.debug('Token refreshed');
      return data.token;
    } catch (error) {
      this.clearAuth();
      serviceLogger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Set auth
   */
  setAuth(user, token) {
    this.currentUser = user;
    this.token = token;
    apiService.setAuthorization(token);
    storageService.set('auth', { user, token });
    this.startRefreshTimer();
    this.notifyListeners();
  }

  /**
   * Clear auth
   */
  clearAuth() {
    this.currentUser = null;
    this.token = null;
    apiService.setAuthorization(null);
    storageService.remove('auth');
    this.stopRefreshTimer();
    this.notifyListeners();
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.currentUser;
  }

  /**
   * Get token
   */
  getToken() {
    return this.token;
  }

  /**
   * Has permission
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    return this.currentUser.permissions && 
           this.currentUser.permissions.includes(permission);
  }

  /**
   * Has role
   */
  hasRole(role) {
    if (!this.currentUser) return false;
    return this.currentUser.role === role;
  }

  /**
   * Start refresh timer
   */
  startRefreshTimer() {
    this.stopRefreshTimer();
    // Refresh token every 55 minutes (assuming 1 hour expiry)
    this.refreshTimer = setInterval(() => {
      this.refreshToken().catch(() => {
        serviceLogger.warn('Automatic token refresh failed');
      });
    }, 55 * 60 * 1000);
  }

  /**
   * Stop refresh timer
   */
  stopRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Add listener
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Notify listeners
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentUser);
      } catch (error) {
        serviceLogger.error('Error in auth listener', { error: error.message });
      }
    });
  }

  /**
   * Update profile
   */
  async updateProfile(profileData) {
    if (!this.currentUser) {
      throw new AuthError('Not authenticated');
    }

    try {
      const data = await apiService.put('/auth/profile', profileData);
      this.currentUser = data.user;
      storageService.set('auth', {
        user: this.currentUser,
        token: this.token
      });
      this.notifyListeners();
      serviceLogger.info('Profile updated');
      return data;
    } catch (error) {
      serviceLogger.error('Failed to update profile', { error: error.message });
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(oldPassword, newPassword) {
    if (!oldPassword || !newPassword) {
      throw new ValidationError('Old and new passwords are required');
    }

    try {
      await apiService.post('/auth/change-password', {
        oldPassword,
        newPassword
      });
      serviceLogger.info('Password changed');
    } catch (error) {
      serviceLogger.error('Failed to change password', { error: error.message });
      throw error;
    }
  }
}

// Global auth service instance
const authService = new AuthService();

export { AuthService, authService };
