# Splenexa-Admin-Panel
Splenexa Web admin panel

The website signs in against the Splenexa backend before showing the dashboard.
For local development, copy `.env.example` to `.env.local` and set `VITE_API_URL`
to the backend URL. Apply the Question Bank catalog, account, and admin session
migrations in Supabase, then configure the backend's Supabase credentials and
`JWT_SECRET` in `backend/.env`. Anyone may create an account with a unique
email, and each user can sign in with that email and password. Passwords are
stored as scrypt hashes. Email format is validated, but the system does not
send verification emails. Sessions are checked and revoked by the backend on
logout. Never put backend credentials or account passwords in this website's
environment files.

The Students page lists profiles registered by the mobile app through the
admin-protected `GET /api/app-users/admin` endpoint. Apply
`backend/supabase/migrations/20261127000000_create_app_users.sql` to create the
app-user table and
`backend/supabase/migrations/20261128201000_add_app_user_email_and_last_login.sql`
to add optional email and last-login tracking before using the additional
Students fields. Existing users will show no email until they add one in the
mobile app, and last-login history starts when the updated backend is deployed.

For production builds, set `VITE_API_URL` to the publicly reachable backend
origin if it differs from the configured production default. Loopback URLs such
as `127.0.0.1` and `localhost` are ignored in production builds.

Admin modules use clean paths such as `/fmge-payments`. The production build
includes an Apache rewrite rule so direct visits and refreshes on these paths
serve the SPA entry point.
