import { knipConfig } from '@kitschpatrol/knip-config'

export default knipConfig({
	entry: [
		'src/extension.ts',
		'test/run-test.ts',
		'test/suite/extension.test.ts',
		'test/suite/index.ts',
	],
	ignore: ['test/fixtures/workspace/*'],
	ignoreBinaries: ['code'],
	ignoreDependencies: ['@types/vscode', '@types/mocha'],
})
