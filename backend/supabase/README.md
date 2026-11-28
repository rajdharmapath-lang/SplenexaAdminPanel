# Supabase database and Edge Function setup

1. Create a Supabase project.
2. Configure the backend-only values `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `MSG91_AUTHKEY`, and
   `MSG91_WIDID` in `backend/.env`. Use the MSG91 AuthKey and Widget ID shown
   in the widget's server-side integration settings. `MSG91_TOKENAUTH` is a
   separate client-side widget token and must not be used as the backend
   `authkey` header. Use credentials from the Splenexa Supabase project only.
   For production, use a current non-JWT Supabase Secret API key. The legacy
   JWT-based service-role key is not accepted by the backend in production.
   Keep this key server-only; never include it in the app bundle.
3. Configure `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env`. These values are
   embedded in the app; never put a service-role key in this file. For an
   Android emulator using a backend on the same computer, use
   `http://10.0.2.2:3000` for `EXPO_PUBLIC_API_URL`. For a physical device,
   use the computer's LAN IP instead.
4. Apply `backend/supabase/migrations/20261022000000_create_users.sql` to the
   project database. The API accesses the table with a server-only Supabase
   secret key; client access for `anon` and `authenticated` is revoked.
5. Apply `backend/supabase/migrations/20261121000000_create_question_bank_catalog.sql`
   to create the shared Question Bank catalog. The backend accesses it through
   the existing Supabase client using `SUPABASE_URL` and a server-only
   `SUPABASE_SECRET_KEY`. Configure a unique
   `JWT_SECRET` in the backend environment. Apply
   `backend/supabase/migrations/20261122000000_create_admin_accounts.sql` and
   `backend/supabase/migrations/20261123000000_allow_multiple_accounts.sql`
   before using signup. Any number of users may create accounts with unique
   email addresses. Passwords are stored as scrypt hashes. The website checks
   email format but does not send an email verification message. Apply
   `backend/supabase/migrations/20261123000100_create_admin_sessions.sql` to
   enable server-side session verification and revocation when a user logs out.
   Each user gets an eight-hour session; the app reads active products and
   questions from `GET /api/question-bank`. Apply
   `backend/supabase/migrations/20261127000000_create_app_users.sql` to create
   the app-user table used by authenticated purchases.
6. Apply `backend/supabase/migrations/20261128000000_create_fee_plans_and_checkout.sql`
   after the app-user migration. It creates protected fee-plan, duration-price,
   Razorpay order/transaction, and purchased-plan entitlement tables. Fee plans
   are managed through the authenticated admin API and published plans are
   returned by `GET /api/fee-plans`.
7. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` only in the backend
   environment. Start with Razorpay test credentials and keep
   `RAZORPAY_ALLOW_LIVE=false`; live checkout requires setting it to `true`
   after testing. The mobile app uses only the public Key ID returned for a
   server-created order. The backend verifies Razorpay's signature and
   captured amount before recording a purchase. Mobile checkout currently
   supports one-time plans; subscription and installment payment flows are not
   implemented.
8. Install the Supabase CLI, authenticate, and link the `backend/` directory to
   the Splenexa Supabase project. Create an untracked
   `backend/supabase/.env.edge` file containing the same Splenexa `JWT_SECRET` used by the Express backend
   and the non-JWT `SUPABASE_SECRET_KEY`, then set them as Edge Function
   secrets:

   ```powershell
   cd backend
   supabase login
   supabase link --project-ref YOUR_SPLENEXA_PROJECT_REF
   supabase secrets set --env-file supabase/.env.edge
   supabase functions deploy super-worker
   ```

   The file should contain `JWT_SECRET=...` and
   `SUPABASE_SECRET_KEY=...`. Supabase provides `SUPABASE_URL` to the Edge
   Function from the linked project. Never copy values from the reference
   project or place a Supabase secret key in the frontend.

   `verify_jwt` is disabled for the Supabase gateway because Splenexa issues its
   own API session JWT rather than a Supabase Auth JWT. The function verifies
   that session signature and expiry itself before using the server-only
   Supabase secret key.

For production, deploy the backend and Edge Function on runtimes with
automatically synchronized system clocks (NTP). The app session JWT uses the
backend clock when issued and the Edge Function clock when validated; no
application code can compensate safely for an unsynchronized production host.

MSG91 sends and verifies phone OTPs. The backend accepts legacy environment
names `MSG91_AUTH_KEY` and `MSG91_WIDGET_ID` as aliases. After verification,
the API creates or loads the corresponding database user and returns a signed
API session token. The Expo app stores that token in SecureStore; the
`super-worker` Edge Function validates it before reading or updating only that
user's profile.
