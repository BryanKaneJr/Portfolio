/** Simulation tests (pure TypeScript). The UI is checked in a browser with Playwright (scripts/screens.mjs). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: { '\\.(png|jpg)$': '<rootDir>/tests/support/asset.js' },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: { strict: true, esModuleInterop: true, resolveJsonModule: true, module: 'commonjs', target: 'es2022', moduleResolution: 'node', skipLibCheck: true, types: ['jest', 'node'] },
      },
    ],
  },
};
