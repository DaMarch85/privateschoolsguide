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

/*
DEFAULTS
These apply to every location unless overridden below.
*/

const DEFAULT_NAV: LocationNavigationConfig = {
  compareOverview: true,
  compareAlevels: true,
  fees: true,
  bursaries: true,
  openDays: true,
  movingToSection: true
};

const DEFAULT_PRESENTATION: LocationPresentationConfig = {
  heroImage: '/assets/img/default/location-hero.jpg',
  heroImageAlt: 'Private school guide location hero image',
  defaultSchoolHeroImage: '/assets/img/default/default-school.jpg',
  nav: DEFAULT_NAV
};

/*
LOCATION-SPECIFIC OVERRIDES
Only include what differs from the defaults.
*/

type LocationPresentationOverride =
  Partial<Omit<LocationPresentationConfig, 'nav'>> & {
    nav?: Partial<LocationNavigationConfig>;
  };

const LOCATION_PRESENTATION_OVERRIDES: Record<string, LocationPresentationOverride> = {
  bath: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bath skyline'
  },

  bristol: {
    heroImage: '/assets/img/bristol/bristol-location-hero.jpg',
    heroImageAlt: 'Bristol skyline'
  },

  /* Future locations — features disabled until launched */

  cheltenham: {
    nav: {
      compareOverview: false,
      compareAlevels: false,
      fees: false,
      bursaries: false,
      openDays: false
    }
  },

  oxford: {
    nav: {
      compareOverview: false,
      compareAlevels: false,
      fees: false,
      bursaries: false,
      openDays: false
    }
  },

  winchester: {
    nav: {
      compareOverview: false,
      compareAlevels: false,
      fees: false,
      bursaries: false,
      openDays: false
    }
  },

  sevenoaks: {
    nav: {
      compareOverview: false,
      compareAlevels: false,
      fees: false,
      bursaries: false,
      openDays: false
    }
  },

  'st-albans': {
    nav: {
      compareOverview: false,
      compareAlevels: false,
      fees: false,
      bursaries: false,
      openDays: false
    }
  }
};

/*
Helper functions
*/

function buildHeroAlt(locationName?: string, fallback?: string) {
  return String(fallback || `${locationName || 'Location'} skyline`).trim();
}

export function getLocationPresentation(
  locationSlug: string,
  locationName?: string
): LocationPresentationConfig {

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

export function getLocationNavigationConfig(
  locationSlug: string
): LocationNavigationConfig {
  return getLocationPresentation(locationSlug).nav;
}
