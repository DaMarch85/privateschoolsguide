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
  defaultSchoolHeroImage: string;
  nav: LocationNavigationConfig;
};

const DEFAULT_NAV: LocationNavigationConfig = {
  compareOverview: true,
  compareAlevels: true,
  fees: true,
  bursaries: true,
  openDays: true,
  movingToSection: true
};

const DEFAULT_PRESENTATION: LocationPresentationConfig = {
  heroImage: '/assets/img/bath/bath-location-hero.jpg',
  heroImageAlt: 'Private school guide location hero image',
  defaultSchoolHeroImage: '/assets/img/bath/default-school.jpg',
  nav: DEFAULT_NAV
};

type LocationPresentationOverride = Partial<Omit<LocationPresentationConfig, 'nav'>> & {
  nav?: Partial<LocationNavigationConfig>;
};

const LOCATION_PRESENTATION_OVERRIDES: Record<string, LocationPresentationOverride> = {
  bath: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bath skyline'
  },
  bristol: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bristol private schools guide hero image'
  },
  cheltenham: {
    nav: {
      openDays: false,
      bursaries: false,
      fees: false,
      compareOverview: false,
      compareAlevels: false
    }
  },
  oxford: {
    nav: {
      openDays: false,
      bursaries: false,
      fees: false,
      compareOverview: false,
      compareAlevels: false
    }
  },
  winchester: {
    nav: {
      openDays: false,
      bursaries: false,
      fees: false,
      compareOverview: false,
      compareAlevels: false
    }
  },
  sevenoaks: {
    nav: {
      openDays: false,
      bursaries: false,
      fees: false,
      compareOverview: false,
      compareAlevels: false
    }
  },
  'st-albans': {
    nav: {
      openDays: false,
      bursaries: false,
      fees: false,
      compareOverview: false,
      compareAlevels: false
    }
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
    defaultSchoolHeroImage: override.defaultSchoolHeroImage || DEFAULT_PRESENTATION.defaultSchoolHeroImage,
    nav: {
      ...DEFAULT_NAV,
      ...(override.nav || {})
    }
  };
}

export function getLocationNavigationConfig(locationSlug: string): LocationNavigationConfig {
  return getLocationPresentation(locationSlug).nav;
}
