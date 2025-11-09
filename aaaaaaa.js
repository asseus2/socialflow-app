import { throttle } from './utils/helpers.js';

class AdvancedVideoPlayer {
    constructor(container) {
        this.container = container;
        this.videoId = container.dataset.videoId;
        this.mediaElements = [];
        this.currentMediaIndex = 0;
        this.isPlaying = false;
        this.isLoading = false;
        this.intersectionObserver = null;
        this.visibilityObserver = null;
        this.performanceObserver = null;
        this.eventListeners = new Map();
        this.loadCallbacks = new Set();
        this.playPromise = null;
        
        this.performanceMetrics = {
            loadTime: 0,
            playTime: 0,
            bufferingTime: 0,
            errors: []
        };

        this.init();
    }

    async init() {
        try {
            this.setupMediaElements();
            this.setupEventListeners();
            this.setupObservers();
            this.setupPreloadStrategy();
            await this.setupPerformanceMonitoring();
        } catch (error) {
            console.error(`VideoPlayer init failed for ${this.videoId}:`, error);
            this.handleError(error);
        }
    }

    setupMediaElements() {
        this.mediaElements = Array.from(this.container.querySelectorAll('video, img'));
        
        this.mediaElements.forEach((media, index) => {
            if (media.tagName === 'VIDEO') {
                this.setupVideoElement(media, index);
            } else {
                this.setupImageElement(media, index);
            }
        });
    }

    setupVideoElement(video, index) {
        video.preload = 'none';
        video.playsInline = true;
        video.muted = true;
        video.disablePictureInPicture = true;
        video.loading = 'lazy';
        
        video.setAttribute('decoding', 'async');
        video.setAttribute('importance', 'low');
        
        const events = {
            loadstart: this.handleLoadStart.bind(this, index),
            canplay: this.handleCanPlay.bind(this, index),
            playing: this.handlePlaying.bind(this, index),
            pause: this.handlePause.bind(this, index),
            ended: this.handleEnded.bind(this, index),
            error: this.handleError.bind(this, index),
            waiting: this.handleWaiting.bind(this, index),
            progress: this.handleProgress.bind(this, index)
        };

        Object.entries(events).forEach(([event, handler]) => {
            video.addEventListener(event, handler);
            this.trackEventListener(video, event, handler);
        });
    }

    setupImageElement(img, index) {
        img.loading = 'lazy';
        img.decoding = 'async';
        
        const events = {
            load: this.handleImageLoad.bind(this, index),
            error: this.handleError.bind(this, index)
        };

        Object.entries(events).forEach(([event, handler]) => {
            img.addEventListener(event, handler);
            this.trackEventListener(img, event, handler);
        });
    }

    trackEventListener(element, event, handler) {
        const key = `${event}_${this.videoId}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        this.eventListeners.get(key).push({ element, event, handler });
    }

    setupObservers() {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.handleVisible();
                    } else {
                        this.handleHidden();
                    }
                });
            },
            { 
                threshold: 0.5,
                rootMargin: '50% 0% 50% 0%'
            }
        );

        this.intersectionObserver.observe(this.container);

        this.visibilityObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.intersectionRatio < 0.1) {
                        this.pause();
                    }
                });
            },
            { threshold: [0.1] }
        );

        this.visibilityObserver.observe(this.container);
    }

    async setupPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.entryType === 'resource' && entry.name.includes(this.videoId)) {
                        this.performanceMetrics.loadTime = entry.duration;
                    }
                });
            });

            this.performanceObserver.observe({ entryTypes: ['resource', 'navigation'] });
        }
    }

    setupPreloadStrategy() {
        if (!navigator.connection) return;

        const connection = navigator.connection;
        const currentMedia = this.mediaElements[this.currentMediaIndex];
        
        if (!currentMedia) return;

        let preloadStrategy = 'metadata';
        
        if (connection.saveData) {
            preloadStrategy = 'none';
        } else {
            switch (connection.effectiveType) {
                case 'slow-2g':
                case '2g':
                    preloadStrategy = 'none';
                    break;
                case '3g':
                    preloadStrategy = 'metadata';
                    break;
                case '4g':
                    preloadStrategy = 'auto';
                    break;
            }
        }

        if (currentMedia.tagName === 'VIDEO') {
            currentMedia.preload = preloadStrategy;
        }

        if (preloadStrategy === 'auto') {
            this.preloadAdjacentMedia();
        }
    }

    preloadAdjacentMedia() {
        const adjacentIndexes = [
            this.currentMediaIndex - 1,
            this.currentMediaIndex + 1
        ].filter(index => index >= 0 && index < this.mediaElements.length);

        adjacentIndexes.forEach(index => {
            const media = this.mediaElements[index];
            if (media.dataset.src && !media.src) {
                media.src = media.dataset.src;
                delete media.dataset.src;
            }
        });
    }

    async load() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const startTime = performance.now();

        try {
            const currentMedia = this.mediaElements[this.currentMediaIndex];
            if (!currentMedia) return;

            if (currentMedia.dataset.src && !currentMedia.src) {
                currentMedia.src = currentMedia.dataset.src;
                delete currentMedia.dataset.src;

                if (currentMedia.tagName === 'VIDEO') {
                    await currentMedia.load();
                }
            }

            this.performanceMetrics.loadTime = performance.now() - startTime;
            
            this.loadCallbacks.forEach(callback => {
                try {
                    callback(this.performanceMetrics.loadTime);
                } catch (error) {
                    console.error('Load callback error:', error);
                }
            });

        } catch (error) {
            this.handleError(error);
        } finally {
            this.isLoading = false;
        }
    }

    async play() {
        if (this.isPlaying) return;

        const currentMedia = this.mediaElements[this.currentMediaIndex];
        if (!currentMedia || currentMedia.tagName !== 'VIDEO') return;

        try {
            if (this.playPromise) {
                this.playPromise.catch(() => {});
                this.playPromise = null;
            }

            this.playPromise = currentMedia.play();
            await this.playPromise;
            
            this.isPlaying = true;
            this.performanceMetrics.playTime = performance.now();

        } catch (error) {
            console.error('Video play failed:', error);
            this.handleError(error);
            throw error;
        } finally {
            this.playPromise = null;
        }
    }

    pause() {
        if (!this.isPlaying) return;

        const currentMedia = this.mediaElements[this.currentMediaIndex];
        if (currentMedia?.tagName === 'VIDEO') {
            currentMedia.pause();
            this.isPlaying = false;
        }

        if (this.playPromise) {
            this.playPromise.catch(() => {});
            this.playPromise = null;
        }
    }

    async switchMedia(index) {
        if (index === this.currentMediaIndex || index < 0 || index >= this.mediaElements.length) {
            return;
        }

        this.pause();
        this.currentMediaIndex = index;
        await this.load();

        if (this.isPlaying) {
            await this.play();
        }
    }

    handleLoadStart(index) {
        this.performanceMetrics.loadStartTime = performance.now();
    }

    handleCanPlay(index) {
        const loadTime = performance.now() - this.performanceMetrics.loadStartTime;
        this.performanceMetrics.loadTime = loadTime;
    }

    handlePlaying(index) {
        this.isPlaying = true;
        this.performanceMetrics.bufferingTime = 0;
    }

    handlePause(index) {
        this.isPlaying = false;
    }

    handleEnded(index) {
        this.isPlaying = false;
        
        const nextIndex = this.currentMediaIndex + 1;
        if (nextIndex < this.mediaElements.length) {
            this.switchMedia(nextIndex);
        }
    }

    handleWaiting(index) {
        this.performanceMetrics.bufferingTime = 
            (this.performanceMetrics.bufferingTime || 0) + 1;
    }

    handleProgress(index) {
        const video = this.mediaElements[index];
        if (video?.buffered?.length > 0) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const duration = video.duration;
            
            if (duration > 0) {
                const bufferedPercentage = (bufferedEnd / duration) * 100;
                this.emit('bufferprogress', { percentage: bufferedPercentage });
            }
        }
    }

    handleImageLoad(index) {
        this.performanceMetrics.loadTime = performance.now() - this.performanceMetrics.loadStartTime;
    }

    handleError(index, error) {
        const errorEvent = {
            type: 'media_error',
            videoId: this.videoId,
            mediaIndex: index,
            error: error.message || 'Unknown media error',
            timestamp: new Date().toISOString()
        };

        this.performanceMetrics.errors.push(errorEvent);
        
        console.error('Media error:', errorEvent);
        
        if (index === this.currentMediaIndex && this.mediaElements.length > 1) {
            const nextIndex = (index + 1) % this.mediaElements.length;
            this.switchMedia(nextIndex);
        }
    }

    handleVisible() {
        this.load().catch(console.error);
    }

    handleHidden() {
        this.pause();
    }

    onLoad(callback) {
        this.loadCallbacks.add(callback);
        return () => this.loadCallbacks.delete(callback);
    }

    emit(event, data) {
        const customEvent = new CustomEvent(`video:${event}`, {
            detail: { videoId: this.videoId, ...data },
            bubbles: true
        });
        this.container.dispatchEvent(customEvent);
    }

    getMetrics() {
        return { ...this.performanceMetrics };
    }

    destroy() {
        this.pause();
        
        this.intersectionObserver?.disconnect();
        this.visibilityObserver?.disconnect();
        this.performanceObserver?.disconnect();

        this.eventListeners.forEach((listeners, key) => {
            listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.eventListeners.clear();

        this.mediaElements.forEach(media => {
            if (media.tagName === 'VIDEO') {
                media.src = '';
                media.load();
            } else {
                media.src = '';
            }
        });
        this.mediaElements = [];

        this.loadCallbacks.clear();
        this.container = null;
    }
}

export { AdvancedVideoPlayer };