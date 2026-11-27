const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const msg91 = require('../src/services/msg91.client');

function setMsg91Config() {
  const names = [
    'MSG91_AUTHKEY',
    'MSG91_AUTH_KEY',
    'MSG91_TOKENAUTH',
    'MSG91_TOKEN_AUTH',
    'MSG91_WIDID',
    'MSG91_WIDGET_ID',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  process.env.MSG91_AUTHKEY = 'test-auth-key';
  process.env.MSG91_TOKENAUTH = 'client-widget-token';
  process.env.MSG91_WIDID = 'test-widget';
  return () => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
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
  const requests = [];
  const responses = [
    { type: 'success', reqId: 'request-12345678' },
    { type: 'success' },
    { type: 'success' },
  ];
  mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => responses.shift(),
    };
  });

  try {
    const requestId = await msg91.sendOtp('918072655035');
    assert.equal(requestId, 'request-12345678');
    assert.equal(requests[0].options.headers.authkey, 'test-auth-key');
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      widgetId: 'test-widget',
      identifier: '918072655035',
    });
    await msg91.retryOtp(requestId);
    assert.equal(await msg91.verifyOtp(requestId, '123456'), true);
  } finally {
    mock.restoreAll();
    restoreConfig();
  }
});

test('does not use the client widget token as the backend AuthKey', async () => {
  const names = [
    'MSG91_AUTHKEY',
    'MSG91_AUTH_KEY',
    'MSG91_TOKENAUTH',
    'MSG91_TOKEN_AUTH',
    'MSG91_WIDID',
    'MSG91_WIDGET_ID',
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  process.env.MSG91_TOKENAUTH = 'client-widget-token';
  process.env.MSG91_WIDID = 'test-widget';

  try {
    await assert.rejects(msg91.sendOtp('918072655035'), (error) => {
      assert.equal(error.code, 'MSG91_NOT_CONFIGURED');
      return true;
    });
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
