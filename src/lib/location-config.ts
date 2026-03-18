export type LocationNavigationConfig = {
  compareOverview: boolean;
  compareAlevels: boolean;
  fees: boolean;
  bursaries: boolean;
  openDays: boolean;
  movingToSection: boolean;
};

export type LocationPresentationConfig = {
  heroImage: string;
  heroImageAlt: string;
  heroSubtitle: string | null;
  defaultSchoolHeroImage: string;
  nav: LocationNavigationConfig;
};

const DISABLED_NAV: LocationNavigationConfig = {
  compareOverview: false,
  compareAlevels: false,
  fees: false,
  bursaries: false,
  openDays: false,
  movingToSection: false
};

const DEFAULT_PRESENTATION: LocationPresentationConfig = {
  heroImage: '/assets/img/bath/bath-location-hero.jpg',
  heroImageAlt: 'Private school guide location hero image',
  heroSubtitle: null,
  defaultSchoolHeroImage: '/assets/img/bath/default-school.jpg',
  nav: DISABLED_NAV
};

type LocationPresentationOverride = Partial<Omit<LocationPresentationConfig, 'nav'>> & {
  nav?: Partial<LocationNavigationConfig>;
};

const FULL_NAV: LocationNavigationConfig = {
  compareOverview: true,
  compareAlevels: true,
  fees: true,
  bursaries: true,
  openDays: true,
  movingToSection: true
};

const CORE_DATA_NAV: LocationNavigationConfig = {
  compareOverview: true,
  compareAlevels: true,
  fees: true,
  bursaries: false,
  openDays: false,
  movingToSection: false
};

const LOCATION_PRESENTATION_OVERRIDES: Record<string, LocationPresentationOverride> = {
  bath: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bath',
    heroSubtitle: 'Bath and North East Somerset',
    nav: FULL_NAV
  },
  bristol: {
    heroImage: '/assets/img/bristol-hero.jpg',
    heroImageAlt: 'Bristol',
    heroSubtitle: '',
    nav: FULL_NAV
  },
  wiltshire: {
    heroImageAlt: 'Wiltshire',
    heroSubtitle: 'Salisbury, Warminster, Chippenham, Trowbridge and county',
    nav: CORE_DATA_NAV
  },
  somerset: {
    heroImageAlt: 'Somerset',
    heroSubtitle: 'Taunton, Glastonbury, Bridgwater, Frome and county',
    nav: CORE_DATA_NAV
  },
  devon: {
    heroImageAlt: 'Devon',
    heroSubtitle: 'Plymouth, Exeter, Torquay and county',
    nav: CORE_DATA_NAV
  },
  cornwall: {
    heroImage: '/assets/img/cornwall-hero.jpg',
    heroImageAlt: 'Cornwall',
    heroSubtitle: 'Falmouth, Penzance, St Austell and county',
    nav: CORE_DATA_NAV
  }
};

function buildHeroAlt(locationName?: string, fallback?: string) {
  return String(fallback || `${locationName || 'Location'} skyline`).trim();
}

export function getLocationPresentation(locationSlug: string, locationName?: string): LocationPresentationConfig {
  const slug = String(locationSlug || '').trim().toLowerCase();
  const override = LOCATION_PRESENTATION_OVERRIDES[slug] || {};

  return {
    heroImage: override.heroImage || DEFAULT_PRESENTATION.heroImage,
    heroImageAlt: buildHeroAlt(locationName, override.heroImageAlt || DEFAULT_PRESENTATION.heroImageAlt),
    heroSubtitle: override.heroSubtitle ?? DEFAULT_PRESENTATION.heroSubtitle,
    defaultSchoolHeroImage: override.defaultSchoolHeroImage || DEFAULT_PRESENTATION.defaultSchoolHeroImage,
    nav: {
      ...DISABLED_NAV,
      ...(override.nav || {})
    }
  };
}

export function getLocationNavigationConfig(locationSlug: string): LocationNavigationConfig {
  return getLocationPresentation(locationSlug).nav;
}
