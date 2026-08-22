import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextInvoiceFromList } from '../lib/invoice-number';

test('skips demo D-prefix invoices and uses the highest numeric suffix', () => {
  const next = nextInvoiceFromList(
    [
      'INV-2026-D9031',
      'INV-2026-D9001',
      'INV-2026-009035',
      'INV-2026-000NaN',
      'INV-2026-000001'
    ],
    2026
  );
  assert.equal(next, 'INV-2026-009036');
});

test('starts at 000001 when only demo invoices exist', () => {
  assert.equal(nextInvoiceFromList(['INV-2026-D9001'], 2026), 'INV-2026-000001');
});
