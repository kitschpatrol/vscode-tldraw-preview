import { mdatConfig } from '@kitschpatrol/mdat-config'
import { readFileSync } from 'node:fs'

type SettingSchema = {
	default: boolean | number | string
	description: string
}

type ExtensionManifest = {
	contributes: {
		configuration: {
			properties: Record<string, SettingSchema>
		}
	}
}

/**
 * Render the extension's contributed settings from `package.json` as a Markdown
 * table, so the readme can't drift from what VS Code shows users.
 */
function renderSettingsTable(): string {
	const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as ExtensionManifest
	const rows = Object.entries(manifest.contributes.configuration.properties).map(
		([name, { default: defaultValue, description }]) =>
			`| \`${name}\` | \`${String(defaultValue)}\` | ${description} |`,
	)

	return ['| Setting | Default | Description |', '| --- | --- | --- |', ...rows].join('\n')
}

export default mdatConfig({
	'vscode-settings': renderSettingsTable,
})
