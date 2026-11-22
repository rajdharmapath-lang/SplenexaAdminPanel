const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const adminAccountRepository = require('../src/db/admin-account.repository');
const adminSessionRepository = require('../src/db/admin-session.repository');
const controller = require('../src/controllers/question-bank.controller');
const { requireQuestionBankAdmin } = require('../src/middleware/question-bank-admin.middleware');
const { verifyPassword } = require('../src/services/admin-password');

const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function validSignupBody() {
  return {
    firstName: 'Ada',
    lastName: 'Lovelace',
    professional: 'Doctor',
    mobile: '+1 555 123 4567',
    email: 'ada@example.com',
    password: 'a-unique-password-123',
  };
}

test('signup validates email and password before inserting an account', async () => {
  const createStub = mock.method(adminAccountRepository, 'createAdminAccount');
  try {
    const response = createResponse();
    await controller.signUpAdmin({
      body: { ...validSignupBody(), email: 'not-an-email' },
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 400);
    assert.equal(createStub.mock.callCount(), 0);
  } finally {
    mock.restoreAll();
  }
});

test('signup stores only a password hash and rejects a duplicate email', async () => {
  const createStub = mock.method(adminAccountRepository, 'createAdminAccount', async () => ({}));
  try {
    const response = createResponse();
    const body = validSignupBody();
    await controller.signUpAdmin({ body }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 201);
    const inserted = createStub.mock.calls[0].arguments[0];
    assert.notEqual(inserted.password_hash, body.password);
    assert.equal(await verifyPassword(body.password, inserted.password_hash), true);

    createStub.mock.mockImplementation(async () => {
      const error = new Error('duplicate admin');
      error.code = '23505';
      throw error;
    });
    const duplicateResponse = createResponse();
    await controller.signUpAdmin({ body }, duplicateResponse, (error) => { throw error; });
    assert.equal(duplicateResponse.statusCode, 409);
  } finally {
    mock.restoreAll();
  }
});

test('login rejects an incorrect password and signs a valid admin session', async () => {
  const passwordHash = await require('../src/services/admin-password').hashPassword('a-unique-password-123');
  mock.method(adminAccountRepository, 'getAdminAccountByEmail', async () => ({
    admin_id: 'f48f0e2d-f6c3-4f37-93ab-f60b43d522d9',
    email: 'ada@example.com',
    password_hash: passwordHash,
  }));
  const createSessionStub = mock.method(adminSessionRepository, 'createAdminSession', async () => {});
  try {
    const invalidResponse = createResponse();
    await controller.loginAdmin({
      body: { email: 'ada@example.com', password: 'wrong-password-123' },
    }, invalidResponse, (error) => { throw error; });
    assert.equal(invalidResponse.statusCode, 401);

    const validResponse = createResponse();
    await controller.loginAdmin({
      body: { email: ' ADA@EXAMPLE.COM ', password: 'a-unique-password-123' },
    }, validResponse, (error) => { throw error; });
    assert.equal(validResponse.statusCode, 200);
    const payload = jwt.verify(validResponse.body.token, process.env.JWT_SECRET);
    assert.equal(payload.purpose, 'question_bank_admin');
    assert.equal(payload.adminId, 'f48f0e2d-f6c3-4f37-93ab-f60b43d522d9');
    assert.equal(payload.jti, createSessionStub.mock.calls[0].arguments[0].jti);
    assert.equal(createSessionStub.mock.calls[0].arguments[0].adminId, payload.adminId);
  } finally {
    mock.restoreAll();
  }
});

test('logout revokes the authenticated session', async () => {
  const revokeStub = mock.method(adminSessionRepository, 'revokeAdminSession', async () => true);
  try {
    const response = createResponse();
    await controller.logoutAdmin({
      adminSession: { jti: '29efc068-b5ab-476b-a587-9043a5a58e0d' },
    }, response, (error) => { throw error; });

    assert.deepEqual(revokeStub.mock.calls[0].arguments, ['29efc068-b5ab-476b-a587-9043a5a58e0d']);
    assert.equal(response.statusCode, 200);
  } finally {
    mock.restoreAll();
  }
});

test('admin middleware accepts active sessions and rejects revoked sessions', async () => {
  const jti = '29efc068-b5ab-476b-a587-9043a5a58e0d';
  const adminId = 'f48f0e2d-f6c3-4f37-93ab-f60b43d522d9';
  const token = jwt.sign(
    { purpose: 'question_bank_admin', adminId, jti },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  );
  const sessionStub = mock.method(adminSessionRepository, 'getAdminSessionById', async () => ({
    jti,
    admin_id: adminId,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
  }));
  const response = createResponse();
  let nextCalled = false;
  const req = { get: () => `Bearer ${token}` };
  try {
    await requireQuestionBankAdmin(req, response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.adminSession.jti, jti);

    nextCalled = false;
    sessionStub.mock.mockImplementation(async () => ({
      jti,
      admin_id: adminId,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: new Date().toISOString(),
    }));
    await requireQuestionBankAdmin(req, response, () => { nextCalled = true; });
    assert.equal(response.statusCode, 401);
    assert.equal(nextCalled, false);
  } finally {
    mock.restoreAll();
  }
});

test.after(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});
