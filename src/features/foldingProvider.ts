/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Token } from '../../libs/textile-js/textile';
import * as vscode from 'vscode';
import { TextileEngine } from '../textileEngine';
import { TableOfContentsProvider } from '../tableOfContentsProvider';

const rangeLimit = 5000;

export default class TextileFoldingProvider implements vscode.FoldingRangeProvider {

	constructor(
		private readonly engine: TextileEngine
	) { }

	// --- Begin : modified for textile
	public async provideFoldingRanges(
		document: vscode.TextDocument,
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

	private async getRegions(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {
		const tokens = await this.engine.parse(document);
		const regionMarkers :{line: number, isStart: boolean}[] = [];
		const jsonmlUtils = await this.engine.jsonmlUtils();
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

		const nestingStack: { line: number, isStart: boolean }[] = [];
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

	private async getHeaderFoldingRanges(document: vscode.TextDocument) {
		const tocProvider = new TableOfContentsProvider(this.engine, document);
		const toc = await tocProvider.getToc();
		return toc.map(entry => {
			let endLine = entry.location.range.end.line;
			if (document.lineAt(endLine).isEmptyOrWhitespace && endLine >= entry.line + 1) {
				endLine = endLine - 1;
			}
			return new vscode.FoldingRange(entry.line, endLine);
		});
	}

	// --- Begin : modified for textile
	private async getBlockFoldingRanges(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {
		const tokens = await this.engine.parse(document);
		const jsonmlUtils = await this.engine.jsonmlUtils();
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

	private getFoldingRangeKind(listItem: Token): vscode.FoldingRangeKind | undefined {
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

const getLineNumber = (token: Token) =>
	typeof(token[0]) === 'string' && typeof(token[1]) === 'object' && typeof(token[1]['data-line']) !== 'undefined' ? +token[1]['data-line'] : undefined;

const getEndLineNumber = (token: Token) =>
	typeof(token[0]) === 'string' && typeof(token[1]) === 'object' && typeof(token[1]['data-line-end']) !== 'undefined' ? +token[1]['data-line-end'] : undefined;

const isFoldableToken = (token: Token): boolean => {
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
