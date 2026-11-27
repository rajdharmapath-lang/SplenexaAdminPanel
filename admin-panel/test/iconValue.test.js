import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBootstrapIcon, normalizeIconValue, normalizeImageUrl } from '../src/utils/iconValue.js';

test('normalizes Bootstrap icon classes', () => {
  assert.equal(normalizeBootstrapIcon('bi-bookmark-fill'), 'bi bi-bookmark-fill');
  assert.equal(normalizeBootstrapIcon('bi bi-bookmark-fill'), 'bi bi-bookmark-fill');
  assert.equal(normalizeBootstrapIcon('https://cdn.example.com/icon.png'), '');
});

test('accepts HTTPS image URLs and rejects unsafe protocols or credentials', () => {
  assert.equal(normalizeImageUrl('https://cdn.example.com/icon.png'), 'https://cdn.example.com/icon.png');
  assert.equal(normalizeImageUrl('http://cdn.example.com/icon.png'), '');
  assert.equal(normalizeImageUrl('javascript:alert(1)'), '');
  assert.equal(normalizeImageUrl('https://user:pass@cdn.example.com/icon.png'), '');
});

test('normalizes either supported icon value', () => {
  assert.equal(normalizeIconValue('bi bi-bookmark-fill'), 'bi bi-bookmark-fill');
  assert.equal(normalizeIconValue('https://cdn.example.com/icon.png'), 'https://cdn.example.com/icon.png');
  assert.equal(normalizeIconValue('not-an-icon'), '');
});
