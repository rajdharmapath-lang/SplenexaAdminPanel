import { Suspense, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import { PAGES, navigate, routeFromHash } from './routes';
import {
  clearAdminSession,
  hasAdminSession,
  loginAdmin,
  logoutAdmin,
  signUpAdmin,
  verifyAdminSession,
} from './services/questionBankApi';

const SESSION_EXPIRED_EVENT = 'splenexa-admin-session-expired';

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [authenticated, setAuthenticated] = useState(() => hasAdminSession(window));
  const [authLoading, setAuthLoading] = useState(() => hasAdminSession(window));
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [signupNotice, setSignupNotice] = useState('');

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      clearAdminSession(window);
      setAuthenticated(false);
      setLoginError('Your session expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  useEffect(() => {
    if (!hasAdminSession(window)) {
      return;
    }
    verifyAdminSession(window)
      .then(setAuthenticated)
      .catch((error) => {
        setAuthenticated(false);
        if (error.status !== 401) {
          setLoginError(error.message);
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => { document.getElementById('page-scroller')?.scrollTo(0, 0); }, [route]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setLoginPending(true);
    setLoginError('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      if (authMode === 'signup') {
        const signupEmail = formData.get('email');
        const result = await signUpAdmin({
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          professional: formData.get('professional'),
          mobile: formData.get('mobile'),
          email: formData.get('email'),
          password: formData.get('password'),
        }, window);
        setSignupNotice(result.message || 'Account created. Sign in with your email and password.');
        setAuthMode('login');
        form.reset();
        form.elements.namedItem('email').value = signupEmail;
      } else {
        await loginAdmin(formData.get('email'), formData.get('password'), window);
        setAuthenticated(true);
        form.reset();
      }
    } catch (error) {
      form.elements.namedItem('password').value = '';
      setLoginError(error.message);
    } finally {
      setLoginPending(false);
    }
  }

  async function handleLogout() {
    setLogoutPending(true);
    setLoginError('');
    try {
      await logoutAdmin(window);
    } catch {
      setLoginError('Your browser session was cleared, but the backend could not confirm token revocation.');
    } finally {
      clearAdminSession(window);
      setAuthenticated(false);
      setAuthMode('login');
      setSignupNotice('');
      setLogoutPending(false);
    }
  }

  if (!authenticated) {
    if (authLoading) {
      return <main className="admin-login"><p role="status">Checking your admin session...</p></main>;
    }
    return (
      <main className="admin-login">
        <form className="admin-login-card" onSubmit={handleAuthSubmit}>
          <div className="admin-login-icon"><i className="bi bi-shield-lock-fill" aria-hidden="true"></i></div>
          <h1>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</h1>
          <p>
            {authMode === 'signup'
              ? 'Create an account to access the Splenexa Admin Panel.'
              : 'Sign in to continue to the Splenexa Admin Panel.'}
          </p>
          {authMode === 'signup' && (
            <>
              <label htmlFor="admin-first-name">First Name</label>
              <input id="admin-first-name" name="firstName" type="text" autoComplete="given-name" maxLength="80" required />
              <label htmlFor="admin-last-name">Last Name</label>
              <input id="admin-last-name" name="lastName" type="text" autoComplete="family-name" maxLength="80" required />
              <label htmlFor="admin-professional">Professional</label>
              <select id="admin-professional" name="professional" defaultValue="" required>
                <option value="" disabled>Select professional</option>
                <option value="Student">Student</option>
                <option value="Doctor">Doctor</option>
              </select>
              <label htmlFor="admin-mobile">Mobile</label>
              <input id="admin-mobile" name="mobile" type="tel" autoComplete="tel" maxLength="20" required />
            </>
          )}
          <label htmlFor="admin-login-email">{authMode === 'signup' ? 'Email' : 'Email (Username)'}</label>
          <input
            id="admin-login-email"
            name="email"
            type="email"
            autoComplete={authMode === 'signup' ? 'email' : 'username'}
            maxLength="254"
            required
          />
          <label htmlFor="admin-login-password">Password</label>
          <input
            id="admin-login-password"
            name="password"
            type="password"
            autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            minLength={authMode === 'signup' ? 12 : undefined}
            maxLength="128"
            required
          />
          {authMode === 'signup' && (
            <p className="admin-login-hint">
              Use at least 12 characters. Email format is checked; no verification email is sent.
            </p>
          )}
          {signupNotice && authMode === 'login' && (
            <p className="admin-login-success" role="status">{signupNotice}</p>
          )}
          {loginError && <p className="admin-login-error" role="alert">{loginError}</p>}
          <button type="submit" disabled={loginPending}>
            {loginPending ? 'Please wait...' : authMode === 'signup' ? 'Sign Up' : 'Sign In'}
          </button>
          <button
            className="admin-login-switch"
            type="button"
            disabled={loginPending}
            onClick={() => {
              setAuthMode(authMode === 'signup' ? 'login' : 'signup');
              setLoginError('');
              setSignupNotice('');
            }}
          >
            {authMode === 'signup' ? 'Back to Sign In' : 'Create Account'}
          </button>
        </form>
      </main>
    );
  }

  const Page = PAGES[route];
  return (
    <>
      <Sidebar route={route} onNavigate={navigate} onLogout={handleLogout} logoutPending={logoutPending} />
      {/* page-frame is the size container for @container rules and the containing block for the
          pages' fixed overlays; page-scroller is the scroll area (same layout as the old iframe). */}
      <div className="page-frame">
        <div className="page-scroller" id="page-scroller">
          <Suspense fallback={null}><Page key={route} /></Suspense>
        </div>
      </div>
    </>
  );
}
