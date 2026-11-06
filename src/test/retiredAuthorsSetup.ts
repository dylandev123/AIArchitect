/** Setup for the `retired-authors` vitest project ONLY.
 *
 * The V2/V3/villa/plan/concept authors and the direct-scene operations author for Generate were retired
 * as new-house providers (production answers 409 with zero provider calls, see
 * src/lib/villa/canonical/authority.test.ts). Their code is retained for saved-project editing and
 * offline replay, and these suites keep regression evidence for it. They need the retirement gate
 * open, which no environment flag can do in production: only this module replacement can, and only
 * inside this project. */
import { vi } from 'vitest';
vi.mock('@/lib/villa/canonical/authority', () => ({
  legacyHouseAuthoringEnabled: () => true,
  canonicalGenerationRequired: () => false,
}));
// These suites deliberately exercise the legacy routes through an offline transport. Model the explicit
// LEGACY_AI_ROUTES deployment decision for this project only; the active project keeps the lockdown.
process.env.LEGACY_AI_ROUTES = 'enabled';
