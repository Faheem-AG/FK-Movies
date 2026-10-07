/* ========================================================
   FK Movies — Firebase Authentication Logic
   - Google Sign-In / Sign-Up
   - Email & Password Sign-Up (with display name)
   - Email & Password Log-In
   - Password Reset via Email
   - Real-time form validation & strength meter
   - Firebase Auth error handling & toasts
   ======================================================== */

// ---- Firebase Configuration ----
const firebaseConfig = {
    apiKey: "AIzaSyByUplVqU-nud1kulPXZJAFbLZH5F3PpEg",
    authDomain: "fkmovies-d0fb9.firebaseapp.com",
    projectId: "fkmovies-d0fb9",
    storageBucket: "fkmovies-d0fb9.firebasestorage.app",
    messagingSenderId: "748434846339",
    appId: "1:748434846339:web:46cd010b126e8eb6a1e1b6",
    measurementId: "G-217EH4DKRP"
};

// Initialize Firebase
let firebaseApp = null;
let auth = null;
let analytics = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
        } else {
            firebaseApp = firebase.app();
        }
        auth = firebase.auth();
        if (firebase.analytics) {
            analytics = firebase.analytics();
        }
    } else {
        console.warn('Firebase SDK not loaded.');
    }
} catch (err) {
    console.error('Firebase initialization error:', err);
}

/* -------------------------------------------------------
   Floating Movie Posters Background
   ------------------------------------------------------- */
function initFloatingPosters() {
    const container = document.getElementById('floating-posters');
    if (!container) return;

    const API_KEY = 'a190ffece46ddc4c4cb240319ce46dd0';
    fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=1`)
        .then(res => res.json())
        .then(data => {
            if (!data.results) return;
            const movies = data.results.filter(m => m.poster_path).slice(0, 8);
            const positions = [
                { top: '5%', left: '5%', delay: '0s', duration: '18s' },
                { top: '15%', left: '80%', delay: '-3s', duration: '22s' },
                { top: '35%', left: '15%', delay: '-6s', duration: '20s' },
                { top: '55%', left: '75%', delay: '-2s', duration: '24s' },
                { top: '70%', left: '8%', delay: '-8s', duration: '19s' },
                { top: '80%', left: '60%', delay: '-4s', duration: '21s' },
                { top: '25%', left: '50%', delay: '-10s', duration: '25s' },
                { top: '60%', left: '35%', delay: '-7s', duration: '23s' },
            ];

            movies.forEach((movie, i) => {
                const el = document.createElement('div');
                el.className = 'floating-poster';
                const pos = positions[i] || positions[0];
                el.style.top = pos.top;
                el.style.left = pos.left;
                el.style.animationDelay = pos.delay;
                el.style.animationDuration = pos.duration;
                el.innerHTML = `<img src="https://image.tmdb.org/t/p/w154${movie.poster_path}" alt="" loading="lazy">`;
                container.appendChild(el);
            });
        })
        .catch(() => {});
}

/* -------------------------------------------------------
   Form Switching (Login ↔ Signup ↔ Forgot)
   ------------------------------------------------------- */
function initFormSwitching() {
    const loginContainer = document.getElementById('login-form-container');
    const signupContainer = document.getElementById('signup-form-container');
    const forgotContainer = document.getElementById('forgot-form-container');

    // Show signup
    document.getElementById('show-signup-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(loginContainer, signupContainer);
    });

    // Show login (from signup)
    document.getElementById('show-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(signupContainer, loginContainer);
    });

    // Show forgot password
    document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(loginContainer, forgotContainer);
    });

    // Back to login (from forgot)
    document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
        switchForm(forgotContainer, loginContainer);
    });

    // Show login link in forgot form
    document.getElementById('show-login-link-2')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchForm(forgotContainer, loginContainer);
    });

    // Back to login after success
    document.getElementById('back-to-login-btn-2')?.addEventListener('click', () => {
        switchForm(forgotContainer, loginContainer);
        document.getElementById('forgot-form').style.display = '';
        document.getElementById('forgot-success').style.display = 'none';
    });
}

function switchForm(hideEl, showEl) {
    if (!hideEl || !showEl) return;
    hideEl.style.display = 'none';
    showEl.style.display = '';
    showEl.style.animation = 'none';
    showEl.offsetHeight; // force reflow
    showEl.style.animation = '';
    clearAllErrors();
}

/* -------------------------------------------------------
   Password Visibility Toggle
   ------------------------------------------------------- */
function initPasswordToggles() {
    document.querySelectorAll('.auth-toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;
            const eyeOpen = btn.querySelector('.eye-open');
            const eyeClosed = btn.querySelector('.eye-closed');

            if (input.type === 'password') {
                input.type = 'text';
                input.classList.add('password-visible');
                if (eyeOpen) eyeOpen.style.display = 'none';
                if (eyeClosed) eyeClosed.style.display = '';
            } else {
                input.type = 'password';
                input.classList.remove('password-visible');
                if (eyeOpen) eyeOpen.style.display = '';
                if (eyeClosed) eyeClosed.style.display = 'none';
            }
        });
    });
}

/* -------------------------------------------------------
   Password Strength Meter
   ------------------------------------------------------- */
function initPasswordStrength() {
    const passwordInput = document.getElementById('signup-password');
    const strengthContainer = document.getElementById('password-strength');
    const strengthFill = document.getElementById('password-strength-fill');
    const strengthText = document.getElementById('password-strength-text');

    if (!passwordInput || !strengthContainer || !strengthFill || !strengthText) return;

    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;

        if (val.length === 0) {
            strengthContainer.classList.remove('visible');
            return;
        }

        strengthContainer.classList.add('visible');
        const score = calculatePasswordStrength(val);

        strengthFill.className = 'password-strength-fill';
        if (score <= 1) {
            strengthFill.classList.add('weak');
            strengthText.textContent = 'Weak';
            strengthText.style.color = '#ef4444';
        } else if (score === 2) {
            strengthFill.classList.add('fair');
            strengthText.textContent = 'Fair';
            strengthText.style.color = '#f59e0b';
        } else if (score === 3) {
            strengthFill.classList.add('good');
            strengthText.textContent = 'Good';
            strengthText.style.color = '#60a5fa';
        } else {
            strengthFill.classList.add('strong');
            strengthText.textContent = 'Strong';
            strengthText.style.color = '#22c55e';
        }
    });
}

function calculatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return Math.min(score, 4);
}

/* -------------------------------------------------------
   Validation Helpers
   ------------------------------------------------------- */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setError(groupId, errorId, message) {
    const group = document.getElementById(groupId);
    const error = document.getElementById(errorId);
    if (group) {
        group.classList.add('error');
        group.classList.remove('success');
    }
    if (error) error.textContent = message;
}

function setSuccess(groupId) {
    const group = document.getElementById(groupId);
    if (group) {
        group.classList.remove('error');
        group.classList.add('success');
    }
}

function clearError(groupId, errorId) {
    const group = document.getElementById(groupId);
    const error = document.getElementById(errorId);
    if (group) group.classList.remove('error', 'success');
    if (error) error.textContent = '';
}

function clearAllErrors() {
    document.querySelectorAll('.auth-input-group').forEach(g => {
        g.classList.remove('error', 'success');
    });
    document.querySelectorAll('.auth-input-error').forEach(e => {
        e.textContent = '';
    });
}

/* -------------------------------------------------------
   Toast Notification
   ------------------------------------------------------- */
let toastTimeout = null;
function showToast(message, type = 'success') {
    const toast = document.getElementById('auth-toast');
    const toastMsg = document.getElementById('auth-toast-message');
    const toastIcon = document.getElementById('auth-toast-icon');
    if (!toast || !toastMsg) return;

    clearTimeout(toastTimeout);

    toast.className = 'auth-toast';
    toast.classList.add(type);

    if (type === 'success') {
        toastIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
        toastIcon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toastMsg.textContent = message;
    toast.classList.add('visible');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 4500);
}

/* -------------------------------------------------------
   Loading State Helper
   ------------------------------------------------------- */
function setLoading(btn, isLoading) {
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    if (isLoading) {
        btn.disabled = true;
        if (text) text.style.display = 'none';
        if (loader) loader.style.display = '';
    } else {
        btn.disabled = false;
        if (text) text.style.display = '';
        if (loader) loader.style.display = 'none';
    }
}

/* -------------------------------------------------------
   Save User Helper
   ------------------------------------------------------- */
function persistUser(user, customName = null) {
    const userData = {
        uid: user.uid,
        email: user.email,
        name: customName || user.displayName || (user.email ? user.email.split('@')[0] : 'Movie Lover'),
        photoURL: user.photoURL || null,
        provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'firebase'
    };
    localStorage.setItem('fk_user', JSON.stringify(userData));
    return userData;
}

/* -------------------------------------------------------
   Login Form Handler (Email & Password)
   ------------------------------------------------------- */
function initLoginForm() {
    const form = document.getElementById('login-form');
    const submitBtn = document.getElementById('login-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        let valid = true;

        if (!email) {
            setError('login-email-group', 'login-email-error', 'Email is required');
            valid = false;
        } else if (!validateEmail(email)) {
            setError('login-email-group', 'login-email-error', 'Please enter a valid email');
            valid = false;
        } else {
            setSuccess('login-email-group');
        }

        if (!password) {
            setError('login-password-group', 'login-password-error', 'Password is required');
            valid = false;
        } else if (password.length < 6) {
            setError('login-password-group', 'login-password-error', 'Password must be at least 6 characters');
            valid = false;
        } else {
            setSuccess('login-password-group');
        }

        if (!valid) return;

        setLoading(submitBtn, true);

        if (auth) {
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                persistUser(userCredential.user);
                showToast(`Welcome back, ${userCredential.user.displayName || email.split('@')[0]}! Redirecting...`, 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1200);
            } catch (err) {
                setLoading(submitBtn, false);
                handleFirebaseError(err);
            }
        } else {
            // Fallback if SDK fails to load
            setLoading(submitBtn, false);
            showToast('Firebase Auth SDK is initializing, please try again.', 'error');
        }
    });

    // Real-time validation
    document.getElementById('login-email')?.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            setError('login-email-group', 'login-email-error', 'Please enter a valid email');
        } else if (this.value) {
            clearError('login-email-group', 'login-email-error');
            setSuccess('login-email-group');
        }
    });
}

/* -------------------------------------------------------
   Sign Up Form Handler (Email & Password + Full Name)
   ------------------------------------------------------- */
function initSignupForm() {
    const form = document.getElementById('signup-form');
    const submitBtn = document.getElementById('signup-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;
        const agreeTerms = document.getElementById('agree-terms')?.checked;
        let valid = true;

        if (!name) {
            setError('signup-name-group', 'signup-name-error', 'Full name is required');
            valid = false;
        } else if (name.length < 2) {
            setError('signup-name-group', 'signup-name-error', 'Name must be at least 2 characters');
            valid = false;
        } else {
            setSuccess('signup-name-group');
        }

        if (!email) {
            setError('signup-email-group', 'signup-email-error', 'Email is required');
            valid = false;
        } else if (!validateEmail(email)) {
            setError('signup-email-group', 'signup-email-error', 'Please enter a valid email address');
            valid = false;
        } else {
            setSuccess('signup-email-group');
        }

        if (!password) {
            setError('signup-password-group', 'signup-password-error', 'Password is required');
            valid = false;
        } else if (password.length < 6) {
            setError('signup-password-group', 'signup-password-error', 'Password must be at least 6 characters');
            valid = false;
        } else {
            setSuccess('signup-password-group');
        }

        if (!confirm) {
            setError('signup-confirm-group', 'signup-confirm-error', 'Please confirm your password');
            valid = false;
        } else if (confirm !== password) {
            setError('signup-confirm-group', 'signup-confirm-error', 'Passwords do not match');
            valid = false;
        } else {
            setSuccess('signup-confirm-group');
        }

        if (!agreeTerms) {
            showToast('Please agree to the Terms of Service & Privacy Policy', 'error');
            valid = false;
        }

        if (!valid) return;

        setLoading(submitBtn, true);

        if (auth) {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Set the display name in Firebase profile
                if (user && user.updateProfile) {
                    await user.updateProfile({ displayName: name });
                }

                persistUser(user, name);
                showToast(`Account created! Welcome to FK Movies, ${name}!`, 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1200);
            } catch (err) {
                setLoading(submitBtn, false);
                handleFirebaseError(err);
            }
        } else {
            setLoading(submitBtn, false);
            showToast('Firebase Auth SDK is initializing, please try again.', 'error');
        }
    });

    // Real-time validation
    document.getElementById('signup-email')?.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            setError('signup-email-group', 'signup-email-error', 'Please enter a valid email');
        } else if (this.value) {
            clearError('signup-email-group', 'signup-email-error');
            setSuccess('signup-email-group');
        }
    });

    document.getElementById('signup-confirm')?.addEventListener('input', function() {
        const password = document.getElementById('signup-password').value;
        if (this.value && this.value !== password) {
            setError('signup-confirm-group', 'signup-confirm-error', 'Passwords do not match');
        } else if (this.value) {
            clearError('signup-confirm-group', 'signup-confirm-error');
            setSuccess('signup-confirm-group');
        }
    });
}

/* -------------------------------------------------------
   Forgot Password Form Handler
   ------------------------------------------------------- */
function initForgotForm() {
    const form = document.getElementById('forgot-form');
    const submitBtn = document.getElementById('forgot-submit-btn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const email = document.getElementById('forgot-email').value.trim();
        let valid = true;

        if (!email) {
            setError('forgot-email-group', 'forgot-email-error', 'Email is required');
            valid = false;
        } else if (!validateEmail(email)) {
            setError('forgot-email-group', 'forgot-email-error', 'Please enter a valid email');
            valid = false;
        } else {
            setSuccess('forgot-email-group');
        }

        if (!valid) return;

        setLoading(submitBtn, true);

        if (auth) {
            try {
                await auth.sendPasswordResetEmail(email);
                setLoading(submitBtn, false);
                form.style.display = 'none';
                const successBlock = document.getElementById('forgot-success');
                if (successBlock) successBlock.style.display = '';
                showToast('Reset email sent! Please check your inbox.', 'success');
            } catch (err) {
                setLoading(submitBtn, false);
                handleFirebaseError(err);
            }
        } else {
            setLoading(submitBtn, false);
            showToast('Firebase Auth is initializing, please try again.', 'error');
        }
    });
}

/* -------------------------------------------------------
   Google Sign In & Sign Up
   ------------------------------------------------------- */
function initGoogleAuth() {
    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSignupBtn = document.getElementById('google-signup-btn');

    const handleGoogleAuth = async (btn) => {
        if (!auth) {
            showToast('Firebase Auth is not ready yet. Please check your network connection.', 'error');
            return;
        }

        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="spinner" width="20" height="20" viewBox="0 0 24 24" style="margin-right:8px"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" dur="0.8s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/></circle></svg> Connecting to Google...`;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            
            persistUser(user);
            showToast(`Welcome, ${user.displayName || user.email}! Redirecting...`, 'success');

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                handleFirebaseError(err);
            }
        }
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => handleGoogleAuth(googleLoginBtn));
    }
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', () => handleGoogleAuth(googleSignupBtn));
    }
}

/* -------------------------------------------------------
   Firebase Error Handling & User-Friendly Messages
   ------------------------------------------------------- */
function handleFirebaseError(err) {
    console.error('Firebase Auth Error:', err);

    const errorMessages = {
        'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
        'auth/user-not-found': 'No account found with this email address. Please create an account.',
        'auth/wrong-password': 'Incorrect password. Please try again or use Forgot Password.',
        'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
        'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many failed attempts. Please wait a moment before trying again.',
        'auth/network-request-failed': 'Network connection error. Please check your internet connection.',
        'auth/popup-blocked': 'Google sign-in popup was blocked. Please allow popups for this website in browser settings.',
        'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console. Please enable Email/Password and Google in Firebase Auth.',
        'auth/unauthorized-domain': 'This domain is not authorized in Firebase Console > Authentication > Settings > Authorized Domains.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    };

    const message = errorMessages[err.code] || err.message || 'An error occurred during authentication. Please try again.';
    showToast(message, 'error');
}

/* -------------------------------------------------------
   Auto Auth State Listener
   ------------------------------------------------------- */
function initAuthStateListener() {
    if (!auth) return;
    auth.onAuthStateChanged((user) => {
        if (user) {
            persistUser(user);
        }
    });
}

/* -------------------------------------------------------
   Initialize Everything
   ------------------------------------------------------- */
function init() {
    initFloatingPosters();
    initFormSwitching();
    initPasswordToggles();
    initPasswordStrength();
    initLoginForm();
    initSignupForm();
    initForgotForm();
    initGoogleAuth();
    initAuthStateListener();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

