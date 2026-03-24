import Mocha from 'mocha'
import * as fs from 'node:fs'
import * as path from 'node:path'

export async function run(): Promise<void> {
	const mocha = new Mocha({
		color: true,
		timeout: 10_000,
		ui: 'bdd',
	})

	const testsRoot = path.resolve(__dirname, '.')
	const files = fs.readdirSync(testsRoot).filter((f) => f.endsWith('.test.js'))

	for (const file of files) {
		mocha.addFile(path.resolve(testsRoot, file))
	}

	return new Promise((resolve, reject) => {
		mocha.run((failures) => {
			if (failures > 0) {
				reject(new Error(`${failures} tests failed.`))
			} else {
				resolve()
			}
		})
	})
}
