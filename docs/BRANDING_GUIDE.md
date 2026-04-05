# Branding Customization Guide

This guide explains how to customize all branding elements of SupportDesk — the app name, logo, icon, colors, copyright, and organization logos.

---

## Table of Contents

- [Quick Start: One File Changes Everything](#quick-start-one-file-changes-everything)
- [Changing the App Name](#changing-the-app-name)
- [Changing the Icon (Favicon)](#changing-the-icon-favicon)
- [Using a Custom Logo Image](#using-a-custom-logo-image)
- [Changing the Icon Initials](#changing-the-icon-initials)
- [Changing Colors](#changing-colors)
- [Changing the Copyright](#changing-the-copyright)
- [Organization Logos](#organization-logos)
- [Advanced: Full Tailwind Theme](#advanced-full-tailwind-theme)
- [Files Reference](#files-reference)

---

## Quick Start: One File Changes Everything

All branding is controlled from a single file:

```
frontend/src/lib/branding.ts
```

Edit this file and every page automatically updates — sidebar, login, signup, footer, loading screens, and favicon.

---

## Changing the App Name

Open `frontend/src/lib/branding.ts` and edit:

```typescript
export const branding = {
  appName: 'YourBrandName',           // Main app name
  tagline: 'Your Custom Tagline',     // Shown below the name
  description: 'Your app description', // Meta description
  // ...
};
```

**Appears in:** Sidebar header, login page, signup page, browser tab title, loading screens.

Also update the metadata in `frontend/src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: 'YourBrandName - Your Tagline',
  description: 'Your description',
};
```

---

## Changing the Icon (Favicon)

### Option A: Edit the SVG Favicon (Easiest)

The favicon is at `frontend/public/favicon.svg`. Open it in any text editor:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb"/>  <!-- Change: Start color -->
      <stop offset="100%" style="stop-color:#7c3aed"/> <!-- Change: End color -->
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#bg)"/>
  <text x="32" y="42"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="26"
    font-weight="700"
    fill="white"
    text-anchor="middle">
    SK  <!-- Change: Your initials (1-3 characters) -->
  </text>
</svg>
```

**What to change:**
- `stop-color:#2563eb` — Gradient start color
- `stop-color:#7c3aed` — Gradient end color
- `SK` — Your initials (1-3 characters recommended)
- `rx="14"` — Corner radius (0 = square, 32 = circle)

### Option B: Use a Custom Image as Favicon

1. Create your icon as a `.ico`, `.png`, or `.svg` file
2. Place it in `frontend/public/` (e.g., `frontend/public/my-icon.png`)
3. Update `frontend/src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  icons: {
    icon: '/my-icon.png',        // Your custom icon
    apple: '/apple-icon.png',    // Optional: Apple touch icon
  },
};
```

4. Update `frontend/src/lib/branding.ts`:

```typescript
faviconPath: '/my-icon.png',
```

### Recommended Icon Sizes

| Format | Size | Purpose |
|--------|------|---------|
| `.svg` | Any (vector) | Modern browsers — best option |
| `.ico` | 32x32, 16x16 | Legacy browser support |
| `.png` | 192x192 | Android/PWA |
| `.png` | 180x180 | Apple Touch Icon |

---

## Using a Custom Logo Image

To replace the generated initials icon with a custom logo image:

1. Place your logo in `frontend/public/images/` (e.g., `frontend/public/images/logo.png`)

2. Update `frontend/src/lib/branding.ts`:

```typescript
export const branding = {
  // Set this to your logo path:
  logo: '/images/logo.png',
  
  // Or use an external URL:
  // logo: 'https://cdn.yourcompany.com/logo.png',
  
  logoWidth: 32,   // Adjust as needed
  logoHeight: 32,  // Adjust as needed
  // ...
};
```

3. The logo will now appear in:
   - Sidebar header
   - Login page
   - Signup page
   - Loading screens

**Logo requirements:**
- Square or near-square aspect ratio works best
- Minimum 64x64px, recommended 128x128px or larger
- PNG with transparency or SVG preferred
- Both dark and light backgrounds should work (or use a logo with built-in background)

### Reverting to Initials Icon

Set `logo: null` in branding.ts to go back to the generated initials icon.

---

## Changing the Icon Initials

If you're using the generated icon (no logo image), you can change the initials:

```typescript
export const branding = {
  logo: null,                    // Must be null to show initials
  iconInitials: 'AB',           // 1-3 characters
  iconBgColor: '#2563eb',       // Background color
  iconTextColor: '#ffffff',     // Text color
  // ...
};
```

**Examples:**
- Company "Acme Corp" → `iconInitials: 'AC'`
- Company "XYZ Solutions" → `iconInitials: 'XYZ'`
- Personal brand "John Doe" → `iconInitials: 'JD'`

---

## Changing Colors

### Brand Colors in branding.ts

```typescript
export const branding = {
  primaryColor: '#2563eb',       // Main brand color (buttons, links, active states)
  primaryHoverColor: '#1d4ed8',  // Button hover
  primaryLightColor: '#eff6ff',  // Light tint backgrounds
  accentColor: '#7c3aed',       // Secondary color (gradients, accents)
  // ...
};
```

### Full Tailwind Color Palette

For complete control, edit `frontend/tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#eff6ff',    // Lightest
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',   // Base
        600: '#2563eb',   // Default (buttons)
        700: '#1d4ed8',   // Hover
        800: '#1e40af',
        900: '#1e3a8a',   // Darkest
      },
    },
  },
},
```

**Popular color schemes:**

| Brand Style | Primary | Accent |
|-------------|---------|--------|
| Blue (default) | `#2563eb` | `#7c3aed` |
| Green | `#059669` | `#0891b2` |
| Red | `#dc2626` | `#ea580c` |
| Purple | `#7c3aed` | `#2563eb` |
| Teal | `#0d9488` | `#6366f1` |
| Orange | `#ea580c` | `#d97706` |

---

## Changing the Copyright

### Copyright Owner

```typescript
export const branding = {
  copyright: {
    owner: 'Your Name or Company',  // Copyright holder
    year: new Date().getFullYear(),  // Auto-updates each year
    url: 'https://yourwebsite.com',  // Link (set '#' for no link)
  },
  // ...
};
```

**Result:** `© 2026 Your Name or Company. All rights reserved.`

### Footer Links

```typescript
export const branding = {
  supportEmail: 'help@yourcompany.com',
  websiteUrl: 'https://yourcompany.com',
  privacyUrl: 'https://yourcompany.com/privacy',  // Set '#' to hide
  termsUrl: 'https://yourcompany.com/terms',       // Set '#' to hide
  // ...
};
```

### Show/Hide Footer Elements

```typescript
export const branding = {
  showPoweredBy: true,     // "Powered by SupportDesk"
  showCopyright: true,     // Copyright line
  showVersionBadge: false, // Version number badge
  version: '1.0.0',       // Version string
  // ...
};
```

---

## Organization Logos

Each organization (tenant) can have its own logo, independent of the app branding.

### Setting an Organization Logo

**Via the UI:**
1. Login as Admin
2. Go to **Settings** > **Organization** tab
3. Paste a logo URL in the **Organization Logo** field
4. Click **Save Changes**

**Via the API:**
```bash
curl -X PATCH http://localhost:3001/api/v1/organizations/current \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"logo": "https://cdn.example.com/org-logo.png"}'
```

### Where Organization Logos Appear

- Sidebar (below the app logo)
- Can be extended to customer portal, email templates, etc.

### Logo URL Options

You can use:
- **External URL:** `https://cdn.yourcompany.com/logo.png`
- **Local path:** Upload via the attachments API and use the returned URL
- **Data URI:** `data:image/png;base64,...` (not recommended for large images)

---

## Advanced: Full Tailwind Theme

For complete visual overhaul, edit `frontend/tailwind.config.ts`:

```typescript
const config: Config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { /* your palette */ },
      },
      fontFamily: {
        sans: ['Your Font', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',  // Global corner radius
      },
    },
  },
};
```

### Using a Custom Font

1. Import the font in `frontend/src/app/layout.tsx`:

```typescript
import { Poppins } from 'next/font/google';
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
```

2. Apply it to the body:

```tsx
<body className={poppins.className}>
```

---

## Files Reference

| File | What It Controls |
|------|-----------------|
| `frontend/src/lib/branding.ts` | All branding config (name, colors, copyright, etc.) |
| `frontend/public/favicon.svg` | Browser tab icon |
| `frontend/src/components/common/BrandLogo.tsx` | Logo/icon component used everywhere |
| `frontend/src/components/layout/Footer.tsx` | Footer with copyright and links |
| `frontend/src/components/layout/Sidebar.tsx` | Sidebar with brand logo and org logo |
| `frontend/src/app/layout.tsx` | HTML metadata (title, favicon) |
| `frontend/src/app/login/page.tsx` | Login page branding |
| `frontend/src/app/signup/page.tsx` | Signup page branding |
| `frontend/src/app/globals.css` | Global CSS styles and Tailwind utilities |
| `frontend/tailwind.config.ts` | Tailwind color palette and theme |

### Change Checklist

When rebranding the entire app:

- [ ] Edit `branding.ts` — app name, tagline, copyright, colors
- [ ] Replace `public/favicon.svg` — or set custom icon path
- [ ] Update `layout.tsx` metadata — title and description
- [ ] (Optional) Change Tailwind primary colors in `tailwind.config.ts`
- [ ] (Optional) Add custom font in `layout.tsx`
- [ ] (Optional) Place logo image in `public/images/` and set `logo` in branding.ts
