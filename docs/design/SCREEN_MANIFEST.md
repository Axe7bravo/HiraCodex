# Hira V1 Visual Reference Manifest

All images are visual references. The PRD remains the functional source of truth.

## Approved visual direction

| File | Screen / use | Status | Important notes |
|---|---|---|---|
| `approved/01-property-detail.png` | Property detail | Strong canonical reference | Corrected to the lean V1 inquiry flow; no payment/booking implication. |
| `approved/02-student-verification-flow.png` | Signup + verification | Strong canonical reference | Use the flow and visual hierarchy; exact copy/data may change. |
| `approved/03-create-listing-flow.png` | Landlord listing creation | Strong canonical reference | Use structured location fields; do not add a map. |
| `approved/04-tenant-dashboard.png` | Tenant dashboard | Visual direction | Ignore app-store promotional content if present. No real-time chat. |
| `approved/05-search-results.png` | Search/browse | Visual direction | No map. “Create alert” is optional/deferred unless explicitly added to scope. |

## Reference-only visual language

These are useful for composition/components but contain one or more features outside V1. Do not implement those features.

| File | Use | Ignore / defer |
|---|---|---|
| `reference-only/homepage-desktop.png` | Homepage art direction | Roommate Match, payments language, app-store CTA. |
| `reference-only/homepage-mobile.png` | Mobile composition | Messages/chat navigation, chat wording. Use Inquiries instead. |
| `reference-only/landlord-dashboard.png` | Dashboard layout | Payouts, Boost Listing. |
| `reference-only/admin-dashboard.png` | Admin visual density | Advanced trust/safety features not required by V1 may be omitted. |
| `reference-only/inquiry-management.png` | Inquiry detail layout | Payouts navigation; viewing scheduling is optional unless implementation plan includes it. |
| `reference-only/design-system-board.png` | Component styling | Any example labels/features that conflict with `design.md` or PRD. |
| `reference-only/responsive-board.png` | Responsive behavior | Payments/Roommate Match wording from older concepts. |

## Rule for Codex

When the mockup and PRD disagree, the PRD wins. When the PRD is silent on visual treatment, `design.md` and these images guide the implementation.
