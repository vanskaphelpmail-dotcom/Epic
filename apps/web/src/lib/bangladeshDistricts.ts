/** Bangladesh divisions and all 64 districts (checkout district picker). */

export type BangladeshDivisionGroup = {
  division: string;
  districts: string[];
};

export const bangladeshDistricts: BangladeshDivisionGroup[] = [
  {
    division: 'Dhaka Division',
    districts: [
      'Dhaka',
      'Faridpur',
      'Gazipur',
      'Gopalganj',
      'Kishoreganj',
      'Madaripur',
      'Manikganj',
      'Munshiganj',
      'Narayanganj',
      'Narsingdi',
      'Rajbari',
      'Shariatpur',
      'Tangail',
    ],
  },
  {
    division: 'Chattogram Division',
    districts: [
      'Bandarban',
      'Brahmanbaria',
      'Chandpur',
      'Chattogram',
      'Cumilla',
      "Cox's Bazar",
      'Feni',
      'Khagrachhari',
      'Lakshmipur',
      'Noakhali',
      'Rangamati',
    ],
  },
  {
    division: 'Rajshahi Division',
    districts: [
      'Bogura',
      'Joypurhat',
      'Naogaon',
      'Natore',
      'Chapainawabganj',
      'Pabna',
      'Rajshahi',
      'Sirajganj',
    ],
  },
  {
    division: 'Khulna Division',
    districts: [
      'Bagerhat',
      'Chuadanga',
      'Jashore',
      'Jhenaidah',
      'Khulna',
      'Kushtia',
      'Magura',
      'Meherpur',
      'Narail',
      'Satkhira',
    ],
  },
  {
    division: 'Barishal Division',
    districts: [
      'Barguna',
      'Barishal',
      'Bhola',
      'Jhalokathi',
      'Patuakhali',
      'Pirojpur',
    ],
  },
  {
    division: 'Sylhet Division',
    districts: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  },
  {
    division: 'Rangpur Division',
    districts: [
      'Dinajpur',
      'Gaibandha',
      'Kurigram',
      'Lalmonirhat',
      'Nilphamari',
      'Panchagarh',
      'Rangpur',
      'Thakurgaon',
    ],
  },
  {
    division: 'Mymensingh Division',
    districts: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
  },
];

export type DistrictOption = {
  district: string;
  division: string;
};

const ALL_OPTIONS: DistrictOption[] = bangladeshDistricts.flatMap((g) =>
  g.districts.map((district) => ({ district, division: g.division })),
);

export function allDistrictOptions(): DistrictOption[] {
  return ALL_OPTIONS;
}

export function findDistrictOption(value?: string | null): DistrictOption | null {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return (
    ALL_OPTIONS.find((o) => o.district.toLowerCase() === key) ||
    ALL_OPTIONS.find((o) => o.district.toLowerCase().includes(key)) ||
    null
  );
}

/** Case-insensitive partial match across all 64 district names. */
export function filterDistrictGroups(query: string): BangladeshDivisionGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return bangladeshDistricts;

  return bangladeshDistricts
    .map((group) => ({
      division: group.division,
      districts: group.districts.filter((d) => d.toLowerCase().includes(q)),
    }))
    .filter((group) => group.districts.length > 0);
}
