module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/extension'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.extension.json',
    }],
  },
  moduleNameMapper: {
    vscode: '<rootDir>/src/extension/__tests__/__mocks__/vscode.ts',
  },
  collectCoverageFrom: [
    'src/extension/**/*.ts',
    '!src/extension/**/__tests__/**',
  ],
};