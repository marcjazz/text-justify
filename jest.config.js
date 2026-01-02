module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@rate-limiter/(.*)$': '<rootDir>/src/services/rate-limiter-store/$1',
  },
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coverageDirectory: 'coverage',
};
