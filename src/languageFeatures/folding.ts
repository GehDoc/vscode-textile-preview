/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type Token } from '../../libs/textile-js/textile';
import * as vscode from 'vscode';
import { ITextileParser, getLineNumber, getEndLineNumber } from '../textileEngine';
import { TextileTableOfContentsProvider } from '../tableOfContents';
import { ITextDocument } from '../types/textDocument';

const rangeLimit = 5000;

/* Disabled for textile : not relevant
interface TextileJSTokenWithMap extends Token {
	map: [number, number];
}
*/

export class TextileFoldingProvider implements vscode.FoldingRangeProvider {

	constructor(
		private readonly parser: ITextileParser,
		private readonly tocProvide: TextileTableOfContentsProvider,
	) { }

	// --- Begin : modified for textile
	public async provideFoldingRanges(
		document: ITextDocument,
		_: vscode.FoldingContext,
		_token: vscode.CancellationToken
	): Promise<vscode.FoldingRange[]> {
		const foldables = await Promise.all([
			this.getRegions(document),
			this.getHeaderFoldingRanges(document),
			this.getBlockFoldingRanges(document)
		]);
		return foldables.flat().slice(0, rangeLimit);
	}

	private async getRegions(document: ITextDocument): Promise<vscode.FoldingRange[]> {
		const tokens = await this.parser.tokenize(document);
		const regionMarkers :{line: number, isStart: boolean}[] = [];
		const jsonmlUtils = await this.parser.jsonmlUtils();
		jsonmlUtils.applyHooks(tokens, [
			[(token) => {
				if( isRegionMarker(token) ) {
					const lineNumber = getLineNumber( token );
					if (lineNumber !== undefined) {
						regionMarkers.push({ line: lineNumber, isStart: isStartRegion(token[2])});
					}
				}
				return token;
			}]
		]);

		const nestingStack: { line: number; isStart: boolean }[] = [];
		return regionMarkers
			.map(marker => {
				if (marker.isStart) {
					nestingStack.push(marker);
				} else if (nestingStack.length && nestingStack[nestingStack.length - 1].isStart) {
					return new vscode.FoldingRange(nestingStack.pop()!.line, marker.line, vscode.FoldingRangeKind.Region);
				} else {
					// noop: invalid nesting (i.e. [end, start] or [start, end, end])
				}
				return null;
			})
			.filter((region: vscode.FoldingRange | null): region is vscode.FoldingRange => !!region);
	}
	// --- End : modified for textile

	private async getHeaderFoldingRanges(document: ITextDocument): Promise<vscode.FoldingRange[]> {
		const toc = await this.tocProvide.getForDocument(document);
		return toc.entries.map(entry => {
			let endLine = entry.sectionLocation.range.end.line;
			if (document.lineAt(endLine).isEmptyOrWhitespace && endLine >= entry.line + 1) {
				endLine = endLine - 1;
			}
			return new vscode.FoldingRange(entry.line, endLine);
		});
	}

	// --- Begin : modified for textile
	private async getBlockFoldingRanges(document: ITextDocument): Promise<vscode.FoldingRange[]> {
		const tokens = await this.parser.tokenize(document);
		const jsonmlUtils = await this.parser.jsonmlUtils();
		const multiLineListItems :{start: number, end: number | undefined, nodeLevel: number, isComment?: boolean}[] = [];
		let undefinedEndCount = 0;
		const setEndForPreviousItems = (nodeLevel: number, end: number) => {
			if ( undefinedEndCount && multiLineListItems.length ) {
				let id = multiLineListItems.length - 1;
				while (id >= 0 && undefinedEndCount > 0 && multiLineListItems[id].nodeLevel >= nodeLevel ) {
					if (multiLineListItems[id].end === undefined) {
						undefinedEndCount--;
						multiLineListItems[id].end = end;
					}
					// no need to go too far
					if (multiLineListItems[id].nodeLevel === nodeLevel) {
						break;
					}
					id--;
				}
			}
		};
		jsonmlUtils.applyHooks(tokens, [
			[(token, _param, nodeLevel) => {
				let start = getLineNumber( token );
				if( start !== undefined) {
					setEndForPreviousItems( nodeLevel, start );
					if(isFoldableToken(token) ) {
						let end = getEndLineNumber( token );
						if ( end === undefined ) {
							undefinedEndCount++;
							multiLineListItems.push({ start, end, nodeLevel, isComment: token[0] === '!' });
						} else {
							multiLineListItems.push({ start, end: end + 1, nodeLevel, isComment: token[0] === '!' });
						}
					}
				}
				return token;
			}]
		]);
		// last line !
		setEndForPreviousItems( 0, document.lineCount );

		return multiLineListItems.map(listItem => {
			const start = listItem.start;
			let end = listItem.end! - 1;
			if (document.lineAt(end).isEmptyOrWhitespace && end >= start + 1) {
				end = end - 1;
			}
			return new vscode.FoldingRange(start, end, this.getFoldingRangeKind(listItem));
		});
	}

	private getFoldingRangeKind(listItem : {start: number, end: number | undefined, nodeLevel: number, isComment?: boolean}): vscode.FoldingRangeKind | undefined {
		return listItem.isComment
			? vscode.FoldingRangeKind.Comment
			: undefined;
	}
	// --- End : modified for textile
}

// --- Begin : modified for textile
const isStartRegion = (t: string) => /^\s*#?region\b.*/.test(t);
const isEndRegion = (t: string) => /^\s*#?endregion\b.*/.test(t);

const isRegionMarker = (token: Token) =>
	typeof(token[0]) === 'string' && token[0] === '!' && typeof(token[1]) === 'object' && typeof(token[2]) === 'string' && (isStartRegion(token[2]) || isEndRegion(token[2]));

const isFoldableToken = (token: Token) => {
	switch (token[0]) {
		case 'li':
		case 'pre':
		case 'div':
		case 'blockquote':
			return true;

		case '!':
			return !isRegionMarker(token);

		default:
			return false;
	}
};
// --- End : modified for textile

export function registerFoldingSupport(
	selector: vscode.DocumentSelector,
	parser: ITextileParser,
	tocProvider: TextileTableOfContentsProvider,
): vscode.Disposable {
	return vscode.languages.registerFoldingRangeProvider(selector, new TextileFoldingProvider(parser, tocProvider));
}
