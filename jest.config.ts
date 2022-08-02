const JestConfig = {
  verbose: true,
  collectCoverage: false,
  collectCoverageFrom: ['**/*.{js,jsx,ts,tsx}'],
  coverageReporters: ['lcov', 'html', 'text'],
  coveragePathIgnorePatterns: ['node_modules', 'LoaderHelper', 'Sample*', 'ui'],
  modulePaths: ['node_modules', '<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'json', 'node', 'js', 'mjs', 'cjs', 'jsx'],
  resetModules: true,
  resetMocks: true,
  transform: {
    '\\.[jt]sx?$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};

export default JestConfig;
