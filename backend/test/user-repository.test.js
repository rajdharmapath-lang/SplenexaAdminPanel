const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const supabase = require('../src/db/supabase');
const userRepository = require('../src/db/user.repository');

function createClient({ maybeSingle = [], single = [], lists = [] } = {}) {
  const tables = [];
  const inserts = [];
  const updates = [];
  const orders = [];
  const client = {
    from(table) {
      tables.push(table);
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        order(column, options) {
          orders.push({ column, options });
          return query;
        },
        maybeSingle: async () => maybeSingle.shift(),
        insert(values) {
          inserts.push(values);
          return query;
        },
        update(values) {
          updates.push(values);
          return query;
        },
        single: async () => single.shift(),
        then(resolve, reject) {
          return Promise.resolve(lists.shift()).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, tables, inserts, updates, orders };
}

test('getOrCreateUserByPhone reads and creates accounts in AppUsers', async () => {
  const user = {
    id: 'user-id',
    dial_code: '91',
    phone: '9876543210',
    email: null,
    name: null,
    state: null,
    batch_year: null,
    profile_completed: false,
    last_login_at: null,
  };
  const database = createClient({
    maybeSingle: [{ data: null, error: null }],
    single: [{ data: user, error: null }],
  });
  mock.method(supabase, 'getClient', () => database.client);

  try {
    const result = await userRepository.getOrCreateUserByPhone('+91', '987-654-3210');

    assert.deepEqual(database.tables, ['AppUsers', 'AppUsers']);
    assert.deepEqual(database.inserts, [{ dial_code: '91', phone: '9876543210' }]);
    assert.equal(result.created, true);
    assert.equal(result.user.phone, '9876543210');
  } finally {
    mock.restoreAll();
  }
});

test('getUserById reads profile details from AppUsers', async () => {
  const user = {
    id: 'user-id',
    dial_code: '91',
    phone: '9876543210',
    email: null,
    name: 'Ada',
    state: 'Karnataka',
    batch_year: 2026,
    profile_completed: true,
    last_login_at: null,
  };
  const database = createClient({ maybeSingle: [{ data: user, error: null }] });
  mock.method(supabase, 'getClient', () => database.client);

  try {
    const result = await userRepository.getUserById('user-id');

    assert.deepEqual(database.tables, ['AppUsers']);
    assert.equal(result.name, 'Ada');
    assert.equal(result.batchYear, 2026);
  } finally {
    mock.restoreAll();
  }
});

test('listAppUsers returns app profiles newest first with registration timestamps', async () => {
  const createdAt = '2026-11-28T10:00:00.000Z';
  const updatedAt = '2026-11-28T11:00:00.000Z';
  const database = createClient({
    lists: [{
      data: [{
        id: 'user-id',
        dial_code: '91',
        phone: '9876543210',
        email: 'ada@example.com',
        name: 'Ada',
        state: 'Karnataka',
        batch_year: 2026,
        profile_completed: true,
        last_login_at: '2026-11-28T12:00:00.000Z',
        created_at: createdAt,
        updated_at: updatedAt,
      }],
      error: null,
    }],
  });
  mock.method(supabase, 'getClient', () => database.client);

  try {
    const result = await userRepository.listAppUsers();

    assert.deepEqual(database.tables, ['AppUsers']);
    assert.deepEqual(database.orders, [{ column: 'created_at', options: { ascending: false } }]);
    assert.deepEqual(result, [{
      id: 'user-id',
      dialCode: '91',
      phone: '9876543210',
      email: 'ada@example.com',
      name: 'Ada',
      state: 'Karnataka',
      batchYear: 2026,
      profile_completed: true,
      lastLoginAt: '2026-11-28T12:00:00.000Z',
      createdAt,
      updatedAt,
    }]);
  } finally {
    mock.restoreAll();
  }
});

test('recordLogin updates the last app sign-in timestamp', async () => {
  const lastLoginAt = '2026-11-28T12:00:00.000Z';
  const database = createClient({
    single: [{
      data: {
        id: 'user-id',
        dial_code: '91',
        phone: '9876543210',
        email: null,
        name: 'Ada',
        state: 'Karnataka',
        batch_year: 2026,
        profile_completed: true,
        last_login_at: lastLoginAt,
      },
      error: null,
    }],
  });
  mock.method(supabase, 'getClient', () => database.client);

  try {
    const result = await userRepository.recordLogin('user-id');
    assert.ok(Number.isFinite(Date.parse(database.updates[0].last_login_at)));
    assert.equal(result.lastLoginAt, lastLoginAt);
  } finally {
    mock.restoreAll();
  }
});

test('updateProfile writes completed profile details to AppUsers', async () => {
  const user = {
    id: 'user-id',
    dial_code: '91',
    phone: '9876543210',
    email: null,
    name: 'Ada',
    state: 'Karnataka',
    batch_year: 2026,
    profile_completed: true,
    last_login_at: null,
  };
  const database = createClient({ single: [{ data: user, error: null }] });
  mock.method(supabase, 'getClient', () => database.client);

  try {
    const result = await userRepository.updateProfile('user-id', {
      name: ' Ada ',
      state: 'Karnataka',
      batchYear: 2026,
    });

    assert.deepEqual(database.tables, ['AppUsers']);
    const [updatedProfile] = database.updates;
    const { updated_at: updatedAt, ...profileFields } = updatedProfile;
    assert.deepEqual(profileFields, {
      name: 'Ada',
      state: 'Karnataka',
      batch_year: 2026,
      profile_completed: true,
    });
    assert.ok(Number.isFinite(Date.parse(updatedAt)));
    assert.equal(result.profile_completed, true);
  } finally {
    mock.restoreAll();
  }
});
