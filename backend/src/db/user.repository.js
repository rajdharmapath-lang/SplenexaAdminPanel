const supabase = require('./supabase');

const USER_FIELDS = 'id, dial_code, phone, email, name, state, batch_year, profile_completed, last_login_at';
const ADMIN_USER_FIELDS = `${USER_FIELDS}, created_at, updated_at`;

function unwrap(result) {
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

function toUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    dialCode: row.dial_code,
    phone: row.phone,
    email: row.email || null,
    name: row.name,
    state: row.state,
    batchYear: row.batch_year,
    profile_completed: Boolean(row.profile_completed),
    lastLoginAt: row.last_login_at || null,
  };
}

function toAdminUser(row) {
  return {
    ...toUser(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getUserById(userId) {
  const result = await supabase
    .getClient()
    .from('AppUsers')
    .select(USER_FIELDS)
    .eq('id', userId)
    .maybeSingle();
  return toUser(unwrap(result));
}

async function listAppUsers() {
  const result = await supabase
    .getClient()
    .from('AppUsers')
    .select(ADMIN_USER_FIELDS)
    .order('created_at', { ascending: false });
  return unwrap(result).map(toAdminUser);
}

async function recordLogin(userId) {
  const result = await supabase
    .getClient()
    .from('AppUsers')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId)
    .select(USER_FIELDS)
    .single();
  return toUser(unwrap(result));
}

async function getUserByPhone(dialCode, phone) {
  const result = await supabase
    .getClient()
    .from('AppUsers')
    .select(USER_FIELDS)
    .eq('dial_code', dialCode)
    .eq('phone', phone)
    .maybeSingle();
  return toUser(unwrap(result));
}

async function getOrCreateUserByPhone(dialCode, phone) {
  const normalizedDialCode = String(dialCode).replace(/\D/g, '');
  const normalizedPhone = String(phone).replace(/\D/g, '');
  const existingUser = await getUserByPhone(normalizedDialCode, normalizedPhone);
  if (existingUser) {
    return { user: existingUser, created: false };
  }

  const result = await supabase
    .getClient()
    .from('AppUsers')
    .insert({ dial_code: normalizedDialCode, phone: normalizedPhone })
    .select(USER_FIELDS)
    .single();

  if (!result.error) {
    return { user: toUser(result.data), created: true };
  }
  if (result.error.code !== '23505') {
    throw result.error;
  }

  const concurrentUser = await getUserByPhone(normalizedDialCode, normalizedPhone);
  if (!concurrentUser) {
    throw result.error;
  }
  return { user: concurrentUser, created: false };
}

async function updateProfile(userId, profile) {
  const values = {
    name: profile.name.trim(),
    state: profile.state,
    batch_year: profile.batchYear,
    profile_completed: true,
    updated_at: new Date().toISOString(),
  };
  if (profile.email !== undefined) {
    values.email = profile.email;
  }

  const result = await supabase
    .getClient()
    .from('AppUsers')
    .update(values)
    .eq('id', userId)
    .select(USER_FIELDS)
    .single();
  return toUser(unwrap(result));
}

module.exports = { getUserById, getOrCreateUserByPhone, listAppUsers, recordLogin, updateProfile };
