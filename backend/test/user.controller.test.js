const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const userRepository = require('../src/db/user.repository');
const feePlanRepository = require('../src/db/fee-plan.repository');
const questionBankRepository = require('../src/db/question-bank.repository');
const userController = require('../src/controllers/user.controller');

function createResponse() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('admin app-user list returns records from the repository', async () => {
  const users = [{ id: 'user-id', name: 'Ada', phone: '9876543210' }];
  mock.method(userRepository, 'listAppUsers', async () => users);
  mock.method(feePlanRepository, 'getActiveEntitlementsForAdmin', async () => [{
    userId: 'user-id',
    planName: 'Foundation',
    productIds: ['product-id'],
  }]);
  mock.method(questionBankRepository, 'getProductNames', async () => [{
    id: 'product-id',
    name: 'Test Series',
  }]);
  const response = createResponse();

  try {
    await userController.listAdminAppUsers({}, response, (error) => { throw error; });
    assert.deepEqual(response.body, {
      users: [{ ...users[0], enrolledCourses: ['Test Series'] }],
    });
  } finally {
    mock.restoreAll();
  }
});

test('updateProfile normalizes an optional email address', async () => {
  let savedProfile;
  const user = { id: 'user-id', email: 'student@example.com' };
  mock.method(userRepository, 'updateProfile', async (_id, profile) => {
    savedProfile = profile;
    return user;
  });
  const response = createResponse();

  try {
    await userController.updateProfile({
      user: { id: 'user-id' },
      body: {
        name: 'Ada',
        state: 'Karnataka',
        batchYear: 2026,
        email: ' Ada@Example.com ',
      },
    }, response, (error) => { throw error; });
    assert.equal(savedProfile.email, 'ada@example.com');
    assert.equal(response.body.user, user);
  } finally {
    mock.restoreAll();
  }
});
