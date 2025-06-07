/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',               // use ts-jest preset
    testEnvironment: 'node',         // for backend code
    testMatch: ['**/tests/**/*.test.ts'], // only pick up .ts tests in /tests
    moduleFileExtensions: ['ts','js','json','node'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',  // transform TS with ts-jest
    },
    // (optional) if you use paths in tsconfig, uncomment and adjust:
    // moduleNameMapper: {
    //   '^@src/(.*)$': '<rootDir>/src/$1'
    // },
  };
  