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

const WALK_BACK_TERMINATORS_REGEX = /[\s)[\]>=,;{}]/
const WALK_FORWARD_TERMINATORS_REGEX = /[\s"'`()[\]<>=,;{}]/
const TLDR_EXTENSION_BOUNDARY_REJECT_REGEX = /[A-Z0-9]/i

/**
 * Find a `.tldr` file path at the given position in a line, handling paths with
 * spaces when they're inside quotes or angle brackets.
 */
function findTldrPathAtPosition(
	line: string,
	character: number,
): undefined | { end: number; path: string; start: number } {
	const tldrExtension = '.tldr'
	let searchIndex = 0

	while (searchIndex < line.length) {
		const tldrIndex = line.indexOf(tldrExtension, searchIndex)
		if (tldrIndex === -1) {
			break
		}

		// Reject matches inside longer extensions like `.tldraw`
		const charAfter = line.charAt(tldrIndex + tldrExtension.length)
		if (TLDR_EXTENSION_BOUNDARY_REJECT_REGEX.test(charAfter)) {
			searchIndex = tldrIndex + 1
			continue
		}

		// Walk backward from the `.tldr` to find the start of the path
		let startIndex = tldrIndex
		let openingDelimiter = ''

		for (let i = tldrIndex - 1; i >= 0; i--) {
			const char = line[i]

			// If we hit a known opening delimiter, the path starts after it
			if (char in delimiterPairs) {
				openingDelimiter = char
				startIndex = i + 1
				break
			}

			// If we hit whitespace or a closing bracket, stop
			if (WALK_BACK_TERMINATORS_REGEX.test(char)) {
				startIndex = i + 1
				break
			}

			startIndex = i
		}

		// Determine end boundary
		const closingDelimiter = delimiterPairs[openingDelimiter]
		const afterTldr = tldrIndex + tldrExtension.length
		let endIndex: number

		if (closingDelimiter) {
			// Inside delimiters — include everything up to the closing delimiter
			const closePos = line.indexOf(closingDelimiter, afterTldr)
			endIndex = closePos === -1 ? afterTldr : closePos
		} else {
			// No delimiter — stop at whitespace or common terminators
			const remaining = line.slice(afterTldr)
			const match = WALK_FORWARD_TERMINATORS_REGEX.exec(remaining)
			endIndex = match?.index === undefined ? line.length : afterTldr + match.index
		}

		// Check if cursor is within this path
		if (character >= startIndex && character <= endIndex) {
			return {
				end: endIndex,
				path: line.slice(startIndex, endIndex),
				start: startIndex,
			}
		}

		searchIndex = endIndex
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

type ResolvedConfig = {
	manifestPath: string
	maxWidth: number
}

function readConfig(document: vscode.TextDocument): ResolvedConfig | undefined {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri)
	if (!workspaceFolder) {
		return undefined
	}

	const config = vscode.workspace.getConfiguration('tldraw-preview')
	const configuredPath = config.get<string>(
		'manifestPath',
		'node_modules/.cache/tldraw/.tldraw-plugin-cache.json',
	)
	const maxWidth = config.get<number>('maxWidth', 300)

	const manifestPath = path.isAbsolute(configuredPath)
		? configuredPath
		: path.join(workspaceFolder.uri.fsPath, configuredPath)

	return { manifestPath, maxWidth }
}

/**
 * Parse import query params into the JSON format used by unplugin-tldraw for
 * manifest keys. Mirrors the parsing logic in unplugin-tldraw's
 * `parseImportOverrides`.
 */
function parseQueryToManifestKey(queryString: string): string {
	const params = new URLSearchParams(queryString)
	const overrides: Record<string, boolean | number | string> = {}

	for (const [key, value] of params.entries()) {
		if (key === 'tldr' || key === 'tldraw') {
			continue
		}

		switch (key) {
			case 'dark':
			case 'stripStyle':
			case 'transparent': {
				overrides[key] = value === 'true' || value === ''
				break
			}

			case 'format':
			case 'frame':
			case 'page': {
				overrides[key] = value
				break
			}

			case 'padding':
			case 'scale': {
				const numberValue = Number(value)
				if (!Number.isNaN(numberValue)) {
					overrides[key] = numberValue
				}

				break
			}

			default: {
				break
			}
		}
	}

	return Object.keys(overrides).length > 0 ? JSON.stringify(overrides) : ''
}

/**
 * Look up a `.tldr` path in the manifest. Keys in the manifest are relative to
 * the cache directory, with query params stored as JSON (e.g.
 * `path.tldr?{"dark":true}`).
 */
function findManifestEntry(
	relativeTldrPath: string,
	queryString: string | undefined,
	manifest: Manifest,
): ManifestEntry | undefined {
	if (queryString) {
		const manifestQuery = parseQueryToManifestKey(queryString)
		if (manifestQuery) {
			const keyWithQuery = `${relativeTldrPath}?${manifestQuery}`
			// eslint-disable-next-line ts/no-unnecessary-condition
			if (manifest[keyWithQuery]) {
				return manifest[keyWithQuery]
			}
		}
	}

	// Exact match without query string
	// eslint-disable-next-line ts/no-unnecessary-condition
	if (manifest[relativeTldrPath]) {
		return manifest[relativeTldrPath]
	}

	return undefined
}

function createHoverContent(
	tldrPath: string,
	manifest: Manifest,
	manifestPath: string,
	documentDirectory: string,
	maxWidth: number,
): vscode.MarkdownString {
	// Split path and query string
	const queryIndex = tldrPath.indexOf('?')
	const filePath = queryIndex === -1 ? tldrPath : tldrPath.slice(0, queryIndex)
	const queryString = queryIndex === -1 ? undefined : tldrPath.slice(queryIndex + 1)

	// Resolve to absolute, then make relative to cache directory (manifest keys are relative to it)
	const cacheDirectory = path.dirname(manifestPath)
	const absolutePath = path.isAbsolute(filePath)
		? filePath
		: path.resolve(documentDirectory, filePath)
	const relativeTldrPath = path.relative(cacheDirectory, absolutePath)

	const entry = findManifestEntry(relativeTldrPath, queryString, manifest)

	if (!entry) {
		const md = new vscode.MarkdownString()
		md.supportHtml = true
		md.appendMarkdown('### ⚠️ Not in cache\n\n')
		md.appendMarkdown(`\`${tldrPath}\`\n\n`)
		md.appendMarkdown("This asset hasn't been cached yet.\n\n")
		md.appendMarkdown('Run `pnpm build` or `vite build` to generate the cache.')
		return md
	}

	// Resolve the cached file path relative to the cache directory
	const cachedPath = path.join(cacheDirectory, entry.result)

	if (!fs.existsSync(cachedPath)) {
		const md = new vscode.MarkdownString()
		md.supportHtml = true
		md.appendMarkdown('### ⚠️ Cache file missing\n\n')
		md.appendMarkdown(`\`${entry.result}\`\n\n`)
		md.appendMarkdown("The cache manifest references this file, but it doesn't exist.\n\n")
		md.appendMarkdown('Try running `pnpm build` to regenerate the cache.')
		return md
	}

	const fileUri = vscode.Uri.file(cachedPath)
	const md = new vscode.MarkdownString()
	md.isTrusted = true
	md.supportHtml = true

	md.appendMarkdown(`<img src="${fileUri.toString()}" width="${maxWidth}" />\n\n`)

	// Link to open the file in VS Code
	md.appendMarkdown(`[${path.basename(cachedPath)}](${fileUri.toString()})`)
	return md
}

class TldrawHoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position): undefined | vscode.Hover {
		const line = document.lineAt(position.line).text

		const found = findTldrPathAtPosition(line, position.character)
		if (!found) {
			return undefined
		}

		const config = readConfig(document)
		if (!config) {
			return undefined
		}

		const documentDirectory = path.dirname(document.uri.fsPath)
		const range = new vscode.Range(position.line, found.start, position.line, found.end)
		const manifest = getManifest(config.manifestPath)
		const content = createHoverContent(
			found.path,
			manifest,
			config.manifestPath,
			documentDirectory,
			config.maxWidth,
		)

		return new vscode.Hover(content, range)
	}
}

const ON_LANGUAGE_PREFIX = 'onLanguage:'

export function activate(context: vscode.ExtensionContext): void {
	// Derive the supported languages from `activationEvents` in package.json so the
	// list lives in exactly one place.
	const packageJson: unknown = context.extension.packageJSON
	const activationEvents =
		typeof packageJson === 'object' &&
		packageJson !== null &&
		'activationEvents' in packageJson &&
		Array.isArray(packageJson.activationEvents)
			? packageJson.activationEvents.filter((event): event is string => typeof event === 'string')
			: []
	const supportedLanguages = activationEvents
		.filter((event) => event.startsWith(ON_LANGUAGE_PREFIX))
		.map((event) => event.slice(ON_LANGUAGE_PREFIX.length))

	const selector: vscode.DocumentSelector = supportedLanguages.map((lang) => ({
		language: lang,
		scheme: 'file',
	}))

	const hoverProvider = vscode.languages.registerHoverProvider(selector, new TldrawHoverProvider())

	context.subscriptions.push(hoverProvider)
}

export function deactivate(): void {
	manifestCache.clear()
}
