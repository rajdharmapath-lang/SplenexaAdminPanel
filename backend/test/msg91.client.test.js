const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const msg91 = require('../src/services/msg91.client');

function setMsg91Config() {
  const previous = {
    auth: process.env.MSG91_TOKEN_AUTH,
    widget: process.env.MSG91_WIDGET_ID,
  };
  process.env.MSG91_TOKEN_AUTH = 'test-auth-key';
  process.env.MSG91_WIDGET_ID = 'test-widget';
  return () => {
    if (previous.auth === undefined) delete process.env.MSG91_TOKEN_AUTH;
    else process.env.MSG91_TOKEN_AUTH = previous.auth;
    if (previous.widget === undefined) delete process.env.MSG91_WIDGET_ID;
    else process.env.MSG91_WIDGET_ID = previous.widget;
  };
}

test('sendOtp reports sanitized details when MSG91 rejects a widget request', async () => {
  const restoreConfig = setMsg91Config();
  mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      type: 'error',
      code: 'WIDGET_INACTIVE',
      message: 'Widget is inactive for 918072655035',
    }),
  }));

  try {
    await assert.rejects(msg91.sendOtp('918072655035'), (error) => {
      assert.equal(error.code, 'MSG91_PROVIDER_REJECTED');
      assert.equal(error.providerOperation, '/sendOtp');
      assert.equal(error.providerHttpStatus, 200);
      assert.equal(error.providerCode, 'WIDGET_INACTIVE');
      assert.equal(error.providerMessage, 'Widget is inactive for ***5035');
      assert.equal(JSON.stringify(error).includes('test-auth-key'), false);
      return true;
    });
  } finally {
    mock.restoreAll();
    restoreConfig();
  }
});

test('send, retry, and verify handle successful MSG91 responses', async () => {
  const restoreConfig = setMsg91Config();
  const responses = [
    { type: 'success', reqId: 'request-12345678' },
    { type: 'success' },
    { type: 'success' },
  ];
  mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => responses.shift(),
  }));

  try {
    const requestId = await msg91.sendOtp('918072655035');
    assert.equal(requestId, 'request-12345678');
    await msg91.retryOtp(requestId);
    assert.equal(await msg91.verifyOtp(requestId, '123456'), true);
  } finally {
    mock.restoreAll();
    restoreConfig();
  }
});
