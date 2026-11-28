import { NAV_ITEMS } from '../routes';
import splenexaLogo from '../assets/images/splenexa-logo.png';

export default function Sidebar({ route, onNavigate }) {
  return (
    <aside className="constant-sidebar">
      <div className="brand">
        <img className="brand-logo" src={splenexaLogo} alt="Splenexa" />
      </div>
      <nav className="constant-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(([id, label, icon]) => (
          <button key={id} type="button" className={id === route ? 'active' : undefined}
            aria-current={id === route ? 'page' : undefined} onClick={() => onNavigate(id)}>
            <i className={`bi bi-${icon}`} />{label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
