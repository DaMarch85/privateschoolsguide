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

/*
DEFAULTS

Safe defaults:
- future locations do not automatically expose compare / fees / bursaries / open days
- movingToSection stays on by default because it is just a section on the main location page
*/

const DEFAULT_NAV: LocationNavigationConfig = {
  compareOverview: false,
  compareAlevels: false,
  fees: false,
  bursaries: false,
  openDays: false,
  movingToSection: true
};

const DEFAULT_PRESENTATION: LocationPresentationConfig = {
  heroImage: '/assets/img/default/location-hero.jpg',
  heroImageAlt: 'Private school guide location hero image',
  heroSubtitle: null,
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
    heroImageAlt: 'Bath skyline',
    heroSubtitle: 'Bath and North East Somerset',
    nav: {
      compareOverview: true,
      compareAlevels: true,
      fees: true,
      bursaries: true,
      openDays: true,
      movingToSection: true
    }
  },

  bristol: {
    heroImage: '/assets/img/bristol/bristol-location-hero.jpg',
    heroImageAlt: 'Bristol skyline',
    heroSubtitle: 'Bristol and surrounding area',
    nav: {
      compareOverview: true,
      compareAlevels: true,
      fees: true,
      bursaries: true,
      openDays: true,
      movingToSection: true
    }
  },

  cornwall: {
    heroSubtitle: 'Falmouth, Truro, St Ives and county'
  },

  devon: {
    heroSubtitle: 'Plymouth, Exeter, Torquay and county'
  },

  dorset: {
    heroSubtitle: 'Bournemouth, Poole, Weymouth and county'
  },

  somerset: {
    heroSubtitle: 'Taunton, Bridgwater, Glastonbury, Frome and county'
  },

  wiltshire: {
    heroSubtitle: 'Salisbury, Warminster, Chippenham, Trowbridge and county'
  },

  gloucestershire: {
    heroSubtitle: 'Gloucester, Cheltenham and county'
  },

  oxfordshire: {
    heroSubtitle: 'Oxford and county'
  },

  'hampshire-south': {
    heroSubtitle: 'Southampton, Portsmouth, Winchester and south of county'
  },

  'hampshire-north': {
    heroSubtitle: 'Basingstoke, Andover and north of county'
  },

  berkshire: {
    heroSubtitle: 'Reading, Slough and county'
  },

  'surrey-outside-m25': {
    heroSubtitle: 'Guildford, Woking and county'
  },

  'surrey-inside-m25': {
    heroSubtitle: 'Surrey schools inside the M25'
  },

  sussex: {
    heroSubtitle: 'Worthing, Brighton, Eastbourne and Crawley'
  },

  'kent-outside-m25': {
    heroSubtitle: 'Canterbury, Royal Tunbridge Wells, Sevenoaks and county'
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
    heroImageAlt: buildHeroAlt(
      locationName,
      override.heroImageAlt || DEFAULT_PRESENTATION.heroImageAlt
    ),
    heroSubtitle:
      override.heroSubtitle !== undefined
        ? override.heroSubtitle
        : DEFAULT_PRESENTATION.heroSubtitle,
    defaultSchoolHeroImage:
      override.defaultSchoolHeroImage || DEFAULT_PRESENTATION.defaultSchoolHeroImage,
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
