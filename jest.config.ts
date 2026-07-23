// This is the jest.config.ts file. What this file does is tell Jest (our test runner)
// how to run our tests: which TypeScript settings to use, where to find test files,
// and what setup to run before each test file.

import type { Config } from 'jest'; // Bring in Jest's 'Config' type, just so TypeScript can check our settings object is shaped correctly

const config: Config = { // Build the settings object Jest will use
  preset: 'ts-jest', // Use the 'ts-jest' preset, which teaches Jest how to understand TypeScript files
  testEnvironment: 'node', // Run tests as if in a plain Node.js environment (not a browser)
  globals: { // Extra settings passed through to specific tools
    'ts-jest': { // Settings specifically for the ts-jest preset
      tsconfig: 'tsconfig.test.json', // Use this specific TypeScript config file when compiling test code
    }, // End of the ts-jest settings
  }, // End of the globals section
  setupFiles: ['./src/tests/setup.ts'], // Run this file once before the test framework loads, to set up environment variables
  testMatch: ['**/tests/**/*.test.ts'], // Only treat files matching this pattern (inside any 'tests' folder, ending in .test.ts) as test files
  forceExit: true, // Force Jest to exit after tests finish, even if something (like an open connection) would otherwise keep it running
}; // End of the settings object

export default config; // Share this settings object as the file's main export, so Jest can find and use it
