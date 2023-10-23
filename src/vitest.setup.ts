import 'vitest-canvas-mock';

import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import { afterEach, beforeEach, expect, vi } from 'vitest';

expect.extend(matchers);

if (import.meta.env.CI) {
  // Hide all console output
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
}

beforeEach(() => {
  vi.stubEnv('LOCALE', 'en-US');
});
afterEach(cleanup);

// make jest things think vitest is jest
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Uhhh
// @ts-ignore
global.jest = vi;
