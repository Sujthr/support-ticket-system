/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   BRANDING CONFIGURATION                     ║
 * ║                                                              ║
 * ║  Edit this file to customize all branding across the app.    ║
 * ║  Changes here reflect everywhere — sidebar, login, footer.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const branding = {
  // ─── App Identity ────────────────────────────────────────────
  appName: 'SupportDesk',
  tagline: 'Customer Support Platform',
  description: 'Multi-tenant customer support ticketing system',

  // ─── Copyright ───────────────────────────────────────────────
  copyright: {
    owner: 'Sujit Kumar Thakur',
    year: new Date().getFullYear(),
    url: '#', // Link when copyright text is clicked
  },

  // ─── Logo & Icon ─────────────────────────────────────────────
  // Set to null to use the default generated icon
  // To use a custom image: '/images/logo.png' or a full URL
  logo: null as string | null,
  logoWidth: 32,
  logoHeight: 32,

  // Icon initials (shown when no logo image is set)
  iconInitials: 'SK',
  iconBgColor: '#2563eb',  // Primary blue
  iconTextColor: '#ffffff',

  // ─── Favicon ─────────────────────────────────────────────────
  // Place your favicon at: frontend/public/favicon.ico
  // Or set a custom path here
  faviconPath: '/favicon.svg',

  // ─── Colors ──────────────────────────────────────────────────
  // These override the Tailwind primary palette
  primaryColor: '#2563eb',       // Main brand color
  primaryHoverColor: '#1d4ed8',  // Button hover
  primaryLightColor: '#eff6ff',  // Light background tint
  accentColor: '#7c3aed',       // Secondary accent (purple)

  // ─── Links ───────────────────────────────────────────────────
  supportEmail: 'support@supportdesk.com',
  websiteUrl: '#',
  privacyUrl: '#',
  termsUrl: '#',

  // ─── Feature Flags ───────────────────────────────────────────
  showPoweredBy: true,           // Show "Powered by SupportDesk" in footer
  showCopyright: true,           // Show copyright in footer
  showVersionBadge: false,       // Show version number
  version: '1.0.0',
} as const;

/**
 * Get the full copyright string
 */
export function getCopyrightText() {
  const { owner, year } = branding.copyright;
  return `\u00A9 ${year} ${owner}. All rights reserved.`;
}

/**
 * Get display name with optional tagline
 */
export function getFullAppName(withTagline = false) {
  return withTagline
    ? `${branding.appName} - ${branding.tagline}`
    : branding.appName;
}
