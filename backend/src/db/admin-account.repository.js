const supabase = require('./supabase');

const ACCOUNT_FIELDS = 'admin_id, first_name, last_name, professional, mobile, email, password_hash';

async function createAdminAccount(account) {
  const { data, error } = await supabase
    .getClient()
    .from('admin_accounts')
    .insert({
      first_name: account.firstName,
      last_name: account.lastName,
      professional: account.professional,
      mobile: account.mobile,
      email: account.email,
      password_hash: account.password_hash,
    })
    .select(ACCOUNT_FIELDS)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

async function getAdminAccountByEmail(email) {
  const { data, error } = await supabase
    .getClient()
    .from('admin_accounts')
    .select(ACCOUNT_FIELDS)
    .eq('email', email)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

module.exports = { createAdminAccount, getAdminAccountByEmail };
