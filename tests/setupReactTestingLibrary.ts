// tests/setupReactTestingLibrary.ts
// Raise React Testing Library's async-utility timeout so waitFor / findBy* have
// headroom on slower or CPU-contended machines. The architect jsdom UI suite is
// render-heavy (100+ files, 200s+ wall clock); RTL's default 1000ms internal
// polling cap can flake under starvation even when the assertion would pass with
// a little more time. This is RTL's internal polling window — Vitest's
// `testTimeout` (set in vitest.ui.config.js) governs the outer per-test budget.
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5000 });
