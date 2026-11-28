const test = require('node:test');
const mock = require('node:test').mock;
const assert = require('node:assert/strict');
const supabase = require('../src/db/supabase');
const controller = require('../src/controllers/question-bank.controller');
const repository = require('../src/db/question-bank.repository');
const feePlanRepository = require('../src/db/fee-plan.repository');

test('catalog reads product rows and maps them to the Question Bank API shape', async () => {
  const storedProduct = {
    product_id: 'product-1',
    name: 'FMGE Practice',
    description: 'Practice questions',
    access_type: 'Paid',
    is_active: true,
    supports_topics: true,
    is_review_enabled: false,
    icon_data_url: '',
    icon_bootstrap_class: 'bi bi-book-fill',
    show_icon: true,
  };
  const storedTest = {
    test_id: 'test-1',
    product_id: 'product-1',
    title: 'Mock Test',
    icon_bootstrap_class: 'bi bi-clipboard-check',
    add_topic_under_test: true,
    subject_id: 'subject-1',
    topic: 'Cardiology',
    topic_icon_bootstrap_class: 'bi bi-heart',
    question_ids: ['question-1'],
    question_selection_enabled: true,
    total_questions: 1,
    total_marks: '2.5',
    marks_per_question: '2.5',
    marks_enabled: true,
    negative_marking: '0.5',
    negative_marking_enabled: true,
    start_date_time_enabled: true,
    start_at: '2026-11-22T09:00:00.000Z',
    end_date_time_enabled: false,
    end_at: null,
    duration_enabled: true,
    duration_minutes: 60,
    is_published: false,
    created_at: '2026-11-20T09:00:00.000Z',
  };
  const catalogQuery = {
    select() { return this; },
    eq() { return this; },
    async maybeSingle() {
      return {
        data: {
          subjects: [{ id: 'subject-1' }],
          questions: [{
            id: 'question-1',
            questionHtml: '<p>Question text</p>',
            explanationHtml: '<p>Explanation</p>',
            options: ['A', 'B', 'C', 'D'],
            answer: null,
            difficulty: 'Hard',
            tags: ['cardiology'],
          }],
        },
        error: null,
      };
    },
  };
  const productQuery = {
    select() { return this; },
    order() { return this; },
    then(resolve, reject) {
      return Promise.resolve({ data: [storedProduct], error: null }).then(resolve, reject);
    },
  };
  const testQuery = {
    select() { return this; },
    order() { return this; },
    then(resolve, reject) {
      return Promise.resolve({ data: [storedTest], error: null }).then(resolve, reject);
    },
  };
  const client = {
    from(table) {
      if (table === 'question_bank_catalog') return catalogQuery;
      if (table === 'question_bank_products') return productQuery;
      return testQuery;
    },
  };
  const getClientStub = mock.method(supabase, 'getClient', () => client);

  try {
    assert.deepEqual(await repository.getCatalog(), {
      products: [{
        id: 'product-1',
        name: 'FMGE Practice',
        description: 'Practice questions',
        accessType: 'Paid',
        isActive: true,
        supportsTopics: true,
        isReviewEnabled: false,
        iconDataUrl: '',
        iconBootstrapClass: 'bi bi-book-fill',
        showIcon: true,
      }],
      subjects: [{ id: 'subject-1' }],
      questions: [{
        id: 'question-1',
        questionHtml: '<p>Question text</p>',
        explanationHtml: '<p>Explanation</p>',
        options: ['A', 'B', 'C', 'D'],
        answer: null,
        difficulty: 'Hard',
        tags: ['cardiology'],
      }],
      tests: [{
        id: 'test-1',
        productId: 'product-1',
        title: 'Mock Test',
        iconBootstrapClass: 'bi bi-clipboard-check',
        addTopicUnderTest: true,
        subjectId: 'subject-1',
        topic: 'Cardiology',
        topicIconBootstrapClass: 'bi bi-heart',
        questionIds: ['question-1'],
        questionSelectionEnabled: true,
        totalQuestions: 1,
        totalMarks: 2.5,
        marksPerQuestion: 2.5,
        marksEnabled: true,
        negativeMarking: 0.5,
        negativeMarkingEnabled: true,
        startDateTimeEnabled: true,
        startAt: '2026-11-22T09:00:00.000Z',
        endDateTimeEnabled: false,
        endAt: null,
        durationEnabled: true,
        durationMinutes: 60,
        isPublished: false,
        createdAt: '2026-11-20T09:00:00.000Z',
      }],
    });
    assert.equal(getClientStub.mock.callCount(), 1);
  } finally {
    mock.restoreAll();
  }
});

test('app catalog exposes only entitled or free Question Bank content', async () => {
  mock.method(repository, 'getCatalog', async () => ({
    products: [
      { id: 'paid-product', name: 'Paid product', accessType: 'Paid', isActive: true },
      { id: 'free-product', name: 'Free product', accessType: 'Free', isActive: true },
      { id: 'unpaid-product', name: 'Unpaid product', accessType: 'Paid', isActive: true },
      { id: 'inactive-product', isActive: false },
    ],
    subjects: [
      { id: 'paid-subject', productId: 'paid-product' },
      { id: 'free-subject', productId: 'free-product' },
      { id: 'unpaid-subject', productId: 'unpaid-product' },
      { id: 'inactive-subject', productId: 'inactive-product' },
    ],
    questions: [
      {
        id: 'paid-question',
        productId: 'paid-product',
        status: 'Active',
        answer: null,
        difficulty: 'Medium',
        tags: ['cardiology'],
      },
      { id: 'free-question', productId: 'free-product', status: 'Active' },
      { id: 'unpaid-question', productId: 'unpaid-product', status: 'Active' },
      { id: 'inactive-question', productId: 'inactive-product', status: 'Active' },
    ],
    tests: [
      { id: 'paid-test', productId: 'paid-product' },
      { id: 'free-test', productId: 'free-product' },
      { id: 'unpaid-test', productId: 'unpaid-product' },
      { id: 'inactive-test', productId: 'inactive-product' },
    ],
  }));
  mock.method(feePlanRepository, 'getUserEntitlements', async () => [
    { productIds: ['paid-product'] },
  ]);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await controller.getAppCatalog({ user: { id: 'user-1' } }, response, (error) => { throw error; });
    assert.deepEqual(response.body.products.map((item) => [item.id, item.hasAccess]), [
      ['paid-product', true],
      ['free-product', true],
      ['unpaid-product', false],
    ]);
    assert.deepEqual(response.body.subjects.map((item) => item.id), ['paid-subject', 'free-subject']);
    assert.deepEqual(response.body.questions, [{
      id: 'paid-question',
      productId: 'paid-product',
      status: 'Active',
      answer: null,
      difficulty: 'Medium',
      tags: ['cardiology'],
    }, { id: 'free-question', productId: 'free-product', status: 'Active' }]);
    assert.deepEqual(response.body.tests.map((item) => item.id), ['paid-test', 'free-test']);
  } finally {
    mock.restoreAll();
  }
});

test('duplicate question text returns a conflict to the admin editor', async () => {
  mock.method(repository, 'saveCatalog', async () => {
    throw Object.assign(new Error('Question text must be unique across the Question Bank.'), {
      code: '23505',
    });
  });
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await controller.saveAdminCatalog({
      body: { products: [], subjects: [], questions: [] },
    }, response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.message, 'Question text must be unique across the Question Bank.');
  } finally {
    mock.restoreAll();
  }
});

test('catalog saves products and related data through the database transaction', async () => {
  const catalog = {
    products: [{
      id: 'product-1',
      name: 'FMGE Practice',
      isReviewEnabled: true,
    }],
    subjects: [],
    questions: [{
      id: 'question-1',
      questionHtml: '<p>Question text</p>',
      explanationHtml: '<p>Explanation</p>',
      options: ['A', 'B', 'C', 'D'],
      answer: null,
      difficulty: 'Hard',
      tags: ['cardiology'],
    }],
    tests: [{
      id: 'test-1',
      productId: 'product-1',
      title: 'FMGE Practice',
      questionIds: [],
    }],
  };
  let rpcCall;
  const client = {
    async rpc(name, parameters) {
      rpcCall = { name, parameters };
      return { data: catalog, error: null };
    },
  };
  const getClientStub = mock.method(supabase, 'getClient', () => client);

  try {
    assert.deepEqual(await repository.saveCatalog(catalog), catalog);
    assert.deepEqual(rpcCall, {
      name: 'save_question_bank_catalog',
      parameters: {
        p_products: catalog.products,
        p_subjects: catalog.subjects,
        p_questions: catalog.questions,
        p_tests: catalog.tests,
      },
    });
    assert.equal(getClientStub.mock.callCount(), 1);
  } finally {
    mock.restoreAll();
  }
});
