module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test", "<rootDir>/src"],
  moduleFileExtensions: ["js", "json", "ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  coverageReporters: ["json-summary", "lcov", "clover", ["text", { skipFull: true }]],
  collectCoverageFrom: [
    "src/**/*.{js,ts}",
    "!src/main.ts",
    "!src/app.module.ts",
    "!src/types.ts",
    "!src/**/domain/entities/*.ts",
    "!src/**/infrastructure/repositories/SQLServer/entities/*.schema.ts",
    "!src/**/infrastructure/repositories/SQLServer/entities/*.ts",
    "!src/**/infrastructure/SQLServer/migrations/*.ts",
    "!src/app.controller.ts",
    "!src/**/domain/valueObjects/*.ts",
    "!src/**/application/dtos/*.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 95,
      // statements: -10
    },
  },
};
