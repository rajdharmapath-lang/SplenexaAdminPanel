import { useEffect, useRef, useState } from 'react';
import { useAdminSession } from '../context/AdminSessionContext';

export default function AccountMenu() {
  const { user, onLogout, logoutPending } = useAdminSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((part) => part.trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || fullName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        className="account-menu-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-menu-avatar" aria-hidden="true">{initials}</span>
        <span className="account-menu-copy">
          <strong>{fullName}</strong>
          <small>{user?.professional || user?.email}</small>
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="account-menu-dropdown" role="menu">
          <div className="account-menu-details">
            <strong>{fullName}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={logoutPending}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            {logoutPending ? 'Signing out...' : 'Log Out'}
          </button>
        </div>
      )}
    </div>
  );
}
