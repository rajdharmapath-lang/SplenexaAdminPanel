const { createClient } = require('@supabase/supabase-js');

let client;

function getClient() {
  if (client) {
    return client;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const allowsLegacyKey = ['development', 'test'].includes(process.env.NODE_ENV);
  const configuredSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const supabaseKey = (
    configuredSecretKey ||
    (allowsLegacyKey ? process.env.SUPABASE_SERVICE_ROLE_KEY : '') ||
    ''
  ).trim();
  const isJwtKey = supabaseKey.split('.').length === 3;
  if (
    !supabaseUrl ||
    !supabaseKey ||
    (!allowsLegacyKey && (!configuredSecretKey || isJwtKey))
  ) {
    const error = new Error(
      !allowsLegacyKey
        ? 'A non-JWT SUPABASE_SECRET_KEY is required outside development and test. Do not use the legacy SUPABASE_SERVICE_ROLE_KEY.'
        : 'Supabase backend is not configured. Set SUPABASE_URL and a server-side Supabase secret key in backend/.env.',
    );
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
  }

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

module.exports = { getClient };
