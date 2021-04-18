module.exports = {
    testEnvironment: 'jest-environment-node',
  projects: ['<rootDir>/packages/*'],
  preset: 'ts-jest',
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  "transform": {
    "^.+\\.[t|j]sx?$": "babel-jest"
  }
};
