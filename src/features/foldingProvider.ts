/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Token } from '../../libs/textile-js/textile';
import * as vscode from 'vscode';
import { TextileEngine } from '../textileEngine';
import { TableOfContentsProvider } from '../tableOfContentsProvider';
import { flatten } from '../util/arrays';

const rangeLimit = 5000;

// --- Begin : modified for textile
const isStartRegion = (t: string) => /^\s*#?region\b.*/.test(t);
const isEndRegion = (t: string) => /^\s*#?endregion\b.*/.test(t);

const isRegionMarker = (token: Token) =>
	typeof(token[0]) === 'string' && token[0] === '!' && typeof(token[1]) === 'object' && typeof(token[2]) === 'string' && (isStartRegion(token[2]) || isEndRegion(token[2]));
// --- End : modified for textile


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
			/* FIXME : this.getBlockFoldingRanges(document) */
		]);
		return flatten(foldables).slice(0, rangeLimit);
	}

	private async getRegions(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {
		const tokens = await this.engine.parse(document);
		let regionMarkers :{line: number, isStart: boolean}[] = [];
		const jsonmlUtils = await this.engine.jsonmlUtils();
		jsonmlUtils.applyHooks(tokens, [
			[(token) => {
				if( isRegionMarker(token) ) {
					const lineNumber = +token[1]['data-line'];
					regionMarkers.push({ line: lineNumber, isStart: isStartRegion(token[2])});
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

	/* FIXME
	private async getBlockFoldingRanges(document: vscode.TextDocument): Promise<vscode.FoldingRange[]> {

		const isFoldableToken = (token: Token): boolean => {
			switch (token.type) {
				case 'fence':
				case 'list_item_open':
					return token.map[1] > token.map[0];

				case 'html_block':
					return token.map[1] > token.map[0] + 1;

				default:
					return false;
			}
		};

		const tokens = await this.engine.parse(document);
		const multiLineListItems = tokens.filter(isFoldableToken);
		return multiLineListItems.map(listItem => {
			const start = listItem.map[0];
			let end = listItem.map[1] - 1;
			if (document.lineAt(end).isEmptyOrWhitespace && end >= start + 1) {
				end = end - 1;
			}
			return new vscode.FoldingRange(start, end);
		});
	}
	*/
}
