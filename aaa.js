import { SecureAuthManager } from './auth-manager.js';
import { ImmutableStateManager } from './state-manager.js';
import { AdvancedVideoPlayer } from './video-player.js';
import { ComprehensiveErrorBoundary } from './error-boundary.js';
import { 
    formatCount, 
    formatTime, 
    debounce, 
    throttle,
    sanitizeHTML,
    escapeHTML,
    generateId,
    isElementInViewport
} from './utils/helpers.js';

class SocialFlowApp {
    constructor() {
        this.stateManager = new ImmutableStateManager();
        this.errorBoundary = new ComprehensiveErrorBoundary();
        this.authManager = new SecureAuthManager();
        
        this.videoPlayers = new Map();
        this.currentPage = 'home';
        this.isInitialized = false;
        this.eventListeners = new Map();
        this.abortController = new AbortController();
        
        this.performance = {
            navigationStart: performance.now(),
            timeToInteractive: null
        };

        this.virtualScroll = {
            container: null,
            itemHeight: 300,
            buffer: 5,
            visibleItems: new Set()
        };
    }

    async init() {
        try {
            this.performance.appStart = performance.now();
            
            this.errorBoundary.init();
            this.setupGlobalErrorHandling();
            
            await Promise.all([
                this.stateManager.init(),
                this.authManager.init()
            ]);
            
            this.setupEventListeners();
            this.setupPerformanceOptimizations();
            this.initializeUI();
            this.setupServiceWorker();
            
            this.isInitialized = true;
            this.performance.timeToInteractive = performance.now();
            
            this.logEvent('app_initialized', {
                loadTime: this.performance.timeToInteractive - this.performance.navigationStart
            });
            
            console.log('SocialFlow App initialized successfully');
            
        } catch (error) {
            this.errorBoundary.handleGlobalError({ error });
            throw error;
        }
    }

    setupGlobalErrorHandling() {
        this.errorBoundary.registerComponent(
            'video_player',
            (error, context) => this.handleVideoError(error, context),
            () => this.recoverVideoPlayers()
        );

        this.errorBoundary.registerComponent(
            'state_manager',
            (error, context) => this.handleStateError(error, context),
            () => this.recoverStateManager()
        );

        window.addEventListener('error', (event) => {
            this.errorBoundary.handleGlobalError(event);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.errorBoundary.handlePromiseRejection(event);
        });
    }

    setupEventListeners() {
        const signal = this.abortController.signal;

        this.addEventListener('click', '[data-page]', (e) => {
            const page = e.currentTarget.dataset.page;
            this.switchPage(page);
        }, { signal });

        this.addEventListener('click', '#themeToggle', () => {
            this.toggleTheme();
        }, { signal });

        this.addEventListener('click', '#demoLogin', () => {
            this.authManager.enableDemoMode();
            this.initializeUI();
        }, { signal });

        this.addEventListener('click', '[data-video-action]', (e) => {
            const action = e.currentTarget.dataset.videoAction;
            const videoId = e.currentTarget.dataset.videoId;
            this.handleVideoAction(action, videoId);
        }, { signal });

        this.addEventListener(document, 'visibilitychange', () => {
            this.handleVisibilityChange();
        }, { signal });

        this.addEventListener(window, 'resize', 
            throttle(() => this.handleResize(), 250), 
            { signal }
        );

        this.stateManager.subscribe('videos', (videos) => {
            this.handleVideosUpdate(videos);
        });

        this.stateManager.subscribe('online', (online) => {
            this.handleOnlineStatus(online);
        });
    }

    addEventListener(target, event, handler, options = {}) {
        const actualTarget = typeof target === 'string' ? 
            document : target;
        
        actualTarget.addEventListener(event, handler, options);
        
        const key = `${event}_${handler.name}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        this.eventListeners.get(key).push({ target: actualTarget, event, handler });
    }

    setupPerformanceOptimizations() {
        this.setupVirtualScrolling();
        this.prefetchResources();
        this.setupMemoryMonitoring();
        this.setupLazyLoading();
    }

    setupVirtualScrolling() {
        this.virtualScroll.container = document.getElementById('videoFeed');
        
        if (this.virtualScroll.container) {
            this.addEventListener(this.virtualScroll.container, 'scroll',
                throttle(() => this.renderVisibleVideos(), 100)
            );
        }
    }

    renderVisibleVideos() {
        if (!this.virtualScroll.container) return;

        const scrollTop = this.virtualScroll.container.scrollTop;
        const containerHeight = this.virtualScroll.container.clientHeight;
        
        const startIdx = Math.max(0, Math.floor(scrollTop / this.virtualScroll.itemHeight) - this.virtualScroll.buffer);
        const endIdx = Math.min(
            this.stateManager.state.videos.size,
            startIdx + Math.ceil(containerHeight / this.virtualScroll.itemHeight) + this.virtualScroll.buffer * 2
        );

        this.renderVideoRange(startIdx, endIdx);
    }

    renderVideoRange(startIdx, endIdx) {
        const videos = Array.from(this.stateManager.state.videos.values())
            .slice(startIdx, endIdx);
        
        const feed = document.getElementById('videoFeed');
        if (!feed) return;

        const fragment = document.createDocumentFragment();
        
        videos.forEach((video, relativeIndex) => {
            const absoluteIndex = startIdx + relativeIndex;
            const element = this.createVideoElement(video, absoluteIndex);
            fragment.appendChild(element);
        });

        feed.innerHTML = '';
        feed.appendChild(fragment);

        this.initializeVideoPlayers();
    }

    setupLazyLoading() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const videoContainer = entry.target;
                    this.loadVideoContent(videoContainer);
                    observer.unobserve(videoContainer);
                }
            });
        }, { 
            rootMargin: '100px 0px',
            threshold: 0.1 
        });

        document.querySelectorAll('.video-container').forEach(container => {
            observer.observe(container);
        });
    }

    async initializeUI() {
        if (this.authManager.isAuthenticated || this.authManager.isDemoMode) {
            await this.showMainApp();
        } else {
            this.showWelcomeScreen();
        }

        const savedTheme = this.stateManager.state.ui.theme;
        this.setTheme(savedTheme || 'dark');
    }

    async showMainApp() {
        try {
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('mainHeader').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('bottomNav').style.display = 'flex';
            
            await this.loadCurrentPage();
            
        } catch (error) {
            this.errorBoundary.handleComponentError('ui_manager', error, {
                operation: 'showMainApp'
            });
        }
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'flex';
        document.getElementById('mainHeader').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('bottomNav').style.display = 'none';
    }

    async switchPage(page) {
        if (this.currentPage === page) return;
        
        this.logEvent('page_navigation', {
            from: this.currentPage,
            to: page
        });

        await this.cleanupPage(this.currentPage);
        
        this.currentPage = page;
        await this.loadCurrentPage();
    }

    async loadCurrentPage() {
        try {
            switch (this.currentPage) {
                case 'home':
                    await this.loadHomePage();
                    break;
                case 'explore':
                    await this.loadExplorePage();
                    break;
                case 'profile':
                    await this.loadProfilePage();
                    break;
                case 'analytics':
                    await this.loadAnalyticsPage();
                    break;
            }
        } catch (error) {
            this.errorBoundary.handleComponentError('page_loader', error, {
                page: this.currentPage
            });
        }
    }

    async loadHomePage() {
        const videos = await this.stateManager.getVideos();
        this.renderVideoFeed(videos);
    }

    renderVideoFeed(videos) {
        const feed = document.getElementById('videoFeed');
        if (!feed) return;

        const visibleVideos = Array.from(videos.values()).slice(0, 10);
        
        feed.innerHTML = visibleVideos.map((video, index) => 
            this.createVideoElement(video, index)
        ).join('');

        this.initializeVideoPlayers();
    }

    createVideoElement(video, index) {
        return sanitizeHTML`
            <div class="video-container" data-video-id="${video.id}" data-video-index="${index}">
                <div class="video-player-container">
                    ${this.createMediaGallery(video)}
                    <div class="video-overlay">
                        <div class="video-caption">${video.caption}</div>
                        <div class="video-stats">
                            <span>${formatCount(video.likes)} beğeni</span>
                            <span>${formatTime(video.timestamp)}</span>
                        </div>
                    </div>
                    <div class="video-actions">
                        <button class="btn" data-video-action="like" data-video-id="${video.id}">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="btn" data-video-action="share" data-video-id="${video.id}">
                            <i class="fas fa-share"></i>
                        </button>
                        <button class="btn" data-video-action="save" data-video-id="${video.id}">
                            <i class="fas fa-bookmark"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createMediaGallery(video) {
        const currentIndex = this.stateManager.getCurrentMediaIndex(video.id);
        
        return sanitizeHTML`
            <div class="media-gallery">
                <div class="media-container" style="transform: translateX(-${currentIndex * 100}%)">
                    ${video.media.map((media, mediaIndex) => `
                        <div class="media-item ${mediaIndex === currentIndex ? 'active' : ''}">
                            ${media.type === 'video' ? 
                                `<video data-src="${escapeHTML(media.url)}" preload="none" playsinline muted></video>` :
                                `<img data-src="${escapeHTML(media.thumbnail)}" alt="${escapeHTML(video.caption)}" loading="lazy">`
                            }
                        </div>
                    `).join('')}
                </div>
                ${video.media.length > 1 ? this.createGalleryControls(video, currentIndex) : ''}
            </div>
        `;
    }

    createGalleryControls(video, currentIndex) {
        return sanitizeHTML`
            <div class="gallery-controls">
                <div class="gallery-indicator">
                    ${video.media.map((_, i) => `
                        <button class="indicator-dot ${i === currentIndex ? 'active' : ''}" 
                                onclick="app.switchMedia('${video.id}', ${i})"
                                aria-label="${i + 1}. medyaya geç">
                        </button>
                    `).join('')}
                </div>
                <div class="media-count">
                    ${currentIndex + 1} / ${video.media.length}
                </div>
            </div>
        `;
    }

    initializeVideoPlayers() {
        document.querySelectorAll('.video-container').forEach(container => {
            const videoId = container.dataset.videoId;
            
            if (!this.videoPlayers.has(videoId)) {
                try {
                    const player = new AdvancedVideoPlayer(container);
                    this.videoPlayers.set(videoId, player);
                    
                    player.onLoad((loadTime) => {
                        this.logEvent('video_load', {
                            videoId,
                            loadTime,
                            success: true
                        });
                    });
                    
                } catch (error) {
                    this.errorBoundary.handleComponentError('video_player', error, {
                        videoId,
                        operation: 'initialization'
                    });
                }
            }
        });
    }

    async switchMedia(videoId, mediaIndex) {
        try {
            this.stateManager.setCurrentMediaIndex(videoId, mediaIndex);
            
            const player = this.videoPlayers.get(videoId);
            if (player) {
                await player.switchMedia(mediaIndex);
            }
            
            this.updateGalleryUI(videoId, mediaIndex);
        } catch (error) {
            this.errorBoundary.handleComponentError('video_player', error, {
                videoId,
                operation: 'switchMedia'
            });
        }
    }

    updateGalleryUI(videoId, mediaIndex) {
        const container = document.querySelector(`[data-video-id="${videoId}"]`);
        if (!container) return;

        const mediaContainer = container.querySelector('.media-container');
        const indicators = container.querySelectorAll('.indicator-dot');
        const mediaCount = container.querySelector('.media-count');

        if (mediaContainer) {
            mediaContainer.style.transform = `translateX(-${mediaIndex * 100}%)`;
        }

        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === mediaIndex);
        });

        if (mediaCount) {
            mediaCount.textContent = `${mediaIndex + 1} / ${indicators.length}`;
        }
    }

    async handleVideoAction(action, videoId) {
        try {
            switch (action) {
                case 'like':
                    const liked = await this.stateManager.likeVideo(videoId);
                    this.logEvent('video_like', { videoId, liked });
                    this.showToast(liked ? 'Beğenildi' : 'Beğeni kaldırıldı');
                    break;
                    
                case 'share':
                    await this.shareVideo(videoId);
                    break;
                    
                case 'save':
                    await this.saveVideo(videoId);
                    break;
            }
        } catch (error) {
            this.errorBoundary.handleComponentError('video_action', error, {
                action,
                videoId
            });
        }
    }

    async shareVideo(videoId) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'SocialFlow Video',
                    text: 'Bu videoyu SocialFlow\'da izle!',
                    url: `${window.location.origin}/video/${videoId}`
                });
                this.logEvent('video_share', { videoId, method: 'native' });
            } catch (error) {
                console.log('Share cancelled');
            }
        } else {
            this.fallbackShare(videoId);
        }
    }

    fallbackShare(videoId) {
        const url = `${window.location.origin}/video/${videoId}`;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('Link kopyalandı!');
            this.logEvent('video_share', { videoId, method: 'clipboard' });
        });
    }

    async saveVideo(videoId) {
        this.showToast('Video kaydedildi!');
        this.logEvent('video_save', { videoId });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    handleVideoError(error, context) {
        console.error('Video error:', error, context);
        
        if (context.videoId) {
            const player = this.videoPlayers.get(context.videoId);
            if (player) {
                player.destroy();
                this.videoPlayers.delete(context.videoId);
            }
        }
    }

    async recoverVideoPlayers() {
        this.videoPlayers.forEach(player => player.destroy());
        this.videoPlayers.clear();
        this.initializeVideoPlayers();
    }

    handleStateError(error, context) {
        console.error('State error:', error, context);
        
        this.stateManager.setState({
            videos: new Map(),
            likedVideos: new Set(),
            savedVideos: new Set()
        });
    }

    async recoverStateManager() {
        await this.stateManager.init();
        await this.loadCurrentPage();
    }

    handleVideosUpdate(videos) {
        if (this.currentPage === 'home') {
            this.renderVideoFeed(videos);
        }
    }

    handleOnlineStatus(online) {
        if (online) {
            this.showToast('Çevrimiçi');
            this.stateManager.syncPendingActions();
        } else {
            this.showToast('Çevrimdışı mod');
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.pauseAllVideos();
            this.stateManager.saveToStorageDebounced();
        } else {
            this.resumeVideos();
        }
    }

    handleResize() {
        this.renderVisibleVideos();
    }

    pauseAllVideos() {
        this.videoPlayers.forEach(player => {
            player.pause();
        });
    }

    resumeVideos() {
        this.videoPlayers.forEach((player, videoId) => {
            const container = document.querySelector(`[data-video-id="${videoId}"]`);
            if (container && isElementInViewport(container)) {
                player.play().catch(console.error);
            }
        });
    }

    toggleTheme() {
        const currentTheme = this.stateManager.state.ui.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.setTheme(newTheme);
        this.stateManager.setState({
            ui: { ...this.stateManager.state.ui, theme: newTheme }
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        if (theme === 'dark') {
            document.documentElement.style.setProperty('--bg-dark', '#000000');
            document.documentElement.style.setProperty('--bg-card', '#1c1c1e');
            document.documentElement.style.setProperty('--text-light', '#ffffff');
        } else {
            document.documentElement.style.setProperty('--bg-dark', '#ffffff');
            document.documentElement.style.setProperty('--bg-card', '#f2f2f7');
            document.documentElement.style.setProperty('--text-light', '#000000');
        }
    }

    prefetchResources() {
        const links = [
            { rel: 'preconnect', href: 'https://api.socialflow.com' },
            { rel: 'dns-prefetch', href: 'https://cdn.socialflow.com' }
        ];

        links.forEach(link => {
            const element = document.createElement('link');
            Object.assign(element, link);
            document.head.appendChild(element);
        });
    }

    setupMemoryMonitoring() {
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                const usedMB = memory.usedJSHeapSize / 1048576;
                
                if (usedMB > 100) {
                    this.logEvent('high_memory_usage', { usedMB });
                    
                    if (usedMB > 200) {
                        this.cleanupUnusedResources();
                    }
                }
            }, 30000);
        }
    }

    cleanupUnusedResources() {
        this.videoPlayers.forEach((player, videoId) => {
            const container = document.querySelector(`[data-video-id="${videoId}"]`);
            if (!container || !isElementInViewport(container)) {
                player.destroy();
                this.videoPlayers.delete(videoId);
            }
        });

        this.stateManager.invalidateCache('videos');
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        }
    }

    async cleanupPage(page) {
        switch (page) {
            case 'home':
                this.pauseAllVideos();
                break;
        }
    }

    logEvent(eventName, data = {}) {
        const event = {
            name: eventName,
            timestamp: new Date().toISOString(),
            ...data
        };

        if (window.gtag) {
            gtag('event', eventName, data);
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('App Event:', event);
        }
    }

    async cleanup() {
        this.videoPlayers.forEach(player => player.destroy());
        this.videoPlayers.clear();

        this.stateManager.cleanup();
        this.authManager.cleanup();
        this.errorBoundary.cleanup();

        this.eventListeners.forEach((listeners, key) => {
            listeners.forEach(({ target, event, handler }) => {
                target.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();

        this.abortController.abort();

        this.logEvent('app_cleanup');
    }
}

// Global app instance
window.app = new SocialFlowApp();
window.errorBoundary = window.app.errorBoundary;

// Initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app.init().catch(console.error);
    });
} else {
    window.app.init().catch(console.error);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.app.cleanup();
});

export { SocialFlowApp };