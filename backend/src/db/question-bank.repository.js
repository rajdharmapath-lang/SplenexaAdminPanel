const supabase = require('./supabase');

async function getCatalog() {
  const client = supabase.getClient();
  const [catalogResult, productResult, testResult] = await Promise.all([
    client
      .from('question_bank_catalog')
      .select('subjects, questions')
      .eq('catalog_id', 1)
      .maybeSingle(),
    client
      .from('question_bank_products')
      .select('product_id, name, description, access_type, is_active, supports_topics, is_review_enabled, icon_data_url, icon_bootstrap_class, show_icon')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    client
      .from('question_bank_tests')
      .select('*')
      .order('created_at', { ascending: true }),
  ]);
  if (catalogResult.error) throw catalogResult.error;
  if (productResult.error) throw productResult.error;
  if (testResult.error) throw testResult.error;

  return {
    products: (productResult.data || []).map((product) => ({
      id: product.product_id,
      name: product.name,
      description: product.description,
      accessType: product.access_type,
      isActive: product.is_active,
      supportsTopics: product.supports_topics,
      isReviewEnabled: product.is_review_enabled,
      iconDataUrl: product.icon_data_url,
      iconBootstrapClass: product.icon_bootstrap_class,
      showIcon: product.show_icon,
    })),
    subjects: catalogResult.data?.subjects || [],
    questions: catalogResult.data?.questions || [],
    tests: (testResult.data || []).map((test) => ({
      id: test.test_id,
      productId: test.product_id,
      title: test.title,
      iconBootstrapClass: test.icon_bootstrap_class,
      addTopicUnderTest: test.add_topic_under_test,
      subjectId: test.subject_id,
      topic: test.topic,
      topicIconBootstrapClass: test.topic_icon_bootstrap_class,
      questionIds: test.question_ids,
      questionSelectionEnabled: test.question_selection_enabled,
      totalQuestions: test.total_questions,
      totalMarks: Number(test.total_marks),
      marksPerQuestion: Number(test.marks_per_question),
      marksEnabled: test.marks_enabled,
      negativeMarking: Number(test.negative_marking),
      negativeMarkingEnabled: test.negative_marking_enabled,
      startDateTimeEnabled: test.start_date_time_enabled,
      startAt: test.start_at,
      endDateTimeEnabled: test.end_date_time_enabled,
      endAt: test.end_at,
      durationEnabled: test.duration_enabled,
      durationMinutes: test.duration_minutes,
      isPublished: test.is_published,
      createdAt: test.created_at,
    })),
  };
}

async function saveCatalog(catalog) {
  const parameters = {
    p_products: catalog.products,
    p_subjects: catalog.subjects,
    p_questions: catalog.questions,
  };
  if (Array.isArray(catalog.tests)) parameters.p_tests = catalog.tests;
  const { data, error } = await supabase.getClient().rpc('save_question_bank_catalog', parameters);
  if (error) throw error;
  return data;
}

module.exports = { getCatalog, saveCatalog };
