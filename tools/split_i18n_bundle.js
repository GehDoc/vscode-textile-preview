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

// Languages list, with string replacements
const langs = require('./languages.config');

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