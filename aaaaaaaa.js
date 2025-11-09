class ComprehensiveErrorBoundary {
    constructor() {
        this.isActive = false;
        this.componentHandlers = new Map();
        this.unhandledRejections = new Set();
        this.errorCount = 0;
        this.maxErrors = 10;
        this.errorWindow = 60000;
    }

    init() {
        if (this.isActive) return;

        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
        
        this.setupComponentErrorHandling();
        
        window.addEventListener('online', this.handleConnectivityChange.bind(this));
        window.addEventListener('offline', this.handleConnectivityChange.bind(this));

        this.isActive = true;
        console.log('Error Boundary initialized');
    }

    registerComponent(componentId, errorHandler, recoveryHandler = null) {
        this.componentHandlers.set(componentId, {
            errorHandler,
            recoveryHandler,
            errorCount: 0
        });

        return () => this.componentHandlers.delete(componentId);
    }

    handleComponentError(componentId, error, context = {}) {
        const component = this.componentHandlers.get(componentId);
        if (!component) {
            this.handleGlobalError({
                error,
                message: `Unhandled component error: ${componentId}`
            });
            return;
        }

        component.errorCount++;
        
        if (component.errorCount > 5) {
            console.warn(`Component ${componentId} error rate exceeded`);
            if (component.recoveryHandler) {
                component.recoveryHandler();
            }
            return;
        }

        try {
            component.errorHandler(error, context);
        } catch (handlerError) {
            console.error('Error handler failed:', handlerError);
            this.handleGlobalError({
                error: handlerError,
                message: `Error handler failed for component: ${componentId}`
            });
        }

        this.reportError(error, {
            type: 'component_error',
            componentId,
            ...context
        });
    }

    handleGlobalError(event) {
        event.preventDefault();
        
        const error = event.error || new Error(event.message);
        const context = {
            type: 'global_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        };

        if (this.shouldSuppressError()) {
            console.warn('Error suppressed due to rate limiting:', error);
            return false;
        }

        this.showError('Runtime Error', error, context);
        this.reportError(error, context);
        
        return false;
    }

    handlePromiseRejection(event) {
        event.preventDefault();
        
        if (this.unhandledRejections.has(event.reason)) {
            return false;
        }

        this.unhandledRejections.add(event.reason);
        setTimeout(() => {
            this.unhandledRejections.delete(event.reason);
        }, 1000);

        const error = event.reason instanceof Error ? 
            event.reason : 
            new Error(`Promise rejected: ${String(event.reason)}`);

        const context = {
            type: 'promise_rejection',
            reason: event.reason
        };

        if (this.shouldSuppressError()) {
            console.warn('Promise rejection suppressed:', error);
            return false;
        }

        this.showError('Promise Rejection', error, context);
        this.reportError(error, context);
        
        return false;
    }

    handleConnectivityChange(event) {
        const isOnline = navigator.onLine;
        
        if (!isOnline) {
            const error = new Error('Network connectivity lost');
            this.showError(
                'Connection Lost', 
                error, 
                { type: 'network_error', online: false }
            );
        } else {
            this.hideError();
            this.reportRecovery('network_recovered');
        }
    }

    shouldSuppressError() {
        const now = Date.now();
        this.errorCount++;
        
        setTimeout(() => {
            this.errorCount = Math.max(0, this.errorCount - 1);
        }, this.errorWindow);

        return this.errorCount > this.maxErrors;
    }

    showError(title, error, context = {}) {
        if (!this.isActive) return;
        
        const errorDetails = this.sanitizeError(error, context);
        const errorBoundary = document.getElementById('errorBoundary');
        
        if (!errorBoundary) {
            console.error('Error boundary element not found');
            return;
        }

        try {
            const errorTitle = errorBoundary.querySelector('.error-title');
            const errorMessage = errorBoundary.querySelector('.error-message');
            const errorDetailsEl = errorBoundary.querySelector('.error-details');
            
            if (errorTitle) errorTitle.textContent = title;
            if (errorMessage) errorMessage.textContent = error.message || 'An unexpected error occurred';
            if (errorDetailsEl) {
                errorDetailsEl.textContent = errorDetails;
                errorDetailsEl.style.display = process.env.NODE_ENV === 'development' ? 'block' : 'none';
            }

            errorBoundary.classList.add('active');
            errorBoundary.setAttribute('aria-hidden', 'false');
            
            errorBoundary.focus();
            
            console.error(`Error Boundary: ${title}`, error, context);

        } catch (uiError) {
            console.error('Failed to display error UI:', uiError);
        }
    }

    hideError() {
        const errorBoundary = document.getElementById('errorBoundary');
        if (errorBoundary) {
            errorBoundary.classList.remove('active');
            errorBoundary.setAttribute('aria-hidden', 'true');
        }
    }

    sanitizeError(error, context = {}) {
        if (process.env.NODE_ENV === 'production') {
            const safeError = {
                name: error.name,
                message: error.message,
                component: context.componentId,
                type: context.type,
                timestamp: new Date().toISOString()
            };
            
            return JSON.stringify(safeError, null, 2);
        }
        
        return JSON.stringify({
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...context,
            timestamp: new Date().toISOString()
        }, null, 2);
    }

    setupComponentErrorHandling() {
        const originalCreateElement = document.createElement;
        
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            
            if (['VIDEO', 'IMG', 'IFRAME'].includes(tagName)) {
                const originalSetAttribute = element.setAttribute;
                element.setAttribute = function(name, value) {
                    try {
                        originalSetAttribute.call(this, name, value);
                    } catch (error) {
                        window.errorBoundary?.handleComponentError(
                            `element_${tagName.toLowerCase()}`,
                            error,
                            { operation: 'setAttribute', name, value }
                        );
                    }
                };
            }
            
            return element;
        };
    }

    reportError(error, context = {}) {
        const errorReport = {
            type: 'error_report',
            error: {
                name: error.name,
                message: error.message,
                stack: this.sanitizeStack(error.stack)
            },
            context: this.sanitizeContext(context),
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize
            } : null
        };

        if (window.gtag) {
            gtag('event', 'exception', {
                description: error.message,
                fatal: context.type !== 'network_error',
                ...context
            });
        }

        if (window.Sentry) {
            Sentry.withScope(scope => {
                scope.setExtras(context);
                Sentry.captureException(error);
            });
        }

        this.sendErrorReport(errorReport).catch(console.error);

        console.error('Error reported:', errorReport);
    }

    reportRecovery(type, data = {}) {
        const recoveryReport = {
            type: 'recovery_report',
            recoveryType: type,
            timestamp: new Date().toISOString(),
            ...data
        };

        if (window.gtag) {
            gtag('event', 'recovery', recoveryReport);
        }

        console.log('Recovery reported:', recoveryReport);
    }

    sanitizeStack(stack) {
        if (!stack) return null;
        
        if (process.env.NODE_ENV === 'production') {
            return stack.split('\n')
                .map(line => line.replace(/\(.*[\/\\]([^\/\\]+)\)/, '($1)'))
                .join('\n');
        }
        
        return stack;
    }

    sanitizeContext(context) {
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
        const sanitized = { ...context };
        
        sensitiveKeys.forEach(key => {
            if (sanitized[key]) {
                sanitized[key] = '***REDACTED***';
            }
        });
        
        return sanitized;
    }

    async sendErrorReport(errorReport) {
        try {
            await fetch('/api/error-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(errorReport)
            });
        } catch (error) {
            console.warn('Error report sending failed:', error);
        }
    }

    async recoverComponent(componentId) {
        const component = this.componentHandlers.get(componentId);
        if (component?.recoveryHandler) {
            try {
                await component.recoveryHandler();
                component.errorCount = 0;
                this.reportRecovery('component_recovered', { componentId });
                return true;
            } catch (error) {
                console.error(`Component recovery failed for ${componentId}:`, error);
                return false;
            }
        }
        return false;
    }

    cleanup() {
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
        window.removeEventListener('online', this.handleConnectivityChange);
        window.removeEventListener('offline', this.handleConnectivityChange);
        
        this.componentHandlers.clear();
        this.unhandledRejections.clear();
        this.isActive = false;
    }
}

export { ComprehensiveErrorBoundary };