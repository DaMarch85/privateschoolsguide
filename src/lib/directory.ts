import { getLocationPresentation } from './location-config';
import { supabase } from './supabase';

export type LocationRecord = {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  hero_title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  intro_text: string | null;
  latitude: number | null;
  longitude: number | null;
  is_live: boolean;
  show_on_homepage?: boolean | null;
  homepage_order?: number | null;
  homepage_status_label?: string | null;
};

export type HomepageLocationRecord = {
  name: string;
  slug: string;
  is_live: boolean;
  show_on_homepage: boolean | null;
  homepage_order: number | null;
  homepage_status_label: string | null;
};

export type HomepageLocationItem = {
  name: string;
  href: string;
  state: string;
  isLive: boolean;
};

export type LocationSchoolLink = {
  location_id: string;
  school_id: string | number;
  sort_order: number;
  is_featured?: boolean;
};

export type SchoolSummaryRecord = {
  id: string | number;
  slug: string;
  name: string;
  school_type: string | null;
  provision_category?: string | null;
  phase: string | null;
  gender: string | null;
  age_min: number | null;
  age_max: number | null;
  day_boarding: string | null;
  address_line1: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  pupil_numbers: number | null;
  description: string | null;
  inspection_rating: string | null;
  official_sixth_form?: string | null;
  nursery_provision?: string | null;
  number_of_boys?: number | null;
  number_of_girls?: number | null;
  religion?: string | null;
  religious_ethos?: string | null;
  status?: string | null;
};

export type SchoolContentRecord = {
  admissions_summary: string | null;
  inspection_snapshot: string | null;
  assessment_approach: string | null;
  scholarships: string | null;
  destinations: string | null;
  what_parents_say: string | null;
  what_school_says: string | null;
  [key: string]: unknown;
};

export type LocationFeeCell = {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  amount: number | null;
};

export type LocationFeeRow = {
  label: string;
  cells: LocationFeeCell[];
};

export type LocationFeeView = {
  feeType: string;
  label: string;
  rows: LocationFeeRow[];
};

export type LocationBursaryCard = {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  summary: string;
};

export type LocationOpenDayItem = {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  title: string;
  startAt: string | null;
  endAt: string | null;
  bookingUrl: string | null;
  notes: string | null;
  isVerified: boolean;
  lastVerifiedAt: string | null;
};

export type ExamResultRecord = {
  result_year: number;
  entries_count: number | string | null;
  pct_a_star_a: number | string | null;
  pct_a_star_b: number | string | null;
  unique_subjects: number | string | null;
};

export type SubjectRecord = {
  subject_name: string;
  share_of_entries: number | string | null;
  sort_order: number | null;
};

export type FeeRecord = {
  academic_year: string;
  fee_type: string;
  year_group_label: string;
  amount_gbp: number | string;
  includes_vat: boolean;
};

export type AnnualFeeRecord = {
  academic_year: string;
  fee_type: string;
  includes_vat: boolean;
  amount_gbp_pre_reception_annual_inc_vat: number | string | null;
  amount_gbp_reception_annual_inc_vat: number | string | null;
  amount_gbp_year_1_annual_inc_vat: number | string | null;
  amount_gbp_year_2_annual_inc_vat: number | string | null;
  amount_gbp_year_3_annual_inc_vat: number | string | null;
  amount_gbp_year_4_annual_inc_vat: number | string | null;
  amount_gbp_year_5_annual_inc_vat: number | string | null;
  amount_gbp_year_6_annual_inc_vat: number | string | null;
  amount_gbp_year_7_annual_inc_vat: number | string | null;
  amount_gbp_year_8_annual_inc_vat: number | string | null;
  amount_gbp_year_9_annual_inc_vat: number | string | null;
  amount_gbp_year_10_annual_inc_vat: number | string | null;
  amount_gbp_year_11_annual_inc_vat: number | string | null;
  amount_gbp_year_12_annual_inc_vat: number | string | null;
  amount_gbp_year_13_annual_inc_vat: number | string | null;
};

export type BursaryRecord = {
  has_bursaries: boolean | null;
  status_label: string | null;
  summary: string | null;
  entry_points: string | null;
  published_support_level: string | null;
  application_and_review: string | null;
};

export type SchoolCard = {
  slug: string;
  name: string;
  href: string;
  cardClass: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  texts: string[];
};

export type MapSchool = {
  name: string;
  slug: string;
  href: string;
  locationSlug: string;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  type: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  note: string;
  addressLine1: string;
  address_line1: string;
};

export type HomepageSearchSchool = {
  id: string;
  slug: string;
  name: string;
  href: string | null;
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  type: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  note: string;
  displayLocation: string;
  ageLabel: string;
  genderLabel: string;
  genderFilter: 'boys' | 'girls' | 'mixed';
  boardingLabel: string;
  boardingFilter: 'day' | 'boarding' | 'both' | null;
  hasSixthForm: boolean;
  hasNursery: boolean;
  religion: string | null;
  studentsLabel: string | null;
  boyGirlSplit: string | null;
  dayFee: string;
  boardingFee: string;
  totalExams: number | null;
  pctAStarA: number | null;
  pctAStarB: number | null;
  uniqueSubjects: number | null;
};

export type FeePane = {
  feeType: string;
  label: string;
  columns: FeeRecord[][];
};

export type CompareAlevelMetrics = {
  totalExams: number | null;
  pctAStarA: number | null;
  pctAStarB: number | null;
  uniqueSubjects: number | null;
  coreScience: number | null;
  mathematics: number | null;
  art: number | null;
  languages: number | null;
  economics: number | null;
  english: number | null;
  history: number | null;
  geography: number | null;
  psychology: number | null;
  other: number | null;
};

export type CompareSchoolRecord = {
  id: string;
  schoolId: string;
  schoolSlug: string;
  provisionCategory: 'mainstream' | 'sen_specialist';
  name: string;
  slug: string;
  ages: string;
  gender: string;
  format: string;
  dayFee: string;
  boardingFee: string;
  bursaries: string;
  location: string;
  subhead: string;
  heroImage: string;
  map: MapSchool | null;
  alevel: CompareAlevelMetrics | null;
};

function fail(message: string, error?: { message?: string } | null): never {
  throw new Error(error?.message ? `${message}: ${error.message}` : message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSupabaseError(error?: { message?: string } | null): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('bad gateway') ||
    message.includes('<!doctype html') ||
    message.includes('cloudflare')
  );
}

async function withRetry<T extends { error: { message?: string } | null }>(
  run: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 300
): Promise<T> {
  let result = await run();

  for (let attempt = 1; attempt < attempts && result.error && isTransientSupabaseError(result.error); attempt += 1) {
    await sleep(baseDelayMs * attempt);
    result = await run();
  }

  return result;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatCurrency(value: unknown): string {
  const num = toNumber(value);
  if (num === null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
  }).format(num);
}

export function formatPercent(value: unknown): string {
  const num = toNumber(value);
  if (num === null) return '—';
  return `${Math.round(num * 100)}%`;
}

export function formatInteger(value: unknown): string {
  const num = toNumber(value);
  if (num === null) return '—';
  return new Intl.NumberFormat('en-GB').format(num);
}

export function getPhaseLabel(phase: string | null, ageMax: number | null): string {
  const value = (phase || '').toLowerCase();
  if (value.includes('all')) return 'All-through school';
  if (value.includes('prep') || value.includes('junior') || (ageMax !== null && ageMax <= 11)) return 'Prep school';
  return 'Senior school';
}

export function getMapType(phase: string | null, ageMax: number | null): string {
  const value = (phase || '').toLowerCase();
  if (value.includes('all')) return 'allthrough';
  if (value.includes('prep') || value.includes('junior') || (ageMax !== null && ageMax <= 11)) return 'junior';
  return 'senior';
}

export function getProvisionCategory(
  school: Pick<SchoolSummaryRecord, 'provision_category' | 'school_type'>
): 'mainstream' | 'sen_specialist' {
  const raw = String(school.provision_category || '').trim().toLowerCase();
  if (raw === 'sen_specialist') return 'sen_specialist';
  return 'mainstream';
}

export function getGenderLabel(gender: string | null): string {
  const value = (gender || '').toLowerCase();
  if (value.includes('girl')) return 'Girls';
  if (value.includes('boy')) return 'Boys';
  return 'Mixed';
}

export function getGenderFilterValue(gender: string | null): 'boys' | 'girls' | 'mixed' {
  const value = (gender || '').toLowerCase();
  if (value.includes('girl')) return 'girls';
  if (value.includes('boy')) return 'boys';
  return 'mixed';
}

export function getBoardingFilterValue(dayBoarding: string | null): 'day' | 'boarding' | 'both' | null {
  const value = String(dayBoarding || '').replace(/[_\s]+/g, ' ').trim().toLowerCase();
  if (!value) return null;
  if (value === 'day' || value === 'day only' || value === 'day school' || value === 'no boarders') return 'day';
  if (value.includes('day') && value.includes('board')) return 'both';
  if (value === 'boarding school') return 'both';
  if (value.includes('boarding')) return 'boarding';
  return null;
}

export function getFormatLabel(dayBoarding: string | null): string {
  const category = getBoardingFilterValue(dayBoarding);
  if (category === 'day') return 'Day only';
  if (category === 'boarding') return 'Boarding only';
  if (category === 'both') return 'Day & boarding';
  return 'Day only';
}

export function getAgeLabel(ageMin: number | null, ageMax: number | null): string {
  if (ageMin !== null && ageMax !== null) return `${ageMin}–${ageMax}`;
  if (ageMin !== null) return `${ageMin}+`;
  if (ageMax !== null) return `Up to ${ageMax}`;
  return 'To be confirmed';
}

function firstNonEmptyText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned;
  }
  return null;
}

export function getSchoolReligionLabel(
  school: Pick<SchoolSummaryRecord, 'religion' | 'religious_ethos'>
): string | null {
  const raw = firstNonEmptyText(school.religion, school.religious_ethos);
  if (!raw) return null;

  const value = raw.toLowerCase();
  if (value === 'does not apply' || value === 'not applicable') return null;
  if (/\b(orthodox jewish|charadi jewish|jewish)\b/.test(value)) return 'Jewish';
  if (/\bchurch of england\b/.test(value) || /\banglican\b/.test(value)) return 'Church of England';
  if (/\broman catholic\b/.test(value) || value === 'catholic') return 'Roman Catholic';
  if (/\bplymouth brethren\b/.test(value)) return 'Plymouth Brethren Christian Church';
  if (/\bseventh[ -]?day adventist\b/.test(value)) return 'Seventh-day Adventist';
  if (/\bmethodist\b/.test(value)) return 'Methodist';
  if (/\bquaker\b/.test(value)) return 'Quaker';
  if (/\bunited reformed church\b/.test(value)) return 'United Reformed Church';
  if (/\b(islam|muslim|sunni)\b/.test(value)) return 'Muslim';
  if (/\bhindu\b/.test(value)) return 'Hindu';
  if (/\bsikh\b/.test(value)) return 'Sikh';
  if (/\b(multi-faith|all faiths)\b/.test(value)) return 'Multi-faith';
  if (value.includes('non-denominational') || value.includes('interdenominational')) return 'Non-denominational';
  if (value.includes('christian science')) return 'Christian';
  if (/\b(christian|evangelical|protestant|free church|unitarian|greek orthodox|orthodox)\b/.test(value)) return 'Christian';
  return raw;
}

export function schoolHasSixthForm(
  school: Pick<SchoolSummaryRecord, 'official_sixth_form' | 'age_max'>
): boolean {
  const value = String(school.official_sixth_form || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (value.includes('has a sixth form')) return true;
  if (value.includes('does not have a sixth form')) return false;
  return school.age_max !== null && school.age_max >= 17;
}

export function schoolHasNursery(
  school: Pick<SchoolSummaryRecord, 'nursery_provision' | 'age_min'>
): boolean {
  const value = String(school.nursery_provision || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (value.includes('has nursery')) return true;
  if (value.includes('no nursery')) return false;
  return school.age_min !== null && school.age_min <= 3;
}

export function getStudentCount(
  school: Pick<SchoolSummaryRecord, 'number_of_boys' | 'number_of_girls' | 'pupil_numbers'>
): number | null {
  const boys = toNumber(school.number_of_boys);
  const girls = toNumber(school.number_of_girls);

  if (boys !== null || girls !== null) {
    return Math.max(0, boys || 0) + Math.max(0, girls || 0);
  }

  return toNumber(school.pupil_numbers);
}

export function getBoyGirlSplitLabel(
  school: Pick<SchoolSummaryRecord, 'number_of_boys' | 'number_of_girls'>
): string | null {
  const boys = Math.max(0, toNumber(school.number_of_boys) || 0);
  const girls = Math.max(0, toNumber(school.number_of_girls) || 0);
  const total = boys + girls;
  if (total <= 0) return null;
  const boysPct = Math.round((boys / total) * 100);
  const girlsPct = 100 - boysPct;
  return `${boysPct}% boys / ${girlsPct}% girls`;
}

export function getSchoolLocationLabel(
  school: Pick<SchoolSummaryRecord, 'town' | 'county' | 'postcode' | 'address_line1'>
): string {
  const parts = [school.town, school.county].filter((part, index, list) => Boolean(part) && list.indexOf(part) === index) as string[];
  return parts.join(', ') || school.postcode || school.address_line1 || 'Location to be confirmed';
}

export function getYearFoundedLabel(content: SchoolContentRecord | null): string | null {
  if (!content) return null;
  const raw = firstNonEmptyText(
    String((content as Record<string, unknown>).year_founded || ''),
    String((content as Record<string, unknown>).founded || ''),
    String((content as Record<string, unknown>).founded_year || ''),
    String((content as Record<string, unknown>).established || '')
  );
  if (!raw) return null;
  const match = raw.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return match ? match[1] : raw;
}

export function buildAddress(school: Pick<SchoolSummaryRecord, 'address_line1' | 'town' | 'postcode'>): string {
  return [school.address_line1, school.town, school.postcode].filter(Boolean).join(', ');
}


function getSchoolCoordinates(
  school: Pick<SchoolSummaryRecord, 'latitude' | 'longitude'>
) {
  const lat = toNumber(school.latitude);
  const lng = toNumber(school.longitude);

  if (lat === null || lng === null) {
    return null;
  }

  return { lat, lng, zoom: 13 };
}

function buildLocationMapSchool(location: LocationRecord, school: SchoolSummaryRecord): MapSchool | null {
  const coordinates = getSchoolCoordinates(school);
  if (!coordinates) return null;

  const href = `/${location.slug}/schools/${school.slug}/`;
  const provisionCategory = getProvisionCategory(school);
  const note = [
    provisionCategory === 'sen_specialist' ? 'SEN specialist' : null,
    getPhaseLabel(school.phase, school.age_max),
    getGenderLabel(school.gender),
    getFormatLabel(school.day_boarding),
    `Ages ${getAgeLabel(school.age_min, school.age_max)}`
  ].filter(Boolean).join(' · ');
  const addressLine1 = school.address_line1 || '';

  return {
    name: school.name,
    slug: href,
    href,
    locationSlug: location.slug,
    lat: coordinates.lat,
    lng: coordinates.lng,
    latitude: coordinates.lat,
    longitude: coordinates.lng,
    type: getMapType(school.phase, school.age_max),
    provisionCategory,
    note,
    addressLine1,
    address_line1: addressLine1
  };
}

export function splitPipeList(text: string | null | undefined): string[] {
  return String(text || '')
    .split('|')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function splitParagraphs(text: string | null | undefined): string[] {
  const value = String(text || '').trim();
  if (!value) return [];
  if (value.includes('|')) return [];
  return value
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}


type RawSchoolContentRecord = Partial<SchoolContentRecord> & Record<string, unknown>;

function contentValueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned || null;
  }
  if (Array.isArray(value)) {
    const cleanedItems = value
      .map((item) => (typeof item === 'string' ? item.replace(/\s+/g, ' ').trim() : ''))
      .filter(Boolean);
    return cleanedItems.length ? cleanedItems.join(' | ') : null;
  }
  return null;
}

function pickFirstContentValue(content: RawSchoolContentRecord | null, keys: string[]): string | null {
  if (!content) return null;

  for (const key of keys) {
    const value = contentValueToString(content[key]);
    if (value) return value;
  }

  return null;
}

function normalizeSchoolContent(content: RawSchoolContentRecord | null): SchoolContentRecord | null {
  if (!content) return null;

  return {
    ...content,
    admissions_summary: pickFirstContentValue(content, [
      'admissions_summary',
      'admissions',
      'admissions_notes'
    ]),
    inspection_snapshot: pickFirstContentValue(content, [
      'inspection_snapshot',
      'inspection_overview'
    ]),
    assessment_approach: pickFirstContentValue(content, [
      'assessment_approach',
      'assessment',
      'assessment_summary'
    ]),
    scholarships: pickFirstContentValue(content, [
      'scholarships',
      'scholarship_summary',
      'scholarships_summary'
    ]),
    destinations: pickFirstContentValue(content, [
      'destinations',
      'leavers_destinations',
      'leaver_destinations',
      'destination_summary'
    ]),
    what_parents_say: pickFirstContentValue(content, [
      'what_parents_say',
      'parents_like',
      'what_parents_like',
      'parent_likes',
      'parents_say'
    ]),
    what_school_says: pickFirstContentValue(content, [
      'what_school_says',
      'how_the_school_describes_itself',
      'how_school_describes_itself',
      'school_describes_itself',
      'school_voice'
    ])
  };
}

function yearGroupOrder(label: string): number {
  const trimmed = label.trim();
  if (/^(pre[\s-]?reception|preschool|pre-school|pre school)/i.test(trimmed)) return -2;
  if (/^nursery/i.test(trimmed)) return -1;
  if (/^reception/i.test(trimmed)) return 0;
  const match = trimmed.match(/^year\s*(\d{1,2})/i);
  if (match) return Number(match[1]);
  return 999;
}

function feeTypeOrder(type: string): number {
  if (type === 'day') return 1;
  if (type === 'weekly_boarding') return 2;
  if (type === 'full_boarding') return 3;
  return 9;
}

export function feeTypeLabel(type: string): string {
  if (type === 'day') return 'Day';
  if (type === 'weekly_boarding') return 'Weekly boarding';
  if (type === 'full_boarding') return 'Full boarding';
  return type.replace(/_/g, ' ');
}

const ANNUAL_FEE_SELECT_WITH_SCHOOL_ID = `
  school_id,
  academic_year,
  fee_type,
  includes_vat,
  amount_gbp_pre_reception_annual_inc_vat,
  amount_gbp_reception_annual_inc_vat,
  amount_gbp_year_1_annual_inc_vat,
  amount_gbp_year_2_annual_inc_vat,
  amount_gbp_year_3_annual_inc_vat,
  amount_gbp_year_4_annual_inc_vat,
  amount_gbp_year_5_annual_inc_vat,
  amount_gbp_year_6_annual_inc_vat,
  amount_gbp_year_7_annual_inc_vat,
  amount_gbp_year_8_annual_inc_vat,
  amount_gbp_year_9_annual_inc_vat,
  amount_gbp_year_10_annual_inc_vat,
  amount_gbp_year_11_annual_inc_vat,
  amount_gbp_year_12_annual_inc_vat,
  amount_gbp_year_13_annual_inc_vat
`.replace(/\s+/g, ' ').trim();

const ANNUAL_FEE_SELECT = ANNUAL_FEE_SELECT_WITH_SCHOOL_ID.replace(/^school_id,\s*/, '');

const ANNUAL_FEE_COLUMNS: Array<{ label: string; key: keyof AnnualFeeRecord }> = [
  { label: 'Pre-Reception', key: 'amount_gbp_pre_reception_annual_inc_vat' },
  { label: 'Reception', key: 'amount_gbp_reception_annual_inc_vat' },
  { label: 'Year 1', key: 'amount_gbp_year_1_annual_inc_vat' },
  { label: 'Year 2', key: 'amount_gbp_year_2_annual_inc_vat' },
  { label: 'Year 3', key: 'amount_gbp_year_3_annual_inc_vat' },
  { label: 'Year 4', key: 'amount_gbp_year_4_annual_inc_vat' },
  { label: 'Year 5', key: 'amount_gbp_year_5_annual_inc_vat' },
  { label: 'Year 6', key: 'amount_gbp_year_6_annual_inc_vat' },
  { label: 'Year 7', key: 'amount_gbp_year_7_annual_inc_vat' },
  { label: 'Year 8', key: 'amount_gbp_year_8_annual_inc_vat' },
  { label: 'Year 9', key: 'amount_gbp_year_9_annual_inc_vat' },
  { label: 'Year 10', key: 'amount_gbp_year_10_annual_inc_vat' },
  { label: 'Year 11', key: 'amount_gbp_year_11_annual_inc_vat' },
  { label: 'Year 12', key: 'amount_gbp_year_12_annual_inc_vat' },
  { label: 'Year 13', key: 'amount_gbp_year_13_annual_inc_vat' }
];

function expandAnnualFeeRows<T extends AnnualFeeRecord & { school_id?: string | number }>(rows: T[]): Array<FeeRecord & { school_id?: string | number }> {
  return rows.flatMap((row) =>
    ANNUAL_FEE_COLUMNS.flatMap(({ label, key }) => {
      const amount = toNumber(row[key]);
      if (amount === null) return [];
      return [{
        school_id: row.school_id,
        academic_year: row.academic_year,
        fee_type: row.fee_type,
        year_group_label: label,
        amount_gbp: amount,
        includes_vat: Boolean(row.includes_vat)
      }];
    })
  );
}

function splitColumns<T>(rows: T[]): T[][] {
  if (rows.length <= 4) return [rows];
  const midpoint = Math.ceil(rows.length / 2);
  return [rows.slice(0, midpoint), rows.slice(midpoint)];
}

function formatFeeRange(rows: FeeRecord[]): string {
  const amounts = rows
    .map((row) => toNumber(row.amount_gbp))
    .filter((value): value is number => value !== null);

  if (!amounts.length) return 'Not listed';

  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min === max) return `${formatCurrency(min)} / year`;
  return `${formatCurrency(min)}–${formatCurrency(max)} / year`;
}

function formatBursaryStatus(bursary: BursaryRecord | null): string {
  if (!bursary) return '—';
  if (bursary.status_label) return bursary.status_label;
  if (bursary.has_bursaries === true) return 'Available';
  if (bursary.has_bursaries === false) return 'Not currently published';
  return '—';
}

function formatLocationLabel(school: SchoolSummaryRecord, fallbackLocationName: string): string {
  const parts = [school.town, school.county].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : fallbackLocationName;
}

function normalizeSubjectName(subjectName: string): string {
  return subjectName
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bucketSubject(subjectName: string): keyof Omit<CompareAlevelMetrics, 'totalExams' | 'pctAStarA' | 'pctAStarB' | 'uniqueSubjects'> {
  const value = normalizeSubjectName(subjectName);

  if (/\benglish\b/.test(value)) return 'english';
  if (/\b(french|spanish|german|latin|greek|mandarin|italian|russian|portuguese|japanese|chinese|arabic|language|languages)\b/.test(value)) return 'languages';
  if (/\b(math|maths|mathematics|further mathematics|further maths|statistics)\b/.test(value)) return 'mathematics';
  if (/\b(biology|chemistry|physics|science)\b/.test(value)) return 'coreScience';
  if (/\b(economics|business|accounting)\b/.test(value)) return 'economics';
  if (/\b(history|ancient history)\b/.test(value)) return 'history';
  if (/\bgeography\b/.test(value)) return 'geography';
  if (/\bpsychology\b/.test(value)) return 'psychology';
  if (/\b(art|design|drama|theatre|music|photography|film|media|textiles)\b/.test(value)) return 'art';
  return 'other';
}

function aggregateAlevelMetrics(examResult: ExamResultRecord | null, subjectRows: SubjectRecord[]): CompareAlevelMetrics | null {
  if (!examResult) return null;

  const buckets: Record<string, number> = {
    coreScience: 0,
    mathematics: 0,
    art: 0,
    languages: 0,
    economics: 0,
    english: 0,
    history: 0,
    geography: 0,
    psychology: 0,
    other: 0
  };

  subjectRows.forEach((row) => {
    const bucket = bucketSubject(row.subject_name);
    const share = toNumber(row.share_of_entries) ?? 0;
    buckets[bucket] += share;
  });

  return {
    totalExams: toNumber(examResult.entries_count),
    pctAStarA: toNumber(examResult.pct_a_star_a),
    pctAStarB: toNumber(examResult.pct_a_star_b),
    uniqueSubjects: toNumber(examResult.unique_subjects),
    coreScience: buckets.coreScience,
    mathematics: buckets.mathematics,
    art: buckets.art,
    languages: buckets.languages,
    economics: buckets.economics,
    english: buckets.english,
    history: buckets.history,
    geography: buckets.geography,
    psychology: buckets.psychology,
    other: buckets.other
  };
}

export async function getLiveLocations(): Promise<LocationRecord[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_live', true)
    .order('name', { ascending: true });

  if (error) fail('Could not load live locations', error);
  return (data || []) as LocationRecord[];
}


export async function getHomepageLocations(): Promise<HomepageLocationItem[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('name, slug, is_live, show_on_homepage, homepage_order, homepage_status_label')
    .eq('show_on_homepage', true)
    .order('homepage_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) fail('Could not load homepage locations', error);

  return ((data || []) as HomepageLocationRecord[]).map((location) => ({
    name: location.name,
    href: `/${location.slug}/`,
    state: String(location.homepage_status_label || '').trim() || (location.is_live ? 'Live now' : 'Coming soon'),
    isLive: Boolean(location.is_live)
  }));
}

export async function getLocationBySlug(locationSlug: string): Promise<LocationRecord> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('slug', locationSlug)
    .eq('is_live', true)
    .single();

  if (error || !data) fail(`Could not load location ${locationSlug}`, error);
  return data as LocationRecord;
}

export async function getLocationPaths() {
  const locations = await getLiveLocations();
  return locations.map((location) => ({ params: { location: location.slug } }));
}

async function getLocationSchoolLinks(locationId: string): Promise<LocationSchoolLink[]> {
  const { data, error } = await supabase
    .from('location_schools')
    .select('location_id, school_id, sort_order, is_featured')
    .eq('location_id', locationId)
    .order('sort_order', { ascending: true });

  if (error) fail(`Could not load location school links for ${locationId}`, error);
  return (data || []) as LocationSchoolLink[];
}

function dedupeIds<T extends string | number>(values: T[]): T[] {
  return Array.from(new Map(values.map((value) => [String(value), value])).values());
}

function chunkArray<T>(values: T[], size: number): T[][] {
  if (size <= 0) return [values];

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function getSchoolSlugMapByIds(schoolIds: Array<string | number>): Promise<Map<string, string>> {
  const uniqueSchoolIds = dedupeIds(schoolIds);
  if (!uniqueSchoolIds.length) return new Map();

  const rows: Array<{ id: string | number; slug: string }> = [];

  for (const batch of chunkArray(uniqueSchoolIds, 500)) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, slug')
      .in('id', batch);

    if (error) fail('Could not load school slugs for dynamic paths', error);
    rows.push(...(((data || []) as Array<{ id: string | number; slug: string }>)));
  }

  return new Map(rows.map((school) => [String(school.id), school.slug]));
}

async function getLocationSchoolPathLinks(locationIds: string[]): Promise<Array<{ location_id: string; school_id: string | number }>> {
  if (!locationIds.length) return [];

  const rows: Array<{ location_id: string; school_id: string | number }> = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('location_schools')
      .select('location_id, school_id')
      .in('location_id', locationIds)
      .order('location_id', { ascending: true })
      .order('school_id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) fail('Could not load location-school combinations', error);

    const page = (data || []) as Array<{ location_id: string; school_id: string | number }>;
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function getSchoolsByIds(schoolIds: Array<string | number>): Promise<SchoolSummaryRecord[]> {
  const uniqueSchoolIds = dedupeIds(schoolIds);
  if (!uniqueSchoolIds.length) return [];

  const rows: SchoolSummaryRecord[] = [];

  for (const batch of chunkArray(uniqueSchoolIds, 500)) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, slug, name, school_type, provision_category, phase, gender, age_min, age_max, day_boarding, address_line1, town, county, postcode, latitude, longitude, website, pupil_numbers, description, inspection_rating, official_sixth_form, nursery_provision, number_of_boys, number_of_girls, religion, religious_ethos, status')
      .in('id', batch);

    if (error) fail('Could not load schools', error);
    rows.push(...((data || []) as SchoolSummaryRecord[]));
  }

  return rows;
}

export async function getLocationDirectoryData(locationSlug: string) {
  const location = await getLocationBySlug(locationSlug);
  const locationLinks = await getLocationSchoolLinks(location.id);
  const schoolIds = locationLinks.map((row) => row.school_id);
  const schoolsRaw = await getSchoolsByIds(schoolIds);
  const schoolMap = new Map(schoolsRaw.map((school) => [String(school.id), school]));

  const schools = locationLinks
    .map((link) => schoolMap.get(String(link.school_id)))
    .filter(Boolean)
    .filter((school): school is SchoolSummaryRecord => getProvisionCategory(school) === 'mainstream');

  const schoolCards: SchoolCard[] = schools.map((school) => ({
    slug: school.slug,
    name: school.name,
    href: `/${location.slug}/schools/${school.slug}/`,
    cardClass: `school-square-card school-square-card--${getMapType(school.phase, school.age_max)}`,
    provisionCategory: getProvisionCategory(school),
    texts: [
      getPhaseLabel(school.phase, school.age_max),
      `${getGenderLabel(school.gender)} · ${getFormatLabel(school.day_boarding)}`,
      `Ages ${getAgeLabel(school.age_min, school.age_max)}`
    ]
  }));

  const mapSchools: MapSchool[] = schools
    .map((school) => buildLocationMapSchool(location, school))
    .filter((school): school is MapSchool => Boolean(school));

  return { location, locationLinks, schools, schoolCards, mapSchools };
}



let globalLinkedSchoolsPromise: Promise<Array<{ id: string; slug: string; name: string; locationSlug: string; latitude: number; longitude: number }>> | null = null;

async function getGlobalLinkedSchools() {
  if (!globalLinkedSchoolsPromise) {
    globalLinkedSchoolsPromise = (async () => {
      const liveLocations = await getLiveLocations();
      const locationSlugById = new Map(liveLocations.map((location) => [String(location.id), location.slug]));
      const links = await getLocationSchoolPathLinks(liveLocations.map((location) => location.id));
      const firstLocationBySchoolId = new Map<string, string>();

      links.forEach((link) => {
        const schoolKey = String(link.school_id);
        const locationSlug = locationSlugById.get(String(link.location_id));
        if (!locationSlug || firstLocationBySchoolId.has(schoolKey)) return;
        firstLocationBySchoolId.set(schoolKey, locationSlug);
      });

      const schools = await getSchoolsByIds(Array.from(firstLocationBySchoolId.keys()));
      return schools
        .map((school) => {
          const lat = toNumber(school.latitude);
          const lng = toNumber(school.longitude);
          const locationSlug = firstLocationBySchoolId.get(String(school.id));
          if (lat === null || lng === null || !locationSlug) return null;
          return {
            id: String(school.id),
            slug: school.slug,
            name: school.name,
            locationSlug,
            latitude: lat,
            longitude: lng
          };
        })
        .filter((row): row is { id: string; slug: string; name: string; locationSlug: string; latitude: number; longitude: number } => Boolean(row));
    })();
  }

  return globalLinkedSchoolsPromise;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = Math.PI / 180;
  const dLat = (lat2 - lat1) * radians;
  const dLng = (lng2 - lng1) * radians;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * radians) * Math.cos(lat2 * radians) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 3958.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getHomepageSearchSchoolRows(): Promise<SchoolSummaryRecord[]> {
  const rows: SchoolSummaryRecord[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, slug, name, school_type, provision_category, phase, gender, age_min, age_max, day_boarding, address_line1, town, county, postcode, latitude, longitude, website, pupil_numbers, description, inspection_rating, official_sixth_form, nursery_provision, number_of_boys, number_of_girls, religion, religious_ethos, status')
      .eq('provision_category', 'mainstream')
      .in('status', ['active', 'open'])
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) fail('Could not load homepage school search rows', error);

    const page = (data || []) as SchoolSummaryRecord[];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function getHomepageSearchSchools(): Promise<HomepageSearchSchool[]> {
  const linkedSchools = await getGlobalLinkedSchools();
  const locationSlugBySchoolId = new Map(linkedSchools.map((row) => [row.id, row.locationSlug]));
  const schools = await getHomepageSearchSchoolRows();
  const schoolIds = schools.map((school) => school.id);

  const [{ data: feeRowsRaw, error: feeRowsError }, { data: examRowsRaw, error: examRowsError }] = await Promise.all([
    supabase
      .from('school_fee_profiles_annual')
      .select(ANNUAL_FEE_SELECT_WITH_SCHOOL_ID)
      .in('school_id', schoolIds),
    supabase
      .from('school_exam_results')
      .select('school_id, result_year, entries_count, pct_a_star_a, pct_a_star_b, unique_subjects')
      .in('school_id', schoolIds)
      .eq('exam_type', 'alevel')
      .order('result_year', { ascending: false })
  ]);

  if (feeRowsError) fail('Could not load homepage fee rows', feeRowsError);
  if (examRowsError) fail('Could not load homepage exam rows', examRowsError);

  const feeRows = expandAnnualFeeRows(((feeRowsRaw || []) as Array<AnnualFeeRecord & { school_id: string | number }>));
  const latestExamBySchool = new Map<string, ExamResultRecord>();
  (((examRowsRaw || []) as Array<ExamResultRecord & { school_id: string | number }>)).forEach((row) => {
    const key = String(row.school_id);
    if (!latestExamBySchool.has(key)) latestExamBySchool.set(key, row);
  });

  return schools.map((school) => {
    const lat = toNumber(school.latitude) || 0;
    const lng = toNumber(school.longitude) || 0;
    const schoolId = String(school.id);
    const linkedLocationSlug = locationSlugBySchoolId.get(schoolId) || null;
    const href = linkedLocationSlug ? `/${linkedLocationSlug}/schools/${school.slug}/` : null;
    const ageLabel = getAgeLabel(school.age_min, school.age_max);
    const genderLabel = getGenderLabel(school.gender);
    const boardingLabel = getFormatLabel(school.day_boarding);
    const religion = getSchoolReligionLabel(school);
    const hasSixthForm = schoolHasSixthForm(school);
    const hasNursery = schoolHasNursery(school);
    const studentCount = getStudentCount(school);
    const studentsLabel = studentCount !== null ? formatInteger(studentCount) : null;
    const boyGirlSplit = getBoyGirlSplitLabel(school);
    const schoolFeeRows = feeRows.filter((row) => String(row.school_id) === schoolId);
    const currentAcademicYear = Array.from(new Set(schoolFeeRows.map((row) => row.academic_year))).sort().at(-1) || null;
    const currentFeeRows = currentAcademicYear ? schoolFeeRows.filter((row) => row.academic_year === currentAcademicYear) : [];
    const latestExam = latestExamBySchool.get(schoolId) || null;
    const provisionCategory = getProvisionCategory(school);

    return {
      id: schoolId,
      slug: school.slug,
      name: school.name,
      href,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      type: getMapType(school.phase, school.age_max),
      provisionCategory,
      note: `${genderLabel} · ${boardingLabel} · Ages ${ageLabel}`,
      displayLocation: getSchoolLocationLabel(school),
      ageLabel,
      genderLabel,
      genderFilter: getGenderFilterValue(school.gender),
      boardingLabel,
      boardingFilter: getBoardingFilterValue(school.day_boarding),
      hasSixthForm,
      hasNursery,
      religion,
      studentsLabel,
      boyGirlSplit,
      dayFee: formatFeeRange(currentFeeRows.filter((row) => row.fee_type === 'day')),
      boardingFee: formatFeeRange(currentFeeRows.filter((row) => row.fee_type === 'weekly_boarding' || row.fee_type === 'full_boarding')),
      totalExams: latestExam ? toNumber(latestExam.entries_count) : null,
      pctAStarA: latestExam ? toNumber(latestExam.pct_a_star_a) : null,
      pctAStarB: latestExam ? toNumber(latestExam.pct_a_star_b) : null,
      uniqueSubjects: latestExam ? toNumber(latestExam.unique_subjects) : null
    };
  });
}

export async function getHomepageMapSchools(): Promise<MapSchool[]> {
  const liveLocations = await getLiveLocations();
  const directoryEntries = await Promise.all(
    liveLocations.map((location) => getLocationDirectoryData(location.slug))
  );

  const seen = new Set<string>();
  const mapSchools: MapSchool[] = [];

  directoryEntries.forEach((entry) => {
    entry.mapSchools.forEach((school) => {
      const key = school.href || school.slug;
      if (seen.has(key)) return;
      seen.add(key);
      mapSchools.push(school);
    });
  });

  return mapSchools;
}

export async function getLocationCompareData(locationSlug: string): Promise<{ location: LocationRecord; compareSchools: CompareSchoolRecord[] }> {
  const location = await getLocationBySlug(locationSlug);
  const locationLinks = await getLocationSchoolLinks(location.id);
  const schoolIds = locationLinks.map((row) => row.school_id);
  const schoolsRaw = await getSchoolsByIds(schoolIds);
  const schoolMap = new Map(schoolsRaw.map((school) => [String(school.id), school]));
  const orderedSchools = locationLinks
    .map((link) => schoolMap.get(String(link.school_id)))
    .filter(Boolean) as SchoolSummaryRecord[];

  if (!orderedSchools.length) {
    return { location, compareSchools: [] };
  }

  const { data: feeRowsRaw, error: feeRowsError } = await supabase
    .from('school_fee_profiles_annual')
    .select(ANNUAL_FEE_SELECT_WITH_SCHOOL_ID)
    .in('school_id', schoolIds);

  if (feeRowsError) fail(`Could not load compare fees for ${locationSlug}`, feeRowsError);

  const { data: bursaryRowsRaw, error: bursaryRowsError } = await supabase
    .from('school_bursaries')
    .select('school_id, has_bursaries, status_label, summary, entry_points, published_support_level, application_and_review')
    .in('school_id', schoolIds);

  if (bursaryRowsError) fail(`Could not load compare bursaries for ${locationSlug}`, bursaryRowsError);

  const { data: examRowsRaw, error: examRowsError } = await supabase
    .from('school_exam_results')
    .select('school_id, result_year, entries_count, pct_a_star_a, pct_a_star_b, unique_subjects')
    .in('school_id', schoolIds)
    .eq('exam_type', 'alevel')
    .order('result_year', { ascending: false });

  if (examRowsError) fail(`Could not load compare exam results for ${locationSlug}`, examRowsError);

  const { data: subjectRowsRaw, error: subjectRowsError } = await supabase
    .from('school_subject_popularity')
    .select('school_id, result_year, subject_name, share_of_entries, sort_order')
    .in('school_id', schoolIds)
    .eq('exam_type', 'alevel')
    .order('sort_order', { ascending: true });

  if (subjectRowsError) fail(`Could not load compare subjects for ${locationSlug}`, subjectRowsError);

  const feeRows = expandAnnualFeeRows(
    ((feeRowsRaw || []) as Array<AnnualFeeRecord & { school_id: string | number }>)
  );
  const bursaryRows = (bursaryRowsRaw || []) as Array<BursaryRecord & { school_id: string | number }>;
  const examRows = (examRowsRaw || []) as Array<ExamResultRecord & { school_id: string | number }>;
  const subjectRows = (subjectRowsRaw || []) as Array<SubjectRecord & { school_id: string | number; result_year: number }>;

  const bursaryBySchool = new Map(bursaryRows.map((row) => [String(row.school_id), row]));
  const latestExamBySchool = new Map<string, ExamResultRecord>();
  examRows.forEach((row) => {
    const key = String(row.school_id);
    if (!latestExamBySchool.has(key)) latestExamBySchool.set(key, row);
  });

  const presentation = getLocationPresentation(location.slug, location.name);

  const compareSchools: CompareSchoolRecord[] = orderedSchools.map((school) => {
    const key = String(school.id);
    const schoolFeeRows = feeRows.filter((row) => String(row.school_id) === key);
    const currentAcademicYear = Array.from(new Set(schoolFeeRows.map((row) => row.academic_year))).sort().at(-1) || null;
    const currentFeeRows = currentAcademicYear
      ? schoolFeeRows.filter((row) => row.academic_year === currentAcademicYear)
      : [];

    const latestExam = latestExamBySchool.get(key) || null;
    const latestSubjects = latestExam
      ? subjectRows.filter((row) => String(row.school_id) === key && row.result_year === latestExam.result_year)
      : [];

    const phaseLabel = getPhaseLabel(school.phase, school.age_max);
    const genderLabel = getGenderLabel(school.gender);
    const formatLabel = getFormatLabel(school.day_boarding);
    const ageLabel = getAgeLabel(school.age_min, school.age_max);

    return {
      id: school.slug,
      schoolId: String(school.id),
      schoolSlug: school.slug,
      provisionCategory: getProvisionCategory(school),
      name: school.name,
      slug: `/${location.slug}/schools/${school.slug}/`,
      ages: ageLabel,
      gender: genderLabel,
      format: formatLabel,
      dayFee: formatFeeRange(currentFeeRows.filter((row) => row.fee_type === 'day')),
      boardingFee: formatFeeRange(currentFeeRows.filter((row) => row.fee_type === 'weekly_boarding' || row.fee_type === 'full_boarding')),
      bursaries: formatBursaryStatus(bursaryBySchool.get(key) || null),
      location: formatLocationLabel(school, location.name),
      subhead: school.description || `${phaseLabel} in ${school.town || location.name}.`,
      heroImage: presentation.defaultSchoolHeroImage,
      map: buildLocationMapSchool(location, school),
      alevel: aggregateAlevelMetrics(latestExam, latestSubjects)
    };
  });

  return { location, compareSchools };
}


async function getOrderedLocationSchools(locationSlug: string) {
  const location = await getLocationBySlug(locationSlug);
  const locationLinks = await getLocationSchoolLinks(location.id);
  const schoolIds = locationLinks.map((row) => row.school_id);
  const schoolsRaw = await getSchoolsByIds(schoolIds);
  const schoolMap = new Map(schoolsRaw.map((school) => [String(school.id), school]));

  const schools = locationLinks
    .map((link) => schoolMap.get(String(link.school_id)))
    .filter(Boolean) as SchoolSummaryRecord[];

  return { location, locationLinks, schoolIds, schools, schoolMap };
}

export async function getLocationFeesData(locationSlug: string) {
  const { location, schools, schoolIds } = await getOrderedLocationSchools(locationSlug);

  const { data, error } = schoolIds.length
    ? await supabase
        .from('school_fee_profiles_annual')
        .select(ANNUAL_FEE_SELECT_WITH_SCHOOL_ID)
        .in('school_id', schoolIds)
    : { data: [], error: null };

  if (error) fail(`Could not load fees for ${locationSlug}`, error);

  const feeRows = expandAnnualFeeRows(
    ((data || []) as Array<AnnualFeeRecord & { school_id: string | number }>)
  );
  const currentAcademicYear = Array.from(new Set(feeRows.map((row) => row.academic_year))).sort().at(-1) || null;
  const filtered = feeRows
    .filter((row) => !currentAcademicYear || row.academic_year === currentAcademicYear)
    .sort((a, b) => {
      const feeTypeDelta = feeTypeOrder(a.fee_type) - feeTypeOrder(b.fee_type);
      if (feeTypeDelta !== 0) return feeTypeDelta;
      return yearGroupOrder(a.year_group_label) - yearGroupOrder(b.year_group_label);
    });

  const schoolHeaders = schools.map((school) => ({
    schoolId: String(school.id),
    schoolSlug: school.slug,
    schoolName: school.name,
    provisionCategory: getProvisionCategory(school)
  }));

  const feeTypes = Array.from(new Set(filtered.map((row) => row.fee_type))).sort(
    (a, b) => feeTypeOrder(a) - feeTypeOrder(b)
  );

  const views: LocationFeeView[] = feeTypes.map((feeType) => {
    const rowsForType = filtered.filter((row) => row.fee_type === feeType);
    const labels = Array.from(new Set(rowsForType.map((row) => row.year_group_label))).sort(
      (a, b) => yearGroupOrder(a) - yearGroupOrder(b)
    );

    const rows: LocationFeeRow[] = labels.map((label) => ({
      label,
      cells: schools.map((school) => {
        const match = rowsForType.find(
          (row) => String(row.school_id) === String(school.id) && row.year_group_label === label
        );
        return {
          schoolId: String(school.id),
          schoolName: school.name,
          schoolSlug: school.slug,
          amount: match ? toNumber(match.amount_gbp) : null
        };
      })
    }));

    return {
      feeType,
      label: feeTypeLabel(feeType),
      rows
    };
  });

  const allFeesIncludeVat = filtered.length ? filtered.every((row) => row.includes_vat) : false;

  return {
    location,
    schoolHeaders,
    currentAcademicYear,
    allFeesIncludeVat,
    views
  };
}

export async function getLocationBursariesData(locationSlug: string) {
  const { location, schools, schoolIds } = await getOrderedLocationSchools(locationSlug);

  const { data, error } = schoolIds.length
    ? await supabase
        .from('school_bursaries')
        .select('school_id, has_bursaries, status_label, summary, entry_points, published_support_level, application_and_review')
        .in('school_id', schoolIds)
    : { data: [], error: null };

  if (error) fail(`Could not load bursaries for ${locationSlug}`, error);

  const bursaryBySchool = new Map(
    ((data || []) as Array<BursaryRecord & { school_id: string | number }>).map((row) => [String(row.school_id), row])
  );

  const cards: LocationBursaryCard[] = schools.map((school) => {
    const bursary = bursaryBySchool.get(String(school.id)) || null;
    const summary = String(
      bursary?.summary ||
      bursary?.status_label ||
      (bursary?.has_bursaries === true ? 'Bursary information is being updated.' : 'Coming soon')
    ).trim();

    return {
      schoolId: String(school.id),
      schoolSlug: school.slug,
      schoolName: school.name,
      provisionCategory: getProvisionCategory(school),
      summary: summary || 'Coming soon'
    };
  });

  return { location, cards };
}

export async function getLocationOpenDaysData(locationSlug: string) {
  const { location, schools, schoolIds } = await getOrderedLocationSchools(locationSlug);

  const { data, error } = schoolIds.length
    ? await supabase
        .from('school_open_days')
        .select('school_id, title, start_at, end_at, booking_url, notes, is_verified, last_verified_at')
        .in('school_id', schoolIds)
        .order('start_at', { ascending: true })
    : { data: [], error: null };

  if (error) fail(`Could not load open days for ${locationSlug}`, error);

  const schoolMap = new Map(schools.map((school) => [String(school.id), school]));
  const openDays: LocationOpenDayItem[] = ((data || []) as Array<{
    school_id: string | number;
    title: string;
    start_at: string | null;
    end_at: string | null;
    booking_url: string | null;
    notes: string | null;
    is_verified: boolean;
    last_verified_at: string | null;
  }>)
    .map((row) => {
      const school = schoolMap.get(String(row.school_id));
      if (!school) return null;
      return {
        schoolId: String(row.school_id),
        schoolSlug: school.slug,
        schoolName: school.name,
        provisionCategory: getProvisionCategory(school),
        title: row.title,
        startAt: row.start_at,
        endAt: row.end_at,
        bookingUrl: row.booking_url,
        notes: row.notes,
        isVerified: Boolean(row.is_verified),
        lastVerifiedAt: row.last_verified_at
      };
    })
    .filter(Boolean) as LocationOpenDayItem[];

  const lastVerifiedAt = openDays
    .map((row) => row.lastVerifiedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    location,
    openDays,
    lastVerifiedAt
  };
}

export async function getAllLocationSchoolPaths() {
  const locations = await getLiveLocations();
  if (!locations.length) return [];

  const locationById = new Map(locations.map((location) => [String(location.id), location.slug]));
  const locationIds = locations.map((location) => location.id);
  const links = await getLocationSchoolPathLinks(locationIds);
  const schoolIds = dedupeIds(links.map((link) => link.school_id));
  const schoolSlugById = await getSchoolSlugMapByIds(schoolIds);

  return links
    .map((link) => {
      const locationSlug = locationById.get(String(link.location_id));
      const schoolSlug = schoolSlugById.get(String(link.school_id));
      if (!locationSlug || !schoolSlug) return null;
      return { params: { location: locationSlug, slug: schoolSlug } };
    })
    .filter(Boolean);
}

export async function getLocationSchoolProfile(locationSlug: string, schoolSlug: string) {
  const location = await getLocationBySlug(locationSlug);
  const locationLinks = await getLocationSchoolLinks(location.id);
  const schoolIds = locationLinks.map((row) => row.school_id);

  const { data: schoolData, error: schoolError } = await supabase
    .from('schools')
    .select('id, slug, name, school_type, provision_category, phase, gender, age_min, age_max, day_boarding, address_line1, town, county, postcode, latitude, longitude, website, pupil_numbers, description, inspection_rating, official_sixth_form, nursery_provision, number_of_boys, number_of_girls, religion, religious_ethos, status')
    .eq('slug', schoolSlug)
    .single();

  if (schoolError || !schoolData) fail(`Could not load school ${schoolSlug}`, schoolError);

  const school = schoolData as SchoolSummaryRecord;
  const allowedSchoolIds = new Set(schoolIds.map((id) => String(id)));
  if (!allowedSchoolIds.has(String(school.id))) {
    throw new Error(`${schoolSlug} is not linked to ${locationSlug}`);
  }

  const [contentRes, heroImageRes, examRes, feeRes, bursaryRes, compareSchoolsRes] = await Promise.all([
    withRetry(() =>
      supabase
        .from('school_content')
        .select('*')
        .eq('school_id', school.id)
        .maybeSingle()
    ),
    withRetry(() =>
      supabase
        .from('school_images')
        .select('image_url, alt_text')
        .eq('school_id', school.id)
        .eq('image_type', 'hero')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()
    ),
    withRetry(() =>
      supabase
        .from('school_exam_results')
        .select('result_year, entries_count, pct_a_star_a, pct_a_star_b, unique_subjects')
        .eq('school_id', school.id)
        .eq('exam_type', 'alevel')
        .order('result_year', { ascending: false })
        .limit(1)
        .maybeSingle()
    ),
    withRetry(() =>
      supabase
        .from('school_fee_profiles_annual')
        .select(ANNUAL_FEE_SELECT)
        .eq('school_id', school.id)
        .order('academic_year', { ascending: false })
    ),
    withRetry(() =>
      supabase
        .from('school_bursaries')
        .select('has_bursaries, status_label, summary, entry_points, published_support_level, application_and_review')
        .eq('school_id', school.id)
        .maybeSingle()
    ),
    schoolIds.length
      ? withRetry(() => supabase.from('schools').select('id, slug, name').in('id', schoolIds))
      : Promise.resolve({ data: [], error: null })
  ]);

  if (contentRes.error && !isTransientSupabaseError(contentRes.error)) {
    fail(`Could not load school content for ${schoolSlug}`, contentRes.error);
  }
  if (heroImageRes.error) fail(`Could not load school image for ${schoolSlug}`, heroImageRes.error);
  if (examRes.error) fail(`Could not load exam results for ${schoolSlug}`, examRes.error);
  if (feeRes.error) fail(`Could not load fees for ${schoolSlug}`, feeRes.error);
  if (bursaryRes.error) fail(`Could not load bursary data for ${schoolSlug}`, bursaryRes.error);
  if (compareSchoolsRes.error) fail(`Could not load compare links for ${schoolSlug}`, compareSchoolsRes.error);

  const content = normalizeSchoolContent((contentRes.data || null) as RawSchoolContentRecord | null);
  const locationPresentation = getLocationPresentation(location.slug, location.name);
  const heroImageUrl = heroImageRes.data?.image_url || locationPresentation.defaultSchoolHeroImage;
  const heroImageAlt = heroImageRes.data?.alt_text || '';
  const alevelResult = (examRes.data || null) as ExamResultRecord | null;
  const feeRowsAll = expandAnnualFeeRows((feeRes.data || []) as AnnualFeeRecord[]) as FeeRecord[];
  const bursary = (bursaryRes.data || null) as BursaryRecord | null;

  const compareRows = ((compareSchoolsRes.data || []) as Array<{ id: string | number; slug: string; name: string }>);
  const compareSchoolMap = new Map(compareRows.map((row) => [String(row.id), row]));
  const fallbackCompareLinks = locationLinks
    .map((row) => compareSchoolMap.get(String(row.school_id)))
    .filter((row): row is { id: string | number; slug: string; name: string } => Boolean(row))
    .filter((row) => row.slug !== school.slug)
    .map((row) => ({ slug: row.slug, name: row.name }));

  const { data: subjectRowsRaw, error: subjectRowsError } = alevelResult
    ? await withRetry(() =>
        supabase
          .from('school_subject_popularity')
          .select('subject_name, share_of_entries, sort_order')
          .eq('school_id', school.id)
          .eq('exam_type', 'alevel')
          .eq('result_year', alevelResult.result_year)
          .order('sort_order', { ascending: true })
      )
    : { data: [], error: null };

  if (subjectRowsError) fail(`Could not load subject popularity for ${schoolSlug}`, subjectRowsError);

  const subjectRows = (subjectRowsRaw || []) as SubjectRecord[];
  const currentAcademicYear = Array.from(new Set(feeRowsAll.map((row) => row.academic_year))).sort().at(-1) || null;
  const feeRows = feeRowsAll
    .filter((row) => row.academic_year === currentAcademicYear)
    .sort((a, b) => {
      const feeTypeDelta = feeTypeOrder(a.fee_type) - feeTypeOrder(b.fee_type);
      if (feeTypeDelta !== 0) return feeTypeDelta;
      return yearGroupOrder(a.year_group_label) - yearGroupOrder(b.year_group_label);
    });

  const feePanes: FeePane[] = Array.from(new Set(feeRows.map((row) => row.fee_type))).map((feeType) => {
    const rows = feeRows.filter((row) => row.fee_type === feeType);
    return {
      feeType,
      label: feeTypeLabel(feeType),
      columns: splitColumns(rows)
    };
  });

  const allFeesIncludeVat = feeRows.length ? feeRows.every((row) => row.includes_vat) : false;
  const phaseLabel = getPhaseLabel(school.phase, school.age_max);
  const genderLabel = getGenderLabel(school.gender);
  const formatLabel = getFormatLabel(school.day_boarding);
  const ageLabel = getAgeLabel(school.age_min, school.age_max);
  const address = buildAddress(school);
  const subhead = school.description || `${phaseLabel} in ${school.town || location.name}.`;
  const canonicalPath = `/${location.slug}/schools/${school.slug}/`;
  const coordinates = getSchoolCoordinates(school);

  const provisionCategory = getProvisionCategory(school);
  const studentCount = getStudentCount(school);
  const boyGirlSplit = getBoyGirlSplitLabel(school);
  const religionLabel = getSchoolReligionLabel(school);
  const yearFoundedLabel = getYearFoundedLabel(content);

  const compareLinks = coordinates
    ? (await getGlobalLinkedSchools())
        .filter((candidate) => candidate.slug !== school.slug)
        .map((candidate) => ({
          slug: candidate.slug,
          name: candidate.name,
          locationSlug: candidate.locationSlug,
          distanceMiles: haversineMiles(coordinates.lat, coordinates.lng, candidate.latitude, candidate.longitude)
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name, 'en'))
        .slice(0, 8)
        .map((candidate) => ({ slug: candidate.slug, name: candidate.name, locationSlug: candidate.locationSlug }))
    : fallbackCompareLinks.map((row) => ({ slug: row.slug, name: row.name, locationSlug: location.slug }));

  const mapData = coordinates
    ? {
        name: school.name,
        slug: canonicalPath,
        href: canonicalPath,
        lat: coordinates.lat,
        lng: coordinates.lng,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        provisionCategory,
        note: `${provisionCategory === 'sen_specialist' ? 'SEN specialist · ' : ''}${phaseLabel} · ${genderLabel} · ${formatLabel} · Ages ${ageLabel}`,
        zoom: coordinates.zoom || 13
      }
    : null;

  const rawAtGlanceRows = [
    { label: 'Ages', value: ageLabel },
    studentCount !== null ? { label: 'Students', value: formatInteger(studentCount) } : null,
    boyGirlSplit ? { label: 'Boy/girl split', value: boyGirlSplit } : null,
    { label: 'Gender', value: genderLabel },
    { label: 'Format', value: formatLabel },
    religionLabel ? { label: 'Religion', value: religionLabel } : null,
    schoolHasNursery(school) ? { label: 'Nursery', value: 'Has a nursery' } : null,
    yearFoundedLabel ? { label: 'Founded', value: yearFoundedLabel } : null,
    bursary?.status_label
      ? { label: 'Bursaries', value: bursary.status_label }
      : bursary?.has_bursaries === true
        ? { label: 'Bursaries', value: 'Available' }
        : bursary?.has_bursaries === false
          ? { label: 'Bursaries', value: 'Not currently published' }
          : null
  ];

  const atGlanceRows = rawAtGlanceRows.filter((row): row is { label: string; value: string } => Boolean(row));
  const parentLikes = splitPipeList(content?.what_parents_say);
  const schoolVoice = splitPipeList(content?.what_school_says);
  const inspectionBullets = splitPipeList(content?.inspection_snapshot);
  const scholarshipBullets = splitPipeList(content?.scholarships);
  const destinationsBullets = splitPipeList(content?.destinations);
  const assessmentBullets = splitPipeList(content?.assessment_approach);
  const bursaryBullets = [
    bursary?.entry_points,
    bursary?.published_support_level,
    bursary?.application_and_review
  ].filter(Boolean) as string[];

  return {
    location,
    school,
    content,
    heroImageUrl,
    heroImageAlt,
    alevelResult,
    subjectRows,
    subjectTopRows: subjectRows.slice(0, 5),
    subjectExtraRows: subjectRows.slice(5),
    bursary,
    bursaryBullets,
    feePanes,
    currentAcademicYear,
    allFeesIncludeVat,
    compareLinks,
    atGlanceRows,
    parentLikes,
    schoolVoice,
    inspectionBullets,
    scholarshipBullets,
    destinationsBullets,
    assessmentBullets,
    phaseLabel,
    genderLabel,
    formatLabel,
    ageLabel,
    address,
    subhead,
    canonicalPath,
    mapData
  };
}
