// Runs once after the JSX markup mounts.
import { loadAdminCatalog, saveAdminCatalog } from '../../services/questionBankApi';
import { navigate } from '../../routes';
import { normalizeBootstrapIcon, normalizeIconValue, normalizeImageUrl } from '../../utils/iconValue';

export default async function init(document, window) {
  const productStorageKey = 'fmge-question-bank-products';
  const subjectStorageKey = 'fmge-question-bank-subjects';
  const questionStorageKey = 'fmge-question-bank-questions';
  let cachedCatalog = { products: [], subjects: [], questions: [], tests: [] };
  try {
    cachedCatalog = {
      products: JSON.parse(window.sessionStorage.getItem(productStorageKey) || '[]'),
      subjects: JSON.parse(window.sessionStorage.getItem(subjectStorageKey) || '[]'),
      questions: JSON.parse(window.sessionStorage.getItem(questionStorageKey) || '[]'),
      tests: JSON.parse(window.sessionStorage.getItem('fmge-question-bank-tests') || '[]'),
    };
  } catch (error) {
    console.error('Could not read the previous Question Bank browser cache.', error);
  }
  let products = [];
  let subjects = [];
  let questions = [];
  let tests = [];
  let catalogNeedsSave = false;
  try {
    const catalog = await loadAdminCatalog(window);
    const remoteHasContent = catalog.products.length || catalog.subjects.length || catalog.questions.length || catalog.tests.length;
    const localHasContent = cachedCatalog.products.length || cachedCatalog.subjects.length || cachedCatalog.questions.length || cachedCatalog.tests.length;
    const source = !remoteHasContent && localHasContent ? cachedCatalog : catalog;
    catalogNeedsSave = source === cachedCatalog;
    products = source.products;
    subjects = source.subjects;
    questions = source.questions;
    tests = catalog.tests.length ? catalog.tests : cachedCatalog.tests;
    if (!catalog.tests.length && cachedCatalog.tests.length) catalogNeedsSave = true;
    window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
  } catch (error) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '<div class="product-empty"><strong>Question Bank could not be loaded</strong>' +
      escapeHtml(error.message) + '</div>';
    console.error('Could not load the Question Bank catalog from the backend.', error);
    window.alert('Question Bank could not be loaded. Check the backend URL and admin token, then reload this page.');
    return;
  }
  function createId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'product-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  const knownQuestionIds = new Set();
  if (subjects.some(function (subject) { return !subject.productId; })) {
    let legacyProduct = products.find(function (product) { return product.name === 'FMGE Q-Bank'; });
    if (!legacyProduct) {
      legacyProduct = { id: createId(), name: 'FMGE Q-Bank', description: 'Migrated existing question bank content.', accessType: 'Paid', isActive: true, supportsTopics: true };
      products.push(legacyProduct);
    }
    subjects.forEach(function (subject) { if (!subject.productId) subject.productId = legacyProduct.id; });
    catalogNeedsSave = true;
  }
  subjects.forEach(function (subject) {
    if (!subject.id) {
      subject.id = createId();
      catalogNeedsSave = true;
    }
    if (!Array.isArray(subject.topics)) subject.topics = [];
    if (!subject.topicIcons || typeof subject.topicIcons !== 'object' || Array.isArray(subject.topicIcons)) subject.topicIcons = {};
    subject.topics.sort(function (left, right) { return left.localeCompare(right); });
  });
  products.forEach(function (product) {
    if (typeof product.supportsTopics !== 'boolean') {
      product.supportsTopics = subjects.some(function (subject) { return subject.productId === product.id && subject.topics.length > 0; }) || product.name === 'FMGE Q-Bank';
      catalogNeedsSave = true;
    }
    if (typeof product.isReviewEnabled !== 'boolean') {
      product.isReviewEnabled = false;
      catalogNeedsSave = true;
    }
  });
  questions.forEach(function (question) {
    if (!question.id || knownQuestionIds.has(String(question.id))) {
      question.id = createId();
      catalogNeedsSave = true;
    }
    knownQuestionIds.add(String(question.id));
    if (!question.productId) {
      const owner = question.product
        ? products.find(function (product) { return product.name === question.product; })
        : null;
      const subject = subjects.find(function (item) { return item.name === question.subject; });
      if (owner) question.productId = owner.id;
      else if (subject) question.productId = subject.productId;
      if (question.productId) catalogNeedsSave = true;
    }
  });
  function persistCatalog() {
    window.sessionStorage.setItem(productStorageKey, JSON.stringify(products));
    window.sessionStorage.setItem(subjectStorageKey, JSON.stringify(subjects));
    window.sessionStorage.setItem(questionStorageKey, JSON.stringify(questions));
    tests = tests.filter(function (test) {
      return products.some(function (product) { return String(product.id) === String(test.productId); });
    });
    window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
    saveAdminCatalog({ products: products, subjects: subjects, questions: questions, tests: tests }, window).catch(function (error) {
      console.error('Could not save the Question Bank catalog to the backend.', error);
      window.alert('The Question Bank change was not saved to the shared database. ' + error.message);
    });
  }
  function syncTestQuestionCounts(skipSave) {
    let hasChanges = false;
    tests.forEach(function (test) {
      const subject = subjects.find(function (item) { return item.id === test.subjectId; });
      if (!subject) return;
      const matchingQuestions = questions.filter(function (question) {
        return question.productId === test.productId &&
          question.subject === subject.name &&
          (test.topic ? question.topic === test.topic : !question.topic);
      });
      let selectedQuestions = matchingQuestions;
      if (test.questionSelectionEnabled) {
        const previousQuestionIds = JSON.stringify(test.questionIds || []);
        const selectedIds = new Set((Array.isArray(test.questionIds) ? test.questionIds : []).map(String));
        selectedQuestions = matchingQuestions.filter(function (question) { return selectedIds.has(String(question.id)); });
        test.questionIds = selectedQuestions.map(function (question) { return String(question.id); });
        if (previousQuestionIds !== JSON.stringify(test.questionIds)) hasChanges = true;
      }
      const totalQuestions = selectedQuestions.length;
      const totalMarks = totalQuestions * (test.marksEnabled ? Number(test.marksPerQuestion) || 0 : 0);
      if (test.totalQuestions !== totalQuestions || test.totalMarks !== totalMarks) hasChanges = true;
      test.totalQuestions = totalQuestions;
      test.totalMarks = totalMarks;
    });
    window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
    if (hasChanges && !skipSave) persistCatalog();
    return hasChanges;
  }
  const testCountsChanged = syncTestQuestionCounts(true);
  if (catalogNeedsSave || testCountsChanged) persistCatalog();
  let currentProductId = null;
  let editingProductId = null;
  let editingProductIconDataUrl = '';
  let editingItem = null;
  const productBrowser = document.getElementById('product-browser');
  const productList = document.getElementById('product-list');
  const subjectView = document.getElementById('question-list');
  const subjectList = document.getElementById('subject-list');
  const topicCreateQuestion = document.getElementById('create-question-from-topic');
  const backQuestionList = document.getElementById('back-question-list');
  const createTestFromProduct = document.getElementById('create-test-from-product');
  const subjectDialog = document.getElementById('create-subject-dialog');
  const productDialog = document.getElementById('product-dialog');

  function activeProduct() {
    return products.find(function (product) { return product.id === currentProductId; });
  }

  function subjectSupportsTopics(subject) {
    return typeof subject.supportsTopics === 'boolean' ? subject.supportsTopics : Boolean(activeProduct()?.supportsTopics);
  }

  function renderProducts() {
    if (!products.length) {
      productList.innerHTML = '<div class="product-empty"><i class="bi bi-box-seam"></i><strong>No products yet</strong>Create a product to start organizing subjects and questions.</div>';
      return;
    }
    productList.innerHTML = products.map(function (product) {
      const questionCount = questions.filter(function (question) { return question.productId === product.id; }).length;
      const iconDataUrl = /^data:image\/(?:png|jpeg|webp);base64,/i.test(product.iconDataUrl || '') ? product.iconDataUrl : '';
      const iconClass = normalizeBootstrapIcon(product.iconBootstrapClass);
      const productIcon = product.showIcon && iconClass
        ? '<i class="' + escapeHtml(iconClass) + '"></i>'
        : product.showIcon && iconDataUrl
          ? '<img src="' + escapeHtml(iconDataUrl) + '" alt="" />'
          : '<i class="bi bi-box-seam-fill"></i>';
      return '<article class="product-card" data-product-id="' + escapeHtml(product.id) + '" tabindex="0" role="group" aria-label="' + escapeHtml(product.name) + ' product">' +
        '<div class="product-card-head"><div class="product-card-info"><span class="product-card-icon">' + productIcon + '</span><div><h3>' + escapeHtml(product.name) + '</h3><p>' + escapeHtml(product.description || 'No description provided.') + '</p></div></div>' +
        '<div class="product-card-actions">' +
        '<button type="button" class="product-actions-toggle" aria-label="More actions for ' + escapeHtml(product.name) + '" aria-haspopup="menu" aria-expanded="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></button>' +
        '<div class="product-action-menu" role="menu" hidden><button type="button" class="edit-product-action" data-product-id="' + escapeHtml(product.id) + '" role="menuitem"><i class="bi bi-pencil-fill"></i>Edit</button><button type="button" class="delete-product" data-product-id="' + escapeHtml(product.id) + '" role="menuitem"><i class="bi bi-trash3-fill"></i>Delete</button></div>' +
        '</div></div><hr class="product-card-divider" /><div class="product-card-footer">' +
        '<span class="product-badge ' + (product.accessType === 'Free' ? 'free' : '') + '">' + escapeHtml(product.accessType || 'Paid') + '</span>' +
        '<span class="product-badge question-count">Questions: ' + questionCount.toLocaleString('en-US') + '</span>' +
        '<span class="product-badge">' + (product.supportsTopics ? 'Subjects + Topics' : 'Subject only') + '</span>' +
        '<span class="product-badge">Review: ' + (product.isReviewEnabled ? 'Immediate' : 'After completion') + '</span>' +
        '<span class="product-badge ' + (product.isActive ? 'active' : 'inactive') + '">' + (product.isActive ? 'Active' : 'Inactive') + '</span>' +
        '</div></article>';
    }).join('');
  }

  function openProduct(productId) {
    const product = products.find(function (item) { return item.id === productId; });
    if (!product) return;
    currentProductId = product.id;
    subjectView.dataset.product = product.name;
    subjectView.dataset.productId = product.id;
    productBrowser.classList.add('hidden');
    subjectView.classList.add('on');
    document.getElementById('active-product-title').textContent = product.name;
    openSubjects();
  }

  createTestFromProduct.addEventListener('click', function () {
    const product = activeProduct();
    if (!product) return;
    navigate('fmge-create-test?product=' + encodeURIComponent(product.name) + '&productId=' + encodeURIComponent(product.id));
  });

  function showProducts() {
    currentProductId = null;
    subjectView.classList.remove('on');
    productBrowser.classList.remove('hidden');
    renderProducts();
  }

  function openProductDialog(product) {
    editingProductId = product ? product.id : null;
    editingProductIconDataUrl = product ? product.iconDataUrl || '' : '';
    document.getElementById('product-dialog-title').innerHTML = '<i class="bi bi-' + (product ? 'pencil-fill' : 'box-seam-fill') + '"></i> ' + (product ? 'Edit Product' : 'Create Product');
    document.getElementById('product-name').value = product ? product.name : '';
    document.getElementById('product-description').value = product ? product.description || '' : '';
    document.querySelectorAll('input[name="product-access"]').forEach(function (input) {
      input.checked = input.value === (product ? product.accessType : 'Paid');
    });
    document.getElementById('product-active').checked = product ? Boolean(product.isActive) : true;
    document.getElementById('product-topics-enabled').checked = product ? Boolean(product.supportsTopics) : true;
    document.querySelectorAll('input[name="product-review-enabled"]').forEach(function (input) {
      input.checked = input.value === String(product ? Boolean(product.isReviewEnabled) : false);
    });
    document.getElementById('product-icon-enabled').checked = product ? Boolean(product.showIcon) : true;
    document.getElementById('product-icon-code').value = product ? product.iconBootstrapClass || '' : '';
    document.getElementById('product-icon-file').value = '';
    document.getElementById('product-icon-name').textContent = editingProductIconDataUrl ? 'Current icon selected' : 'PNG, JPG, or WebP · up to 256 KB';
    renderProductIconPreview();
    document.getElementById('save-product').textContent = product ? 'Save Changes' : 'Create Product';
    productDialog.classList.add('on');
    document.getElementById('product-name').focus();
  }

  function closeProductDialog() {
    productDialog.classList.remove('on');
    editingProductId = null;
    editingProductIconDataUrl = '';
  }

  function renderProductIconPreview() {
    const preview = document.getElementById('product-icon-preview');
    const removeButton = document.getElementById('product-icon-remove');
    const isValidIcon = /^data:image\/(?:png|jpeg|webp);base64,/i.test(editingProductIconDataUrl);
    const iconClass = normalizeBootstrapIcon(document.getElementById('product-icon-code').value);
    document.getElementById('product-icon-code-preview').className = iconClass || 'bi bi-box-seam-fill';
    preview.innerHTML = iconClass
      ? '<i class="' + escapeHtml(iconClass) + '" aria-hidden="true"></i>'
      : isValidIcon
        ? '<img src="' + escapeHtml(editingProductIconDataUrl) + '" alt="Product icon preview" />'
        : '<i class="bi bi-image"></i>';
    removeButton.hidden = !isValidIcon;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function renderTopicIconPreview(value) {
    const preview = document.getElementById('topic-icon-code-preview');
    const iconUrl = normalizeImageUrl(value);
    const iconClass = normalizeBootstrapIcon(value) || 'bi bi-bookmark-fill';
    preview.innerHTML = iconUrl
      ? '<img src="' + escapeHtml(iconUrl) + '" alt="" />'
      : '<i class="' + escapeHtml(iconClass) + '" aria-hidden="true"></i>';
  }

  function openNameDialog(type, index) {
    const isSubject = type === 'subject';
    const item = isSubject ? subjects[index] : subjects[Number(subjectView.dataset.subjectIndex)].topics[index];
    if (!item) return;
    editingItem = { type: type, index: index, oldName: isSubject ? item.name : item };
    document.getElementById('subject-dialog-title').innerHTML = '<i class="bi bi-pencil-fill"></i> Edit ' + (isSubject ? 'Subject' : 'Topic');
    document.getElementById('subject-dialog-label').textContent = (isSubject ? 'Subject' : 'Topic') + ' Name';
    document.getElementById('new-subject-name').value = editingItem.oldName;
    document.getElementById('topic-icon-code-field').hidden = isSubject;
    if (!isSubject) {
      const subject = subjects[Number(subjectView.dataset.subjectIndex)];
      const iconValue = subject.topicIcons[item] || '';
      document.getElementById('topic-icon-code').value = iconValue;
      renderTopicIconPreview(iconValue);
    } else {
      document.getElementById('topic-icon-code').value = '';
      renderTopicIconPreview('');
    }
    document.getElementById('save-create-subject').textContent = 'Save Changes';
    subjectDialog.classList.add('on');
    document.getElementById('new-subject-name').focus();
  }

  function closeNameDialog() {
    editingItem = null;
    subjectDialog.classList.remove('on');
    document.getElementById('subject-dialog-title').innerHTML = '<i class="bi bi-plus-circle-fill"></i> Create Subject';
    document.getElementById('subject-dialog-label').textContent = 'Subject Name';
    document.getElementById('topic-icon-code-field').hidden = true;
    document.getElementById('topic-icon-code').value = '';
    renderTopicIconPreview('');
    document.getElementById('save-create-subject').textContent = 'Save';
  }

  function categoryActions(type, index) {
    const itemName = type === 'subject' ? subjects[index].name : subjects[Number(subjectView.dataset.subjectIndex)].topics[index];
    const deleteClass = type === 'subject' ? 'delete-subject' : 'delete-topic';
    const title = type === 'subject' ? 'subject' : 'topic';
    return '<div class="category-card-actions">' +
      '<button type="button" class="edit-' + title + '" data-' + title + '-index="' + index + '" title="Edit ' + title + '" aria-label="Edit ' + title + '"><i class="bi bi-pencil-fill"></i></button>' +
      '<div class="category-menu-wrap"><button type="button" class="category-actions-toggle" aria-label="More actions for ' + escapeHtml(itemName) + '" aria-haspopup="menu" aria-expanded="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></button>' +
      '<div class="category-action-menu" role="menu" hidden><button type="button" class="' + deleteClass + '" data-' + title + '-index="' + index + '" role="menuitem"><i class="bi bi-trash3-fill"></i>Delete</button></div></div></div>';
  }

  function renderSubjects() {
    subjectList.classList.remove('question-items');
    const productSubjects = subjects.map(function (subject, subjectIndex) {
      return { subject: subject, index: subjectIndex };
    }).filter(function (item) { return item.subject.productId === currentProductId; });
    subjectList.innerHTML = productSubjects.map(function (item) {
      const subject = item.subject;
      const subjectIndex = item.index;
      const questionCount = questions.filter(function (question) { return question.productId === currentProductId && question.subject === subject.name; }).length;
      const topicCount = subject.topics.length;
      return '<article class="subject-card category-card" data-subject-index="' + subjectIndex + '" tabindex="0" role="group" aria-label="' + escapeHtml(subject.name) + ' subject">' +
        '<div class="category-card-head"><div class="category-card-info"><h3>' + escapeHtml(subject.name) + '</h3><p>' + topicCount + ' ' + (topicCount === 1 ? 'topic' : 'topics') + '</p></div>' +
        categoryActions('subject', subjectIndex) + '</div><hr class="category-card-divider" /><div class="category-card-footer"><span class="product-badge question-count">Questions: ' + questionCount.toLocaleString('en-US') + '</span></div></article>';
    }).join('') || '<p class="empty-topics">No subjects yet. Create a subject to start adding topics and questions.</p>';
  }

  function renderTopics(subjectIndex) {
    subjectList.classList.remove('question-items');
    const subject = subjects[subjectIndex];
    subjectList.innerHTML = subject.topics.map(function (topic, topicIndex) {
      const questionCount = questions.filter(function (question) {
        return question.productId === currentProductId && question.subject === subject.name && question.topic === topic;
      }).length;
      const iconValue = subject.topicIcons[topic] || '';
      const iconUrl = normalizeImageUrl(iconValue);
      const iconClass = normalizeBootstrapIcon(iconValue) || 'bi bi-bookmark-fill';
      const iconMarkup = iconUrl
        ? '<img src="' + escapeHtml(iconUrl) + '" alt="" />'
        : '<i class="' + escapeHtml(iconClass) + '"></i>';
      return '<article class="topic-card category-card" data-topic="' + encodeURIComponent(topic) + '" data-topic-index="' + topicIndex + '" tabindex="0" role="group" aria-label="' + escapeHtml(topic) + ' topic">' +
        '<div class="category-card-head"><span class="topic-card-icon">' + iconMarkup + '</span><div class="category-card-info"><h3>' + escapeHtml(topic) + '</h3><p>' + escapeHtml(subject.name) + '</p></div>' +
        categoryActions('topic', topicIndex) + '</div><hr class="category-card-divider" /><div class="category-card-footer"><span class="product-badge question-count">Questions: ' + questionCount.toLocaleString('en-US') + '</span></div></article>';
    }).join('') || '<p class="empty-topics">No topics added yet.</p>';
  }

  function renderQuestions(subjectName, topicName) {
    subjectList.classList.add('question-items');
    const topicQuestions = questions.filter(function (question) {
      return question.subject === subjectName && (topicName ? question.topic === topicName : !question.topic) && question.productId === currentProductId;
    });
    subjectList.innerHTML = topicQuestions.map(function (question, index) {
      const questionIndex = questions.indexOf(question);
      return '<article class="question-card category-card" data-question-index="' + questionIndex + '">' +
        '<div class="category-card-head"><div class="category-card-info"><h3>' + escapeHtml(question.text || 'Untitled question') + '</h3><p>Question ' + (index + 1) + '</p></div>' +
        '<div class="category-card-actions">' +
        '<button type="button" class="view-saved-question" data-question-index="' + questionIndex + '" title="View question" aria-label="View question"><i class="bi bi-eye-fill"></i></button>' +
        '<button type="button" class="edit-saved-question" data-question-index="' + questionIndex + '" title="Edit question" aria-label="Edit question"><i class="bi bi-pencil-fill"></i></button>' +
        '<div class="category-menu-wrap"><button type="button" class="category-actions-toggle" aria-label="More actions for question ' + (index + 1) + '" aria-haspopup="menu" aria-expanded="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg></button>' +
        '<div class="category-action-menu" role="menu" hidden><button type="button" class="delete-saved-question" data-question-index="' + questionIndex + '" role="menuitem"><i class="bi bi-trash3-fill"></i>Delete</button></div></div>' +
        '</div></div><hr class="category-card-divider" /></article>';
    }).join('') || '<p class="empty-topics">No questions added for this ' + (topicName ? 'topic' : 'subject') + ' yet.</p>';
  }

  function openQuestions(subjectIndex, topicName) {
    const subject = subjects[subjectIndex];
    subjectView.dataset.subjectIndex = String(subjectIndex);
    if (topicName) subjectView.dataset.topic = topicName;
    else subjectView.removeAttribute('data-topic');
    document.getElementById('question-list-title').textContent = topicName ? topicName + ' Questions' : subject.name + ' Questions';
    createTestFromProduct.style.display = 'none';
    document.getElementById('create-subject-from-product').hidden = true;
    topicCreateQuestion.style.display = 'inline-flex';
    backQuestionList.style.display = 'inline-flex';
    backQuestionList.querySelector('span').textContent = topicName ? 'Back to Topics' : 'Back to Subjects';
    subjectView.classList.add('on');
    renderQuestions(subject.name, topicName);
  }

  function openTopics(subjectIndex) {
    const subject = subjects[subjectIndex];
    subjectView.dataset.subjectIndex = String(subjectIndex);
    subjectView.removeAttribute('data-topic');
    document.getElementById('question-list-title').textContent = subject.name + ' Topics';
    createTestFromProduct.style.display = 'none';
    document.getElementById('create-subject-from-product').innerHTML = '<i class="bi bi-plus-circle"></i> Add Topic';
    document.getElementById('create-subject-from-product').hidden = false;
    topicCreateQuestion.style.display = 'none';
    backQuestionList.style.display = 'inline-flex';
    backQuestionList.querySelector('span').textContent = 'Back to Subjects';
    subjectView.classList.add('on');
    renderTopics(subjectIndex);
  }

  function openSubjects() {
    subjectView.removeAttribute('data-subject-index');
    subjectView.removeAttribute('data-topic');
    const product = activeProduct();
    if (!product) return showProducts();
    subjectView.dataset.product = product.name;
    subjectView.dataset.productId = product.id;
    document.getElementById('question-list-title').textContent = 'Subjects';
    createTestFromProduct.style.display = '';
    document.getElementById('create-subject-from-product').innerHTML = '<i class="bi bi-plus-circle"></i> Create Subject';
    document.getElementById('create-subject-from-product').hidden = false;
    topicCreateQuestion.style.display = 'none';
    backQuestionList.style.display = 'inline-flex';
    backQuestionList.querySelector('span').textContent = 'Back to Products';
    subjectView.classList.add('on');
    renderSubjects();
  }

  const initialParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
  const initialSubject = initialParams.get('subject');
  const initialTopic = initialParams.get('topic');
  const initialProductId = initialParams.get('productId');
  const initialProductName = initialParams.get('product');
  const initialProduct = products.find(function (product) {
    return product.id === initialProductId || product.name === initialProductName;
  });
  if (initialProduct) {
    openProduct(initialProduct.id);
    if (initialSubject) {
      let initialIndex = subjects.findIndex(function (subject) {
        return subject.productId === initialProduct.id && subject.name === initialSubject;
      });
      if (initialIndex < 0) {
        subjects.push({ id: createId(), productId: initialProduct.id, name: initialSubject, topics: initialTopic ? [initialTopic] : [] });
        initialIndex = subjects.length - 1;
        persistCatalog();
      }
      if (initialTopic) openQuestions(initialIndex, initialTopic);
      else if (subjectSupportsTopics(subjects[initialIndex]) && subjects[initialIndex].topics.length) openTopics(initialIndex);
      else openQuestions(initialIndex, null);
    }
  } else {
    showProducts();
  }

  backQuestionList.addEventListener('click', function () {
    const subjectIndex = subjectView.dataset.subjectIndex;
    if (subjectView.dataset.topic) openTopics(Number(subjectIndex));
    else if (subjectIndex !== undefined) openSubjects();
    else showProducts();
  });

  document.getElementById('create-product').addEventListener('click', function () { openProductDialog(null); });
  document.getElementById('cancel-product').addEventListener('click', closeProductDialog);
  document.getElementById('product-icon-code').addEventListener('input', renderProductIconPreview);
  document.getElementById('product-icon-upload').addEventListener('click', function () {
    document.getElementById('product-icon-file').click();
  });
  document.getElementById('product-icon-file').addEventListener('change', function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 256 * 1024) {
      window.alert('Choose a PNG, JPG, or WebP icon smaller than 256 KB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      if (typeof reader.result !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(reader.result)) {
        window.alert('The selected file could not be read as a supported image.');
        return;
      }
      editingProductIconDataUrl = reader.result;
      document.getElementById('product-icon-name').textContent = file.name;
      renderProductIconPreview();
    };
    reader.onerror = function () {
      console.error('Could not read the selected product icon.', reader.error);
      window.alert('The product icon could not be read. Choose another image and try again.');
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('product-icon-remove').addEventListener('click', function () {
    editingProductIconDataUrl = '';
    document.getElementById('product-icon-file').value = '';
    document.getElementById('product-icon-name').textContent = 'PNG, JPG, or WebP · up to 256 KB';
    if (!normalizeBootstrapIcon(document.getElementById('product-icon-code').value)) {
      document.getElementById('product-icon-enabled').checked = false;
    }
    renderProductIconPreview();
  });
  document.getElementById('save-product').addEventListener('click', function () {
    const nameInput = document.getElementById('product-name');
    const iconCodeInput = document.getElementById('product-icon-code');
    const iconBootstrapClass = normalizeBootstrapIcon(iconCodeInput.value);
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    if (iconCodeInput.value.trim() && !iconBootstrapClass) {
      iconCodeInput.setCustomValidity('Use a Bootstrap Icons class such as "bi bi-book-fill".');
      iconCodeInput.reportValidity();
      iconCodeInput.addEventListener('input', function clearIconCodeError() {
        iconCodeInput.setCustomValidity('');
        iconCodeInput.removeEventListener('input', clearIconCodeError);
      });
      return;
    }
    const duplicate = products.some(function (product) {
      return product.name.toLowerCase() === name.toLowerCase() && product.id !== editingProductId;
    });
    if (duplicate) {
      nameInput.setCustomValidity('A product with this name already exists.');
      nameInput.reportValidity();
      nameInput.addEventListener('input', function clearProductNameError() {
        nameInput.setCustomValidity('');
        nameInput.removeEventListener('input', clearProductNameError);
      });
      return;
    }
    const accessType = document.querySelector('input[name="product-access"]:checked')?.value || 'Paid';
    const productData = {
      id: editingProductId || createId(),
      name: name,
      description: document.getElementById('product-description').value.trim(),
      accessType: accessType,
      isActive: document.getElementById('product-active').checked,
      supportsTopics: document.getElementById('product-topics-enabled').checked,
      isReviewEnabled: document.querySelector('input[name="product-review-enabled"]:checked')?.value === 'true',
      iconDataUrl: editingProductIconDataUrl,
      iconBootstrapClass: iconBootstrapClass,
      showIcon: document.getElementById('product-icon-enabled').checked
    };
    if (editingProductId) {
      const oldName = products.find(function (product) { return product.id === editingProductId; })?.name;
      products = products.map(function (product) { return product.id === editingProductId ? productData : product; });
      if (oldName !== name) questions.forEach(function (question) { if (question.productId === editingProductId) question.product = name; });
      if (currentProductId === editingProductId) {
        subjectView.dataset.product = name;
        document.getElementById('active-product-title').textContent = name;
      }
    } else {
      products.push(productData);
    }
    persistCatalog();
    closeProductDialog();
    renderProducts();
  });
  productList.addEventListener('click', function (event) {
    const menuToggle = event.target.closest('.product-actions-toggle');
    if (menuToggle) {
      const menu = menuToggle.nextElementSibling;
      const shouldOpen = menu.hasAttribute('hidden');
      productList.querySelectorAll('.product-action-menu').forEach(function (item) { item.hidden = true; });
      productList.querySelectorAll('.product-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
      if (shouldOpen) {
        menu.hidden = false;
        menuToggle.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    const edit = event.target.closest('.edit-product-action');
    if (edit) {
      edit.closest('.product-action-menu').hidden = true;
      const product = products.find(function (item) { return item.id === edit.dataset.productId; });
      if (product) openProductDialog(product);
      return;
    }
    const remove = event.target.closest('.delete-product');
    if (remove) {
      remove.closest('.product-action-menu').hidden = true;
      const product = products.find(function (item) { return item.id === remove.dataset.productId; });
      if (!product || !window.confirm('Delete "' + product.name + '" and all its subjects, topics, and questions?')) return;
      products = products.filter(function (item) { return item.id !== product.id; });
      const removedSubjectNames = subjects.filter(function (subject) { return subject.productId === product.id; }).map(function (subject) { return subject.name; });
      subjects = subjects.filter(function (subject) { return subject.productId !== product.id; });
      questions = questions.filter(function (question) {
        return question.productId ? question.productId !== product.id : removedSubjectNames.indexOf(question.subject) === -1;
      });
      persistCatalog();
      renderProducts();
      return;
    }
    if (event.target.closest('.product-action-menu')) return;
    const card = event.target.closest('.product-card');
    if (card) openProduct(card.dataset.productId);
  });
  document.addEventListener('mousedown', function (event) {
    if (event.target.closest('.product-card-actions')) return;
    productList.querySelectorAll('.product-action-menu').forEach(function (menu) { menu.hidden = true; });
    productList.querySelectorAll('.product-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    productList.querySelectorAll('.product-action-menu').forEach(function (menu) { menu.hidden = true; });
    productList.querySelectorAll('.product-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  });
  productList.addEventListener('keydown', function (event) {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('product-card')) {
      event.preventDefault();
      openProduct(event.target.dataset.productId);
    }
  });

  document.getElementById('create-subject-from-product').addEventListener('click', function () {
    const topicSubjectIndex = subjectView.dataset.subjectIndex;
    if (topicSubjectIndex !== undefined) {
      const subject = subjects[Number(topicSubjectIndex)];
      navigate('fmge-create-test?product=' + encodeURIComponent(subjectView.dataset.product || '') + '&productId=' + encodeURIComponent(currentProductId || '') + '&subject=' + encodeURIComponent(subject.name) + '&mode=topic');
      return;
    }
    const dialog = document.getElementById('create-subject-dialog');
    dialog.classList.add('on');
    document.getElementById('subject-dialog-title').innerHTML = '<i class="bi bi-plus-circle-fill"></i> Create Subject';
    document.getElementById('subject-dialog-label').textContent = 'Subject Name';
    document.getElementById('save-create-subject').textContent = 'Save';
    editingItem = null;
    document.getElementById('new-subject-name').value = '';
    document.getElementById('new-subject-name').focus();
  });
  topicCreateQuestion.addEventListener('click', function () {
    const subject = subjects[Number(subjectView.dataset.subjectIndex)];
    navigate('fmge-add-question?product=' + encodeURIComponent(subjectView.dataset.product || '') + '&productId=' + encodeURIComponent(currentProductId || '') + '&subject=' + encodeURIComponent(subject.name) + '&topic=' + encodeURIComponent(subjectView.dataset.topic || ''));
  });
  document.getElementById('cancel-create-subject').addEventListener('click', function () {
    closeNameDialog();
  });
  document.getElementById('topic-icon-code').addEventListener('input', function (event) {
    event.target.setCustomValidity('');
    renderTopicIconPreview(event.target.value);
  });
  document.getElementById('save-create-subject').addEventListener('click', function () {
    const input = document.getElementById('new-subject-name');
    const topicIconInput = document.getElementById('topic-icon-code');
    const topicIconValue = normalizeIconValue(topicIconInput.value);
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    if (editingItem?.type === 'topic' && topicIconInput.value.trim() && !topicIconValue) {
      topicIconInput.setCustomValidity('Use a Bootstrap Icons class or a valid HTTPS image URL.');
      topicIconInput.reportValidity();
      return;
    }
    if (editingItem) {
      const current = editingItem;
      const duplicateSubject = subjects.some(function (subject, index) {
        return index !== current.index && subject.productId === currentProductId && subject.name.toLowerCase() === name.toLowerCase();
      });
      if (current.type === 'subject') {
        if (duplicateSubject) {
          input.focus();
          return;
        }
        subjects[current.index].name = name;
        questions.forEach(function (question) {
          if (question.productId === currentProductId && question.subject === current.oldName) question.subject = name;
        });
        persistCatalog();
        syncTestQuestionCounts();
        renderSubjects();
      } else {
        const subjectIndex = Number(subjectView.dataset.subjectIndex);
        const currentSubject = subjects[subjectIndex];
        const duplicateTopic = currentSubject.topics.some(function (topic, index) {
          return index !== current.index && topic.toLowerCase() === name.toLowerCase();
        });
        if (duplicateTopic) {
          input.focus();
          return;
        }
        if (current.oldName !== name) delete currentSubject.topicIcons[current.oldName];
        if (topicIconValue) currentSubject.topicIcons[name] = topicIconValue;
        else delete currentSubject.topicIcons[name];
        currentSubject.topics[current.index] = name;
        questions.forEach(function (question) {
          if (question.productId === currentProductId && question.subject === currentSubject.name && question.topic === current.oldName) question.topic = name;
        });
        tests.forEach(function (test) {
          if (test.productId === currentProductId && test.subjectId === currentSubject.id && test.topic === current.oldName) test.topic = name;
        });
        window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
        persistCatalog();
        syncTestQuestionCounts();
        renderTopics(subjectIndex);
      }
      persistCatalog();
      closeNameDialog();
      return;
    }
    if (!subjects.some(function (subject) { return subject.productId === currentProductId && subject.name.toLowerCase() === name.toLowerCase(); })) subjects.push({ id: createId(), productId: currentProductId, name: name, topics: [] });
    persistCatalog();
    renderSubjects();
    closeNameDialog();
  });

  subjectList.addEventListener('click', function (event) {
    const menuToggle = event.target.closest('.category-actions-toggle');
    if (menuToggle) {
      const menu = menuToggle.nextElementSibling;
      const shouldOpen = menu.hasAttribute('hidden');
      subjectList.querySelectorAll('.category-action-menu').forEach(function (item) { item.hidden = true; });
      subjectList.querySelectorAll('.category-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
      if (shouldOpen) {
        menu.hidden = false;
        menuToggle.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    const editSubject = event.target.closest('.edit-subject');
    if (editSubject) {
      openNameDialog('subject', Number(editSubject.dataset.subjectIndex));
      return;
    }
    const deleteSubject = event.target.closest('.delete-subject');
    if (deleteSubject) {
      const index = Number(deleteSubject.dataset.subjectIndex);
      const subject = subjects[index];
      if (subject && window.confirm('Delete "' + subject.name + '" and its topics and questions?')) {
        subjects.splice(index, 1);
        questions = questions.filter(function (question) { return question.productId !== currentProductId || question.subject !== subject.name; });
        tests = tests.filter(function (test) { return test.subjectId !== subject.id; });
        persistCatalog();
        syncTestQuestionCounts();
        renderSubjects();
      }
      return;
    }
    const editTopic = event.target.closest('.edit-topic');
    if (editTopic) {
      openNameDialog('topic', Number(editTopic.dataset.topicIndex));
      return;
    }
    const deleteTopic = event.target.closest('.delete-topic');
    if (deleteTopic) {
      const subject = subjects[Number(subjectView.dataset.subjectIndex)];
      const topicIndex = Number(deleteTopic.dataset.topicIndex);
      const topic = subject && subject.topics[topicIndex];
      if (topic && window.confirm('Delete "' + topic + '" and its questions?')) {
        subject.topics.splice(topicIndex, 1);
        delete subject.topicIcons[topic];
        questions = questions.filter(function (question) { return question.productId !== currentProductId || question.subject !== subject.name || question.topic !== topic; });
        tests = tests.filter(function (test) {
          return test.productId !== currentProductId || test.subjectId !== subject.id || test.topic !== topic;
        });
        persistCatalog();
        syncTestQuestionCounts();
        renderTopics(Number(subjectView.dataset.subjectIndex));
      }
      return;
    }
    const subjectCard = event.target.closest('.subject-card');
    if (subjectCard) {
      const subjectIndex = Number(subjectCard.dataset.subjectIndex);
      if (subjectSupportsTopics(subjects[subjectIndex]) && subjects[subjectIndex].topics.length) openTopics(subjectIndex);
      else openQuestions(subjectIndex, null);
      return;
    }
    const topicCard = event.target.closest('.topic-card');
    if (topicCard) {
      const topic = decodeURIComponent(topicCard.dataset.topic);
      openQuestions(Number(subjectView.dataset.subjectIndex), topic);
      return;
    }
    const viewQuestion = event.target.closest('.view-saved-question');
    const editQuestion = event.target.closest('.edit-saved-question');
    const deleteQuestion = event.target.closest('.delete-saved-question');
    const action = viewQuestion || editQuestion || deleteQuestion;
    if (!action) return;
    const questionIndex = Number(action.dataset.questionIndex);
    const question = questions[questionIndex];
    if (viewQuestion) {
      document.getElementById('view-question-text').textContent = question.text;
      document.getElementById('view-question-subject').textContent = question.subject;
      document.getElementById('view-question-topic').textContent = question.topic;
      document.getElementById('view-question-difficulty').textContent = question.difficulty || 'Medium';
      document.getElementById('view-question-tags').textContent = Array.isArray(question.tags) && question.tags.length
        ? question.tags.join(', ')
        : 'Not set';
      document.getElementById('view-question-options').innerHTML = (question.options || []).map(function (option) { return '<li>' + option + '</li>'; }).join('');
      document.getElementById('view-question-answer').textContent = question.options && question.options[question.answer] ? question.options[question.answer] : 'Not set';
      document.getElementById('view-question-dialog').classList.add('on');
    } else if (editQuestion) {
      const subject = subjects[Number(subjectView.dataset.subjectIndex)];
      navigate('fmge-add-question?product=' + encodeURIComponent(subjectView.dataset.product || '') + '&productId=' + encodeURIComponent(currentProductId || '') + '&subject=' + encodeURIComponent(subject.name) + '&topic=' + encodeURIComponent(subjectView.dataset.topic || '') + '&edit=' + questionIndex);
    } else if (deleteQuestion && window.confirm('Delete this question?')) {
      questions.splice(questionIndex, 1);
      persistCatalog();
      syncTestQuestionCounts();
      renderQuestions(subjectView.dataset.subjectIndex && subjects[Number(subjectView.dataset.subjectIndex)].name, subjectView.dataset.topic);
    }
  });
  document.addEventListener('mousedown', function (event) {
    if (event.target.closest('.category-card-actions')) return;
    subjectList.querySelectorAll('.category-action-menu').forEach(function (menu) { menu.hidden = true; });
    subjectList.querySelectorAll('.category-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    subjectList.querySelectorAll('.category-action-menu').forEach(function (menu) { menu.hidden = true; });
    subjectList.querySelectorAll('.category-actions-toggle').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  });

  document.querySelectorAll('[data-close-question-dialog]').forEach(function (button) {
    button.addEventListener('click', function () {
      button.closest('.question-dialog').classList.remove('on');
    });
  });

}
