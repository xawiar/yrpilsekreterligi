/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  ignorePatterns: [
    'dist',
    'node_modules',
    '_archived_files',
    'public/sw.js',
    'public/firebase-messaging-sw.js',
    'scripts/**',
    'android/**',
    'ios/**',
  ],
  rules: {
    // React 17+ JSX transform — React import gerekmez
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',

    // Eski codebase'de unused var çok — warn olarak başla, error değil
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],

    // Hooks kuralları katı
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // alert/confirm kullanma — useToast/useConfirm var
    'no-alert': 'warn',

    // Console.log warn (production'da Sentry'ye log etmek için console.error tercih edilir)
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

    // a11y bazı kurallar geçici olarak warn (legacy code uyumu için)
    'jsx-a11y/no-static-element-interactions': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
    'jsx-a11y/img-redundant-alt': 'warn',

    // Legacy code uyumu — gerçek bug'lar için warn
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-prototype-builtins': 'warn',
    'no-case-declarations': 'warn',
    'no-constant-condition': 'warn',
    'no-misleading-character-class': 'warn',

    // Dinamik string anchor URL'leri için kapatma
    'react/no-unescaped-entities': 'warn',
  },
};
