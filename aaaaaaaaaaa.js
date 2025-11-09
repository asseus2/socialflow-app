// Email validation
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Password validation
export const validatePassword = (password) => {
    return password && password.length >= 8;
};

// URL validation
export const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Phone number validation (basic)
export const validatePhone = (phone) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Username validation
export const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
};

// Video URL validation
export const validateVideoUrl = (url) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

// Image URL validation
export const validateImageUrl = (url) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
};

// File size validation
export const validateFileSize = (file, maxSizeMB) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
};

// File type validation
export const validateFileType = (file, allowedTypes) => {
    return allowedTypes.includes(file.type);
};

// Required field validation
export const validateRequired = (value) => {
    return value !== null && value !== undefined && value.toString().trim() !== '';
};

// Minimum length validation
export const validateMinLength = (value, minLength) => {
    return value && value.length >= minLength;
};

// Maximum length validation
export const validateMaxLength = (value, maxLength) => {
    return value && value.length <= maxLength;
};

// Number range validation
export const validateNumberRange = (value, min, max) => {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
};

// Date validation
export const validateDate = (date) => {
    return !isNaN(Date.parse(date));
};

// Credit card validation (Luhn algorithm)
export const validateCreditCard = (cardNumber) => {
    const sanitized = cardNumber.replace(/\s+/g, '');
    if (!/^\d+$/.test(sanitized)) return false;

    let sum = 0;
    let shouldDouble = false;
    
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i));
        
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    
    return sum % 10 === 0;
};

// CSV validation
export const validateCsv = (text) => {
    const lines = text.split('\n');
    if (lines.length < 2) return false;
    
    const header = lines[0].split(',');
    if (header.length === 0) return false;
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== header.length) return false;
    }
    
    return true;
};

// JSON validation
export const validateJson = (text) => {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
};

// Custom validator composition
export const createValidator = (validators) => {
    return (value) => {
        for (const validator of validators) {
            const result = validator(value);
            if (result !== true) {
                return result;
            }
        }
        return true;
    };
};

// Form validation
export const validateForm = (formData, rules) => {
    const errors = {};
    
    for (const [field, validators] of Object.entries(rules)) {
        const value = formData[field];
        
        for (const validator of validators) {
            const result = validator(value);
            if (result !== true) {
                errors[field] = result;
                break;
            }
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// Export all validators
export default {
    validateEmail,
    validatePassword,
    validateUrl,
    validatePhone,
    validateUsername,
    validateVideoUrl,
    validateImageUrl,
    validateFileSize,
    validateFileType,
    validateRequired,
    validateMinLength,
    validateMaxLength,
    validateNumberRange,
    validateDate,
    validateCreditCard,
    validateCsv,
    validateJson,
    createValidator,
    validateForm
};