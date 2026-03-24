// @case-police-ignore URI

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

type ManifestEntry = {
	result: string
}

type Manifest = Record<string, ManifestEntry>

type ManifestCache = {
	manifest: Manifest
	mtime: number
}

// Cache for manifest files, keyed by absolute path
const manifestCache = new Map<string, ManifestCache>()

// Map of opening delimiters to their closing counterparts
const delimiterPairs: Record<string, string> = {
	'"': '"',
	"'": "'",
	'<': '>',
	'`': '`',
}

/**
 * Find an aphex URL at the given position in a line, handling paths with spaces
 * when they're inside quotes or angle brackets.
 */
function findAphexUrlAtPosition(
	line: string,
	character: number,
): undefined | { end: number; start: number; url: string } {
	const aphexMarker = '~aphex/'
	let searchIndex = 0

	// eslint-disable-next-line ts/no-unnecessary-condition
	while (true) {
		const startOfAphex = line.indexOf(aphexMarker, searchIndex)
		if (startOfAphex === -1) break

		// Look at the character before ~aphex/ to determine the delimiter
		const charBefore = startOfAphex > 0 ? line[startOfAphex - 1] : ''
		const closingDelimiter = delimiterPairs[charBefore]

		let endIndex: number

		if (closingDelimiter) {
			// Path is inside quotes or angle brackets - find the closing delimiter
			endIndex = line.indexOf(closingDelimiter, startOfAphex)
			if (endIndex === -1) endIndex = line.length
		} else {
			// No delimiter - stop at whitespace or common terminators
			const remaining = line.slice(Math.max(0, startOfAphex))
			const match = /[\s"'`()[\]<>]/.exec(remaining)
			endIndex = match?.index === undefined ? line.length : startOfAphex + match.index
		}

		// Check if cursor is within this URL
		if (character >= startOfAphex && character <= endIndex) {
			return {
				end: endIndex,
				start: startOfAphex,
				// eslint-disable-next-line unicorn/prefer-string-slice
				url: line.substring(startOfAphex, endIndex),
			}
		}

		searchIndex = startOfAphex + 1
	}

	return undefined
}

function getManifest(manifestPath: string): Manifest {
	try {
		const stats = fs.statSync(manifestPath)
		const mtime = stats.mtimeMs

		const cached = manifestCache.get(manifestPath)
		if (cached?.mtime === mtime) {
			return cached.manifest
		}

		const content = fs.readFileSync(manifestPath, 'utf8')
		// eslint-disable-next-line ts/no-unsafe-type-assertion
		const manifest = JSON.parse(content) as Manifest

		manifestCache.set(manifestPath, { manifest, mtime })
		return manifest
	} catch {
		// File doesn't exist or is invalid JSON - treat as empty manifest
		return {}
	}
}

function getManifestPath(document: vscode.TextDocument): string | undefined {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
	if (!workspaceFolder) {
		return undefined
	}

	const config = vscode.workspace.getConfiguration('aphex-preview')
	const configuredPath = config.get<string>(
		'manifestPath',
		'node_modules/.cache/aphex/.aphex-plugin-cache.json',
	)

	if (path.isAbsolute(configuredPath)) {
		return configuredPath
	}

	return path.join(workspaceFolder.uri.fsPath, configuredPath)
}

function createHoverContent(
	url: string,
	manifest: Manifest,
	workspaceRoot: string,
): vscode.MarkdownString {
	const config = vscode.workspace.getConfiguration('aphex-preview')
	const maxWidth = config.get<number>('maxWidth', 300)

	const entry = manifest[url]

	// eslint-disable-next-line ts/no-unnecessary-condition
	if (!entry) {
		// Case 2: URL not found in manifest
		const md = new vscode.MarkdownString()
		md.isTrusted = true
		md.supportHtml = true
		md.appendMarkdown('### ⚠️ Not in cache\n\n')
		md.appendMarkdown(`\`${url}\`\n\n`)
		md.appendMarkdown("This asset hasn't been cached yet.\n\n")
		md.appendMarkdown('Run `pnpm build` or `vite build` to generate the cache.')
		return md
	}

	// Resolve the cached file path
	const cachedPath = path.isAbsolute(entry.result)
		? entry.result
		: path.join(workspaceRoot, entry.result)

	if (!fs.existsSync(cachedPath)) {
		// Case 3: URL in manifest but file doesn't exist
		const md = new vscode.MarkdownString()
		md.isTrusted = true
		md.supportHtml = true
		md.appendMarkdown('### ⚠️ Cache file missing\n\n')
		md.appendMarkdown(`\`${entry.result}\`\n\n`)
		md.appendMarkdown("The cache manifest references this file, but it doesn't exist.\n\n")
		md.appendMarkdown('Try running `pnpm build` to regenerate the cache.')
		return md
	}

	// Case 1: URL found and file exists - show image preview
	const fileUri = vscode.Uri.file(cachedPath)
	const md = new vscode.MarkdownString()
	md.isTrusted = true
	md.supportHtml = true

	md.appendMarkdown(`<img src="${fileUri.toString()}" width="${maxWidth}" />\n\n`)

	// Link to open the file in VS Code
	md.appendMarkdown(`[${path.basename(cachedPath)}](${fileUri.toString()})`)
	return md
}

class AphexHoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): undefined | vscode.Hover {
		const line = document.lineAt(position.line).text

		const found = findAphexUrlAtPosition(line, position.character)
		if (!found) {
			return undefined
		}

		const manifestPath = getManifestPath(document)
		if (!manifestPath) {
			return undefined
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
		if (!workspaceFolder) {
			return undefined
		}

		const range = new vscode.Range(position.line, found.start, position.line, found.end)
		const manifest = getManifest(manifestPath)
		const content = createHoverContent(found.url, manifest, workspaceFolder.uri.fsPath)

		return new vscode.Hover(content, range)
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const supportedLanguages = [
		'mdx',
		'html',
		'markdown',
		'astro',
		'svelte',
		'javascript',
		'typescript',
		'javascriptreact',
		'typescriptreact',
	]

	const selector: vscode.DocumentSelector = supportedLanguages.map((lang) => ({
		language: lang,
		scheme: 'file',
	}))

	const hoverProvider = vscode.languages.registerHoverProvider(selector, new AphexHoverProvider())

	context.subscriptions.push(hoverProvider)
}

export function deactivate(): void {
	manifestCache.clear()
}
