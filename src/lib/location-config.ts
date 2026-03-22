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

export type LocationPresentationSource = {
  name: string;
  hero_image?: string | null;
  hero_image_alt?: string | null;
  default_school_hero_image?: string | null;
  nav_compare_overview?: boolean | null;
  nav_compare_alevels?: boolean | null;
  nav_fees?: boolean | null;
  nav_bursaries?: boolean | null;
  nav_open_days?: boolean | null;
  nav_moving_to_section?: boolean | null;
};

const DEFAULT_HERO_IMAGE = '/assets/img/bath/bath-location-hero.jpg';
const DEFAULT_SCHOOL_HERO_IMAGE = '/assets/img/bath/default-school.jpg';

function buildHeroAlt(locationName: string, fallback?: string | null) {
  return String(fallback || `${locationName} skyline`).trim();
}

export function getLocationPresentation(location: LocationPresentationSource): LocationPresentationConfig {
  return {
    heroImage: location.hero_image || DEFAULT_HERO_IMAGE,
    heroImageAlt: buildHeroAlt(location.name, location.hero_image_alt),
    defaultSchoolHeroImage: location.default_school_hero_image || DEFAULT_SCHOOL_HERO_IMAGE,
    nav: {
      compareOverview: location.nav_compare_overview ?? true,
      compareAlevels: location.nav_compare_alevels ?? true,
      fees: location.nav_fees ?? true,
      bursaries: location.nav_bursaries ?? true,
      openDays: location.nav_open_days ?? true,
      movingToSection: location.nav_moving_to_section ?? false
    }
  };
}
