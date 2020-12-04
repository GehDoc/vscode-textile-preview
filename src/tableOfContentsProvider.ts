/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TextileEngine } from './textileEngine';
import { Slug, githubSlugifier } from './slugify';

export interface TocEntry {
	readonly slug: Slug;
	readonly text: string;
	readonly level: number;
	readonly line: number;
	readonly location: vscode.Location;
}

export interface SkinnyTextLine {
	text: string;
}

export interface SkinnyTextDocument {
	readonly uri: vscode.Uri;
	readonly version: number;
	readonly lineCount: number;

	lineAt(line: number): SkinnyTextLine;
	getText(): string;
}

export class TableOfContentsProvider {
	private toc?: TocEntry[];

	public constructor(
		private engine: TextileEngine,
		private document: SkinnyTextDocument
	) { }

	public async getToc(): Promise<TocEntry[]> {
		if (!this.toc) {
			try {
				this.toc = await this.buildToc(this.document);
			} catch (e) {
				this.toc = [];
			}
		}
		return this.toc;
	}

	public async lookup(fragment: string): Promise<TocEntry | undefined> {
		const toc = await this.getToc();
		const slug = githubSlugifier.fromHeading(fragment);
		return toc.find(entry => entry.slug.equals(slug));
	}

	// -- Begin : modified for textile
	private async buildToc(document: SkinnyTextDocument): Promise<TocEntry[]> {
		const toc: TocEntry[] = [];
		const tokens = await this.engine.parse(document);

		const slugCount = new Map<string, number>();
		const jsonmlUtils = await this.engine.jsonmlUtils();
		jsonmlUtils.applyHooks(tokens, [
			[(token) => {
				let level;
				if(typeof(token[0]) === 'string' && (level = TableOfContentsProvider.getHeaderLevel( token[0] )) < 7) {
					if( typeof(token[1]) === 'object' && typeof( token[1]['data-line'] ) === 'number' ) {
						const lineNumber = token[1]['data-line'];
						const line = document.lineAt(lineNumber);
						const text = TableOfContentsProvider.getHeaderText(line.text)

						let slug = githubSlugifier.fromHeading(text);
						if (slugCount.has(slug.value)) {
							const count = slugCount.get(slug.value)!;
							slugCount.set(slug.value, count + 1);
							slug = githubSlugifier.fromHeading(slug.value + '-' + (count + 1));
						} else {
							slugCount.set(slug.value, 0);
						}

						toc.push({
							slug,
							text: text,
							level: level,
							line: lineNumber,
							location: new vscode.Location(document.uri,
								new vscode.Range(lineNumber, 0, lineNumber, line.text.length))
						});
					}
				}
				return token;
			}]
		]);

		// Get full range of section
		return toc.map((entry, startIndex): TocEntry => {
			let end: number | undefined = undefined;
			for (let i = startIndex + 1; i < toc.length; ++i) {
				if (toc[i].level <= entry.level) {
					end = toc[i].line - 1;
					break;
				}
			}
			const endLine = end ?? document.lineCount - 1;
			return {
				...entry,
				location: new vscode.Location(document.uri,
					new vscode.Range(
						entry.location.range.start,
						new vscode.Position(endLine, document.lineAt(endLine).text.length)))
			};
		});
	}

	private static getHeaderLevel(markup: string): number {
		switch (markup) {
			case 'h1':
				return 1;
			case 'h2':
				return 2;
			case 'h3':
				return 3;
			case 'h4':
				return 4;
			case 'h5':
				return 5;
			case 'h6':
				return 6;
			default:
				return 7;						
		}
	}

	private static getHeaderText(header: string): string {
		return header.replace(/^\s*h[1-6]\.\s*(.*?)\s*$/, (_, word) => word.trim());
	}
	// -- End : modified for textile
}
