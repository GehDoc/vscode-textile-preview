/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const gulp = require('gulp');
//const path = require('path');

const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const es = require('event-stream');
const vsce = require('vsce');
const nls = require('vscode-nls-dev');
const webpack = require('webpack');

const tsProject = ts.createProject('./tsconfig.json', { typescript });
const configWebpackExt = require('./extension.webpack.config.js');
const configWebpackPreview = require('./webpack.config.js');

const inlineMap = true;
const inlineSource = false;
const outDest = 'out';

// See : https://github.com/microsoft/vscode/blob/release/1.22/build/lib/i18n.ts
// and : https://github.com/microsoft/vscode-loc/#visual-studio-code-language-packs
const languages = [
	{ id: 'zh-tw', folderName: 'cht', transifexId: 'zh-hant' },
	{ id: 'zh-cn', folderName: 'chs', transifexId: 'zh-hans' },
	{ id: 'ja', folderName: 'jpn' },
	{ id: 'ko', folderName: 'kor' },
	{ id: 'de', folderName: 'deu' },
	{ id: 'fr', folderName: 'fra' },
	{ id: 'es', folderName: 'esn' },
	{ id: 'ru', folderName: 'rus' },
	{ id: 'it', folderName: 'ita' }
];

const cleanTask = function() {
	return del(['out/**', 'dist/**', 'package.nls.*.json', 'vscode-textile-preview*.vsix', 'media/index.js', 'media/pre.js']);
};

/*
const internalCompileTask = function() {
	return doCompile(false);
};
*/

const internalNlsCompileTask = function() {
	return doCompile(true);
};

const addI18nTask = function() {
	return gulp.src(['package.nls.json'])
		.pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
		.pipe(gulp.dest('.'));
};

const buildTask = function( cb ) {
	configWebpackPreview.mode = "production";
	configWebpackExt.mode = "production";

	return gulp.series(cleanTask, internalNlsCompileTask, addI18nTask, packPreview, packExt)( cb );
};

const buildDevTask = function( cb ) {
	configWebpackPreview.mode = "development";
	configWebpackExt.mode = "development";

	return gulp.series(cleanTask, internalNlsCompileTask, addI18nTask, packPreview, packExt)( cb );
};

const doCompile = function (buildNls) {
	var r = tsProject.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject()).js
		.pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
		.pipe(buildNls ? nls.createAdditionalLanguageFiles(languages, 'i18n', 'out') : es.through())
		.pipe(buildNls ? nls.bundleMetaDataFiles('GehDoc.vscode-textile-preview', 'out') : es.through())
		.pipe(buildNls ? nls.bundleLanguageFiles() : es.through());

	if (inlineMap && inlineSource) {
		r = r.pipe(sourcemaps.write());
	} else {
		r = r.pipe(sourcemaps.write("../out", {
			// no inlined source
			includeContent: inlineSource,
			// Return relative source map root directories per file.
			sourceRoot: "../src"
		}));
	}

	return r.pipe(gulp.dest(outDest));
};

const vscePublishTask = function() {
	return vsce.publish();
};

const vscePackageTask = function() {
	return vsce.createVSIX();
};

const packExt = function( cb ) {
	webpack(configWebpackExt).run( cb );
};

const packPreview = function( cb ) {
	webpack(configWebpackPreview).run( cb );
};

gulp.task('default', buildTask);

gulp.task('clean', cleanTask);

//gulp.task('compile', gulp.series(cleanTask, internalCompileTask));

gulp.task('build-dev', buildDevTask);

gulp.task('build', buildTask);

gulp.task('publish', gulp.series(buildTask, vscePublishTask));

gulp.task('package', gulp.series(buildTask, vscePackageTask)); 
