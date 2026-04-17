import type { Config } from 'jest';
import nextJest from 'next/jest.js';

// Creates a Jest config that loads next.config.ts and .env files for the test environment.
const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  // Set up @testing-library/jest-dom matchers.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // jsdom for component tests; individual files can override with a docblock if they need node.
  testEnvironment: 'jsdom',

  // Resolve the @/* alias the same way tsconfig does.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Only pick up tests that live under /tests.
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],

  // Ignore build output and node_modules.
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],

  // Speed up CI by clearing mocks between tests.
  clearMocks: true,
};

// next/jest wraps the config with the Next.js-specific SWC transformer, CSS handling, etc.
export default createJestConfig(config);
