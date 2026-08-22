import fs from 'fs';
import path from 'path';

export const STORE_BRAND = {
  name: 'The Ouds',
  displayName: 'THE OUDS',
  address: '136A Woodville Road, CF24 4EE, Cardiff',
  phone: '+447454 045315',
  email: 'theoudswarehouse@gmail.com',
  website: 'www.theouds.co.uk',
  websiteUrl: 'https://www.theouds.co.uk',
  refundPolicyUrl: 'https://theouds.com/refund-policy/',
  logoPath: '/the-ouds-logo.png',
  logoFile: 'the-ouds-logo.png',
  qrPath: '/refund-policy-qr.png',
  qrFile: 'refund-policy-qr.png',
  currency: 'GBP',
  vatLabel: 'VAT included'
} as const;

function fileToDataUri(filename: string, mime = 'image/png') {
  const file = path.join(process.cwd(), 'public', filename);
  if (!fs.existsSync(file)) return null;
  const base64 = fs.readFileSync(file).toString('base64');
  return `data:${mime};base64,${base64}`;
}

export function getLogoDataUri() {
  return fileToDataUri(STORE_BRAND.logoFile);
}

export function getRefundQrDataUri() {
  return fileToDataUri(STORE_BRAND.qrFile);
}

export function getLogoFilePath() {
  return path.join(process.cwd(), 'public', STORE_BRAND.logoFile);
}

export function getRefundQrFilePath() {
  return path.join(process.cwd(), 'public', STORE_BRAND.qrFile);
}

export function resolveStoreBrand(store?: {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
} | null) {
  return {
    name: store?.name || STORE_BRAND.name,
    displayName: STORE_BRAND.displayName,
    address: store?.address || STORE_BRAND.address,
    phone: store?.phone || STORE_BRAND.phone,
    email: STORE_BRAND.email,
    website: STORE_BRAND.website,
    websiteUrl: STORE_BRAND.websiteUrl,
    refundPolicyUrl: STORE_BRAND.refundPolicyUrl,
    logoUrl: store?.logoUrl || STORE_BRAND.logoPath,
    qrUrl: STORE_BRAND.qrPath
  };
}
