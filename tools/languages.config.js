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
module.exports = {
	'de':{
		id: 'de',
		folderName: 'deu',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'es':{
		id: 'es',
		folderName: 'esn',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'fr':{
		id: 'fr',
		folderName: 'fra',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'it':{
		id: 'it',
		folderName: 'ita',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'ja':{
		id: 'ja',
		folderName: 'jpn',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /マークダウン/g, 'Textile', 3 ],
			[ /Markdown/g, 'Textile', 22 ],
		]
	},
	'ko':{
		id: 'ko',
		folderName: 'kor',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'ru':{
		id: 'ru',
		folderName: 'rus',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		]
	},
	'zh-hant':{
		id: 'zh-tw',
		folderName: 'cht',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		],
		transifexId: 'zh-hant'
	},
	'zh-hans':{
		id: 'zh-cn',
		folderName: 'chs',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 25 ],
		],
		transifexId: 'zh-hans'
	},
};