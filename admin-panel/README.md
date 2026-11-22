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
