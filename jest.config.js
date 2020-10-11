/*
 * https://jestjs.io/docs/en/configuration.html
 * https://kulshekhar.github.io/ts-jest/user/config/
 */
module.exports = {
    globals: {
        'ts-jest': {
            // ts-jest configuration goes here
            diagnostics: {
                // https://github.com/kulshekhar/ts-jest/issues/748
                ignoreCodes: [151001]
            }
        }
    },
    // Aliases for imports in test files, as 'ts-jest' (and jest) don't use tsconfig.paths!
    // https://github.com/kulshekhar/ts-jest/issues/414
    moduleNameMapper: {
        "^src/(.*)": "<rootDir>/src/$1",
        "^tests/(.*)": "<rootDir>/tests/$1"
    },
    preset: 'ts-jest',
    // setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
    //testEnvironment: 'node',
    testEnvironment: 'jsdom',
    testMatch: [
        '<rootDir>/tests/**/?(*.)test.[jt]s?(x)',
        "**/?(*.)+(spec|test).[jt]s?(x)"
    ],
    verbose: true
};
