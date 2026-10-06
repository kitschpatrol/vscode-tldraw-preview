/* eslint-disable unicorn/no-process-exit */

import { runTests } from '@vscode/test-electron'
import * as path from 'node:path'

async function main(): Promise<void> {
	// When compiled, __dirname is out-test/test, so go up 2 levels to project root
	const projectRoot = path.resolve(__dirname, '../../')
	const extensionDevelopmentPath = projectRoot
	const extensionTestsPath = path.resolve(__dirname, './suite/index')
	const testWorkspace = path.join(projectRoot, 'test/fixtures/workspace')

	try {
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [testWorkspace, '--disable-extensions'],
		})
	} catch (error) {
		console.error('Failed to run tests:', error)
		process.exit(1)
	}
}

void main()
