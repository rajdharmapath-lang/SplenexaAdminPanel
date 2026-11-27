export function normalizeBootstrapIcon(value) {
  const iconClass = String(value || '').trim().replace(/\s+/g, ' ');
  if (/^bi-[a-z0-9-]+$/i.test(iconClass)) return `bi ${iconClass}`;
  return /^bi bi-[a-z0-9-]+$/i.test(iconClass) ? iconClass : '';
}

export function normalizeImageUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function normalizeIconValue(value) {
  return normalizeBootstrapIcon(value) || normalizeImageUrl(value);
}
