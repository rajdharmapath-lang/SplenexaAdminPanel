import { useEffect, useMemo, useState } from 'react';
import { normalizeBootstrapIcon, normalizeImageUrl } from '../../utils/iconValue';
import './styles.css';

const STORAGE_KEYS = {
  products: 'fmge-question-bank-products',
  subjects: 'fmge-question-bank-subjects',
  questions: 'fmge-question-bank-questions',
  tests: 'fmge-question-bank-tests',
};
const ALLOWED_HTML_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'SUB', 'SUP',
  'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'IMG',
]);

function readArray(key) {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new TypeError(`Saved ${key} data must be an array.`);
  return value;
}

function loadQuestionBank() {
  const products = readArray(STORAGE_KEYS.products);
  const subjects = readArray(STORAGE_KEYS.subjects);
  const questions = readArray(STORAGE_KEYS.questions);
  const tests = readArray(STORAGE_KEYS.tests);
  return { products, subjects, questions, tests };
}

function isAvailable(question) {
  const answer = Number(question.answer);
  return question.status !== 'Inactive' &&
    Array.isArray(question.options) &&
    question.options.length >= 2 &&
    question.answer !== null &&
    question.answer !== undefined &&
    question.answer !== '' &&
    Number.isInteger(answer) &&
    answer >= 0 &&
    answer < question.options.length;
}

function belongsToProduct(data, question, productId) {
  if (String(question.productId || '') === String(productId)) return true;
  const product = data.products.find(item => String(item.id) === String(productId));
  return !question.productId && product?.name === question.product;
}

function questionsForSubject(data, productId, subjectName) {
  return data.questions.filter(question =>
    belongsToProduct(data, question, productId) &&
    question.subject === subjectName &&
    isAvailable(question),
  );
}

function questionsForProduct(data, productId) {
  return data.questions.filter(question =>
    belongsToProduct(data, question, productId) && isAvailable(question),
  );
}

function questionsFor(data, productId, subjectName, topicName) {
  return questionsForSubject(data, productId, subjectName).filter(question =>
    (topicName ? question.topic === topicName : !question.topic),
  );
}

function questionsForTest(data, test, subject) {
  const matching = questionsFor(data, test.productId, subject.name, test.topic || '');
  if (!test.questionSelectionEnabled) return matching;
  const selectedIds = new Set((Array.isArray(test.questionIds) ? test.questionIds : []).map(String));
  return matching.filter(question => selectedIds.has(String(question.id)));
}

function safeRichHtml(html) {
  if (!html || typeof document === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = html;

  function clean(parent) {
    Array.from(parent.childNodes).forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node;
      const tag = element.tagName;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG'].includes(tag)) {
        element.remove();
        return;
      }
      if (!ALLOWED_HTML_TAGS.has(tag)) {
        clean(element);
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
      Array.from(element.attributes).forEach(attribute => {
        const isImageSource = tag === 'IMG' && attribute.name === 'src' &&
          /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(attribute.value);
        const isImageAlt = tag === 'IMG' && attribute.name === 'alt';
        const isCellSpan = ['TD', 'TH'].includes(tag) &&
          ['colspan', 'rowspan'].includes(attribute.name) &&
          /^\d{1,2}$/.test(attribute.value);
        if (!isImageSource && !isImageAlt && !isCellSpan) element.removeAttribute(attribute.name);
      });
      if (tag === 'IMG' && !element.hasAttribute('src')) element.remove();
      else clean(element);
    });
  }

  clean(template.content);
  return template.innerHTML;
}

function RichContent({ html, fallback }) {
  const safeHtml = useMemo(() => safeRichHtml(html), [html]);
  return safeHtml
    ? <div className="mcq-rich-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    : <p>{fallback || 'No question text provided.'}</p>;
}

function Header({ title, onBack, eyebrow }) {
  return (
    <header className="mcq-header">
      {onBack ? (
        <button className="mcq-back" type="button" onClick={onBack} aria-label="Go back">
          <i className="bi bi-chevron-left" />
        </button>
      ) : <span className="mcq-header-spacer" />}
      <div>
        {eyebrow && <span className="mcq-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      <span className="mcq-header-spacer" />
    </header>
  );
}

function FeatureCard({ item, onClick, detail, disabled = false }) {
  return (
    <button className="mcq-feature-card" type="button" onClick={onClick} disabled={disabled}>
      <span className="mcq-feature-icon">
        {item.iconUrl ? <img src={item.iconUrl} alt="" /> : <i className={item.iconClass || `bi bi-${item.icon}`} />}
      </span>
      <span className="mcq-feature-copy">
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
        {detail && <small>{detail}</small>}
      </span>
      <span className="mcq-arrow"><i className="bi bi-arrow-right" /></span>
    </button>
  );
}

function Quiz({ quiz, onBack, onFinish }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Array(quiz.questions.length).fill(null));
  const [timeRemaining, setTimeRemaining] = useState(() => (quiz.durationMinutes || 0) * 60);
  const [showGrid, setShowGrid] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookmarked, setBookmarked] = useState([]);
  const question = quiz.questions[questionIndex];
  const selectedOption = answers[questionIndex];
  const attempted = answers.filter(answer => answer !== null).length;
  const correctCount = answers.reduce(
    (count, answer, index) => count + (answer === Number(quiz.questions[index].answer) ? 1 : 0),
    0,
  );

  useEffect(() => {
    if (submitted || !quiz.durationMinutes) return undefined;
    const timer = window.setInterval(() => {
      setTimeRemaining(current => {
        if (current <= 1) {
          window.clearInterval(timer);
          setSubmitted(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quiz.durationMinutes, submitted]);

  useEffect(() => {
    if (submitted || !quiz.durationMinutes || timeRemaining !== 0) return;
    setSubmitted(true);
    if (quiz.mode === 'practice') onFinish(quiz, attempted, correctCount);
  }, [attempted, correctCount, onFinish, quiz, submitted, timeRemaining]);

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  }

  function selectAnswer(optionIndex) {
    if (submitted) return;
    setAnswers(current => current.map((answer, index) => index === questionIndex ? optionIndex : answer));
  }

  function finish() {
    setSubmitted(true);
    setConfirmSubmit(false);
    onFinish(quiz, attempted, correctCount);
  }

  function toggleBookmark() {
    setBookmarked(current => current.includes(questionIndex)
      ? current.filter(index => index !== questionIndex)
      : [...current, questionIndex]);
  }

  const isPracticeFeedback = quiz.mode === 'practice' && selectedOption !== null;
  const shouldShowAnswer = submitted || isPracticeFeedback;
  const imageQuestion = question.questionHtml || '';
  const explanationHtml = question.explanationHtml || '';
  const explanationText = question.explanation || '';
  const incorrectCount = attempted - correctCount;
  const earnedMarks = correctCount * quiz.marksPerQuestion - incorrectCount * quiz.negativeMarking;
  const maximumMarks = quiz.questions.length * quiz.marksPerQuestion;

  if (submitted) {
    const incorrect = attempted - correctCount;
    const unanswered = quiz.questions.length - attempted;
    return (
      <section className="mcq-results">
        <Header title="Test Results" eyebrow={quiz.title} onBack={onBack} />
        <div className="mcq-result-card">
          <span className="mcq-result-icon"><i className="bi bi-check2-circle" /></span>
          <p className="mcq-eyebrow">Session complete</p>
          <h2>{quiz.marksPerQuestion > 0 ? earnedMarks : correctCount} <span>/ {quiz.marksPerQuestion > 0 ? maximumMarks : quiz.questions.length}</span></h2>
          <p className="mcq-result-subtitle">{quiz.marksPerQuestion > 0 ? `Marks · ${correctCount} correct` : 'Correct answers'}</p>
          <div className="mcq-result-stats">
            <div><strong>{attempted}</strong><span>Attempted</span></div>
            <div><strong>{incorrect}</strong><span>Incorrect</span></div>
            <div><strong>{unanswered}</strong><span>Unanswered</span></div>
            <div><strong>{attempted ? `${Math.round(correctCount / attempted * 100)}%` : '0%'}</strong><span>Accuracy</span></div>
          </div>
          <button type="button" className="mcq-primary-button" onClick={onBack}>Back to MCQ Preview</button>
        </div>
        <div className="mcq-review-list">
          <h2>Answer review</h2>
          {quiz.questions.map((item, index) => (
            <article key={`${item.id || item.text}-${index}`} className="mcq-review-item">
              <span className={answers[index] === Number(item.answer) ? 'mcq-review-number correct' : 'mcq-review-number'}>
                {index + 1}
              </span>
              <div>
                <RichContent html={item.questionHtml} fallback={item.text} />
                <p className="mcq-review-answer">
                  Correct answer: {item.options[Number(item.answer)]}
                  {answers[index] === null ? ' · Not answered' : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mcq-quiz">
      <Header
        title={quiz.title}
        eyebrow={[quiz.productName, quiz.mode === 'test' ? 'Test' : 'Practice'].filter(Boolean).join(' · ')}
        onBack={() => setConfirmLeave(true)}
      />
      <div className="mcq-quiz-toolbar">
        <div className="mcq-progress-copy">
          <strong>Question {questionIndex + 1} of {quiz.questions.length}</strong>
          <span>{attempted} attempted</span>
        </div>
        <div className="mcq-progress-track" role="progressbar" aria-valuenow={questionIndex + 1} aria-valuemin="1" aria-valuemax={quiz.questions.length}>
          <span style={{ width: `${(questionIndex + 1) / quiz.questions.length * 100}%` }} />
        </div>
        <div className="mcq-quiz-tools">
          {quiz.durationMinutes ? (
            <span className={`mcq-timer ${timeRemaining < 300 ? 'urgent' : ''}`} aria-label="Time remaining">
              <i className="bi bi-clock" /> {formatTime(timeRemaining)}
            </span>
          ) : <span className="mcq-timer"><i className="bi bi-infinity" /> No time limit</span>}
          <button className={`mcq-tool-button ${bookmarked.includes(questionIndex) ? 'selected' : ''}`} type="button" onClick={toggleBookmark}>
            <i className={`bi bi-bookmark${bookmarked.includes(questionIndex) ? '-fill' : ''}`} /> Bookmark
          </button>
          <button className="mcq-tool-button" type="button" onClick={() => setShowGrid(current => !current)} aria-expanded={showGrid}>
            <i className="bi bi-grid-3x3-gap" /> Questions
          </button>
        </div>
      </div>

      {showGrid && (
        <div className="mcq-question-grid" aria-label="Question navigator">
          {quiz.questions.map((item, index) => (
            <button
              key={`${item.id || item.text}-${index}`}
              className={`${index === questionIndex ? 'current' : ''} ${answers[index] !== null ? 'answered' : ''}`}
              type="button"
              onClick={() => { setQuestionIndex(index); setShowGrid(false); }}
              aria-label={`Question ${index + 1}${answers[index] !== null ? ', answered' : ', unanswered'}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      <article className="mcq-question-card">
        <div className="mcq-question-label"><span>QUESTION {String(questionIndex + 1).padStart(2, '0')}</span><span>{quiz.subjectName}{quiz.topic ? ` · ${quiz.topic}` : ''}</span></div>
        <RichContent html={imageQuestion} fallback={question.text} />
      </article>

      <h2 className="mcq-section-title">Choose the correct answer</h2>
      <div className="mcq-options">
        {question.options.map((option, index) => {
          const isCorrect = shouldShowAnswer && index === Number(question.answer);
          const isIncorrect = shouldShowAnswer && selectedOption === index && !isCorrect;
          return (
            <button
              key={`${question.id || question.text}-${index}`}
              type="button"
              className={`mcq-option ${selectedOption === index ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isIncorrect ? 'incorrect' : ''}`}
              onClick={() => selectAnswer(index)}
              disabled={submitted}
            >
              <span className="mcq-option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
              {isCorrect && <i className="bi bi-check-circle-fill" />}
              {isIncorrect && <i className="bi bi-x-circle-fill" />}
            </button>
          );
        })}
      </div>
      {shouldShowAnswer && (explanationHtml || explanationText) && (
        <article className="mcq-explanation">
          <h3><i className="bi bi-lightbulb-fill" /> Explanation</h3>
          <RichContent html={explanationHtml} fallback={explanationText} />
        </article>
      )}
      {isPracticeFeedback && (
        <p className={`mcq-feedback ${selectedOption === Number(question.answer) ? 'correct' : 'incorrect'}`} role="status">
          {selectedOption === Number(question.answer) ? 'Your answer is correct.' : `Incorrect. Correct answer: ${String.fromCharCode(65 + Number(question.answer))}.`}
        </p>
      )}
      <footer className="mcq-quiz-footer">
        <button className="mcq-secondary-button" type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex(index => index - 1)}>
          <i className="bi bi-arrow-left" /> Previous
        </button>
        {questionIndex < quiz.questions.length - 1 ? (
          <button className="mcq-primary-button" type="button" onClick={() => setQuestionIndex(index => index + 1)}>
            Next question <i className="bi bi-arrow-right" />
          </button>
        ) : quiz.mode === 'test' ? (
          <button className="mcq-primary-button" type="button" onClick={() => setConfirmSubmit(true)}>Submit test</button>
        ) : (
          <button className="mcq-primary-button" type="button" onClick={finish}>Finish practice</button>
        )}
      </footer>
      {confirmSubmit && (
        <div className="mcq-modal-backdrop" role="presentation">
          <div className="mcq-modal" role="dialog" aria-modal="true" aria-labelledby="mcq-submit-title">
            <h2 id="mcq-submit-title">Submit this test?</h2>
            <p>You have attempted {attempted} of {quiz.questions.length} questions. You cannot change answers after submitting.</p>
            <div>
              <button className="mcq-secondary-button" type="button" onClick={() => setConfirmSubmit(false)}>Continue test</button>
              <button className="mcq-primary-button" type="button" onClick={finish}>Submit</button>
            </div>
          </div>
        </div>
      )}
      {confirmLeave && (
        <div className="mcq-modal-backdrop" role="presentation">
          <div className="mcq-modal" role="dialog" aria-modal="true" aria-labelledby="mcq-leave-title">
            <h2 id="mcq-leave-title">Leave this session?</h2>
            <p>Your current answers and progress will be lost.</p>
            <div>
              <button className="mcq-secondary-button" type="button" onClick={() => setConfirmLeave(false)}>Continue</button>
              <button className="mcq-primary-button" type="button" onClick={onBack}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function MCQPreviewPage() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [completedSubjects, setCompletedSubjects] = useState([]);

  useEffect(() => {
    try {
      setData(loadQuestionBank());
    } catch (error) {
      console.error('Could not load Question Bank data for MCQ Preview.', error);
      setLoadError('Question Bank data could not be loaded. Check the saved products, subjects, questions, and tests, then reload this page.');
    }
  }, []);

  const products = useMemo(() => (data?.products || []).filter(product =>
    product.isActive !== false && product.status !== 'Inactive',
  ), [data]);
  const subjects = useMemo(() => (data?.subjects || []).filter(subject =>
    products.some(product => String(product.id) === String(subject.productId)),
  ), [data, products]);
  const tests = useMemo(() => (data?.tests || []).filter(test =>
    products.some(product => String(product.id) === String(test.productId)) &&
    subjects.some(subject => String(subject.id) === String(test.subjectId)),
  ), [data, products, subjects]);

  function startPractice(subject, topic) {
    const product = products.find(item => String(item.id) === String(subject.productId));
    const questions = questionsFor(data, subject.productId, subject.name, topic || '');
    if (!questions.length) return;
    setSelectedSubject(subject);
    setSelectedTopic(topic || '');
    setQuiz({
      mode: 'practice',
      title: topic || subject.name,
      subjectName: subject.name,
      topic: topic || '',
      durationMinutes: 60,
      questions,
      productName: product?.name || '',
      marksPerQuestion: 1,
      negativeMarking: 0,
    });
    setView('quiz');
  }

  function startTest(test) {
    const subject = subjects.find(item => String(item.id) === String(test.subjectId));
    if (!subject) return;
    const product = products.find(item => String(item.id) === String(test.productId));
    const questions = questionsForTest(data, test, subject);
    if (!questions.length) return;
    setQuiz({
      mode: 'test',
      title: test.title,
      subjectName: subject.name,
      topic: test.topic || '',
      durationMinutes: test.durationEnabled ? Math.max(1, Number(test.durationMinutes) || 60) : null,
      questions,
      productName: product?.name || '',
      marksPerQuestion: Math.max(0, Number(test.marksPerQuestion) || 0),
      negativeMarking: Math.max(0, Number(test.negativeMarking) || 0),
    });
    setView('quiz');
  }

  function finishQuiz(completedQuiz) {
    if (completedQuiz.mode === 'practice' && selectedSubject && !completedSubjects.includes(selectedSubject.id)) {
      setCompletedSubjects(current => [...current, selectedSubject.id]);
    }
  }

  if (loadError) {
    return <main className="mcq-preview"><div className="mcq-error"><i className="bi bi-exclamation-triangle" /><h1>MCQ Preview unavailable</h1><p>{loadError}</p></div></main>;
  }
  if (!data) return <main className="mcq-preview"><div className="mcq-loading">Loading Question Bank…</div></main>;

  const subjectTopics = selectedSubject?.topics || [];
  const generalCount = selectedSubject
    ? questionsFor(data, selectedSubject.productId, selectedSubject.name, '').length
    : 0;

  return (
    <main className="mcq-preview">
      {view === 'quiz' && quiz ? (
        <Quiz
          quiz={quiz}
          onBack={() => { setQuiz(null); setView(quiz.mode === 'test' ? 'home' : selectedTopic || selectedSubject?.name ? 'topics' : 'subjects'); }}
          onFinish={finishQuiz}
        />
      ) : view === 'home' ? (
        <section>
          <Header title="MCQ Preview" eyebrow="Question Bank" />
          <p className="mcq-intro">Choose a product to browse its subjects and topics, or open a saved test.</p>
          <h2 className="mcq-section-title">Products</h2>
          <div className="mcq-feature-list">
            {products.map(product => {
              const productIconClass = product.showIcon
                ? normalizeBootstrapIcon(product.iconBootstrapClass) || 'bi bi-journal-medical'
                : 'bi bi-journal-medical';
              const productSubjects = subjects.filter(subject => String(subject.productId) === String(product.id));
              const questionCount = questionsForProduct(data, product.id).length;
              return (
                <FeatureCard
                  key={product.id}
                  item={{
                    title: product.name,
                    subtitle: product.description || `${product.accessType || 'Paid'} question bank`,
                    icon: 'journal-medical',
                    iconClass: productIconClass,
                  }}
                  detail={`${productSubjects.length} subjects · ${questionCount} questions`}
                  onClick={() => { setSelectedProduct(product); setView('subjects'); }}
                />
              );
            })}
            {!products.length && <div className="mcq-empty"><i className="bi bi-journal-x" /><strong>No products available</strong><span>Create and activate a product in Question Bank to preview its subjects and topics.</span></div>}
          </div>
          <h2 className="mcq-section-title">Saved Tests</h2>
          <div className="mcq-feature-list">
            {tests.map(test => {
              const subject = subjects.find(item => String(item.id) === String(test.subjectId));
              const product = products.find(item => String(item.id) === String(test.productId));
              const testQuestions = subject ? questionsForTest(data, test, subject) : [];
              return (
                <FeatureCard
                  key={test.id}
                  item={{
                    title: test.title,
                    subtitle: [product?.name, subject?.name, test.topic].filter(Boolean).join(' · ') || 'Test',
                    icon: 'clipboard-check',
                    iconClass: normalizeBootstrapIcon(test.iconBootstrapClass) || undefined,
                    iconUrl: normalizeImageUrl(test.iconBootstrapClass) || undefined,
                  }}
                  detail={`${testQuestions.length} questions · ${test.durationEnabled ? `${test.durationMinutes || 60} min` : 'No time limit'} · ${test.isPublished ? 'Published' : 'Draft preview'}`}
                  onClick={() => startTest(test)}
                  disabled={!testQuestions.length}
                />
              );
            })}
            {!tests.length && <div className="mcq-empty"><i className="bi bi-clipboard-x" /><strong>No tests available</strong><span>Create a test from Question Bank to preview it here.</span></div>}
            {tests.length > 0 && tests.every(test => {
              const subject = subjects.find(item => String(item.id) === String(test.subjectId));
              return !subject || !questionsForTest(data, test, subject).length;
            }) && <div className="mcq-notice"><i className="bi bi-info-circle" />Add active questions with options and correct answers to the tests before previewing them.</div>}
          </div>
        </section>
      ) : view === 'subjects' ? (
        <section>
          <Header title={selectedProduct?.name || 'Product'} eyebrow="Choose a subject" onBack={() => setView('home')} />
          <div className="mcq-card-list">
            {subjects.filter(subject => String(subject.productId) === String(selectedProduct?.id)).map(subject => {
              const count = questionsForSubject(data, selectedProduct.id, subject.name).length;
              return (
                <button key={subject.id} className="mcq-subject-card" type="button" onClick={() => { setSelectedSubject(subject); setView('topics'); }}>
                  <span className="mcq-subject-icon"><i className="bi bi-bookmark" /></span>
                  <span className="mcq-feature-copy"><strong>{subject.name}</strong><span>{selectedProduct?.name || 'Question Bank'}</span><small>{completedSubjects.includes(subject.id) ? 'Practice completed' : `${count} questions available`}</small></span>
                  <span className="mcq-progress-count">{count}</span>
                  <span className="mcq-arrow"><i className="bi bi-arrow-right" /></span>
                </button>
              );
            })}
            {!subjects.some(subject => String(subject.productId) === String(selectedProduct?.id)) && <div className="mcq-empty"><i className="bi bi-journal-x" /><strong>No subjects available</strong><span>Create subjects for this product in Question Bank first.</span></div>}
          </div>
        </section>
      ) : view === 'topics' && selectedSubject ? (
        <section>
          <Header title={selectedSubject.name} eyebrow={selectedProduct?.name || 'Product'} onBack={() => setView('subjects')} />
          <p className="mcq-intro">Choose a topic to begin practice. Questions and progress are based on the content in Question Bank.</p>
          <div className="mcq-card-list">
            {generalCount > 0 && (
              <FeatureCard
                item={{ title: 'General questions', subtitle: 'Questions not assigned to a topic.', icon: 'collection' }}
                detail={`${generalCount} questions`}
                onClick={() => startPractice(selectedSubject, '')}
              />
            )}
            {subjectTopics.map(topic => {
              const count = questionsFor(data, selectedSubject.productId, selectedSubject.name, topic).length;
              return (
                <FeatureCard
                  key={topic}
                  item={{
                    title: topic,
                    subtitle: `Practice ${selectedSubject.name} MCQs by topic.`,
                    icon: 'bookmark',
                    iconClass: normalizeBootstrapIcon(selectedSubject.topicIcons?.[topic]) || undefined,
                    iconUrl: normalizeImageUrl(selectedSubject.topicIcons?.[topic]) || undefined,
                  }}
                  detail={`${count} questions`}
                  onClick={() => startPractice(selectedSubject, topic)}
                  disabled={!count}
                />
              );
            })}
            {!generalCount && !subjectTopics.length && <div className="mcq-empty"><i className="bi bi-inboxes" /><strong>No topics or questions yet</strong><span>Add topics and active questions from the Question Bank admin page.</span></div>}
            {!generalCount && subjectTopics.length > 0 && !subjectTopics.some(topic => questionsFor(data, selectedSubject.productId, selectedSubject.name, topic).length) && <div className="mcq-empty"><i className="bi bi-inboxes" /><strong>No playable questions yet</strong><span>Add questions with options and a correct answer to begin practice.</span></div>}
          </div>
        </section>
      ) : null}
    </main>
  );
}
