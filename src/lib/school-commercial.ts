export type SchoolProfilePackage = 'organic' | 'claimed' | 'enhanced' | 'featured';

export type PublicSchoolPackage = Exclude<SchoolProfilePackage, 'organic'>;

export type SchoolPackageDefinition = {
  slug: PublicSchoolPackage;
  name: string;
  monthlyPriceLabel: string;
  headline: string;
  features: string[];
  ctaLabel: string;
  visibilitySummary: string;
};

export const SCHOOL_PACKAGE_DEFINITIONS: SchoolPackageDefinition[] = [
  {
    slug: 'claimed',
    name: 'Claimed profile',
    monthlyPriceLabel: 'Free',
    headline: 'For schools that want to manage their official presence.',
    visibilitySummary: 'Keeps the profile accurate and clearly school-supported.',
    ctaLabel: 'Claim profile',
    features: [
      'Claim and verify the school profile',
      'Add 1 hero image',
      'Official website link',
      'Submit an open day',
      'Basic click stats (coming soon)'
    ]
  },
  {
    slug: 'enhanced',
    name: 'Enhanced profile',
    monthlyPriceLabel: '£39 / month',
    headline: 'For schools that want stronger visibility and richer content.',
    visibilitySummary: 'Priority placement above free listings on browse pages.',
    ctaLabel: 'Choose Enhanced',
    features: [
      'Priority placement above free listings',
      'Up to 5 school images',
      'Official website and admissions/contact links',
      'Highlighted open day link',
      'Profile supported by school badge'
    ]
  },
  {
    slug: 'featured',
    name: 'Featured profile',
    monthlyPriceLabel: '£99 / month',
    headline: 'For schools that want the strongest visibility in the directory.',
    visibilitySummary: 'Priority placement above Enhanced profiles on browse pages.',
    ctaLabel: 'Choose Featured',
    features: [
      'Priority placement above Enhanced profiles',
      'Featured partner badge',
      'Up to 5 school images',
      'Official website and admissions/contact links',
      'Priority reporting and promotional options'
    ]
  }
];

export function normalizeSchoolProfilePackage(value: unknown): SchoolProfilePackage {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'claimed') return 'claimed';
  if (raw === 'enhanced') return 'enhanced';
  if (raw === 'featured') return 'featured';
  return 'organic';
}

export function getSchoolPackagePriority(value: unknown): number {
  switch (normalizeSchoolProfilePackage(value)) {
    case 'featured':
      return 3;
    case 'enhanced':
      return 2;
    case 'claimed':
      return 1;
    default:
      return 0;
  }
}

export function getSchoolPackageBadge(value: unknown): string | null {
  switch (normalizeSchoolProfilePackage(value)) {
    case 'featured':
      return 'Featured partner';
    case 'enhanced':
    case 'claimed':
      return null;
    default:
      return null;
  }
}

export function getSchoolManagedLabel(value: unknown): string | null {
  const pkg = normalizeSchoolProfilePackage(value);
  if (pkg === 'claimed' || pkg === 'enhanced' || pkg === 'featured') {
    return 'Profile supported by school';
  }
  return null;
}
