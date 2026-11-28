import { memo, useEffect, useMemo, useState } from 'react';
import AccountMenu from '../../components/AccountMenu';
import { loadAdminAppUsers } from '../../services/questionBankApi';
import './styles.css';

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not provided';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(user) {
  const dialCode = String(user.dialCode || '').replace(/\D/g, '');
  const phone = String(user.phone || '').replace(/\D/g, '');
  return `${dialCode ? `+${dialCode} ` : ''}${phone || 'Not provided'}`;
}

function StudentsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [registrationFilter, setRegistrationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadAdminAppUsers(window)
      .then((appUsers) => {
        if (active) setUsers(appUsers);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reloadKey]);

  const batchYears = useMemo(() => [...new Set(
    users.map((user) => user.batchYear).filter((year) => Number.isInteger(year)),
  )].sort((a, b) => b - a), [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cutoff = registrationFilter
      ? Date.now() - Number(registrationFilter) * 24 * 60 * 60 * 1000
      : null;

    return users.filter((user) => {
      const searchable = [
        user.name,
        user.email,
        user.phone,
        user.dialCode ? `+${user.dialCode}${user.phone || ''}` : '',
        (Array.isArray(user.enrolledCourses) ? user.enrolledCourses : []).join(' '),
        user.state,
        user.id,
      ].join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesBatch = !batchFilter || String(user.batchYear || '') === batchFilter;
      const matchesProfile = !profileFilter || (
        profileFilter === 'complete' ? user.profile_completed : !user.profile_completed
      );
      const createdAt = Date.parse(user.createdAt);
      const matchesRegistration = cutoff === null || (Number.isFinite(createdAt) && createdAt >= cutoff);
      return matchesSearch && matchesBatch && matchesProfile && matchesRegistration;
    });
  }, [users, search, batchFilter, profileFilter, registrationFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const completedProfiles = users.filter((user) => user.profile_completed).length;
  const newThisMonth = users.filter((user) => {
    const createdAt = Date.parse(user.createdAt);
    return Number.isFinite(createdAt) && createdAt >= monthStart.getTime();
  }).length;

  function resetFilters() {
    setSearch('');
    setBatchFilter('');
    setProfileFilter('');
    setRegistrationFilter('');
    setPage(1);
  }

  function exportUsers() {
    const rows = [
      ['Name', 'Email', 'Phone', 'Enrolled Course', 'State', 'Batch Year', 'Status', 'Registration Date', 'Last Login', 'App User ID'],
      ...filteredUsers.map((user) => [
        user.name || '',
        user.email || '',
        formatPhone(user),
        (Array.isArray(user.enrolledCourses) ? user.enrolledCourses : []).join('; '),
        user.state || '',
        user.batchYear || '',
        user.profile_completed ? 'Yes' : 'No',
        user.createdAt || '',
        user.lastLoginAt || '',
        user.id,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'splenexa-app-users.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const summaries = [
    { label: 'Total App Users', value: users.length, icon: 'bi-people' },
    { label: 'Completed Profiles', value: completedProfiles, icon: 'bi-person-check' },
    { label: 'Incomplete Profiles', value: users.length - completedProfiles, icon: 'bi-person-exclamation' },
    { label: 'New This Month', value: newThisMonth, icon: 'bi-person-plus' },
    { label: 'Batch Years', value: batchYears.length, icon: 'bi-mortarboard' },
  ];

  return (
    <div className="pg pg-students">
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-spacer" />
          <AccountMenu />
        </header>
        <div className="page-content">
          <section aria-labelledby="students-title">
            <div className="page-heading">
              <div>
                <div className="title-row">
                  <span className="title-icon" aria-hidden="true"><i className="bi bi-people" /></span>
                  <div>
                    <div className="eyebrow">Mobile app accounts</div>
                    <h1 id="students-title">Students</h1>
                  </div>
                </div>
                <p>View profiles registered in the Splenexa app.</p>
              </div>
            </div>

            <div className="summary-grid" aria-label="App user summary">
              {summaries.map((summary) => (
                <article className="card summary-card" key={summary.label}>
                  <span className="summary-icon" aria-hidden="true"><i className={`bi ${summary.icon}`} /></span>
                  <div>
                    <div className="summary-label">{summary.label}</div>
                    <div className="summary-value">{summary.value.toLocaleString('en-IN')}</div>
                    <div className="summary-meta">From app registrations</div>
                  </div>
                </article>
              ))}
            </div>

            <section className="card filter-bar" aria-label="Filter app users">
              <label className="search-control" aria-label="Search by name, email, phone, course, state, or user ID">
                <i className="bi bi-search search-icon" aria-hidden="true" />
                <input
                  className="filter-search"
                  type="search"
                  placeholder="Search name, email, phone, course, state or ID..."
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                />
              </label>
              <label className="sr-only" htmlFor="batch-filter">Filter by batch year</label>
              <select
                className="control"
                id="batch-filter"
                value={batchFilter}
                onChange={(event) => { setBatchFilter(event.target.value); setPage(1); }}
              >
                <option value="">All Batch Years</option>
                {batchYears.map((year) => <option value={year} key={year}>{year}</option>)}
              </select>
              <label className="sr-only" htmlFor="profile-filter">Filter by profile completion</label>
              <select
                className="control"
                id="profile-filter"
                value={profileFilter}
                onChange={(event) => { setProfileFilter(event.target.value); setPage(1); }}
              >
                <option value="">All Profiles</option>
                <option value="complete">Completed</option>
                <option value="incomplete">Incomplete</option>
              </select>
              <label className="sr-only" htmlFor="registration-filter">Filter by registration date</label>
              <select
                className="control"
                id="registration-filter"
                value={registrationFilter}
                onChange={(event) => { setRegistrationFilter(event.target.value); setPage(1); }}
              >
                <option value="">Any Registration Date</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <button className="button button-secondary" type="button" onClick={resetFilters}>
                <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset
              </button>
            </section>

            <section className="card table-card" aria-labelledby="student-list-title">
              <div className="table-heading">
                <div>
                  <h2 id="student-list-title">App Users</h2>
                  <p>Profile details provided by mobile app users. Email addresses are optional and not verified.</p>
                </div>
                <div className="table-heading-actions">
                  <button className="button button-secondary" type="button" onClick={exportUsers} disabled={loading || Boolean(error)}>
                    <i className="bi bi-download" aria-hidden="true" /> Export
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Enrolled Course</th>
                      <th>State</th>
                      <th>Batch Year</th>
                      <th>Registered</th>
                      <th>Last Login</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr className="empty-row"><td colSpan="11">Loading app users...</td></tr>}
                    {!loading && error && (
                      <tr className="empty-row">
                        <td colSpan="11">
                          <span role="alert">Could not load app users: {error}</span>{' '}
                          <button className="text-link" type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
                        </td>
                      </tr>
                    )}
                    {!loading && !error && visibleUsers.length === 0 && (
                      <tr className="empty-row"><td colSpan="11">No app users match these filters.</td></tr>
                    )}
                    {!loading && !error && visibleUsers.map((user, index) => {
                      const name = user.name?.trim() || 'Name not provided';
                      const initials = name === 'Name not provided'
                        ? '?'
                        : name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
                      const isComplete = user.profile_completed === true;
                      return (
                        <tr key={user.id}>
                          <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                          <td>
                            <div className="student-cell">
                              <span className="avatar">{initials}</span>
                              <span>
                                <strong>{name}</strong>
                                <small>ID: {String(user.id).slice(0, 8)}</small>
                              </span>
                            </div>
                          </td>
                          <td>{user.email || 'Not provided'}</td>
                          <td>{formatPhone(user)}</td>
                          <td>
                            {Array.isArray(user.enrolledCourses) && user.enrolledCourses.length
                              ? user.enrolledCourses.join(', ')
                              : 'Not enrolled'}
                          </td>
                          <td>{user.state || 'Not provided'}</td>
                          <td>{user.batchYear || 'Not provided'}</td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>{formatDateTime(user.lastLoginAt)}</td>
                          <td>
                            <span className={`status-pill ${isComplete ? 'active' : 'pending'}`}>
                              {isComplete ? 'Complete' : 'Incomplete'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="action-button"
                              type="button"
                              aria-label={`View details for ${name}`}
                              onClick={() => setSelectedUser(user)}
                            >
                              <i className="bi bi-eye" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                <div className="table-count" aria-live="polite">
                  {loading
                    ? 'Loading app users'
                    : `Showing ${filteredUsers.length ? (page - 1) * PAGE_SIZE + 1 : 0}-${Math.min(page * PAGE_SIZE, filteredUsers.length)} of ${filteredUsers.length} app users`}
                </div>
                <nav className="pagination" aria-label="App user list pages">
                  <button className="page-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page">‹</button>
                  <span className="page-button current" aria-current="page">{page}</span>
                  <button className="page-button" type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page">›</button>
                </nav>
              </div>
            </section>
          </section>
        </div>
      </main>

      {selectedUser && (
        <div
          className="modal-backdrop is-open"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedUser(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="details-title">
            <div className="modal-header">
              <div>
                <h2 id="details-title">{selectedUser.name?.trim() || 'App User Details'}</h2>
                <p>Profile information from the Splenexa app.</p>
              </div>
              <button className="button button-secondary" type="button" onClick={() => setSelectedUser(null)}>Close</button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Phone</span><strong>{formatPhone(selectedUser)}</strong></div>
              <div className="detail-item"><span>Email</span><strong>{selectedUser.email || 'Not provided'}</strong></div>
              <div className="detail-item">
                <span>Enrolled Course</span>
                <strong>
                  {Array.isArray(selectedUser.enrolledCourses) && selectedUser.enrolledCourses.length
                    ? selectedUser.enrolledCourses.join(', ')
                    : 'Not enrolled'}
                </strong>
              </div>
              <div className="detail-item"><span>Profile Status</span><strong>{selectedUser.profile_completed ? 'Complete' : 'Incomplete'}</strong></div>
              <div className="detail-item"><span>State</span><strong>{selectedUser.state || 'Not provided'}</strong></div>
              <div className="detail-item"><span>Batch Year</span><strong>{selectedUser.batchYear || 'Not provided'}</strong></div>
              <div className="detail-item"><span>Registered</span><strong>{formatDate(selectedUser.createdAt)}</strong></div>
              <div className="detail-item"><span>Last Login</span><strong>{formatDateTime(selectedUser.lastLoginAt)}</strong></div>
              <div className="detail-item"><span>Last Profile Update</span><strong>{formatDate(selectedUser.updatedAt)}</strong></div>
              <div className="detail-item"><span>App User ID</span><strong>{selectedUser.id}</strong></div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default memo(StudentsPage);
