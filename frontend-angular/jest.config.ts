import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // Transform all ESM-only packages in the unified/remark/rehype/micromark/unist/vfile/hast ecosystem.
  // The negative lookahead lists every package that ships "type":"module" and is
  // pulled in by remark-wiki-links and rehype-stringify tests.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '.*\\.mjs|' +
      '@codemirror/state|@codemirror/view|@codemirror/lang-markdown|@codemirror/commands|@codemirror/language|@codemirror/autocomplete|' +
      '@lezer/common|@lezer/highlight|@lezer/markdown|@lezer/lr|' +
      'unified|bail|trough|is-plain-obj|vfile|vfile-message|' +
      'remark-parse|remark-rehype|remark-gfm|remark-stringify|remark-breaks|' +
      'rehype-stringify|rehype-parse|rehype-highlight|' +
      'hast-util-to-html|hast-util-to-text|hast-util-whitespace|hast-util-is-element|' +
      'html-void-elements|stringify-entities|character-entities|character-entities-legacy|' +
      'character-entities-html4|decode-named-character-reference|' +
      'mdast-util-to-hast|mdast-util-from-markdown|mdast-util-to-markdown|' +
      'mdast-util-find-and-replace|mdast-util-to-string|mdast-util-phrasing|' +
      'mdast-util-gfm|mdast-util-gfm-autolink-literal|mdast-util-gfm-footnote|' +
      'mdast-util-gfm-strikethrough|mdast-util-gfm-table|mdast-util-gfm-task-list-item|' +
      'mdast-util-newline-to-break|' +
      'micromark|micromark-core-commonmark|' +
      'micromark-extension-gfm|micromark-extension-gfm-autolink-literal|' +
      'micromark-extension-gfm-footnote|micromark-extension-gfm-strikethrough|' +
      'micromark-extension-gfm-table|micromark-extension-gfm-tagfilter|' +
      'micromark-extension-gfm-task-list-item|' +
      'micromark-factory-destination|micromark-factory-label|micromark-factory-space|' +
      'micromark-factory-title|micromark-factory-whitespace|' +
      'micromark-util-character|micromark-util-chunked|micromark-util-classify-character|' +
      'micromark-util-combine-extensions|micromark-util-decode-numeric-character-reference|' +
      'micromark-util-decode-string|micromark-util-encode|micromark-util-html-tag-name|' +
      'micromark-util-normalize-identifier|micromark-util-resolve-all|' +
      'micromark-util-sanitize-uri|micromark-util-subtokenize|micromark-util-symbol|' +
      'micromark-util-types|' +
      'unist-util-visit|unist-util-visit-parents|unist-util-is|unist-util-find-after|' +
      'unist-util-stringify-position|unist-util-position|' +
      'property-information|space-separated-tokens|comma-separated-tokens|' +
      'ccount|longest-streak|trim-lines|zwitch|devlop|' +
      'parse5|markdown-table|escape-string-regexp|lowlight|' +
      'mermaid' +
    '))',
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '<rootDir>/test-results', outputName: 'jest-junit.xml' }],
  ],
};

export default config;
