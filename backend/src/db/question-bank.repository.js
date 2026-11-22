const supabase = require('./supabase');

async function getCatalog() {
  const { data, error } = await supabase
    .getClient()
    .from('question_bank_catalog')
    .select('products, subjects, questions')
    .eq('catalog_id', 1)
    .maybeSingle();
  if (error) throw error;
  return data || { products: [], subjects: [], questions: [] };
}

async function saveCatalog(catalog) {
  const { data, error } = await supabase
    .getClient()
    .from('question_bank_catalog')
    .upsert(
      { catalog_id: 1, ...catalog, updated_at: new Date().toISOString() },
      { onConflict: 'catalog_id' },
    )
    .select('products, subjects, questions')
    .single();
  if (error) throw error;
  return data;
}

module.exports = { getCatalog, saveCatalog };
