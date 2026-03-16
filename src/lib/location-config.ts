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
  heroSubtitle: string;
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

const FULL_NAV: LocationNavigationConfig = {
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
  heroSubtitle: '',
  defaultSchoolHeroImage: '/assets/img/bath/default-school.jpg',
  nav: DISABLED_NAV
};

type LocationPresentationOverride = Partial<Omit<LocationPresentationConfig, 'nav'>> & {
  nav?: Partial<LocationNavigationConfig>;
};

const LOCATION_PRESENTATION_OVERRIDES: Record<string, LocationPresentationOverride> = {
  bath: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bath skyline',
    heroSubtitle: 'Bath and North East Somerset',
    nav: FULL_NAV
  },
  bristol: {
    heroImage: '/assets/img/bath/bath-location-hero.jpg',
    heroImageAlt: 'Bristol skyline',
    heroSubtitle: 'Bristol and surrounding areas',
    nav: FULL_NAV
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
    heroSubtitle: String(override.heroSubtitle || '').trim(),
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
