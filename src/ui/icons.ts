/** Category iconography — the five SVG glyphs from docs/design/panels.jsx v3
 * (CatIcon). stroke/fill use currentColor so CSS decides the tint. */

export type Category = "CANNON" | "DEFENSE" | "DRONE" | "ECONOMY" | "ULTIMATES";

const ATTRS = `width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

export const CAT_ICONS: Record<Category, string> = {
  CANNON: `<svg ${ATTRS}><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  DEFENSE: `<svg ${ATTRS}><path d="M12 3l7 3v5c0 4-3 7-7 9-4-2-7-5-7-9V6z"/></svg>`,
  DRONE: `<svg ${ATTRS}><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 8l3 3M16 8l-3 3M8 16l3-3M16 16l-3-3"/></svg>`,
  ECONOMY: `<svg ${ATTRS}><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.6 9.6h3.4a2 2 0 010 4H9.6"/></svg>`,
  ULTIMATES: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/></svg>`,
};

/** Trophy (Home top bar -> achievements modal). Drawn, not emoji. */
export const TROPHY_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 5H5a3 3 0 003 4M16 5h3a3 3 0 01-3 4"/><path d="M12 13v4M8 20h8M10 17h4"/></svg>`;

export function catIcon(cat: Category): string {
  return `<span class="cat-icon">${CAT_ICONS[cat]}</span>`;
}

/** Ultimate-weapon icons (Claude Design drop 2026-06-11, docs/design/
 * ultimate-icons/). currentColor — tint via CSS; brand purple is #b48cff. */
export const ULT_ICONS: Record<string, string> = {
  emp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path transform="rotate(0 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><path transform="rotate(60 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><path transform="rotate(120 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><path transform="rotate(180 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><path transform="rotate(240 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><path transform="rotate(300 12 12)" d="M12.9 1.8 L9.5 6.6 L11.5 6.6 L10 10.4 L14.2 5.1 L12.2 5.1 Z"></path><circle cx="12" cy="12" r="2.4"></circle></svg>`,
  freeze: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(0 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g><g transform="rotate(60 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g><g transform="rotate(120 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g><g transform="rotate(180 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g><g transform="rotate(240 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g><g transform="rotate(300 12 12)"><path d="M12 12V3"></path><path d="M12 5 L9.6 2.6"></path><path d="M12 5 L14.4 2.6"></path><path d="M12 8 L10.2 6.2"></path><path d="M12 8 L13.8 6.2"></path></g></svg>`,
  warp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12.5" r="8"></circle><path d="M12 8.5V12.5l3 1.8"></path><path d="M4.6 6.2l.5 2.7 2.7-.5"></path></svg>`,
  laser: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5 L14.6 9.4" stroke-width="2.6"></path><path d="M18 3v7M14.5 6.5h7" stroke-width="1.6"></path><path d="M15.5 4l5 5M20.5 4l-5 5" stroke-width="1.1"></path></svg>`,
  // "All Ultimates" (god-mode only): a big + small sparkle — fire everything at once.
  all: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 1.5 L13.9 9.3 L21.5 11.5 L13.9 13.7 L12 21.5 L10.1 13.7 L2.5 11.5 L10.1 9.3 Z"></path><path d="M18.5 13.5 L19.3 17.2 L22.5 18 L19.3 18.8 L18.5 22.5 L17.7 18.8 L14.5 18 L17.7 17.2 Z"></path></svg>`,
};

/** Painterly item art (docs/design/ICONS-AND-PANELS-SPEC.md). Store cards
 * bleed it in from the right; skill-tree nodes use a compact 46px tile.
 * Swappable on purpose — these will likely be replaced (possibly animated). */
export const ITEM_ART: Record<string, string> = {
  turret: "art/01_main_turret.webp",
  multi: "art/02_multi_shot.webp",
  pierce: "art/03_piercing.webp",
  explosive: "art/04_explosive.webp",
  guided: "art/05_guided.webp",
  repair: "art/06_repair.webp",
  plating: "art/07_plating.webp",
  shield: "art/08_shield.webp",
  drone: "art/09_drone.webp",
  // ("10_auto_shooter" depicts Twin Targeting per the spec; the real
  // Auto-Shooter art arrived later as 16.)
  twin: "art/10_auto_shooter.webp",
  gen: "art/11_generator.webp",
  emp: "art/12_emp_burst.webp",
  freeze: "art/13_freeze_bomb.webp",
  warp: "art/14_time_warp.webp",
  laser: "art/15_laser_beam.webp",
  auto: "art/16_auto_shooter.webp",
  interceptor: "art/17_interceptor.webp",
  medic: "art/18_field_medic.webp",
};
