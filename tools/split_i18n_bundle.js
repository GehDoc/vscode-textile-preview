#!/usr/bin/env node
/**
 * Split the bundle into files
 * 
 * Call parameters : lang in_file out_dir
 */

const fs = require('fs'),
	path = require('path');


 /**
  * Affiche une erreur, et termine le process avec code de retour -1
  * @param {*} msg - le message à afficher
  */
function fatal_error( msg ) {
	console.error( msg );
	process.exit( -1 );
}

if( process.argv.length != 5 ) {
	fatal_error( "3 parameters needed" );
}

// TODO : share this list with gulpfile
//
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
const langs = {
	'de':{
		id: 'de',
		folderName: 'deu',
		replacements: [
			[ /markdown/g, 'textile', 25 ],
			[ /Markdown/g, 'Textile', 24 ],
		]
	},
	'es':{
		id: 'es',
		folderName: 'esn',
		replacements: [
			// OK, count is 44
			[ /markdown/g, 'textile', 29 ],
			[ /Markdown/g, 'Textile', 15 ],
		]
	},
	'fr':{
		id: 'fr',
		folderName: 'fra',
		replacements: [
			[ /markdown/g, 'textile', 28 ],
			[ /Markdown/g, 'Textile', 20 ],
			[ /markdow/g, 'textile', 1 ],
		]
	},
	'it':{
		id: 'it',
		folderName: 'ita',
		replacements: [
			[ /markdown/g, 'textile', 41 ],
			[ /Markdown/g, 'Textile', 8 ],
		]
	},
	'ja':{
		id: 'ja',
		folderName: 'jpn',
		replacements: [
			[ /markdown/g, 'textile', 25 ],
			[ /マークダウン/g, 'Textile', 19 ],
			[ /Markdown/g, 'Textile', 5 ],
		]
	},
	'ko':{
		id: 'ko',
		folderName: 'kor',
		replacements: [
			[ /markdown/g, 'textile', 32 ],
			[ /Markdown/g, 'Textile', 14 ],
			[ /마크다운/g, 'Textile', 3]
		]
	},
	'ru':{
		id: 'ru',
		folderName: 'rus',
		replacements: [
			[ /markdown/g, 'textile', 25 ],
			[ /Markdown/g, 'Textile', 24 ],
		]
	},
	'zh-hant':{
		id: 'zh-tw',
		folderName: 'cht',
		replacements: [
			[ /markdown/g, 'textile', 26 ],
			[ /Markdown/g, 'Textile', 23 ],
		],
		transifexId: 'zh-hant'
	},
	'zh-hans':{
		id: 'zh-cn',
		folderName: 'chs',
		replacements: [
			[ /markdown/g, 'textile', 29 ],
			[ /Markdown/g, 'Textile', 20 ],
		],
		transifexId: 'zh-hans'
	},
};

const	lang = process.argv[2],
		in_file = process.argv[3],
		out_dir = process.argv[4];

if( ! langs.hasOwnProperty( lang ) ) {
	console.log( `Language ${lang} ignored`);
	process.exit( 0 );
}


let rawdata = fs.readFileSync( in_file ).toString();
if( rawdata ) {

	// Replace RAW data, and ensure replace
	for( let i in langs[ lang ].replacements ) {
		const replacement = langs[ lang ].replacements[ i ];

		// check replacement
		const nbm = (rawdata.match(replacement[ 0 ] ) || []).length;
		if( nbm !== replacement[ 2 ] ) {
			fatal_error( `regex ${i} : ${nbm} replacements found instead of ${replacement[ 2 ]}` );
		}

		// apply replacement
		rawdata = rawdata.replace( replacement[ 0 ], replacement[ 1 ] );
	}

	// Split into files, into out_dir
	let data = JSON.parse(rawdata);

	for( let initial_local_filenameWOext in data[ 'contents' ] ) {

		// Rebase into 'out/' directory
		const local_filenameWOext = initial_local_filenameWOext.replace( /^dist\//g, "out/" );

		// Ensure it's a secure name
		if( local_filenameWOext.match( /^[a-zA-Z/]+$/mg ) == null ) {
			fatal_error( `suspicious file named ${local_filenameWOext}` );
		}

		// Make directory
		const filename = out_dir + '/' + langs[ lang ].folderName + '/' + local_filenameWOext + '.i18n.json';
		fs.mkdirSync( path.dirname( filename ), { recursive: true } );

		// Create file
		const content = Object.assign( {
				// common header (license)
				'': data['']
			},
			data[ 'contents' ][ initial_local_filenameWOext ]
		);
		// write pretty
		fs.writeFileSync( filename, JSON.stringify( content, null, '\t' ), 'utf8' );
	}

	process.exit( 0 );
} else {
	fatal_error( "No data" );
}

fatal_error( "Should not be reached");