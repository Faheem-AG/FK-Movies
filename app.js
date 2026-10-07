/* ========================================================
   FK Movies — TMDB API Integration & App Logic
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

// Hero slider state
let heroMovies = [];
let heroIndex = 0;
let heroInterval = null;

// Debounce timer for search
let searchTimeout = null;

/* -------------------------------------------------------
   API Helpers
   ------------------------------------------------------- */
async function tmdbFetch(endpoint, params = {}) {
    const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', CONFIG.API_KEY);
    url.searchParams.set('language', 'en-US');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

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
   Genre Loader
   ------------------------------------------------------- */
async function loadGenres() {
    const data = await tmdbFetch('/genre/movie/list');
    if (data && data.genres) {
        data.genres.forEach(g => genreMap[g.id] = g.name);
    }
}

function getGenreNames(ids = []) {
    return ids.slice(0, 3).map(id => genreMap[id] || '').filter(Boolean).join(', ');
}

/* -------------------------------------------------------
   Movie Card Builder
   ------------------------------------------------------- */
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', movie.title || movie.name);

    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4);
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';

    card.innerHTML = `
        <img class="movie-card-poster" src="${imgUrl(movie.poster_path)}" alt="${movie.title}" loading="lazy" onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">
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

    card.addEventListener('click', () => openModal(movie.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
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
   Hero Section
   ------------------------------------------------------- */
async function initHero() {
    const data = await tmdbFetch('/trending/movie/week');
    if (!data || !data.results) return;

    heroMovies = data.results.filter(m => m.backdrop_path).slice(0, 6);
    if (!heroMovies.length) return;

    // Build dots
    const dotsContainer = document.getElementById('hero-dots');
    dotsContainer.innerHTML = '';
    heroMovies.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = `hero-dot${i === 0 ? ' active' : ''}`;
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
    const title = document.getElementById('hero-title');
    const overview = document.getElementById('hero-overview');
    const rating = document.getElementById('hero-rating');
    const year = document.getElementById('hero-year');
    const genre = document.getElementById('hero-genre');
    const content = document.getElementById('hero-content');

    // Fade out
    content.style.animation = 'none';
    backdrop.style.opacity = '0';

    setTimeout(() => {
        backdrop.style.backgroundImage = `url(${imgUrl(movie.backdrop_path, CONFIG.IMG_SIZES.backdropSmall)})`;
        title.textContent = movie.title || movie.name;
        overview.textContent = movie.overview;
        rating.textContent = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        year.textContent = (movie.release_date || '').slice(0, 4);
        genre.textContent = getGenreNames(movie.genre_ids);

        backdrop.style.opacity = '1';
        content.style.animation = 'heroFadeIn 0.6s ease-out';
    }, 300);

    // Update dots
    document.querySelectorAll('.hero-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === heroIndex);
    });

    // Set detail/trailer buttons
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
   Movie Detail Modal
   ------------------------------------------------------- */
async function openModal(movieId, showTrailer = false) {
    const overlay = document.getElementById('movie-modal');
    const modal = document.getElementById('modal-content');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0;

    // Fetch details + credits + videos
    const [details, credits, videos] = await Promise.all([
        tmdbFetch(`/movie/${movieId}`),
        tmdbFetch(`/movie/${movieId}/credits`),
        tmdbFetch(`/movie/${movieId}/videos`),
    ]);

    if (!details) {
        closeModal();
        return;
    }

    // Backdrop
    const modalBackdrop = document.getElementById('modal-backdrop');
    modalBackdrop.style.backgroundImage = `url(${imgUrl(details.backdrop_path, CONFIG.IMG_SIZES.backdropSmall)})`;

    // Poster
    document.getElementById('modal-poster').src = imgUrl(details.poster_path);

    // Title
    document.getElementById('modal-title').textContent = details.title;

    // Badges (genres)
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
    // Color
    if (pct >= 70) ratingPath.style.stroke = '#21d07a';
    else if (pct >= 50) ratingPath.style.stroke = '#d2d531';
    else ratingPath.style.stroke = '#db2360';

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

    // Stop any playing trailer
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
        mainSections.forEach(s => s.style.display = '');
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
   Navigation
   ------------------------------------------------------- */
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    const backToTop = document.getElementById('back-to-top');

    // Scroll effect
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        backToTop.classList.toggle('visible', window.scrollY > 500);
    });

    // Hamburger toggle
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('open');
    });

    // Nav link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');

            // Update active
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Close mobile menu
            hamburger.classList.remove('active');
            navLinks.classList.remove('open');

            // Clear search
            clearSearch();

            if (section === 'home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const target = document.getElementById(`${section}-section`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });

    // Logo click => home
    document.getElementById('nav-logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        clearSearch();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-section="home"]').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Footer links
    document.querySelectorAll('#footer a[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            clearSearch();
            const target = document.getElementById(`${section}-section`);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Back to top
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function clearSearch() {
    const searchWrapper = document.getElementById('search-wrapper');
    const searchInput = document.getElementById('search-input');
    searchWrapper.classList.remove('active');
    searchInput.value = '';

    const resultsSection = document.getElementById('search-results-section');
    resultsSection.style.display = 'none';

    document.querySelectorAll('.movie-section:not(.search-results-section)').forEach(s => s.style.display = '');
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
    let auth = null;
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            auth = firebase.auth();
        }
    } catch (e) {
        console.warn('Firebase init in app.js:', e);
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

    // Check cached user in localStorage first for instant display
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
            localStorage.removeItem('fk_user');
            renderLoggedOut();
        });
    }

    // Firebase Auth State Listener
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
                    photoURL: user.photoURL || null
                };
                localStorage.setItem('fk_user', JSON.stringify(userData));
                renderLoggedIn(userData);
            } else {
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
    initFirebaseAuth();

    // Load genres first
    await loadGenres();

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
