import { remarkConfig } from '@kitschpatrol/remark-config'

export default remarkConfig({
	rules: [
		['remark-lint-no-undefined-references', false],
		['remark-lint-maximum-heading-length', 80],
		['remark-lint-no-file-name-irregular-characters', false],
		// Useful if the repository is not yet pushed to a remote.
		['remarkValidateLinks', { repository: false }],
	],
})
