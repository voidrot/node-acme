// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config([
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    plugins: {
      stylistic: stylistic
    },
    rules: {
      ...stylistic.configs.customize({
        semi: false,
        quotes: 'single',
        indent: 2,
        commaDangle: 'never',
        severity: 'error',
        pluginName: 'stylistic',
        arrowParens: true
      }).rules,
      'stylistic/object-curly-spacing': [ 'error', 'always' ],
      'stylistic/array-bracket-spacing': [ 'error', 'always' ]
    }
  },
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'docs',
      '.eslintcache'
    ]
  }
])
