// Behaviour carried over from the original HTML page.
import { loadAdminCatalog, saveAdminCatalog } from '../../services/questionBankApi';
import { normalizeBootstrapIcon, normalizeIconValue, normalizeImageUrl } from '../../utils/iconValue';

export default async function init(document, window) {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const productIdParam = params.get('productId') || '';
  const productParam = params.get('product') || '';
  const subjectParam = params.get('subject') || '';
  const topicMode = params.get('mode') === 'topic';
  const productSelect = $('test-product');
  const topicField = $('test-topic-field');
  const testIconField = $('test-icon-field');
  const testTopicNameField = $('test-topic-name-field');
  const topicIconField = $('topic-icon-field');
  const parentSubjectToggleField = $('parent-subject-toggle-field');
  const parentSubjectToggle = $('use-parent-subject');
  const topicInput = $('test-topic');
  const selectionToggle = $('question-selection-enabled');
  const selectionCard = $('question-selection-card');
  const durationToggle = $('duration-enabled');
  const durationControls = $('duration-controls');
  let products = [];
  let subjects = [];
  let questions = [];
  let tests = [];
  try {
    const cachedCatalog = {
      products: JSON.parse(window.sessionStorage.getItem('fmge-question-bank-products') || '[]'),
      subjects: JSON.parse(window.sessionStorage.getItem('fmge-question-bank-subjects') || '[]'),
      questions: JSON.parse(window.sessionStorage.getItem('fmge-question-bank-questions') || '[]'),
      tests: JSON.parse(window.sessionStorage.getItem('fmge-question-bank-tests') || '[]'),
    };
    const catalog = await loadAdminCatalog(window);
    const remoteHasContent = catalog.products.length || catalog.subjects.length || catalog.questions.length;
    const source = !remoteHasContent && (cachedCatalog.products.length || cachedCatalog.subjects.length || cachedCatalog.questions.length)
      ? cachedCatalog
      : catalog;
    products = source.products;
    subjects = source.subjects;
    questions = source.questions;
    tests = catalog.tests.length ? catalog.tests : cachedCatalog.tests;
    window.sessionStorage.setItem('fmge-question-bank-products', JSON.stringify(products));
    window.sessionStorage.setItem('fmge-question-bank-subjects', JSON.stringify(subjects));
    window.sessionStorage.setItem('fmge-question-bank-questions', JSON.stringify(questions));
    window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
  } catch (error) {
    console.error('Could not load Question Bank data before creating a test.', error);
    window.alert('Question Bank data could not be loaded from the shared database. ' + error.message);
    return;
  }
  const selectedProduct = products.find(product => product.id === productIdParam || product.name === productParam);
  const topicsEnabled = selectedProduct
    ? typeof selectedProduct.supportsTopics === 'boolean'
      ? selectedProduct.supportsTopics
      : selectedProduct.name === 'FMGE Q-Bank' || subjects.some(subject => subject.productId === selectedProduct.id && subject.topics.length > 0)
    : topicMode;
  const isTopicMode = topicMode;
  parentSubjectToggle.checked = isTopicMode || topicsEnabled;
  const productId = selectedProduct?.id || productIdParam;
  const productName = selectedProduct?.name || productParam;

  function makeId() {
    return window.crypto && typeof window.crypto.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  let questionsChanged = false;
  const knownQuestionIds = new Set();
  questions.forEach(question => {
    if (!question.id || knownQuestionIds.has(String(question.id))) {
      question.id = makeId();
      questionsChanged = true;
    }
    knownQuestionIds.add(String(question.id));
  });
  if (questionsChanged) {
    try {
      window.sessionStorage.setItem('fmge-question-bank-questions', JSON.stringify(questions));
    } catch (error) {
      console.error('Could not assign IDs to saved Question Bank questions.', error);
      window.alert('Questions could not be prepared for test selection. Check available browser storage and try again.');
    }
  }

  if (products.length) {
    productSelect.innerHTML = products.map(product => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
  } else if (productName && !Array.from(productSelect.options).some(option => option.value === productName || option.textContent.trim() === productName)) {
    const option = document.createElement('option');
    option.value = productName;
    option.textContent = productName;
    productSelect.appendChild(option);
  }
  if (productName) productSelect.value = productName;
  if (productIdParam) productSelect.disabled = true;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function updateIconPreview(inputId, previewId, fallbackClass) {
    const input = $(inputId);
    const preview = $(previewId);
    const iconUrl = normalizeImageUrl(input.value);
    const iconClass = normalizeBootstrapIcon(input.value) || fallbackClass;
    preview.innerHTML = iconUrl
      ? `<img src="${escapeHtml(iconUrl)}" alt="" />`
      : `<i class="${iconClass}" aria-hidden="true"></i>`;
    input.setCustomValidity('');
  }

  function selectedProductId() {
    const selected = products.find(product => product.name === productSelect.value);
    return selected?.id || productId;
  }

  function questionScope() {
    const name = $('test-name').value.trim();
    const subjectName = isTopicMode ? subjectParam : name;
    const topicName = isTopicMode ? name : (parentSubjectToggle.checked ? topicInput.value.trim() : '');
    return {
      productId: selectedProductId(),
      subjectName,
      topicName
    };
  }

  function matchingQuestions(scope) {
    if (!scope.productId || !scope.subjectName) return [];
    return questions.filter(question =>
      question.productId === scope.productId &&
      String(question.subject || '').toLocaleLowerCase() === scope.subjectName.toLocaleLowerCase() &&
      (scope.topicName ? question.topic === scope.topicName : !question.topic) &&
      question.status !== 'Inactive'
    );
  }

  let selectedQuestionIds = [];
  let previousScopeKey = '';
  let selectionPreferenceChosen = false;

  function renderQuestionSelection(scopeQuestions) {
    const availableList = $('available-question-list');
    const selectedList = $('selected-question-list');
    const selectedIds = new Set(selectedQuestionIds);
    const available = scopeQuestions.filter(question => !selectedIds.has(String(question.id)));
    const selected = scopeQuestions.filter(question => selectedIds.has(String(question.id)));
    $('question-selection-summary').textContent = selected.length + ' question' + (selected.length === 1 ? '' : 's') + ' selected';
    $('selected-question-count').textContent = String(selected.length);
    $('select-all-questions').disabled = !available.length;
    availableList.innerHTML = available.length
      ? available.map(question => '<article class="question-selection-row"><div><strong>' +
        escapeHtml(question.text || 'Image-based question') + '</strong><small>' +
        escapeHtml([question.topic, question.status || 'Draft'].filter(Boolean).join(' · ')) +
        '</small></div><button type="button" class="add-selected-question" data-question-id="' +
        escapeHtml(question.id) + '"><i class="bi bi-plus-lg"></i> Add</button></article>').join('')
      : '<p class="selection-empty">' + (scopeQuestions.length ? 'All matching questions are selected.' : 'No questions match this subject and topic yet.') + '</p>';
    selectedList.innerHTML = selected.length
      ? selected.map(question => '<article class="question-selection-row"><div><strong>' +
        escapeHtml(question.text || 'Image-based question') + '</strong><small>' +
        escapeHtml([question.topic, question.status || 'Draft'].filter(Boolean).join(' · ')) +
        '</small></div><button type="button" class="remove-selected-question remove-question" data-question-id="' +
        escapeHtml(question.id) + '"><i class="bi bi-trash3"></i> Remove</button></article>').join('')
      : '<p class="selection-empty">No questions selected.</p>';
  }

  function refreshQuestionSelection(resetSelection) {
    const scope = questionScope();
    const scopeKey = [scope.productId, scope.subjectName, scope.topicName].join('|');
    const scopeQuestions = matchingQuestions(scope);
    if (resetSelection || scopeKey !== previousScopeKey) {
      selectedQuestionIds = scopeQuestions.map(question => String(question.id));
      if (!selectionPreferenceChosen) selectionToggle.checked = scopeQuestions.length > 0;
    } else {
      const availableIds = new Set(scopeQuestions.map(question => String(question.id)));
      selectedQuestionIds = selectedQuestionIds.filter(id => availableIds.has(String(id)));
    }
    previousScopeKey = scopeKey;
    renderQuestionSelection(scopeQuestions);
    selectionCard.hidden = !selectionToggle.checked;
    updateTotalMarks();
  }

  function updateNameMode() {
    $('create-test-submit').lastChild.textContent = isTopicMode ? ' Create Topic' : ' Create Test';
    if (isTopicMode) {
      $('create-flow-title').textContent = 'Create Topic';
      $('test-name-label').childNodes[0].textContent = 'Topic Name';
      $('test-name').placeholder = 'Enter topic name';
      parentSubjectToggleField.style.display = 'none';
      topicField.style.display = '';
      testTopicNameField.style.display = 'none';
      testIconField.style.display = 'none';
      topicIconField.style.display = '';
      $('create-test-description').textContent = 'Add a topic under ' + subjectParam + '.';
    } else if (parentSubjectToggle.checked) {
      $('create-flow-title').textContent = 'Create Test';
      $('test-name-label').childNodes[0].textContent = 'Test Name';
      $('test-name').placeholder = 'Enter test name';
      parentSubjectToggleField.style.display = '';
      topicField.style.display = '';
      testTopicNameField.style.display = '';
      testIconField.style.display = '';
      topicIconField.style.display = '';
      $('create-test-description').textContent = 'Enter a topic name; it will be created under this test name.';
    } else {
      $('create-flow-title').textContent = 'Create Test';
      $('test-name-label').childNodes[0].textContent = 'Test Name';
      $('test-name').placeholder = 'Enter test name';
      parentSubjectToggleField.style.display = '';
      topicField.style.display = 'none';
      testTopicNameField.style.display = '';
      testIconField.style.display = '';
      topicIconField.style.display = '';
      $('create-test-description').textContent = 'Questions will be organized directly under this test name.';
    }
    refreshQuestionSelection(true);
  }
  updateNameMode();
  $('test-icon-code').addEventListener('input', () => updateIconPreview('test-icon-code', 'test-icon-preview', 'bi bi-clipboard2-check-fill'));
  $('topic-icon-code').addEventListener('input', () => updateIconPreview('topic-icon-code', 'topic-icon-preview', 'bi bi-bookmark-fill'));
  parentSubjectToggle.addEventListener('change', updateNameMode);
  topicInput.addEventListener('input', () => refreshQuestionSelection(true));
  $('test-name').addEventListener('input', () => refreshQuestionSelection(true));
  productSelect.addEventListener('change', () => {
    if (!isTopicMode) {
      const currentProduct = products.find(product => product.name === productSelect.value);
      parentSubjectToggle.checked = Boolean(currentProduct?.supportsTopics);
    }
    updateNameMode();
  });
  $('question-selection-card').addEventListener('click', event => {
    if (event.target.closest('#select-all-questions')) {
      selectedQuestionIds = matchingQuestions(questionScope()).map(question => String(question.id));
      refreshQuestionSelection(false);
      return;
    }
    const addButton = event.target.closest('.add-selected-question');
    const removeButton = event.target.closest('.remove-selected-question');
    const selectionButton = addButton || removeButton;
    if (!selectionButton) return;
    const questionId = selectionButton.dataset.questionId;
    if (addButton && !selectedQuestionIds.includes(questionId)) selectedQuestionIds.push(questionId);
    if (removeButton) selectedQuestionIds = selectedQuestionIds.filter(id => id !== questionId);
    refreshQuestionSelection(false);
  });
  selectionToggle.addEventListener('change', () => {
    selectionPreferenceChosen = true;
    selectionCard.hidden = !selectionToggle.checked;
    updateTotalMarks();
  });
  function updateScoringControls() {
    $('marks-per-question').disabled = !$('marks-enabled').checked;
    $('negative-marking').disabled = !$('negative-marking-enabled').checked;
    $('marks-per-question').closest('.scoring-field')?.classList.toggle('scoring-field-disabled', !$('marks-enabled').checked);
    $('negative-marking').closest('.scoring-field')?.classList.toggle('scoring-field-disabled', !$('negative-marking-enabled').checked);
    updateTotalMarks();
  }
  $('marks-enabled').addEventListener('change', updateScoringControls);
  $('negative-marking-enabled').addEventListener('change', updateScoringControls);
  durationToggle.addEventListener('change', () => {
    durationControls.style.display = durationToggle.checked ? '' : 'none';
  });
  durationControls.style.display = durationToggle.checked ? '' : 'none';

  const hours = Array.from({ length: 24 }, (_, index) => `<option>${String(index).padStart(2, '0')}</option>`).join('');
  const minutes = Array.from({ length: 60 }, (_, index) => `<option>${String(index).padStart(2, '0')}</option>`).join('');
  $('hh').innerHTML = hours;
  $('mm').innerHTML = minutes;
  $('hh').value = '01';
  $('mm').value = '00';
  updateScoringControls();

  function row(number) {
    return `<div class="nr" style="margin-bottom:12px"><div class="nb">Notification ${number}</div>
      <div><label class="f">Notification Message <s>*</s></label><input class="in" placeholder="Enter notification message"></div>
      <div><label class="f">Schedule Date &amp; Time <s>*</s></label><div class="dr"><label><i class="bi bi-calendar3"></i><input placeholder="Select date" onfocus="this.type='date'" onblur="if(!this.value)this.type='text'"></label><label><i class="bi bi-clock"></i><input placeholder="Select time" onfocus="this.type='time'" onblur="if(!this.value)this.type='text'"><i class="bi bi-chevron-down ch"></i></label></div></div>
      <button class="del" title="Delete"><i class="bi bi-trash3-fill"></i></button></div>`;
  }

  function renumberNotifications() {
    document.querySelectorAll('#nots .nr').forEach((notification, index) => {
      notification.querySelector('.nb').textContent = 'Notification ' + (index + 1);
    });
  }
  $('nots').innerHTML = row(1);
  $('add').onclick = () => $('nots').insertAdjacentHTML('beforeend', row($('nots').children.length + 1));
  $('nots').onclick = event => {
    const button = event.target.closest('.del');
    if (button && $('nots').children.length > 1) {
      button.closest('.nr').remove();
      renumberNotifications();
    }
  };

  function updateTotalMarks() {
    const count = selectionToggle.checked
      ? selectedQuestionIds.length
      : matchingQuestions(questionScope()).length;
    $('total-question-count').disabled = !selectionToggle.checked;
    const marks = $('marks-enabled').checked ? Math.max(0, Number($('marks-per-question').value) || 0) : 0;
    $('total-question-count').value = String(count);
    $('total-marks').value = String(count * marks);
  }
  $('marks-per-question').addEventListener('input', updateTotalMarks);
  $('negative-marking').addEventListener('input', updateTotalMarks);

  function saveSubjects() {
    window.sessionStorage.setItem('fmge-question-bank-subjects', JSON.stringify(subjects));
  }

  function getDateTime(dateId, timeId, enabled, label) {
    const dateInput = $(dateId);
    const timeInput = $(timeId);
    dateInput.setCustomValidity('');
    timeInput.setCustomValidity('');
    if (!enabled) return null;
    if (!dateInput.value) {
      dateInput.setCustomValidity('Select a ' + label + ' date.');
      dateInput.reportValidity();
      return undefined;
    }
    if (!timeInput.value) {
      timeInput.setCustomValidity('Select a ' + label + ' time.');
      timeInput.reportValidity();
      return undefined;
    }
    const dateTime = new Date(dateInput.value + 'T' + timeInput.value);
    if (Number.isNaN(dateTime.getTime())) {
      dateInput.setCustomValidity('Select a valid ' + label + ' date and time.');
      dateInput.reportValidity();
      return undefined;
    }
    return dateTime.toISOString();
  }

  $('test-start-enabled').addEventListener('change', function () {
    $('test-start-date').disabled = !$('test-start-enabled').checked;
    $('test-start-time').disabled = !$('test-start-enabled').checked;
  });
  $('test-end-enabled').addEventListener('change', function () {
    $('test-end-date').disabled = !$('test-end-enabled').checked;
    $('test-end-time').disabled = !$('test-end-enabled').checked;
  });

  $('create-test-submit').onclick = async () => {
    const product = productSelect.value;
    const currentProductId = selectedProductId();
    const name = $('test-name').value.trim();
    if (!product) {
      productSelect.focus();
      return;
    }
    if (!name) {
      $('test-name').focus();
      return;
    }
    const useTopic = isTopicMode || parentSubjectToggle.checked;
    const subjectName = isTopicMode ? subjectParam : name;
    const topicName = isTopicMode ? name : (useTopic ? topicInput.value.trim() : '');
    if (useTopic && !topicName) {
      topicInput.focus();
      return;
    }
    const testIconCode = $('test-icon-code').value.trim();
    const testIconValue = normalizeIconValue(testIconCode);
    if (!isTopicMode && testIconCode && !testIconValue) {
      $('test-icon-code').setCustomValidity('Use a Bootstrap Icons class or a valid HTTPS image URL.');
      $('test-icon-code').reportValidity();
      return;
    }
    const topicIconCode = $('topic-icon-code').value.trim();
    const topicIconValue = normalizeIconValue(topicIconCode);
    if (topicName && topicIconCode && !topicIconValue) {
      $('topic-icon-code').setCustomValidity('Use a Bootstrap Icons class or a valid HTTPS image URL.');
      $('topic-icon-code').reportValidity();
      return;
    }
    let startAt = null;
    let endAt = null;
    const startDateTimeEnabled = !isTopicMode && $('test-start-enabled').checked;
    const endDateTimeEnabled = !isTopicMode && $('test-end-enabled').checked;
    if (!isTopicMode) {
      startAt = getDateTime('test-start-date', 'test-start-time', startDateTimeEnabled, 'start');
      if (startAt === undefined) return;
      endAt = getDateTime('test-end-date', 'test-end-time', endDateTimeEnabled, 'end');
      if (endAt === undefined) return;
      if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
        $('test-end-date').setCustomValidity('The end date and time must be after the start date and time.');
        $('test-end-date').reportValidity();
        return;
      }
    }
    const durationMinutes = Number($('hh').value) * 60 + Number($('mm').value);
    if (durationToggle.checked && durationMinutes < 1) {
      window.alert('Set a test duration greater than zero, or turn off the time limit.');
      $('hh').focus();
      return;
    }
    let subject = subjects.find(item => item.productId === currentProductId && item.name.toLowerCase() === subjectName.toLowerCase());
    if (!subject) {
      subject = { id: makeId(), productId: currentProductId, name: subjectName, topics: [], topicIcons: {}, supportsTopics: useTopic };
      subjects.push(subject);
    }
    if (!subject.topicIcons || typeof subject.topicIcons !== 'object' || Array.isArray(subject.topicIcons)) subject.topicIcons = {};
    subject.supportsTopics = useTopic;
    if (useTopic && !subject.topics.some(topic => topic.toLowerCase() === topicName.toLowerCase())) {
      subject.topics.push(topicName);
      subject.topics.sort((left, right) => left.localeCompare(right));
    }
    if (topicName && topicIconValue) subject.topicIcons[topicName] = topicIconValue;
    saveSubjects();

    if (isTopicMode) {
      try {
        await saveAdminCatalog({ products, subjects, questions, tests }, window);
      } catch (error) {
        console.error('Could not save the topic to the shared Question Bank.', error);
        window.alert('The topic was not saved to the shared database. ' + error.message);
        return;
      }
      const query = new URLSearchParams({ productId: currentProductId, product: product, subject: subjectName });
      if (topicName) query.set('topic', topicName);
      window.location.hash = 'fmge-question-bank?' + query.toString();
      return;
    }

    const totalQuestions = selectionToggle.checked
      ? selectedQuestionIds.length
      : matchingQuestions(questionScope()).length;
    const marksPerQuestion = $('marks-enabled').checked ? Math.max(0, Number($('marks-per-question').value) || 0) : 0;
    const negativeMarking = $('negative-marking-enabled').checked ? Math.max(0, Number($('negative-marking').value) || 0) : 0;
    const test = {
      id: makeId(),
      productId: currentProductId,
      title: name,
      iconBootstrapClass: testIconValue,
      addTopicUnderTest: useTopic,
      subjectId: subject.id,
      topic: topicName || null,
      topicIconBootstrapClass: topicName ? topicIconValue : '',
      questionIds: selectionToggle.checked ? [...selectedQuestionIds] : [],
      questionSelectionEnabled: selectionToggle.checked,
      totalQuestions: totalQuestions,
      totalMarks: totalQuestions * marksPerQuestion,
      marksPerQuestion: marksPerQuestion,
      marksEnabled: $('marks-enabled').checked,
      negativeMarking: negativeMarking,
      negativeMarkingEnabled: $('negative-marking-enabled').checked,
      startDateTimeEnabled: startDateTimeEnabled,
      startAt: startAt,
      endDateTimeEnabled: endDateTimeEnabled,
      endAt: endAt,
      durationEnabled: durationToggle.checked,
      durationMinutes: durationToggle.checked ? durationMinutes : null,
      isPublished: false,
      createdAt: new Date().toISOString()
    };
    tests = tests.concat(test);
    window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
    try {
      await saveAdminCatalog({ products, subjects, questions, tests }, window);
    } catch (error) {
      tests = tests.filter(function (savedTest) { return savedTest.id !== test.id; });
      window.sessionStorage.setItem('fmge-question-bank-tests', JSON.stringify(tests));
      console.error('Could not save the test to the shared Question Bank.', error);
      window.alert('The test was not saved to the shared database. ' + error.message);
      return;
    }
    const query = new URLSearchParams({ productId: currentProductId, product: product, subject: subjectName });
    if (topicName) query.set('topic', topicName);
    window.location.hash = 'fmge-question-bank?' + query.toString();
  };

  $('back-to-question-bank').onclick = () => {
    const currentProduct = productSelect.value || productName;
    window.location.hash = 'fmge-question-bank?productId=' + encodeURIComponent(selectedProductId()) + '&product=' + encodeURIComponent(currentProduct);
  };
  $('cancel-create-test').onclick = () => {
    const currentProduct = productSelect.value || productName;
    window.location.hash = 'fmge-question-bank?productId=' + encodeURIComponent(selectedProductId()) + '&product=' + encodeURIComponent(currentProduct);
  };
}
