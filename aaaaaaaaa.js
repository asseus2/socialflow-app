// Format large numbers (like 1500 -> 1.5K)
export const formatCount = (count) => {
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
};

// Format timestamp to relative time
export const formatTime = (timestamp) => {
    if (!timestamp) return 'Bilinmiyor';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / (86400000 * 7));
    const months = Math.floor(diff / (86400000 * 30));
    
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    if (weeks < 4) return `${weeks} hafta önce`;
    if (months < 12) return `${months} ay önce`;
    
    return time.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Debounce function for performance
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Throttle function for performance
export const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Sanitize HTML to prevent XSS
export const sanitizeHTML = (strings, ...values) => {
    return strings.reduce((result, str, i) => {
        const value = values[i] ?? '';
        return result + str + escapeHTML(value);
    }, '');
};

// Escape HTML special characters
export const escapeHTML = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Generate unique ID
export const generateId = () => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Check if element is in viewport
export const isElementInViewport = (element) => {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
};

// Deep clone object
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Map) return new Map(obj);
    if (obj instanceof Set) return new Set(obj);
    
    const cloned = Array.isArray(obj) ? [] : {};
    
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    
    return cloned;
};

// Format file size
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Capitalize first letter
export const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Generate random number in range
export const randomInRange = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Check if touch device
export const isTouchDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Get device type
export const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
};

// Parse URL parameters
export const getUrlParams = () => {
    const params = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    for (const [key, value] of urlParams) {
        params[key] = value;
    }
    
    return params;
};

// Sleep function for async operations
export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Validate URL
export const isValidUrl = (string) => {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
};

// Group array by key
export const groupBy = (array, key) => {
    return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
};

// Remove duplicates from array
export const removeDuplicates = (array, key = null) => {
    if (key) {
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
    return [...new Set(array)];
};

// Check if object is empty
export const isEmpty = (obj) => {
    if (obj == null) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return !obj;
};

// Create a simple hash from string
export const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
};