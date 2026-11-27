const test = require('node:test');
const assert = require('node:assert/strict');
const { getClient } = require('../src/db/supabase');

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

test.afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('production rejects the legacy JWT service-role key', () => {
  process.env.NODE_ENV = 'production';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'header.payload.signature';

  assert.throws(
    () => getClient(),
    (error) =>
      error.code === 'SUPABASE_NOT_CONFIGURED' &&
      /non-JWT SUPABASE_SECRET_KEY/.test(error.message),
  );
});

test('production rejects a JWT-shaped value configured as SUPABASE_SECRET_KEY', () => {
  process.env.NODE_ENV = 'production';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'header.payload.signature';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert.throws(
    () => getClient(),
    (error) =>
      error.code === 'SUPABASE_NOT_CONFIGURED' &&
      /non-JWT SUPABASE_SECRET_KEY/.test(error.message),
  );
});

test('production accepts an opaque Supabase secret key', () => {
  process.env.NODE_ENV = 'production';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert.ok(getClient());
});
