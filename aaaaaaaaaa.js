// API Configuration
export const API_BASE_URL = process.env.API_BASE_URL || 'https://api.socialflow.com';
export const API_TIMEOUT = 30000;
export const API_RETRY_ATTEMPTS = 3;

// Application Constants
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'SocialFlow';

// Video Player Constants
export const VIDEO_QUALITIES = [
    { label: 'Auto', value: 'auto' },
    { label: '1080p', value: '1080p' },
    { label: '720p', value: '720p' },
    { label: '480p', value: '480p' },
    { label: '360p', value: '360p' }
];

export const VIDEO_PRELOAD_STRATEGIES = {
    NONE: 'none',
    METADATA: 'metadata',
    AUTO: 'auto'
};

// Storage Keys
export const STORAGE_KEYS = {
    USER: 'socialflow_user',
    TOKEN: 'socialflow_temp_token',
    LIKED_VIDEOS: 'socialflow_likedVideos',
    SAVED_VIDEOS: 'socialflow_savedVideos',
    MEDIA_INDEXES: 'socialflow_currentMediaIndexes',
    UI_SETTINGS: 'socialflow_ui',
    PENDING_ACTIONS: 'socialflow_pendingActions'
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    AUTH_FAILED: 'Authentication failed. Please try again.',
    VIDEO_LOAD_FAILED: 'Failed to load video. Please try again.',
    UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
    OFFLINE_MODE: 'You are currently offline. Some features may not be available.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    VIDEO_LIKED: 'Video liked successfully',
    VIDEO_SAVED: 'Video saved successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    SETTINGS_SAVED: 'Settings saved successfully'
};

// Theme Colors
export const THEME_COLORS = {
    LIGHT: {
        primary: '#ff2d55',
        secondary: '#5856d6',
        background: '#ffffff',
        card: '#f2f2f7',
        text: '#000000',
        textSecondary: '#8e8e93',
        border: '#c6c6c8'
    },
    DARK: {
        primary: '#ff2d55',
        secondary: '#5856d6',
        background: '#000000',
        card: '#1c1c1e',
        text: '#ffffff',
        textSecondary: '#8e8e93',
        border: '#2c2c2e'
    }
};

// Performance Constants
export const PERFORMANCE = {
    CACHE_TTL: 30000, // 30 seconds
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
    LAZY_LOAD_THRESHOLD: 0.1,
    MEMORY_THRESHOLD: 100 // MB
};

// Feature Flags
export const FEATURE_FLAGS = {
    VIRTUAL_SCROLLING: true,
    LAZY_LOADING: true,
    OFFLINE_MODE: true,
    PUSH_NOTIFICATIONS: false,
    ANALYTICS: true
};

// Navigation Routes
export const ROUTES = {
    HOME: 'home',
    EXPLORE: 'explore',
    PROFILE: 'profile',
    ANALYTICS: 'analytics',
    SETTINGS: 'settings'
};

// Social Media Platforms
export const SOCIAL_PLATFORMS = {
    FACEBOOK: 'facebook',
    TWITTER: 'twitter',
    INSTAGRAM: 'instagram',
    TIKTOK: 'tiktok',
    YOUTUBE: 'youtube'
};

// Export all constants
export default {
    API_BASE_URL,
    API_TIMEOUT,
    APP_VERSION,
    APP_NAME,
    VIDEO_QUALITIES,
    STORAGE_KEYS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    THEME_COLORS,
    PERFORMANCE,
    FEATURE_FLAGS,
    ROUTES,
    SOCIAL_PLATFORMS
};