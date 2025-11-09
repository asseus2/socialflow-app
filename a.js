import { debounce } from './utils/helpers.js';
import { API_BASE_URL } from './utils/constants.js';

class ImmutableStateManager {
    constructor() {
        this._state = Object.freeze({
            user: null,
            videos: new Map(),
            likedVideos: new Set(),
            savedVideos: new Set(),
            currentMediaIndexes: new Map(),
            online: navigator.onLine,
            pendingActions: [],
            cache: new Map(),
            ui: {
                theme: 'dark',
                language: 'tr',
                videoQuality: 'auto',
                autoplay: true,
                notifications: true
            }
        });

        this.subscribers = new Map();
        this.cacheTimeout = 30000;
        this.history = [];
        this.maxHistoryLength = 50;
        this.isMutating = false;
    }

    async init() {
        await this.loadFromStorage();
        this.setupStorageSync();
        this.setupConnectivityMonitoring();
    }

    get state() {
        return this._state;
    }

    setState(updater) {
        if (this.isMutating) {
            console.warn('State mutation already in progress');
            return Promise.resolve();
        }

        this.isMutating = true;

        return new Promise((resolve, reject) => {
            queueMicrotask(() => {
                try {
                    const newState = typeof updater === 'function' 
                        ? updater(this._state) 
                        : updater;

                    if (!this.validateState(newState)) {
                        throw new Error('Invalid state structure');
                    }

                    const previousState = this._state;
                    this._state = Object.freeze({
                        ...previousState,
                        ...newState
                    });

                    this.history.push({
                        timestamp: Date.now(),
                        previous: previousState,
                        current: this._state
                    });

                    if (this.history.length > this.maxHistoryLength) {
                        this.history.shift();
                    }

                    this.notifySubscribers(previousState, this._state);
                    this.saveToStorageDebounced();

                    resolve(this._state);
                } catch (error) {
                    reject(error);
                } finally {
                    this.isMutating = false;
                }
            });
        });
    }

    validateState(state) {
        const schema = {
            user: ['object', 'null'],
            videos: ['object'],
            likedVideos: ['object'],
            savedVideos: ['object'],
            online: ['boolean'],
            ui: ['object']
        };

        for (const [key, expectedTypes] of Object.entries(schema)) {
            const actualType = typeof state[key];
            if (!expectedTypes.includes(actualType)) {
                console.error(`State validation failed for ${key}: expected ${expectedTypes}, got ${actualType}`);
                return false;
            }
        }

        return true;
    }

    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        this.subscribers.get(key).add(callback);
        
        return () => {
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    notifySubscribers(previousState, currentState) {
        const changedKeys = this.getChangedKeys(previousState, currentState);
        
        changedKeys.forEach(key => {
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback(currentState[key], previousState[key], key);
                    } catch (error) {
                        console.error(`Subscriber error for ${key}:`, error);
                    }
                });
            }
        });

        const globalSubscribers = this.subscribers.get('*');
        if (globalSubscribers) {
            globalSubscribers.forEach(callback => {
                try {
                    callback(currentState, previousState, changedKeys);
                } catch (error) {
                    console.error('Global subscriber error:', error);
                }
            });
        }
    }

    getChangedKeys(previous, current) {
        const keys = new Set([
            ...Object.keys(previous),
            ...Object.keys(current)
        ]);

        return Array.from(keys).filter(key => 
            !this.isEqual(previous[key], current[key])
        );
    }

    isEqual(a, b) {
        if (a === b) return true;
        if (a instanceof Map && b instanceof Map) {
            return a.size === b.size && 
                   Array.from(a.entries()).every(([k, v]) => b.get(k) === v);
        }
        if (a instanceof Set && b instanceof Set) {
            return a.size === b.size && 
                   Array.from(a).every(item => b.has(item));
        }
        return JSON.stringify(a) === JSON.stringify(b);
    }

    async getWithCache(key, fetcher, options = {}) {
        const cacheKey = `cache_${key}`;
        const now = Date.now();
        
        const cached = this.state.cache.get(cacheKey);
        if (cached && now - cached.timestamp < (options.ttl || this.cacheTimeout)) {
            return cached.data;
        }

        const data = await fetcher();
        
        this.setState(state => ({
            cache: new Map(state.cache).set(cacheKey, {
                data,
                timestamp: now
            })
        }));

        return data;
    }

    invalidateCache(pattern) {
        this.setState(state => {
            const newCache = new Map(state.cache);
            Array.from(newCache.keys())
                .filter(key => key.includes(pattern))
                .forEach(key => newCache.delete(key));
            
            return { cache: newCache };
        });
    }

    async getVideos(forceRefresh = false) {
        if (forceRefresh) {
            this.invalidateCache('videos');
        }

        return this.getWithCache('videos', async () => {
            try {
                const response = await this.apiRequest('/videos');
                const videos = response.data.videos;
                
                const videoMap = new Map(videos.map(video => [video.id, video]));
                
                return videoMap;
            } catch (error) {
                console.error('Video fetch error:', error);
                return this.getDemoVideos();
            }
        }, { ttl: 60000 });
    }

    getDemoVideos() {
        return new Map([
            ['1', {
                id: '1',
                caption: 'Demo Video 1 - SocialFlow Platform Tanıtımı',
                media: [
                    {
                        type: 'video',
                        url: 'https://demo.socialflow.com/videos/1.mp4',
                        thumbnail: 'https://demo.socialflow.com/thumbnails/1.jpg',
                        duration: 30
                    }
                ],
                user: {
                    id: 'user1',
                    name: 'SocialFlow Official',
                    avatar: 'https://demo.socialflow.com/avatars/1.jpg'
                },
                likes: 1500,
                shares: 300,
                comments: 45,
                timestamp: Date.now() - 3600000
            }],
            ['2', {
                id: '2',
                caption: 'Demo Video 2 - Harika İçerik Örneği',
                media: [
                    {
                        type: 'image',
                        url: 'https://demo.socialflow.com/images/2.jpg',
                        thumbnail: 'https://demo.socialflow.com/thumbnails/2.jpg'
                    }
                ],
                user: {
                    id: 'user2',
                    name: 'Creative Content',
                    avatar: 'https://demo.socialflow.com/avatars/2.jpg'
                },
                likes: 890,
                shares: 120,
                comments: 23,
                timestamp: Date.now() - 7200000
            }],
            ['3', {
                id: '3',
                caption: 'Demo Video 3 - Çoklu Medya Galerisi',
                media: [
                    {
                        type: 'video',
                        url: 'https://demo.socialflow.com/videos/3.mp4',
                        thumbnail: 'https://demo.socialflow.com/thumbnails/3.jpg',
                        duration: 45
                    },
                    {
                        type: 'image',
                        url: 'https://demo.socialflow.com/images/3-1.jpg',
                        thumbnail: 'https://demo.socialflow.com/thumbnails/3-1.jpg'
                    },
                    {
                        type: 'image',
                        url: 'https://demo.socialflow.com/images/3-2.jpg',
                        thumbnail: 'https://demo.socialflow.com/thumbnails/3-2.jpg'
                    }
                ],
                user: {
                    id: 'user3',
                    name: 'MultiMedia Creator',
                    avatar: 'https://demo.socialflow.com/avatars/3.jpg'
                },
                likes: 2450,
                shares: 560,
                comments: 89,
                timestamp: Date.now() - 10800000
            }]
        ]);
    }

    setCurrentMediaIndex(videoId, index) {
        this.setState(state => ({
            currentMediaIndexes: new Map(state.currentMediaIndexes).set(videoId, index)
        }));
        
        this.saveToStorage('currentMediaIndexes', 
            Object.fromEntries(this.state.currentMediaIndexes));
    }

    getCurrentMediaIndex(videoId) {
        return this.state.currentMediaIndexes.get(videoId) || 0;
    }

    async likeVideo(videoId) {
        const previousLiked = this.state.likedVideos.has(videoId);
        const newLiked = !previousLiked;

        await this.setState(state => ({
            likedVideos: new Set(
                newLiked 
                    ? [...state.likedVideos, videoId]
                    : Array.from(state.likedVideos).filter(id => id !== videoId)
            )
        }));

        try {
            if (this.state.online) {
                await this.apiRequest(`/videos/${videoId}/like`, {
                    method: 'PATCH',
                    body: JSON.stringify({ liked: newLiked })
                });
            } else {
                this.queueAction('like', { videoId, liked: newLiked });
            }

            this.invalidateCache(`video_${videoId}`);
            
            return newLiked;
        } catch (error) {
            await this.setState(state => ({
                likedVideos: new Set(
                    previousLiked 
                        ? [...state.likedVideos, videoId]
                        : Array.from(state.likedVideos).filter(id => id !== videoId)
                )
            }));
            
            throw error;
        }
    }

    async saveVideo(videoId) {
        const previousSaved = this.state.savedVideos.has(videoId);
        const newSaved = !previousSaved;

        await this.setState(state => ({
            savedVideos: new Set(
                newSaved 
                    ? [...state.savedVideos, videoId]
                    : Array.from(state.savedVideos).filter(id => id !== videoId)
            )
        }));

        try {
            if (this.state.online) {
                await this.apiRequest(`/videos/${videoId}/save`, {
                    method: 'PATCH',
                    body: JSON.stringify({ saved: newSaved })
                });
            } else {
                this.queueAction('save', { videoId, saved: newSaved });
            }

            return newSaved;
        } catch (error) {
            await this.setState(state => ({
                savedVideos: new Set(
                    previousSaved 
                        ? [...state.savedVideos, videoId]
                        : Array.from(state.savedVideos).filter(id => id !== videoId)
                )
            }));
            
            throw error;
        }
    }

    queueAction(type, data) {
        const action = {
            type,
            data,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9)
        };

        this.setState(state => ({
            pendingActions: [...state.pendingActions, action]
        }));

        this.saveToStorage('pendingActions', this.state.pendingActions);
    }

    async syncPendingActions() {
        const actions = [...this.state.pendingActions];
        
        for (const action of actions) {
            try {
                await this.processAction(action);
                
                this.setState(state => ({
                    pendingActions: state.pendingActions.filter(a => a.id !== action.id)
                }));
                
            } catch (error) {
                console.error(`Action sync failed for ${action.type}:`, error);
                break;
            }
        }
        
        await this.saveToStorage('pendingActions', this.state.pendingActions);
    }

    async processAction(action) {
        switch (action.type) {
            case 'like':
                await this.apiRequest(`/videos/${action.data.videoId}/like`, {
                    method: 'PATCH',
                    body: JSON.stringify({ liked: action.data.liked })
                });
                break;
            case 'save':
                await this.apiRequest(`/videos/${action.data.videoId}/save`, {
                    method: 'PATCH',
                    body: JSON.stringify({ saved: action.data.saved })
                });
                break;
        }
    }

    async loadFromStorage() {
        try {
            const storageKeys = ['user', 'likedVideos', 'savedVideos', 'currentMediaIndexes', 'ui'];
            const storageData = {};
            
            for (const key of storageKeys) {
                storageData[key] = await this.getStorage(key);
            }

            await this.setState(state => ({
                user: storageData.user || state.user,
                likedVideos: new Set(storageData.likedVideos || []),
                savedVideos: new Set(storageData.savedVideos || []),
                currentMediaIndexes: new Map(Object.entries(storageData.currentMediaIndexes || {})),
                ui: { ...state.ui, ...storageData.ui }
            }));

        } catch (error) {
            console.error('Storage load error:', error);
        }
    }

    saveToStorageDebounced = debounce(async () => {
        await this.saveToStorage('user', this.state.user);
        await this.saveToStorage('likedVideos', Array.from(this.state.likedVideos));
        await this.saveToStorage('savedVideos', Array.from(this.state.savedVideos));
        await this.saveToStorage('currentMediaIndexes', 
            Object.fromEntries(this.state.currentMediaIndexes));
        await this.saveToStorage('ui', this.state.ui);
    }, 1000);

    async saveToStorage(key, value) {
        try {
            const storageKey = `socialflow_${key}`;
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (error) {
            console.error(`Storage save error for ${key}:`, error);
        }
    }

    async getStorage(key) {
        try {
            const item = localStorage.getItem(`socialflow_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`Storage get error for ${key}:`, error);
            return null;
        }
    }

    setupConnectivityMonitoring() {
        window.addEventListener('online', () => {
            this.setState({ online: true });
            this.syncPendingActions();
        });

        window.addEventListener('offline', () => {
            this.setState({ online: false });
        });
    }

    setupStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('socialflow_')) {
                this.loadFromStorage();
            }
        });
    }

    async apiRequest(url, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    getVideo(videoId) {
        return this.state.videos.get(videoId);
    }

    isVideoLiked(videoId) {
        return this.state.likedVideos.has(videoId);
    }

    isVideoSaved(videoId) {
        return this.state.savedVideos.has(videoId);
    }

    updateUISettings(newSettings) {
        this.setState(state => ({
            ui: { ...state.ui, ...newSettings }
        }));
    }

    getUISettings() {
        return this.state.ui;
    }

    cleanup() {
        this.saveToStorageDebounced.cancel?.();
        this.subscribers.clear();
    }
}

export { ImmutableStateManager };