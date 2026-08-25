# Hira V1 Design System and Visual Rules

## Purpose

This file is the design source of truth for Hira V1. It works together with `docs/product/HIRA_V1_PRD.md` and the visual references under `docs/design/`.

**Source-of-truth order:**

1. `docs/product/HIRA_V1_PRD.md` — what Hira V1 does.
2. This file — how Hira V1 should look and behave.
3. Screen reference images — visual composition and art direction.
4. Existing implementation — may be changed when it conflicts with 1–3.

If an image contains a feature excluded by the PRD, **do not implement that feature**. Use the image only for visual direction.

## Product personality

Hira should feel:

- youthful without feeling childish;
- trustworthy and verification-led;
- confident, bold and easy to scan;
- local to Lesotho and Southern Africa without using clichés;
- friendly to first-time renters and non-technical landlords;
- practical rather than luxury-travel oriented;
- distinctly Hira, not an Airbnb imitation.

Avoid:

- Airbnb-like coral/pink styling;
- map-dominant layouts;
- generic luxury travel imagery;
- overly delicate typography;
- excessive glassmorphism or gradients;
- decorative shapes with no functional or brand purpose;
- hiding critical actions behind clever interactions;
- introducing features merely because they appear in an AI mockup.

## Core visual language

The Hira logo is the brand anchor. Its roof motif, heavy rounded wordmark, blue and electric-lime contrast, black and white backgrounds, and strong dot punctuation should influence the interface without being repeated decoratively everywhere.

### Color roles

Use the exact production color values only after they have been sampled/confirmed from the supplied logo artwork. Until then, treat the mockup values as provisional tokens:

- `brand-blue`: strong cobalt/royal blue — primary CTAs, active navigation, links, verification accents.
- `brand-lime`: electric yellow-lime — secondary CTAs, emphasis, selected highlights, step markers.
- `ink`: near-black — primary text, strong surfaces, footer/background accents.
- `white`: primary canvas.
- `surface-muted`: very light neutral gray — section separation, table surfaces, disabled/secondary states.
- semantic green: approved/verified/available.
- semantic amber: pending/under review.
- semantic red: rejected/declined/destructive actions.

Do not use gradients in the production UI unless specifically approved later.

## Typography

Use a bold, rounded, highly legible geometric/grotesk sans-serif family with a similar personality to the mockups. The exact production family should be selected before implementation and then used consistently.

Hierarchy:

- Display: bold, compact line-height, used sparingly for homepage hero.
- H1: page title.
- H2: major section title.
- H3: card/section title.
- Body: readable, neutral, not overly small.
- Caption: metadata, statuses, timestamps.

Do not reproduce text from reference images blindly. Copy must match the PRD and actual feature state.

## Layout

- Mobile-first responsive implementation.
- Desktop uses generous whitespace and clear columns.
- Dashboard screens may use a persistent sidebar on desktop and collapsed navigation on smaller screens.
- Search results use filters plus property cards; no map in V1.
- Property detail keeps the image gallery dominant and the inquiry action highly visible.
- Mobile screens should keep the primary action within easy reach and avoid desktop-style sidebars.

Suggested breakpoints for implementation may follow Tailwind defaults unless the real layout requires adjustment.

## Components

### Navigation

Public navigation:

- Hira logo
- Find Housing
- List Property
- How It Works
- Sign In / account control

Do not add V1 navigation for Maps, Payments, Roommate Match, Premium, or Messages.

Authenticated navigation should reflect the user role.

Tenant:

- Dashboard
- Saved Properties
- Inquiries
- My Requests
- Verification
- Profile / Settings

Landlord:

- Dashboard
- Listings
- Inquiries
- Requests
- Verification
- Profile / Settings

Admin:

- Dashboard
- Student Verifications
- Landlord Verifications
- Property Reviews
- Users
- Listings
- Inquiries / Requests

### Buttons

Primary: brand blue, white label.
Secondary/highlight: electric lime, black label.
Tertiary: neutral/outline.
Destructive: semantic red, used only for reject/decline/delete.

All interactive states must include hover, focus, disabled, and loading treatment.

### Form fields

- Large touch targets.
- Persistent labels where possible.
- Clear error state with useful validation copy.
- Avoid placeholder-only forms.
- File upload controls must state accepted formats and size limits.

### Property cards

Every standard property card should prioritize:

1. image;
2. verification state when applicable;
3. property title;
4. area/location text;
5. monthly price;
6. room/property type;
7. up to three high-value amenities;
8. save/favourite action for tenants.

Do not overload cards with every attribute.

### Verification

Verification is a core Hira visual and product differentiator. Keep statuses unmistakable:

- Pending review
- Verified / Approved
- Rejected

A verified badge is a trust signal, not decoration. Never display it unless the underlying record is verified.

### Inquiry/request states

Use a simple V1 status model consistent with the PRD. Do not invent payment or lease states.

Core states:

- Pending
- Accepted
- Declined
- Cancelled when applicable
- Contacted/follow-up may be used only if implemented in the PRD/build plan

## Imagery

Property photography should feel authentic to Maseru/Lesotho housing stock rather than luxury resort stock. Student imagery should feel contemporary and Southern African, warm and natural, not corporate stock photography.

For implementation, mockup photos are placeholders unless licensed/owned production assets are supplied.

## V1 hard exclusions

Do not implement the following in V1, even when visible in a reference image:

- M-Pesa or any payment processing;
- deposits, rent collection, payouts, commissions or transaction dashboards;
- premium subscriptions or freemium paywalls;
- maps or map results;
- real-time chat/WebSocket messaging;
- roommate matching;
- property boosting/paid promotion;
- native iOS/Android app or App Store/Google Play functionality;
- digital lease signing;
- automated property management;
- rent reminders;
- vendor/maintenance marketplace;
- virtual tours/video calls;
- reviews and ratings unless scope is explicitly expanded;
- Redis unless a measured technical need emerges.

## Visual-reference rule

Reference screenshots are not executable specifications. Treat them as guidance for:

- hierarchy;
- spacing;
- density;
- typography personality;
- component shape;
- brand color balance;
- image treatment;
- responsive composition.

Never infer an unapproved backend feature from UI text in a mockup.

## Accessibility

- Target WCAG 2.1 AA for core flows.
- Keyboard-accessible navigation and forms.
- Visible focus states.
- Form errors must not rely on color alone.
- Semantic labels for icons/buttons.
- Sufficient color contrast, especially lime on white.
- Touch targets approximately 44px minimum on mobile.

## Visual QA workflow

For each screen:

1. Read the PRD section governing the feature.
2. Read this file.
3. Inspect the relevant screen reference.
4. Implement one coherent vertical slice.
5. Run the app and capture a screenshot at the target viewport.
6. Compare implementation vs. reference for layout, typography, spacing, color, proportions, image treatment and responsive behavior.
7. Fix visual discrepancies without adding excluded functionality.
8. Run lint, typecheck, tests, and the relevant end-to-end smoke flow.
