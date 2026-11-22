const supabase = require('./supabase');

async function createAdminSession(session) {
  const { error } = await supabase
    .getClient()
    .from('admin_sessions')
    .insert({
      jti: session.jti,
      admin_id: session.adminId,
      expires_at: session.expiresAt,
    });
  if (error) {
    throw error;
  }
}

async function getAdminSessionById(jti) {
  const { data, error } = await supabase
    .getClient()
    .from('admin_sessions')
    .select('jti, admin_id, expires_at, revoked_at')
    .eq('jti', jti)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function revokeAdminSession(jti) {
  const { data, error } = await supabase
    .getClient()
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('jti', jti)
    .is('revoked_at', null)
    .select('jti')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data);
}

module.exports = { createAdminSession, getAdminSessionById, revokeAdminSession };
