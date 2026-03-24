import { eslintConfig } from '@kitschpatrol/eslint-config'

export default eslintConfig(
	{
		ignores: ['test/fixtures/workspace/sample-dom.js'],
		json: {
			overrides: {
				// VS Code bundler needs LICENSE.txt listed in the package.json
				'json-package/no-redundant-files': 'off',
			},
		},
		ts: {
			overrides: {
				'jsdoc/require-jsdoc': 'off',
				'ts/no-empty-function': 'off',
				'ts/no-unnecessary-type-arguments': 'off',
			},
		},
	},
	{
		files: ['LICENSE.txt', 'README.md'],
		rules: {
			'unicorn/filename-case': 'off',
		},
	},
)
