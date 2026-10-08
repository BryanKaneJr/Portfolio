/** Logic-only tests (pure TypeScript); UI is verified on device/simulator. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, module: 'commonjs', target: 'es2022', moduleResolution: 'node', skipLibCheck: true, types: ['jest', 'node'] } }],
  },
};
