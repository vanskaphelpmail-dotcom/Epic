/**
 * Google Drive uploads stay server-side only.
 * Configure GOOGLE_SERVICE_ACCOUNT_* / GOOGLE_DRIVE_FOLDER_ID in env.
 * This stub is safe to call when Drive is not configured.
 */

export type DriveFolder =
  | 'Inventory/Excel Reports'
  | 'Inventory/Stock Documents'
  | 'Attendance'
  | 'Sales'
  | 'Salaries'
  | 'Orders'
  | 'Expenses'
  | 'Supplier Invoices'
  | 'Product Imports'
  | 'Product Exports'
  | 'Stock Reports'
  | 'Barcode'
  | 'Letters'
  | 'Delivery Notes'
  | 'Other Documents';

export async function uploadToDrive(_input: {
  storeCode?: string;
  folder: DriveFolder;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return {
      skipped: true as const,
      message: 'Google Drive is not configured. File kept local/server-side only.'
    };
  }

  // Wire googleapis here when credentials are provided.
  return {
    skipped: true as const,
    message: 'Google Drive credentials detected but client wiring is pending configuration.'
  };
}
