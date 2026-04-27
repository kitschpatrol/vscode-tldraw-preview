/* eslint-disable unicorn/consistent-function-scoping */

import { suite, suiteSetup, test } from 'mocha'
import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

suite('Tldraw Hover Provider', () => {
	// When compiled, __dirname is out-test/test/suite, so go up 3 levels to project root
	const projectRoot = path.resolve(__dirname, '../../../')
	const fixturesPath = path.join(projectRoot, 'test/fixtures/workspace')
	const sampleFilePath = path.join(fixturesPath, 'sample.ts')

	suiteSetup(async () => {
		// Generate manifest with paths relative to the cache directory
		const manifestDirectory = path.join(fixturesPath, 'node_modules/.cache/tldraw')
		fs.mkdirSync(manifestDirectory, { recursive: true })

		const relativeToCache = (filePath: string) =>
			path.relative(manifestDirectory, path.join(fixturesPath, filePath))

		const manifest = {
			[`${relativeToCache('test-sketch.tldr')}?{"dark":true}`]: {
				result: 'test-sketch-6f77fa00.svg',
			},
			[relativeToCache('missing.tldr')]: {
				result: 'nonexistent.svg',
			},
			[relativeToCache('test-sketch.tldr')]: {
				result: 'test-sketch-f547edfc.svg',
			},
		}

		fs.writeFileSync(
			path.join(manifestDirectory, '.tldraw-plugin-cache.json'),
			JSON.stringify(manifest, undefined, '\t'),
		)

		// Wait for extension to activate
		const extension = vscode.extensions.getExtension('kitschpatrol.tldraw-preview')
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

	test('shows image preview for cached .tldr file with existing output', async () => {
		// Line 4: const existingDrawing = './test-sketch.tldr'
		const hovers = await getHoverAt(3, 30)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
		assert.ok(text.includes('test-sketch-f547edfc.svg'), 'Should show the filename')
	})

	test("shows 'not in cache' warning for .tldr file not in manifest", async () => {
		// Line 6: const notCached = './not-in-manifest.tldr'
		const hovers = await getHoverAt(5, 20)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('Not in cache'), "Should show 'Not in cache'")
		assert.ok(text.includes('not-in-manifest.tldr'), 'Should show the path')
	})

	test("shows 'cache file missing' warning when output file doesn't exist", async () => {
		// Line 5: const missingFile = './missing.tldr'
		const hovers = await getHoverAt(4, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('Cache file missing'), "Should show 'Cache file missing'")
	})

	test('does not show hover for non-.tldr paths', async () => {
		// Line 7: const noTldr = 'some/other/path'
		const hovers = await getHoverAt(6, 20)

		const hasTldrawHover = hovers?.some((h) => {
			const text = getHoverText(h)
			return text.includes('.tldr') || text.includes('<img') || text.includes('Not in cache')
		})
		assert.ok(!hasTldrawHover, 'Should not show tldraw hover for non-.tldr path')
	})

	test('correctly captures .tldr path inside brackets', async () => {
		// Line 8: const inBrackets = ['./test-sketch.tldr']
		const hovers = await getHoverAt(7, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
	})

	test('correctly captures .tldr path in another context', async () => {
		// Line 11: const inParens = ('./test-sketch.tldr')
		const hovers = await getHoverAt(10, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag')
	})

	test('does not show hover for .tldraw paths (different extension)', async () => {
		// Line 14: const tldrawFile = './sketch.tldraw'
		const hovers = await getHoverAt(13, 25)

		const hasTldrawHover = hovers?.some((h) => {
			const text = getHoverText(h)
			return text.includes('<img') || text.includes('Not in cache')
		})
		assert.ok(!hasTldrawHover, 'Should not show hover on .tldraw extension')
	})

	test('correctly handles .tldr path with query parameters', async () => {
		// Line 13: const withQuery = './test-sketch.tldr?dark=true&tldr'
		const hovers = await getHoverAt(12, 25)

		assert.ok(hovers && hovers.length > 0, 'Should return a hover')
		const text = getHoverText(hovers[0])
		assert.ok(text.includes('<img'), 'Should contain an img tag for path with query params')
		assert.ok(
			text.includes('test-sketch-6f77fa00.svg'),
			'Should resolve to the dark variant from the JSON-encoded manifest key',
		)
	})
})
