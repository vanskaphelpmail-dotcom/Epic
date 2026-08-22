import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml } from '../lib/html';
import { errorResponse } from '../lib/errors';
import { assertNoPathTraversal, isAllowedPdfRemoteUrl, resolvePublicUploadPath } from '../lib/safe-files';

test('escapeHtml encodes markup', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('errorResponse does not leak stack traces', async () => {
  const res = errorResponse(new Error('secret connection string postgresql://x'));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message, 'Unexpected server error');
  assert.equal(JSON.stringify(body).includes('postgresql://'), false);
});

test('path traversal is rejected for uploads', () => {
  assert.throws(() => assertNoPathTraversal('EMPLOYEE/../../../.env'));
  assert.throws(() => resolvePublicUploadPath('/uploads/../.env'));
  assert.throws(() => resolvePublicUploadPath('../../package.json'));
});

test('remote PDF URLs are limited to Cloudinary HTTPS', () => {
  assert.equal(isAllowedPdfRemoteUrl('https://res.cloudinary.com/demo/raw/upload/x.pdf'), true);
  assert.equal(isAllowedPdfRemoteUrl('http://res.cloudinary.com/demo/raw/upload/x.pdf'), false);
  assert.equal(isAllowedPdfRemoteUrl('https://evil.example/x.pdf'), false);
});
