import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  TrendingUp,
  Mail,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function AuthPage({ onAuthSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatFirebaseError = (err) => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please log in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please check your credentials.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please wait a few moments and try again.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet connection.';
      default:
        return err.message || 'Authentication failed. Please try again.';
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation for Registration
    if (isRegisterMode) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== repeatPassword) {
        setError('Passwords do not match. Please re-enter repeat password.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegisterMode) {
        // 1. Create user with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // 2. Set user display name in Firebase Auth
        await updateProfile(user, {
          displayName: name.trim(),
        });

        // 3. Store user profile in Firebase Firestore with empty initial funds
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: name.trim(),
            email: email.trim(),
            funds: [],
            createdAt: new Date().toISOString(),
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Firestore doc setup:', dbErr.message);
        }

        if (onAuthSuccess) onAuthSuccess(user);
      } else {
        // Log in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (onAuthSuccess) onAuthSuccess(userCredential.user);
      }
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-viewport">
      <div className="auth-card-container">
        {/* Brand header */}
        <div className="auth-brand-header">
          <div className="auth-logo-badge">
            <TrendingUp size={22} />
          </div>
          <h1 className="auth-brand-title">MF<strong>Analyze</strong></h1>
          <p className="auth-brand-subtitle">
            Zerodha-Style Mutual Fund Analysis & Smart Valuation
          </p>
        </div>

        {/* Tab switcher: Log In vs Sign Up */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-btn ${!isRegisterMode ? 'active' : ''}`}
            onClick={() => {
              setIsRegisterMode(false);
              setError(null);
            }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${isRegisterMode ? 'active' : ''}`}
            onClick={() => {
              setIsRegisterMode(true);
              setError(null);
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Form Card */}
        <div className="auth-form-card">
          <div className="auth-form-heading">
            <h2>{isRegisterMode ? 'Create your Account' : 'Welcome back'}</h2>
            <p>
              {isRegisterMode
                ? 'Register with your details to save your mutual fund watchlist in Firebase.'
                : 'Log in with your email and password to access your mutual funds.'}
            </p>
          </div>

          {error && (
            <div className="auth-error-banner">
              <AlertCircle size={16} className="error-icon-shrink" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {/* Register: Full Name field */}
            {isRegisterMode && (
              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="register-name">
                  Full Name
                </label>
                <div className="auth-input-wrap">
                  <User size={15} className="auth-input-icon" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="auth-input"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="auth-email">
                Email Address
              </label>
              <div className="auth-input-wrap">
                <Mail size={15} className="auth-input-icon" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-input-wrap">
                <Lock size={15} className="auth-input-icon" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  placeholder={isRegisterMode ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            {/* Register: Repeat Password Field */}
            {isRegisterMode && (
              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-repeat-password">
                  Repeat Password
                </label>
                <div className="auth-input-wrap">
                  <ShieldCheck size={15} className="auth-input-icon" />
                  <input
                    id="auth-repeat-password"
                    type="password"
                    required
                    placeholder="Confirm your password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    className="auth-input"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="auth-spinner" />
                  <span>{isRegisterMode ? 'Creating Account...' : 'Logging In...'}</span>
                </>
              ) : (
                <>
                  <span>{isRegisterMode ? 'Sign Up' : 'Log In'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Switch link */}
          <div className="auth-switch-prompt">
            {isRegisterMode ? (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setError(null);
                  }}
                >
                  Log in
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setError(null);
                  }}
                >
                  Sign up
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
