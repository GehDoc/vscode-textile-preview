// Supported languages list :
// lang => [
//	id : ID for gulpfile
//	folderName : directory's name for this lang files
//	replacements : list of strings replacements, to transform markdown into textile :
//		[ regexp, replacement string, replacements count ],
// 	transifexId : optional depending on the language, for gulpfile
// ]
//
// For gulpfile, see :
// - https://github.com/microsoft/vscode/blob/release/1.22/build/lib/i18n.ts
// - https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs
//
// Note : usually, 49 replacements

const DEFAULT_REPLACEMENTS = [
	[ /\[link\]\(\/path\/to\/file\.md\)/g, '\\"link\\":/path/to/file.textile' , 1 ],
	[ /\[(link|link text|링크)\]\(\/path\/to\/file\.md#header\)/g, '\\"link\\":/path/to/file.textile#header', 1 ],
	[ /\[(link|vínculo)\]\(#header\)/g , '\\"link\\":#header', 1 ],
	[ /\[about\]\(\/about\)/g , '\\"about\\":/about', 1 ],
	[ /\[link\]\[ref\]/g, '\\"link\\":ref', 1 ],
];

module.exports = {
	'de':{
		id: 'de',
		folderName: 'deu',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		]
	},
	'es':{
		id: 'es',
		folderName: 'esn',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 33 ],
		]
	},
	'fr':{
		id: 'fr',
		folderName: 'fra',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		]
	},
	'it':{
		id: 'it',
		folderName: 'ita',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 42 ],
			[ /Markdown/g, 'Textile', 33 ],
		]
	},
	'ja':{
		id: 'ja',
		folderName: 'jpn',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /マークダウン/g, 'Textile', 6 ],
			[ /Markdown/g, 'Textile', 28 ],
		]
	},
	'ko':{
		id: 'ko',
		folderName: 'kor',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 42 ],
			[ /Markdown/g, 'Textile', 33 ],
		]
	},
	'pl':{
		id: 'pl',
		folderName: 'pol',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		]
	},
	'pt-BR':{
		id: 'pt-br',
		folderName: 'ptb',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 43 ],
			[ /Markdown/g, 'Textile', 32 ],
		]
	},
	'ru':{
		id: 'ru',
		folderName: 'rus',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		]
	},
	'zh-hant':{
		id: 'zh-tw',
		folderName: 'cht',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		],
		transifexId: 'zh-hant'
	},
	'zh-hans':{
		id: 'zh-cn',
		folderName: 'chs',
		replacements: [
			...DEFAULT_REPLACEMENTS,
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 34 ],
		],
		transifexId: 'zh-hans'
	},
};