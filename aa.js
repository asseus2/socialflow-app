import { validateEmail, validatePassword } from './utils/validators.js';
import { API_BASE_URL } from './utils/constants.js';

class SecureAuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.isDemoMode = false;
        this.tokenRefreshTimeout = null;
        this.abortController = new AbortController();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupAutoTokenRefresh();
    }

    async checkAuthStatus() {
        try {
            const token = sessionStorage.getItem('socialflow_temp_token');
            
            if (token && await this.validateToken(token)) {
                this.token = token;
                await this.fetchUserProfile();
            } else {
                await this.validateSession();
            }
        } catch (error) {
            await this.clearAuth();
            throw new Error('Auth check failed');
        }
    }

    async validateSession() {
        try {
            const response = await this.apiRequest('/auth/session', {
                method: 'GET',
                credentials: 'include',
                signal: this.abortController.signal
            });

            if (response.valid) {
                this.token = response.accessToken;
                this.user = response.user;
                sessionStorage.setItem('socialflow_temp_token', this.token);
            }
        } catch (error) {
            console.warn('Session validation failed:', error);
        }
    }

    async login(credentials) {
        try {
            this.validateCredentials(credentials);

            const response = await this.apiRequest('/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify(credentials),
                signal: this.abortController.signal
            });

            if (!response.success) {
                throw new Error('Authentication failed');
            }

            this.token = response.accessToken;
            this.user = response.user;
            
            sessionStorage.setItem('socialflow_temp_token', this.token);
            sessionStorage.setItem('socialflow_user', JSON.stringify(this.user));

            this.setupAutoTokenRefresh(response.expiresIn);
            
            this.logSecurityEvent('login_success', { userId: this.user.id });
            
            return response;

        } catch (error) {
            this.logSecurityEvent('login_failed', { error: error.message });
            await this.clearAuth();
            throw error;
        }
    }

    validateCredentials(credentials) {
        const errors = [];
        
        if (!credentials.email || !validateEmail(credentials.email)) {
            errors.push('Invalid email format');
        }
        
        if (!credentials.password || !validatePassword(credentials.password)) {
            errors.push('Password must be at least 8 characters');
        }

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    async validateToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;

            const payload = JSON.parse(atob(parts[1]));
            const now = Date.now() / 1000;
            
            if (payload.exp <= now) {
                await this.refreshToken();
                return false;
            }

            if (!payload.sub || !payload.iss) {
                return false;
            }

            return true;
        } catch {
            return false;
        }
    }

    async refreshToken() {
        try {
            const response = await this.apiRequest('/auth/refresh', {
                method: 'POST',
                credentials: 'include',
                signal: this.abortController.signal
            });

            this.token = response.accessToken;
            sessionStorage.setItem('socialflow_temp_token', this.token);
            
            this.setupAutoTokenRefresh(response.expiresIn);
            
            return true;
        } catch (error) {
            await this.clearAuth();
            throw error;
        }
    }

    setupAutoTokenRefresh(expiresIn = 300) {
        const refreshTime = (expiresIn - 60) * 1000;
        
        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }
        
        this.tokenRefreshTimeout = setTimeout(() => {
            this.refreshToken();
        }, refreshTime);
    }

    getCSRFToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    async clearAuth() {
        this.token = null;
        this.user = null;
        this.isDemoMode = false;

        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }

        this.abortController.abort();
        this.abortController = new AbortController();

        sessionStorage.removeItem('socialflow_temp_token');
        sessionStorage.removeItem('socialflow_user');
        localStorage.removeItem('demo_mode');

        try {
            await this.apiRequest('/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Logout request failed:', error);
        }

        this.logSecurityEvent('logout');
    }

    async enableDemoMode() {
        this.isDemoMode = true;
        this.user = {
            id: 'demo_user',
            name: 'Demo User',
            email: 'demo@socialflow.com',
            avatar: '/assets/demo-avatar.jpg'
        };
        localStorage.setItem('demo_mode', 'true');
        sessionStorage.setItem('socialflow_user', JSON.stringify(this.user));
        
        this.logSecurityEvent('demo_mode_enabled');
    }

    async fetchUserProfile() {
        try {
            const response = await this.apiRequest('/user/profile');
            this.user = { ...this.user, ...response.user };
            sessionStorage.setItem('socialflow_user', JSON.stringify(this.user));
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            throw error;
        }
    }

    logSecurityEvent(eventType, data = {}) {
        const event = {
            type: eventType,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            userId: this.user?.id,
            ...data
        };

        if (process.env.NODE_ENV === 'development') {
            console.log('Security Event:', event);
        }

        if (window.gtag) {
            gtag('event', 'security_event', {
                event_type: eventType,
                user_id: this.user?.id
            });
        }

        // Error reporting service
        if (window.Sentry && (eventType.includes('failed') || eventType.includes('error'))) {
            Sentry.addBreadcrumb({
                category: 'auth',
                message: eventType,
                data: event
            });
        }
    }

    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
                ...options.headers
            },
            signal: this.abortController.signal
        };

        const response = await fetch(`${API_BASE_URL}${url}`, {
            ...defaultOptions,
            ...options
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        return await response.json();
    }

    get isAuthenticated() {
        return !!(this.token || this.isDemoMode);
    }

    get userInfo() {
        return this.user;
    }

    cleanup() {
        this.abortController.abort();
        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }
    }
}

export { SecureAuthManager };