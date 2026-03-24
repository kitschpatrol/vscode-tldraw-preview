/* eslint-disable unicorn/consistent-function-scoping */

import { suite, suiteSetup, test } from 'mocha'
import * as assert from 'node:assert'
import * as path from 'node:path'
import * as vscode from 'vscode'

suite('Aphex Hover Provider', () => {
	// When compiled, __dirname is out-test/test/suite, so go up 3 levels to project root
	const projectRoot = path.resolve(__dirname, '../../../')
	const fixturesPath = path.join(projectRoot, 'test/fixtures/workspace')
	const sampleFilePath = path.join(fixturesPath, 'sample.ts')

	suiteSetup(async () => {
		// Wait for extension to activate
		const extension = vscode.extensions.getExtension('kitschpatrol.aphex-preview')
		if (extension && !extension.isActive) {
			await extension.activate()
		}
	})

	async function getHoverAt(
		lineNumber: number,
		character: number,
	): Promise<undefined | vscode.Hover[]> {
		const document = await vscode.workspace.openTextDocument(sampleFilePath)
		await vscode.window.showTextDocument(document)

		const position = new vscode.Position(lineNumber, character)
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			'vscode.executeHoverProvider',
			document.uri,
			position,
		)

		return hovers
	}

	function getHoverText(hover: vscode.Hover): string {
		return hover.contents
			.map((content) => {
				if (typeof content === 'string') {
					return content
				}
				if (content instanceof vscode.MarkdownString) {
					return content.value
				}
				return ''
			})
			.join('\n')
	}

	test('shows image preview for cached URL with existing file', async () => {
		// Line 3: const existingImage = '~aphex/pets/tiny/portrait'
		const hovers = await getHoverAt(3, 30)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
		assert.ok(text.includes('test-image.png'), 'Should show the filename')
	})

	test("shows 'not in cache' warning for URL not in manifest", async () => {
		// Line 5: const notCached = '~aphex/test/not-in-manifest'
		const hovers = await getHoverAt(5, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('Not in cache'), "Should show 'Not in cache'")
		assert.ok(text.includes('~aphex/test/not-in-manifest'), 'Should show the URL')
	})

	test("shows 'cache file missing' warning when file doesn't exist", async () => {
		// Line 4: const missingFile = '~aphex/test/missing-file'
		const hovers = await getHoverAt(4, 28)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('Cache file missing'), "Should show 'Cache file missing'")
	})

	test('does not show hover for non-aphex paths', async () => {
		// Line 6: const noAphex = 'some/other/path'
		const hovers = await getHoverAt(6, 22)

		// Should either return empty array or no hover from our extension
		const hasAphexHover = hovers?.some((h) => {
			const text = getHoverText(h)
			return text.includes('aphex') || text.includes('<img') || text.includes('Not in cache')
		})
		assert.ok(!hasAphexHover, 'Should not show aphex hover for non-aphex path')
	})

	test('correctly captures URL inside brackets', async () => {
		// Line 7: const inBrackets = ['~aphex/pets/tiny/portrait']
		const hovers = await getHoverAt(7, 30)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
	})

	test('correctly captures URL in another context', async () => {
		// Line 10: const inParens = ('~aphex/pets/tiny/portrait')
		const hovers = await getHoverAt(10, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
	})

	test('correctly handles paths with spaces', async () => {
		// Line 12: const withSpaces = '~aphex/projects/album with spaces/building'
		const hovers = await getHoverAt(12, 30)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag for path with spaces')
	})
})
