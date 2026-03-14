import { supabase } from './supabase';

const BATH_COORDINATE_FALLBACKS: Record<string, { lat: number; lng: number; zoom?: number }> = {
  'king-edwards-school': { lat: 51.386488, lng: -2.343663, zoom: 13 },
  'kingswood-school': { lat: 51.398883, lng: -2.370005, zoom: 13 },
  'kingswood-preparatory-school': { lat: 51.397143, lng: -2.373238, zoom: 13 },
  'prior-park-college': { lat: 51.364523, lng: -2.343082, zoom: 13 },
  'paragon-school': { lat: 51.370494, lng: -2.355122, zoom: 13 },
  'monkton-combe-school': { lat: 51.357305, lng: -2.326354, zoom: 13 },
  'royal-high-school-bath-gdst': { lat: 51.397185, lng: -2.365419, zoom: 13 },
  'bath-academy': { lat: 51.383903, lng: -2.363978, zoom: 13 },
  'downside-school': { lat: 51.253899, lng: -2.495195, zoom: 13 }
};

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
  fees_from: number | null;
  description: string | null;
  inspection_rating: string | null;
};

export type SchoolContentRecord = {
  admissions_summary: string | null;
  academic_snapshot: string | null;
  inspection_snapshot: string | null;
  assessment_approach: string | null;
  scholarships: string | null;
  destinations: string | null;
  what_parents_say: string | null;
  what_school_says: string | null;
  editor_notes: string | null;
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
  texts: string[];
};

export type MapSchool = {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  type: string;
  note: string;
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
  schoolSlug: string;
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

export function getGenderLabel(gender: string | null): string {
  const value = (gender || '').toLowerCase();
  if (value.includes('girl')) return 'Girls';
  if (value.includes('boy')) return 'Boys';
  return 'Co-ed';
}

export function getFormatLabel(dayBoarding: string | null): string {
  if (!dayBoarding) return 'Day';
  return dayBoarding
    .replace(/_/g, ' ')
    .replace(/\bday boarding\b/i, 'Day & boarding')
    .replace(/\bboarding and day\b/i, 'Day & boarding')
    .replace(/\bday and boarding\b/i, 'Day & boarding')
    .replace(/\bfull boarding\b/i, 'Full boarding')
    .replace(/\bweekly boarding\b/i, 'Weekly boarding')
    .replace(/\bday\b/i, 'Day');
}

export function getAgeLabel(ageMin: number | null, ageMax: number | null): string {
  if (ageMin !== null && ageMax !== null) return `${ageMin}–${ageMax}`;
  if (ageMin !== null) return `${ageMin}+`;
  if (ageMax !== null) return `Up to ${ageMax}`;
  return 'To be confirmed';
}

export function buildAddress(school: Pick<SchoolSummaryRecord, 'address_line1' | 'town' | 'postcode'>): string {
  return [school.address_line1, school.town, school.postcode].filter(Boolean).join(', ');
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

function yearGroupOrder(label: string): number {
  const trimmed = label.trim();
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


function getSchoolCoordinateFallback(locationSlug: string, schoolSlug: string) {
  if (locationSlug !== 'bath') return null;
  return BATH_COORDINATE_FALLBACKS[schoolSlug] || null;
}

function getSchoolCoordinates(locationSlug: string, school: Pick<SchoolSummaryRecord, 'slug' | 'latitude' | 'longitude'>) {
  const lat = toNumber(school.latitude);
  const lng = toNumber(school.longitude);

  if (lat !== null && lng !== null) {
    return { lat, lng, zoom: 13 };
  }

  const fallback = getSchoolCoordinateFallback(locationSlug, school.slug);
  if (!fallback) return null;

  return {
    lat: fallback.lat,
    lng: fallback.lng,
    zoom: fallback.zoom || 13
  };
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

async function getSchoolsByIds(schoolIds: Array<string | number>): Promise<SchoolSummaryRecord[]> {
  if (!schoolIds.length) return [];

  const { data, error } = await supabase
    .from('schools')
    .select('id, slug, name, school_type, phase, gender, age_min, age_max, day_boarding, address_line1, town, county, postcode, latitude, longitude, website, pupil_numbers, fees_from, description, inspection_rating')
    .in('id', schoolIds);

  if (error) fail('Could not load schools', error);
  return (data || []) as SchoolSummaryRecord[];
}

export async function getLocationDirectoryData(locationSlug: string) {
  const location = await getLocationBySlug(locationSlug);
  const locationLinks = await getLocationSchoolLinks(location.id);
  const schoolIds = locationLinks.map((row) => row.school_id);
  const schoolsRaw = await getSchoolsByIds(schoolIds);
  const schoolMap = new Map(schoolsRaw.map((school) => [String(school.id), school]));

  const schools = locationLinks
    .map((link) => schoolMap.get(String(link.school_id)))
    .filter(Boolean) as SchoolSummaryRecord[];

  const schoolCards: SchoolCard[] = schools.map((school) => ({
    slug: school.slug,
    name: school.name,
    href: `/${location.slug}/schools/${school.slug}/`,
    cardClass: `school-square-card school-square-card--${getMapType(school.phase, school.age_max)}`,
    texts: [
      getPhaseLabel(school.phase, school.age_max),
      `${getGenderLabel(school.gender)} · ${getFormatLabel(school.day_boarding)}`,
      `Ages ${getAgeLabel(school.age_min, school.age_max)}`
    ]
  }));

  const mapSchools: MapSchool[] = schools
    .map((school) => {
      const coordinates = getSchoolCoordinates(location.slug, school);
      if (!coordinates) return null;

      return {
        name: school.name,
        slug: `/${location.slug}/schools/${school.slug}/`,
        lat: coordinates.lat,
        lng: coordinates.lng,
        type: getMapType(school.phase, school.age_max),
        note: `${getPhaseLabel(school.phase, school.age_max)} · ${getGenderLabel(school.gender)} · ${getFormatLabel(school.day_boarding)} · Ages ${getAgeLabel(school.age_min, school.age_max)}`
      };
    })
    .filter((school): school is MapSchool => Boolean(school));

  return { location, locationLinks, schools, schoolCards, mapSchools };
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
    .from('school_fee_profiles')
    .select('school_id, academic_year, fee_type, year_group_label, amount_gbp, includes_vat')
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

  const feeRows = (feeRowsRaw || []) as Array<FeeRecord & { school_id: string | number }>;
  const bursaryRows = (bursaryRowsRaw || []) as Array<BursaryRecord & { school_id: string | number }>;
  const examRows = (examRowsRaw || []) as Array<ExamResultRecord & { school_id: string | number }>;
  const subjectRows = (subjectRowsRaw || []) as Array<SubjectRecord & { school_id: string | number; result_year: number }>;

  const bursaryBySchool = new Map(bursaryRows.map((row) => [String(row.school_id), row]));
  const latestExamBySchool = new Map<string, ExamResultRecord>();
  examRows.forEach((row) => {
    const key = String(row.school_id);
    if (!latestExamBySchool.has(key)) latestExamBySchool.set(key, row);
  });

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
      schoolSlug: school.slug,
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
      heroImage: '/assets/img/bath/default-school.jpg',
      map: (() => {
        const coordinates = getSchoolCoordinates(location.slug, school);
        if (!coordinates) return null;

        return {
          name: school.name,
          slug: `/${location.slug}/schools/${school.slug}/`,
          lat: coordinates.lat,
          lng: coordinates.lng,
          type: getMapType(school.phase, school.age_max),
          note: `${phaseLabel} · ${genderLabel} · ${formatLabel} · Ages ${ageLabel}`
        };
      })(),
      alevel: aggregateAlevelMetrics(latestExam, latestSubjects)
    };
  });

  return { location, compareSchools };
}

export async function getAllLocationSchoolPaths() {
  const locations = await getLiveLocations();
  if (!locations.length) return [];

  const locationById = new Map(locations.map((location) => [String(location.id), location.slug]));
  const locationIds = locations.map((location) => location.id);

  const { data: linksRaw, error: linksError } = await supabase
    .from('location_schools')
    .select('location_id, school_id')
    .in('location_id', locationIds);

  if (linksError) fail('Could not load location-school combinations', linksError);

  const links = (linksRaw || []) as Array<{ location_id: string; school_id: string | number }>;
  const schoolIds = Array.from(new Set(links.map((link) => link.school_id)));

  const { data: schoolsRaw, error: schoolsError } = schoolIds.length
    ? await supabase.from('schools').select('id, slug').in('id', schoolIds)
    : { data: [], error: null };

  if (schoolsError) fail('Could not load school slugs for dynamic paths', schoolsError);

  const schoolSlugById = new Map((schoolsRaw || []).map((school) => [String(school.id), school.slug]));

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
    .select('id, slug, name, school_type, phase, gender, age_min, age_max, day_boarding, address_line1, town, county, postcode, latitude, longitude, website, pupil_numbers, fees_from, description, inspection_rating')
    .eq('slug', schoolSlug)
    .single();

  if (schoolError || !schoolData) fail(`Could not load school ${schoolSlug}`, schoolError);

  const school = schoolData as SchoolSummaryRecord;
  const allowedSchoolIds = new Set(schoolIds.map((id) => String(id)));
  if (!allowedSchoolIds.has(String(school.id))) {
    throw new Error(`${schoolSlug} is not linked to ${locationSlug}`);
  }

  const [contentRes, heroImageRes, examRes, feeRes, bursaryRes, compareSchoolsRes] = await Promise.all([
    supabase
      .from('school_content')
      .select('admissions_summary, academic_snapshot, inspection_snapshot, assessment_approach, scholarships, destinations, what_parents_say, what_school_says, editor_notes')
      .eq('school_id', school.id)
      .maybeSingle(),
    supabase
      .from('school_images')
      .select('image_url, alt_text')
      .eq('school_id', school.id)
      .eq('image_type', 'hero')
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('school_exam_results')
      .select('result_year, entries_count, pct_a_star_a, pct_a_star_b, unique_subjects')
      .eq('school_id', school.id)
      .eq('exam_type', 'alevel')
      .order('result_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('school_fee_profiles')
      .select('academic_year, fee_type, year_group_label, amount_gbp, includes_vat')
      .eq('school_id', school.id)
      .order('academic_year', { ascending: false }),
    supabase
      .from('school_bursaries')
      .select('has_bursaries, status_label, summary, entry_points, published_support_level, application_and_review')
      .eq('school_id', school.id)
      .maybeSingle(),
    schoolIds.length
      ? supabase.from('schools').select('id, slug, name').in('id', schoolIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (contentRes.error) fail(`Could not load school content for ${schoolSlug}`, contentRes.error);
  if (heroImageRes.error) fail(`Could not load school image for ${schoolSlug}`, heroImageRes.error);
  if (examRes.error) fail(`Could not load exam results for ${schoolSlug}`, examRes.error);
  if (feeRes.error) fail(`Could not load fees for ${schoolSlug}`, feeRes.error);
  if (bursaryRes.error) fail(`Could not load bursary data for ${schoolSlug}`, bursaryRes.error);
  if (compareSchoolsRes.error) fail(`Could not load compare links for ${schoolSlug}`, compareSchoolsRes.error);

  const content = (contentRes.data || null) as SchoolContentRecord | null;
  const heroImageUrl = heroImageRes.data?.image_url || '/assets/img/bath/default-school.jpg';
  const heroImageAlt = heroImageRes.data?.alt_text || '';
  const alevelResult = (examRes.data || null) as ExamResultRecord | null;
  const feeRowsAll = (feeRes.data || []) as FeeRecord[];
  const bursary = (bursaryRes.data || null) as BursaryRecord | null;

  const compareSchoolMap = new Map((compareSchoolsRes.data || []).map((row) => [String(row.id), row]));
  const compareLinks = locationLinks
    .map((row) => compareSchoolMap.get(String(row.school_id)))
    .filter(Boolean)
    .filter((row) => row?.slug !== school.slug)
    .map((row) => ({ slug: row!.slug, name: row!.name }));

  const { data: subjectRowsRaw, error: subjectRowsError } = alevelResult
    ? await supabase
        .from('school_subject_popularity')
        .select('subject_name, share_of_entries, sort_order')
        .eq('school_id', school.id)
        .eq('exam_type', 'alevel')
        .eq('result_year', alevelResult.result_year)
        .order('sort_order', { ascending: true })
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
  const coordinates = getSchoolCoordinates(location.slug, school);

  const mapData = coordinates
    ? {
        name: school.name,
        slug: canonicalPath,
        lat: coordinates.lat,
        lng: coordinates.lng,
        note: `${phaseLabel} · ${genderLabel} · ${formatLabel} · Ages ${ageLabel}`,
        zoom: coordinates.zoom || 13
      }
    : null;

  const rawAtGlanceRows = [
    { label: 'Ages', value: ageLabel },
    { label: 'Gender', value: genderLabel },
    { label: 'Format', value: formatLabel },
    school.pupil_numbers ? { label: 'Pupils', value: `${formatInteger(school.pupil_numbers)} pupils` } : null,
    school.fees_from ? { label: 'Day fees from', value: `${formatCurrency(school.fees_from)} / year` } : null,
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
