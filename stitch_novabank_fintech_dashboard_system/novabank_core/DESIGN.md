---
name: NovaBank Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434654'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#1d55ce'
  primary: '#1853cc'
  on-primary: '#ffffff'
  primary-container: '#3d6de6'
  on-primary-container: '#fefcff'
  inverse-primary: '#b4c5ff'
  secondary: '#5a5e69'
  on-secondary: '#ffffff'
  secondary-container: '#dee2ef'
  on-secondary-container: '#60646f'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dee2ef'
  secondary-fixed-dim: '#c2c6d3'
  on-secondary-fixed: '#171c25'
  on-secondary-fixed-variant: '#424751'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  tabular-nums:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  card-padding: 24px
---

## Brand & Style
The design system is engineered for a premium fintech experience, balancing high-utility data density with a clean, breathable aesthetic. The brand personality is professional, reliable, and forward-thinking, drawing inspiration from modern SaaS leaders like Stripe and Mercury.

The visual style is **Corporate / Modern** with a focus on:
- **Clarity:** Maximum legibility for complex financial data and transaction records.
- **Precision:** Tight alignment and consistent spacing that reflects institutional trust.
- **Subtle Depth:** Using soft shadows and layered surfaces rather than heavy borders to define hierarchy.
- **Approachability:** Utilizing rounded corners and a vibrant primary blue to soften the typically rigid nature of banking software.

## Colors
The color palette is anchored by a high-energy primary blue, supported by a functional spectrum of semantic colors for financial health indicators.

- **Primary (#4F7DF7):** Used for primary actions, active navigation states, and key data highlights.
- **Secondary / Surface (#EEF2FF):** A soft wash used for button backgrounds, hover states, and subtle grouping.
- **Semantic Green (#10B981):** Represents growth, positive balances, and completed statuses.
- **Semantic Red (#EF4444):** Represents expenses, negative trends, and critical alerts.
- **Neutrals:** A grayscale ramp favoring cool blue-grays to maintain a crisp, technological feel. Backgrounds should remain pure white (`#FFFFFF`) to maximize contrast for the soft card shadows.

## Typography
The system uses **Plus Jakarta Sans** for its modern, geometric construction which ensures legibility in high-density data environments. 

- **Headlines:** Use Bold (700) or SemiBold (600) weights with slightly tightened letter spacing for a premium "editorial" feel.
- **Data Display:** For financial figures, ensure `tabular-nums` is enabled via CSS to keep decimals and commas aligned vertically in tables and lists.
- **Hierarchy:** Primary headings use a deep slate gray, while secondary labels and helper text utilize a lighter neutral tint to create a clear scan path.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high-density card containers. 

- **Grid:** A 12-column system is used for desktop. Cards typically span 3 columns for small metrics, 6 columns for charts, and 12 columns for tables.
- **Rhythm:** An 8px base grid governs all padding and margins. 
- **Adaptation:** On mobile, the 12-column grid collapses to 1 column. Cards transition from fixed-height or multi-column layouts to a vertical stack. Side margins reduce from 32px to 16px to maximize screen real estate for data.
- **Safe Areas:** Interactive elements maintain a minimum 44px tap target, even when visual containers appear smaller.

## Elevation & Depth
Depth is conveyed through **Ambient Shadows** and tonal layering rather than physical skeuomorphism.

- **Level 0 (Background):** Pure white or ultra-light gray (#F8FAFC).
- **Level 1 (Cards):** White background with a soft, diffused shadow: `0px 4px 20px rgba(0, 0, 0, 0.05)`. This creates a subtle "lift" from the base.
- **Level 2 (Interactive/Dropdowns):** A more pronounced shadow to indicate temporary overlay: `0px 10px 30px rgba(0, 0, 0, 0.08)`.
- **Outlines:** Use 1px borders in a very light neutral (`#E2E8F0`) for input fields and table row dividers to provide structure without adding visual noise.

## Shapes
The shape language is defined by generous, friendly rounding that signals a modern "App-like" experience.

- **Cards:** Use a `24px` (extra-large) radius to create a soft, high-end container.
- **Buttons:** Use a `12px` radius for standard actions, or fully pill-shaped (100px) for status badges and tags.
- **Inputs:** Maintain a consistent `12px` radius to match button styling.
- **Icons:** Should feature rounded terminals and soft corners to align with the UI's geometry.

## Components
- **Navigation Bar:** A clean horizontal top-bar. Active states are indicated by the Primary Blue with white text, while inactive items use neutral text.
- **Cards:** Every card must include a consistent internal padding of 24px. Header icons within cards are contained in small, low-opacity blue squares.
- **Tables:** Rows feature a subtle hover state. Status badges (e.g., "Completed", "Pending") use a pill shape with low-opacity background tints matching the semantic color of the text.
- **Action Buttons:**
    - *Primary:* Solid Primary Blue background with White text.
    - *Secondary:* Light Primary Blue background (#EEF2FF) with Primary Blue text.
    - *Ghost:* No background, neutral text, used for less frequent actions like "Export" or "Filter".
- **Charts:** Use smooth Bezier curves for line graphs with a subtle gradient fill below the line to provide weight and visual interest.
- **Search & Filter:** Search bars should include a leading magnifying glass icon and a subtle 1px border. Pagination uses simple chevron icons with a count indicator (e.g., "1 of 24").