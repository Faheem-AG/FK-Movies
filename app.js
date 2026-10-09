/* ========================================================
   FK Movies — TMDB API Integration & App Logic
   - Live TMDB Fetching & Dynamic Hero Slider
   - Movie Card Builder with Top-Right Save / Bookmark Button
   - TMDB Discover & Filter Engine (Genre, Year, Rating, Sort)
   - Cloud Firestore Watchlist Synchronization & Real-Time Sync
   - Modal Trailer Player & Details View
   - Firebase Auth State Integration & Profile Menu
   ======================================================== */

const CONFIG = {
    API_KEY: 'a190ffece46ddc4c4cb240319ce46dd0',
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG_BASE: 'https://image.tmdb.org/t/p/',
    IMG_SIZES: {
        poster: 'w500',
        backdrop: 'original',
        backdropSmall: 'w1280',
        profile: 'w185',
    },
    PLACEHOLDER_POSTER: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDQwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMxNjE2MWYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzMzMyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==',
    PLACEHOLDER_PROFILE: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTg1IiBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDE4NSAxODUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE4NSIgaGVpZ2h0PSIxODUiIGZpbGw9IiMxNjE2MWYiLz48Y2lyY2xlIGN4PSI5Mi41IiBjeT0iNzAiIHI9IjM1IiBmaWxsPSIjMzMzIi8+PHBhdGggZD0iTTMwIDE4NWMwLTM1IDI4LTYzIDYyLjUtNjNzNjIuNSAyOCA2Mi41IDYzIiBmaWxsPSIjMzMzIi8+PC9zdmc+',
};

// Genre map (built from API on init)
let genreMap = {};
let genreList = [];

// Hero slider state
let heroMovies = [];
let heroIndex = 0;
let heroInterval = null;

// Debounce timer for search
let searchTimeout = null;

// Current movie displayed in modal
let currentModalMovie = null;

// Toast timeout
let appToastTimeout = null;

// Firebase & Firestore References
let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;
let watchlistUnsubscribe = null;

// TMDB Discover & Filter State
const filterState = {
    sortBy: 'popularity.desc',
    genreId: '',
    year: '',
    rating: 0,
    page: 1,
    totalPages: 1,
    isLoading: false
};

/* -------------------------------------------------------
   Streaming Website Providers & Search Integration
   ------------------------------------------------------- */
const STREAM_SERVERS = {
    hdtoday: {
        id: 'hdtoday',
        name: 'HDToday',
        icon: '⚡',
        domain: 'hdtodayz.org',
        tag: 'Fast',
        getUrl: (title) => `https://hdtodayz.org/search?q=${encodeURIComponent(title || '')}`
    },
    hydrahd: {
        id: 'hydrahd',
        name: 'HydraHD',
        icon: '🛡️',
        domain: 'hydrahd.com',
        tag: 'Full HD',
        getUrl: (title) => `https://hydrahd.com/index.php?menu=search&query=${encodeURIComponent(title || '')}`
    },
    vidplay: {
        id: 'vidplay',
        name: 'VidPlay',
        icon: '🎬',
        domain: 'vidplay.to',
        tag: 'Multi',
        getUrl: (title) => `https://vidplay.to/search?q=${encodeURIComponent(title || '')}`
    }
};

function getPreferredServer() {
    try {
        const saved = localStorage.getItem('fk_preferred_server');
        return (saved && STREAM_SERVERS[saved]) ? saved : 'hdtoday';
    } catch (e) {
        return 'hdtoday';
    }
}

function setPreferredServer(serverId, showToast = true) {
    if (!STREAM_SERVERS[serverId]) return;
    localStorage.setItem('fk_preferred_server', serverId);
    updateServerUI();
    if (showToast) {
        showAppToast(`Streaming source set to ${STREAM_SERVERS[serverId].name} (${STREAM_SERVERS[serverId].domain})`, 'success');
    }
}

function updateServerUI() {
    const currentServerId = getPreferredServer();
    const server = STREAM_SERVERS[currentServerId];
    if (!server) return;

    // Update Navbar button
    const navServerIcon = document.getElementById('nav-server-icon');
    const navServerName = document.getElementById('nav-server-name');
    if (navServerIcon) navServerIcon.textContent = server.icon;
    if (navServerName) navServerName.textContent = server.name;

    // Update Navbar menu items active state
    document.querySelectorAll('#nav-server-menu .server-menu-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-server') === currentServerId);
    });

    // Update Hero watch button text
    const heroBtnText = document.getElementById('hero-watch-btn-text');
    if (heroBtnText) {
        heroBtnText.textContent = `Watch on ${server.name}`;
    }

    // Update Hero dropdown items active state
    document.querySelectorAll('#hero-server-dropdown .server-option').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-server') === currentServerId);
    });

    // Update Modal stream cards active highlight
    document.querySelectorAll('.stream-server-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-server') === currentServerId);
    });
}

function initStreamingServers() {
    // Initial UI state setup
    updateServerUI();

    // 1. Navbar server dropdown toggling
    const navServerWrapper = document.getElementById('nav-server-wrapper');
    const navServerBtn = document.getElementById('nav-server-btn');
    if (navServerBtn && navServerWrapper) {
        navServerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navServerWrapper.classList.toggle('active');
        });

        document.querySelectorAll('#nav-server-menu .server-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const serverId = item.getAttribute('data-server');
                setPreferredServer(serverId);
                navServerWrapper.classList.remove('active');
            });
        });
    }

    // 2. Hero server selector split dropdown toggling
    const heroWatchGroup = document.getElementById('hero-watch-group');
    const heroServerSelectBtn = document.getElementById('hero-server-select-btn');
    if (heroServerSelectBtn && heroWatchGroup) {
        heroServerSelectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            heroWatchGroup.classList.toggle('active');
        });

        document.querySelectorAll('#hero-server-dropdown .server-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const serverId = option.getAttribute('data-server');
                setPreferredServer(serverId);
                heroWatchGroup.classList.remove('active');
            });
        });
    }

    // 3. Modal server cards click events
    document.querySelectorAll('.stream-server-card').forEach(card => {
        card.addEventListener('click', () => {
            const serverId = card.getAttribute('data-server');
            if (serverId) {
                setPreferredServer(serverId, false);
            }
        });
    });

    // Close all open server dropdowns on window click
    document.addEventListener('click', (e) => {
        if (navServerWrapper && !navServerWrapper.contains(e.target)) {
            navServerWrapper.classList.remove('active');
        }
        if (heroWatchGroup && !heroWatchGroup.contains(e.target)) {
            heroWatchGroup.classList.remove('active');
        }
    });
}

/* -------------------------------------------------------
   API Helpers
   ------------------------------------------------------- */
async function tmdbFetch(endpoint, params = {}) {
    const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', CONFIG.API_KEY);
    url.searchParams.set('language', 'en-US');
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, v);
        }
    });

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('Fetch error:', err);
        return null;
    }
}

function imgUrl(path, size = CONFIG.IMG_SIZES.poster) {
    return path ? `${CONFIG.IMG_BASE}${size}${path}` : CONFIG.PLACEHOLDER_POSTER;
}

function profileUrl(path) {
    return path ? `${CONFIG.IMG_BASE}${CONFIG.IMG_SIZES.profile}${path}` : CONFIG.PLACEHOLDER_PROFILE;
}

/* -------------------------------------------------------
   App Toast Notification
   ------------------------------------------------------- */
function showAppToast(message, type = 'success') {
    const toast = document.getElementById('app-toast');
    const toastMsg = document.getElementById('app-toast-message');
    const toastIcon = document.getElementById('app-toast-icon');
    if (!toast || !toastMsg) return;

    clearTimeout(appToastTimeout);

    if (type === 'success') {
        toastIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
        toastIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toastMsg.textContent = message;
    toast.classList.add('visible');

    appToastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 3800);
}

/* -------------------------------------------------------
   Watchlist (Cloud Firestore & Local Storage Sync)
   ------------------------------------------------------- */
function getWatchlistLocal() {
    try {
        const data = localStorage.getItem('fk_watchlist');
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveWatchlistLocal(list) {
    localStorage.setItem('fk_watchlist', JSON.stringify(list));
    updateWatchlistBadges();
}

function isMovieSaved(movieId) {
    const list = getWatchlistLocal();
    return list.some(m => String(m.id) === String(movieId));
}

// Main toggle function: syncs with Firestore if authenticated
async function toggleWatchlist(movie, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!movie || !movie.id) return;

    let list = getWatchlistLocal();
    const movieIndex = list.findIndex(m => String(m.id) === String(movie.id));
    const wasSaved = movieIndex > -1;

    if (wasSaved) {
        // --- Remove from Watchlist ---
        list.splice(movieIndex, 1);
        saveWatchlistLocal(list);
        updateAllSaveButtons(movie.id, false);

        if (currentUser && db) {
            try {
                await db.collection('users').doc(currentUser.uid).collection('watchlist').doc(String(movie.id)).delete();
                showAppToast(`Removed "${movie.title || movie.name}" from your Firestore Watchlist`, 'info');
            } catch (err) {
                console.error('Firestore delete error:', err);
                showAppToast(`Removed from local watchlist (Firestore offline)`, 'info');
            }
        } else {
            showAppToast(`Removed "${movie.title || movie.name}" from Watchlist`, 'info');
        }
    } else {
        // --- Add to Watchlist ---
        const movieToSave = {
            id: movie.id,
            title: movie.title || movie.name || 'Untitled',
            poster_path: movie.poster_path || null,
            backdrop_path: movie.backdrop_path || null,
            vote_average: Number(movie.vote_average) || 0,
            release_date: movie.release_date || movie.first_air_date || '',
            genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : []),
            overview: movie.overview || '',
            savedAt: new Date().toISOString()
        };

        list.unshift(movieToSave);
        saveWatchlistLocal(list);
        updateAllSaveButtons(movie.id, true);

        if (currentUser && db) {
            try {
                // Save document to Firestore: users/{userId}/watchlist/{movieId}
                await db.collection('users').doc(currentUser.uid).collection('watchlist').doc(String(movie.id)).set({
                    ...movieToSave,
                    serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                showAppToast(`Saved "${movie.title || movie.name}" to Cloud Firestore! ☁️`, 'success');
            } catch (err) {
                console.error('Firestore save error:', err);
                showAppToast(`Saved to local watchlist. (Check Firestore rules if offline)`, 'success');
            }
        } else {
            showAppToast(`Saved to Watchlist! Sign in to sync across devices.`, 'success');
        }
    }

    // Refresh active watchlist grid
    const watchlistSection = document.getElementById('watchlist-section');
    if (watchlistSection && watchlistSection.style.display !== 'none') {
        renderWatchlistSection();
    }
}

// Start real-time Firestore sync when authenticated
function setupFirestoreWatchlistSync(user) {
    if (!db || !user) return;

    if (watchlistUnsubscribe) {
        watchlistUnsubscribe();
    }

    const userWatchlistRef = db.collection('users').doc(user.uid).collection('watchlist');

    // Sync any pre-existing local saved movies to Firestore on login
    const localList = getWatchlistLocal();
    if (localList.length) {
        localList.forEach(item => {
            userWatchlistRef.doc(String(item.id)).set({
                ...item,
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(() => {});
        });
    }

    // Real-time listener for Firestore changes
    watchlistUnsubscribe = userWatchlistRef.onSnapshot((snapshot) => {
        const firestoreMovies = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            firestoreMovies.push(data);
        });

        // Update local cache with live Firestore items
        saveWatchlistLocal(firestoreMovies);

        // Update UI states
        document.querySelectorAll('.movie-card-save').forEach(btn => {
            const mid = btn.getAttribute('data-movie-id');
            const saved = firestoreMovies.some(m => String(m.id) === String(mid));
            btn.classList.toggle('saved', saved);
        });

        const watchlistSection = document.getElementById('watchlist-section');
        if (watchlistSection && watchlistSection.style.display !== 'none') {
            renderWatchlistSection();
        }
    }, (err) => {
        console.warn('Firestore snapshot listener warning:', err);
    });
}

function updateWatchlistBadges() {
    const count = getWatchlistLocal().length;
    const navBadge = document.getElementById('nav-watchlist-count');
    const dropdownBadge = document.getElementById('dropdown-watchlist-count');

    if (navBadge) navBadge.textContent = count;
    if (dropdownBadge) dropdownBadge.textContent = count;
}

function updateAllSaveButtons(movieId, isSaved) {
    document.querySelectorAll(`.movie-card-save[data-movie-id="${movieId}"]`).forEach(btn => {
        btn.classList.toggle('saved', isSaved);
        btn.setAttribute('aria-label', isSaved ? 'Remove from Watchlist' : 'Save to Watchlist');
        btn.setAttribute('title', isSaved ? 'Remove from Watchlist' : 'Save to Watchlist');
    });

    if (currentModalMovie && String(currentModalMovie.id) === String(movieId)) {
        const modalSaveBtn = document.getElementById('modal-save-btn');
        if (modalSaveBtn) {
            modalSaveBtn.classList.toggle('saved', isSaved);
            const textSpan = modalSaveBtn.querySelector('.modal-save-text');
            const outlineIcon = modalSaveBtn.querySelector('.save-icon-outline');
            const filledIcon = modalSaveBtn.querySelector('.save-icon-filled');

            if (textSpan) textSpan.textContent = isSaved ? 'In Watchlist' : 'Add to Watchlist';
            if (outlineIcon) outlineIcon.style.display = isSaved ? 'none' : 'block';
            if (filledIcon) filledIcon.style.display = isSaved ? 'block' : 'none';
        }
    }
}

function renderWatchlistSection() {
    const grid = document.getElementById('watchlist-grid');
    const emptyState = document.getElementById('watchlist-empty-state');
    const subtitle = document.getElementById('watchlist-subtitle');
    const list = getWatchlistLocal();

    if (!grid) return;

    if (!list.length) {
        grid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        if (subtitle) subtitle.textContent = '0 movies saved in your watchlist';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    const isCloud = currentUser ? ' (Synced with Cloud Firestore ☁️)' : '';
    if (subtitle) subtitle.textContent = `${list.length} movie${list.length !== 1 ? 's' : ''} in your watchlist${isCloud}`;

    grid.innerHTML = '';
    list.forEach(movie => {
        grid.appendChild(createMovieCard(movie));
    });
}

function initWatchlistEvents() {
    const clearBtn = document.getElementById('watchlist-clear-btn');
    const browseBtn = document.getElementById('watchlist-browse-btn');

    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const list = getWatchlistLocal();
            if (!list.length) return;
            if (confirm('Are you sure you want to clear your entire watchlist?')) {
                saveWatchlistLocal([]);
                renderWatchlistSection();
                document.querySelectorAll('.movie-card-save.saved').forEach(btn => btn.classList.remove('saved'));

                if (currentUser && db) {
                    try {
                        const snapshot = await db.collection('users').doc(currentUser.uid).collection('watchlist').get();
                        const batch = db.batch();
                        snapshot.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                        showAppToast('Firestore watchlist cleared.', 'info');
                    } catch (err) {
                        console.error('Error clearing Firestore:', err);
                    }
                } else {
                    showAppToast('Watchlist cleared.', 'info');
                }
            }
        });
    }

    if (browseBtn) {
        browseBtn.addEventListener('click', () => {
            showSection('discover');
        });
    }

    const dropdownWatchlistBtn = document.getElementById('dropdown-watchlist-btn');
    if (dropdownWatchlistBtn) {
        dropdownWatchlistBtn.addEventListener('click', () => {
            const userWrapper = document.getElementById('user-menu-wrapper');
            if (userWrapper) userWrapper.classList.remove('active');
            showSection('watchlist');
        });
    }
}

/* -------------------------------------------------------
   Genre Loader
   ------------------------------------------------------- */
async function loadGenres() {
    const data = await tmdbFetch('/genre/movie/list');
    if (data && data.genres) {
        genreList = data.genres;
        data.genres.forEach(g => genreMap[g.id] = g.name);
    }
}

function getGenreNames(ids = []) {
    return ids.slice(0, 3).map(id => genreMap[id] || '').filter(Boolean).join(', ');
}

/* -------------------------------------------------------
   Movie Card Builder (With Top-Right Save Button)
   ------------------------------------------------------- */
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', movie.title || movie.name);

    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const rating = movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'N/A';
    const saved = isMovieSaved(movie.id);

    card.innerHTML = `
        <button class="movie-card-save ${saved ? 'saved' : ''}" data-movie-id="${movie.id}" aria-label="${saved ? 'Remove from Watchlist' : 'Save to Watchlist'}" title="${saved ? 'Remove from Watchlist' : 'Save to Watchlist'}" type="button">
            <svg class="save-icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            <svg class="save-icon-filled" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
        </button>
        <img class="movie-card-poster" src="${imgUrl(movie.poster_path)}" alt="${movie.title || movie.name}" loading="lazy" onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">
        <div class="movie-card-play">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        <div class="movie-card-overlay">
            <div class="movie-card-rating">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ${rating}
            </div>
            <div class="movie-card-title">${movie.title || movie.name}</div>
            <div class="movie-card-meta">
                <span>${year}</span>
                <span>${getGenreNames(movie.genre_ids)}</span>
            </div>
        </div>
        <div class="movie-card-bottom">
            <div class="movie-card-bottom-title">${movie.title || movie.name}</div>
            <div class="movie-card-bottom-year">${year}</div>
        </div>
    `;

    // Save button click
    const saveBtn = card.querySelector('.movie-card-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            toggleWatchlist(movie, e);
        });
    }

    // Card click opens modal
    card.addEventListener('click', () => openModal(movie.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.target === saveBtn) return;
            e.preventDefault();
            openModal(movie.id);
        }
    });

    return card;
}

function createSkeletonCards(count = 8) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'skeleton skeleton-card';
        frag.appendChild(el);
    }
    return frag;
}

/* -------------------------------------------------------
   Populate Movie Rows
   ------------------------------------------------------- */
async function populateRow(containerId, endpoint, params = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.appendChild(createSkeletonCards(8));

    const data = await tmdbFetch(endpoint, params);
    container.innerHTML = '';

    if (data && data.results) {
        data.results.forEach(movie => {
            if (movie.poster_path) {
                container.appendChild(createMovieCard(movie));
            }
        });
    }
}

/* -------------------------------------------------------
   TMDB Discover & Filter Engine
   ------------------------------------------------------- */
async function fetchDiscoverMovies(isLoadMore = false) {
    const grid = document.getElementById('discover-grid');
    const countBadge = document.getElementById('filter-results-count');
    const loadMoreWrapper = document.getElementById('discover-load-more-wrapper');
    const loadMoreBtn = document.getElementById('discover-load-more-btn');
    if (!grid) return;

    if (filterState.isLoading) return;
    filterState.isLoading = true;

    if (!isLoadMore) {
        filterState.page = 1;
        grid.innerHTML = '';
        grid.appendChild(createSkeletonCards(10));
        if (countBadge) countBadge.textContent = 'Filtering movies...';
    } else {
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.innerHTML = '<svg class="spinner" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/></circle></svg> Loading...';
        }
    }

    // Build TMDB Discover Query Parameters
    const params = {
        sort_by: filterState.sortBy,
        page: filterState.page
    };

    if (filterState.genreId) {
        params.with_genres = filterState.genreId;
    }

    if (filterState.rating > 0) {
        params['vote_average.gte'] = filterState.rating;
        params['vote_count.gte'] = 50;
    }

    if (filterState.year) {
        if (filterState.year === '2010s') {
            params['primary_release_date.gte'] = '2010-01-01';
            params['primary_release_date.lte'] = '2019-12-31';
        } else if (filterState.year === '2000s') {
            params['primary_release_date.gte'] = '2000-01-01';
            params['primary_release_date.lte'] = '2009-12-31';
        } else if (filterState.year === '1990s') {
            params['primary_release_date.gte'] = '1990-01-01';
            params['primary_release_date.lte'] = '1999-12-31';
        } else if (filterState.year === 'classic') {
            params['primary_release_date.lte'] = '1989-12-31';
        } else {
            params.primary_release_year = filterState.year;
        }
    }

    const data = await tmdbFetch('/discover/movie', params);
    filterState.isLoading = false;

    if (!isLoadMore) {
        grid.innerHTML = '';
    } else if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Load More Movies';
    }

    if (data && data.results && data.results.length) {
        filterState.totalPages = data.total_pages || 1;
        const validMovies = data.results.filter(m => m.poster_path);

        validMovies.forEach(movie => {
            grid.appendChild(createMovieCard(movie));
        });

        const totalFormatted = (data.total_results || 0).toLocaleString();
        if (countBadge) {
            countBadge.textContent = `Showing page ${filterState.page} of ${filterState.totalPages.toLocaleString()} (${totalFormatted} total titles)`;
        }

        if (loadMoreWrapper) {
            loadMoreWrapper.style.display = filterState.page < filterState.totalPages ? 'flex' : 'none';
        }
    } else {
        if (!isLoadMore) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px 20px; color:var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;margin-bottom:12px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <p style="font-size:1.05rem;">No movies found matching these filter criteria.</p>
                <p style="font-size:0.85rem;margin-top:6px;">Try adjusting the genre, rating, or year.</p>
            </div>`;
            if (countBadge) countBadge.textContent = '0 movies found';
            if (loadMoreWrapper) loadMoreWrapper.style.display = 'none';
        }
    }
}

function initDiscoverFilters() {
    const genreContainer = document.getElementById('genre-pills');
    const sortSelect = document.getElementById('filter-sort');
    const yearSelect = document.getElementById('filter-year');
    const ratingSelect = document.getElementById('filter-rating');
    const resetBtn = document.getElementById('filter-reset-btn');
    const loadMoreBtn = document.getElementById('discover-load-more-btn');

    if (genreContainer && genreList.length) {
        genreContainer.innerHTML = '<button class="genre-pill active" data-genre-id="">All Genres</button>';
        genreList.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'genre-pill';
            btn.setAttribute('data-genre-id', g.id);
            btn.textContent = g.name;
            genreContainer.appendChild(btn);
        });

        genreContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.genre-pill');
            if (!pill) return;

            genreContainer.querySelectorAll('.genre-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            filterState.genreId = pill.getAttribute('data-genre-id') || '';
            fetchDiscoverMovies();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            filterState.sortBy = sortSelect.value;
            fetchDiscoverMovies();
        });
    }

    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            filterState.year = yearSelect.value;
            fetchDiscoverMovies();
        });
    }

    if (ratingSelect) {
        ratingSelect.addEventListener('change', () => {
            filterState.rating = parseFloat(ratingSelect.value) || 0;
            fetchDiscoverMovies();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            filterState.sortBy = 'popularity.desc';
            filterState.genreId = '';
            filterState.year = '';
            filterState.rating = 0;

            if (sortSelect) sortSelect.value = 'popularity.desc';
            if (yearSelect) yearSelect.value = '';
            if (ratingSelect) ratingSelect.value = '0';

            if (genreContainer) {
                genreContainer.querySelectorAll('.genre-pill').forEach(p => {
                    p.classList.toggle('active', p.getAttribute('data-genre-id') === '');
                });
            }

            fetchDiscoverMovies();
            showAppToast('Filters reset to default.');
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            if (filterState.page < filterState.totalPages) {
                filterState.page++;
                fetchDiscoverMovies(true);
            }
        });
    }

    fetchDiscoverMovies();
}

/* -------------------------------------------------------
   Hero Section
   ------------------------------------------------------- */
async function initHero() {
    const data = await tmdbFetch('/trending/movie/week');
    if (!data || !data.results) return;

    heroMovies = data.results.filter(m => m.backdrop_path).slice(0, 6);
    if (!heroMovies.length) return;

    const dotsContainer = document.getElementById('hero-dots');
    dotsContainer.innerHTML = '';
    heroMovies.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = `hero-dot ${i === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Slide ${i + 1}`);
        dot.addEventListener('click', () => {
            heroIndex = i;
            updateHero();
            resetHeroInterval();
        });
        dotsContainer.appendChild(dot);
    });

    updateHero();
    startHeroInterval();
}

function updateHero() {
    const movie = heroMovies[heroIndex];
    if (!movie) return;

    const backdrop = document.getElementById('hero-backdrop');
    const content = document.getElementById('hero-content');
    const rating = document.getElementById('hero-rating');
    const title = document.getElementById('hero-title');
    const overview = document.getElementById('hero-overview');
    const year = document.getElementById('hero-year');
    const genre = document.getElementById('hero-genre');

    backdrop.style.opacity = '0';

    setTimeout(() => {
        backdrop.style.backgroundImage = `url(${imgUrl(movie.backdrop_path, CONFIG.IMG_SIZES.backdrop)})`;
        rating.textContent = movie.vote_average ? Number(movie.vote_average).toFixed(1) : 'N/A';
        title.textContent = movie.title || movie.name;
        overview.textContent = movie.overview;
        year.textContent = (movie.release_date || movie.first_air_date || '').slice(0, 4);
        genre.textContent = getGenreNames(movie.genre_ids);

        backdrop.style.opacity = '1';
        content.style.animation = 'heroFadeIn 0.6s ease-out';
    }, 300);

    document.querySelectorAll('.hero-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === heroIndex);
    });

    const heroWatchBtn = document.getElementById('hero-watch-btn');
    if (heroWatchBtn) {
        heroWatchBtn.onclick = () => {
            const preferredServer = getPreferredServer();
            const server = STREAM_SERVERS[preferredServer] || STREAM_SERVERS.hdtoday;
            const movieTitle = movie.title || movie.name || '';
            const streamUrl = server.getUrl(movieTitle);
            window.open(streamUrl, '_blank', 'noopener,noreferrer');
        };
    }

    document.getElementById('hero-details-btn').onclick = () => openModal(movie.id);
    document.getElementById('hero-trailer-btn').onclick = () => openModal(movie.id, true);
}

function startHeroInterval() {
    heroInterval = setInterval(() => {
        heroIndex = (heroIndex + 1) % heroMovies.length;
        updateHero();
    }, 7000);
}

function resetHeroInterval() {
    clearInterval(heroInterval);
    startHeroInterval();
}

/* -------------------------------------------------------
   Movie Detail Modal (with Bookmark Support)
   ------------------------------------------------------- */
async function openModal(movieId, showTrailer = false) {
    const overlay = document.getElementById('movie-modal');
    const modal = document.getElementById('modal-content');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0;

    const [details, credits, videos] = await Promise.all([
        tmdbFetch(`/movie/${movieId}`),
        tmdbFetch(`/movie/${movieId}/credits`),
        tmdbFetch(`/movie/${movieId}/videos`),
    ]);

    if (!details) {
        closeModal();
        return;
    }

    currentModalMovie = details;

    // Backdrop & Poster
    const modalBackdrop = document.getElementById('modal-backdrop');
    modalBackdrop.style.backgroundImage = `url(${imgUrl(details.backdrop_path, CONFIG.IMG_SIZES.backdropSmall)})`;
    document.getElementById('modal-poster').src = imgUrl(details.poster_path);

    // Save Button in Modal
    const modalSaveBtn = document.getElementById('modal-save-btn');
    if (modalSaveBtn) {
        const isSaved = isMovieSaved(details.id);
        modalSaveBtn.classList.toggle('saved', isSaved);
        const textSpan = modalSaveBtn.querySelector('.modal-save-text');
        const outlineIcon = modalSaveBtn.querySelector('.save-icon-outline');
        const filledIcon = modalSaveBtn.querySelector('.save-icon-filled');

        if (textSpan) textSpan.textContent = isSaved ? 'In Watchlist' : 'Add to Watchlist';
        if (outlineIcon) outlineIcon.style.display = isSaved ? 'none' : 'block';
        if (filledIcon) filledIcon.style.display = isSaved ? 'block' : 'none';

        modalSaveBtn.onclick = (e) => {
            toggleWatchlist(details, e);
        };
    }

    // Title & Badges
    document.getElementById('modal-title').textContent = details.title;
    const badgesContainer = document.getElementById('modal-badges');
    badgesContainer.innerHTML = (details.genres || []).map(g =>
        `<span class="modal-badge genre">${g.name}</span>`
    ).join('');

    // Meta
    const year = (details.release_date || '').slice(0, 4);
    const runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';
    const metaHtml = [];
    if (year) metaHtml.push(`<span>📅 ${year}</span>`);
    if (runtime) metaHtml.push(`<span>⏱️ ${runtime}</span>`);
    if (details.original_language) metaHtml.push(`<span>🌐 ${details.original_language.toUpperCase()}</span>`);
    document.getElementById('modal-meta').innerHTML = metaHtml.join('');

    // Rating circle
    const pct = Math.round((details.vote_average || 0) * 10);
    document.getElementById('modal-rating-text').textContent = pct + '%';
    const ratingPath = document.getElementById('modal-rating-path');
    ratingPath.style.strokeDasharray = `${pct}, 100`;
    if (pct >= 70) ratingPath.style.stroke = '#21d07a';
    else if (pct >= 50) ratingPath.style.stroke = '#d2d531';
    else ratingPath.style.stroke = '#db2360';

    // Update streaming website links in modal
    const movieTitle = details.title || details.name || '';
    const hdtodayCard = document.getElementById('modal-server-hdtoday');
    const hydrahdCard = document.getElementById('modal-server-hydrahd');
    const vidplayCard = document.getElementById('modal-server-vidplay');

    if (hdtodayCard) hdtodayCard.href = STREAM_SERVERS.hdtoday.getUrl(movieTitle);
    if (hydrahdCard) hydrahdCard.href = STREAM_SERVERS.hydrahd.getUrl(movieTitle);
    if (vidplayCard) vidplayCard.href = STREAM_SERVERS.vidplay.getUrl(movieTitle);

    // Update active highlight based on preferred server
    const currentServer = getPreferredServer();
    document.querySelectorAll('.stream-server-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-server') === currentServer);
    });

    // Overview
    document.getElementById('modal-overview').textContent = details.overview || 'No overview available.';

    // Details grid
    const detailsGrid = document.getElementById('modal-details-grid');
    const detailItems = [];
    if (details.status) detailItems.push({ label: 'Status', value: details.status });
    if (details.budget) detailItems.push({ label: 'Budget', value: '$' + details.budget.toLocaleString() });
    if (details.revenue) detailItems.push({ label: 'Revenue', value: '$' + details.revenue.toLocaleString() });
    if (details.vote_count) detailItems.push({ label: 'Votes', value: details.vote_count.toLocaleString() });
    if (details.popularity) detailItems.push({ label: 'Popularity', value: details.popularity.toFixed(0) });
    if (details.production_companies && details.production_companies.length) {
        detailItems.push({ label: 'Studio', value: details.production_companies[0].name });
    }
    detailsGrid.innerHTML = detailItems.map(item => `
        <div class="modal-detail-item">
            <div class="modal-detail-label">${item.label}</div>
            <div class="modal-detail-value">${item.value}</div>
        </div>
    `).join('');

    // Cast
    const castContainer = document.getElementById('modal-cast-row');
    const castSection = document.getElementById('modal-cast-section');
    if (credits && credits.cast && credits.cast.length) {
        castSection.style.display = '';
        castContainer.innerHTML = credits.cast.slice(0, 12).map(person => `
            <div class="cast-card">
                <img src="${profileUrl(person.profile_path)}" alt="${person.name}" loading="lazy" onerror="this.src='${CONFIG.PLACEHOLDER_PROFILE}'">
                <div class="cast-card-name">${person.name}</div>
                <div class="cast-card-char">${person.character || ''}</div>
            </div>
        `).join('');
    } else {
        castSection.style.display = 'none';
    }

    // Trailer
    const trailerSection = document.getElementById('modal-trailer-section');
    const trailerContainer = document.getElementById('trailer-container');
    const trailer = videos && videos.results
        ? videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.results.find(v => v.site === 'YouTube')
        : null;

    if (trailer) {
        trailerSection.style.display = '';
        trailerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0" title="Trailer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
        if (showTrailer) {
            setTimeout(() => trailerSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
        }
    } else {
        trailerSection.style.display = 'none';
        trailerContainer.innerHTML = '';
    }
}

function closeModal() {
    const overlay = document.getElementById('movie-modal');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    currentModalMovie = null;

    const trailerContainer = document.getElementById('trailer-container');
    trailerContainer.innerHTML = '';
}

/* -------------------------------------------------------
   Search
   ------------------------------------------------------- */
async function performSearch(query) {
    const resultsSection = document.getElementById('search-results-section');
    const resultsGrid = document.getElementById('search-results-grid');
    const resultsCount = document.getElementById('search-results-count');
    const mainSections = document.querySelectorAll('.movie-section:not(.search-results-section)');

    if (!query || query.trim().length < 2) {
        resultsSection.style.display = 'none';
        mainSections.forEach(s => {
            if (s.id !== 'watchlist-section') s.style.display = '';
        });
        return;
    }

    mainSections.forEach(s => s.style.display = 'none');
    resultsSection.style.display = '';
    resultsGrid.innerHTML = '';
    resultsGrid.appendChild(createSkeletonCards(12));

    const data = await tmdbFetch('/search/movie', { query: query.trim() });
    resultsGrid.innerHTML = '';

    if (data && data.results && data.results.length) {
        resultsCount.textContent = `Found ${data.total_results} result${data.total_results !== 1 ? 's' : ''} for "${query}"`;
        data.results.forEach(movie => {
            if (movie.poster_path) {
                resultsGrid.appendChild(createMovieCard(movie));
            }
        });
    } else {
        resultsCount.textContent = `No results found for "${query}"`;
        resultsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;margin-bottom:16px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style="font-size:1.1rem;">No movies found matching your search.</p>
        </div>`;
    }
}

function clearSearch() {
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');
    if (searchWrapper) searchWrapper.classList.remove('active');
    if (searchInput) searchInput.value = '';

    const resultsSection = document.getElementById('search-results-section');
    if (resultsSection) resultsSection.style.display = 'none';

    document.querySelectorAll('.movie-section:not(.search-results-section)').forEach(s => {
        if (s.id !== 'watchlist-section') s.style.display = '';
    });
}

/* -------------------------------------------------------
   Scroll Controls for Movie Rows
   ------------------------------------------------------- */
function initScrollControls() {
    document.querySelectorAll('.scroll-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const row = document.getElementById(targetId);
            if (!row) return;
            const scrollAmount = row.clientWidth * 0.75;
            if (btn.classList.contains('scroll-left')) {
                row.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        });
    });
}

/* -------------------------------------------------------
   Navigation & Section Switching
   ------------------------------------------------------- */
function showSection(sectionName) {
    clearSearch();

    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-section') === sectionName);
    });

    const watchlistSection = document.getElementById('watchlist-section');
    const discoverSection = document.getElementById('discover-section');

    if (sectionName === 'watchlist') {
        if (watchlistSection) {
            watchlistSection.style.display = '';
            renderWatchlistSection();
            watchlistSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
    } else {
        if (watchlistSection) watchlistSection.style.display = 'none';
    }

    if (sectionName === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionName === 'discover') {
        if (discoverSection) {
            discoverSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } else {
        const target = document.getElementById(`${sectionName}-section`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function initNavigation() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const backToTop = document.getElementById('back-to-top');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        backToTop.classList.toggle('visible', window.scrollY > 500);
    });

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            hamburger.classList.remove('active');
            navLinks.classList.remove('open');
            showSection(section);
        });
    });

    document.getElementById('nav-logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        showSection('home');
    });

    document.querySelectorAll('#footer a[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            showSection(section);
        });
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* -------------------------------------------------------
   Search UI
   ------------------------------------------------------- */
function initSearch() {
    const searchToggle = document.getElementById('search-toggle');
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');

    searchToggle.addEventListener('click', () => {
        searchWrapper.classList.toggle('active');
        if (searchWrapper.classList.contains('active')) {
            setTimeout(() => searchInput.focus(), 300);
        } else {
            searchInput.value = '';
            clearSearch();
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(searchInput.value);
        }, 400);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchWrapper.classList.remove('active');
            searchInput.value = '';
            clearSearch();
        }
    });
}

/* -------------------------------------------------------
   Modal Events
   ------------------------------------------------------- */
function initModal() {
    const overlay = document.getElementById('movie-modal');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
        }
    });
}

/* -------------------------------------------------------
   Firebase Auth & User Navigation State
   ------------------------------------------------------- */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyByUplVqU-nud1kulPXZJAFbLZH5F3PpEg",
    authDomain: "fkmovies-d0fb9.firebaseapp.com",
    projectId: "fkmovies-d0fb9",
    storageBucket: "fkmovies-d0fb9.firebasestorage.app",
    messagingSenderId: "748434846339",
    appId: "1:748434846339:web:46cd010b126e8eb6a1e1b6",
    measurementId: "G-217EH4DKRP"
};

function initFirebaseAuth() {
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                firebaseApp = firebase.app();
            }
            auth = firebase.auth();
            db = firebase.firestore();
        }
    } catch (e) {
        console.warn('Firebase init error in app.js:', e);
    }

    const signinBtn = document.getElementById('nav-signin-btn');
    const userWrapper = document.getElementById('user-menu-wrapper');
    const userProfileBtn = document.getElementById('user-profile-btn');
    const navAvatar = document.getElementById('nav-user-avatar');
    const navName = document.getElementById('nav-user-name');
    const dropdownAvatar = document.getElementById('dropdown-avatar');
    const dropdownName = document.getElementById('dropdown-name');
    const dropdownEmail = document.getElementById('dropdown-email');
    const signoutBtn = document.getElementById('nav-signout-btn');

    function renderLoggedIn(userData) {
        if (!signinBtn || !userWrapper) return;
        signinBtn.style.display = 'none';
        userWrapper.style.display = 'block';

        const name = userData.name || userData.displayName || (userData.email ? userData.email.split('@')[0] : 'User');
        const email = userData.email || '';
        const initial = name.charAt(0).toUpperCase();

        if (navName) navName.textContent = name;
        if (dropdownName) dropdownName.textContent = name;
        if (dropdownEmail) dropdownEmail.textContent = email;

        if (userData.photoURL) {
            if (navAvatar) navAvatar.innerHTML = `<img src="${userData.photoURL}" alt="${name}">`;
            if (dropdownAvatar) dropdownAvatar.innerHTML = `<img src="${userData.photoURL}" alt="${name}">`;
        } else {
            if (navAvatar) navAvatar.textContent = initial;
            if (dropdownAvatar) dropdownAvatar.textContent = initial;
        }
    }

    function renderLoggedOut() {
        if (!signinBtn || !userWrapper) return;
        signinBtn.style.display = 'inline-flex';
        userWrapper.style.display = 'none';
        userWrapper.classList.remove('active');
    }

    // Check cached user in localStorage
    const cached = localStorage.getItem('fk_user');
    if (cached) {
        try {
            renderLoggedIn(JSON.parse(cached));
        } catch (e) {}
    }

    // Toggle dropdown
    if (userProfileBtn && userWrapper) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userWrapper.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!userWrapper.contains(e.target)) {
                userWrapper.classList.remove('active');
            }
        });
    }

    // Sign out button
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            if (auth) {
                try {
                    await auth.signOut();
                } catch (e) {
                    console.error('Sign out error:', e);
                }
            }
            if (watchlistUnsubscribe) {
                watchlistUnsubscribe();
                watchlistUnsubscribe = null;
            }
            currentUser = null;
            localStorage.removeItem('fk_user');
            renderLoggedOut();
            showAppToast('You have signed out.');
        });
    }

    // Firebase Auth State Listener
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
                    photoURL: user.photoURL || null
                };
                localStorage.setItem('fk_user', JSON.stringify(userData));
                renderLoggedIn(userData);

                // Start real-time Firestore synchronization
                setupFirestoreWatchlistSync(user);
            } else {
                currentUser = null;
                if (watchlistUnsubscribe) {
                    watchlistUnsubscribe();
                    watchlistUnsubscribe = null;
                }
                localStorage.removeItem('fk_user');
                renderLoggedOut();
            }
        });
    }
}

/* -------------------------------------------------------
   Preloader
   ------------------------------------------------------- */
function hidePreloader() {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.classList.add('hidden');
    }, 1600);
}

/* -------------------------------------------------------
   Initialize App
   ------------------------------------------------------- */
async function init() {
    hidePreloader();
    initNavigation();
    initSearch();
    initModal();
    initScrollControls();
    initWatchlistEvents();
    updateWatchlistBadges();
    initFirebaseAuth();
    initStreamingServers();

    // Load genres first
    await loadGenres();

    // Initialize Discover & Filters
    initDiscoverFilters();

    // Load all sections in parallel
    await Promise.all([
        initHero(),
        populateRow('trending-row', '/trending/movie/week'),
        populateRow('now-playing-row', '/movie/now_playing'),
        populateRow('top-rated-row', '/movie/top_rated'),
        populateRow('upcoming-row', '/movie/upcoming'),
    ]);
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
