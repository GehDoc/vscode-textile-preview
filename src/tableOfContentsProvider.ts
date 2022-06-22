/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { TextileEngine } from './textileEngine';
import { Token } from '../libs/textile-js/textile'; // Added for Textile
import { githubSlugifier, Slug } from './slugify';
import { isTextileFile } from './util/file';

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

export class TableOfContents {

	public static async create(engine: TextileEngine, document: SkinnyTextDocument,): Promise<TableOfContents> {
		const entries = await this.buildToc(engine, document);
		return new TableOfContents(entries);
	}

	public static async createForDocumentOrNotebook(engine: TextileEngine, document: SkinnyTextDocument): Promise<TableOfContents> {
		if (document.uri.scheme === 'vscode-notebook-cell') {
			const notebook = vscode.workspace.notebookDocuments
				.find(notebook => notebook.getCells().some(cell => cell.document === document));

			if (notebook) {
				const entries: TocEntry[] = [];

				for (const cell of notebook.getCells()) {
					if (cell.kind === vscode.NotebookCellKind.Markup && isTextileFile(cell.document)) {
						entries.push(...(await this.buildToc(engine, cell.document)));
					}
				}

				return new TableOfContents(entries);
			}
		}
		return this.create(engine, document);
	}

	private constructor(
		public readonly entries: readonly TocEntry[],
	) { }

	public lookup(fragment: string): TocEntry | undefined {
		const slug = githubSlugifier.fromHeading(fragment);
		return this.entries.find(entry => entry.slug.equals(slug));
	}

	// -- Begin : modified for textile
	private static async buildToc(engine: TextileEngine, document: SkinnyTextDocument): Promise<TocEntry[]> {
		const toc: TocEntry[] = [];
		const tokens = await engine.parse(document);

		const existingSlugEntries = new Map<string, { count: number }>();
		const jsonmlUtils = await engine.jsonmlUtils();
		jsonmlUtils.applyHooks(tokens, [
			[(token : Token) => {
				let level;
				if(typeof(token[0]) === 'string' && (level = TableOfContents.getHeaderLevel( token[0] )) < 7) {
					if( typeof(token[1]) === 'object' && typeof( token[1]['data-line'] ) === 'number' ) {
						const lineNumber = token[1]['data-line'];
						const line = document.lineAt(lineNumber);
						const text = TableOfContents.getHeaderText(line.text)

						let slug = githubSlugifier.fromHeading(text);
						const existingSlugEntry = existingSlugEntries.get(slug.value);
						if (existingSlugEntry) {
							++existingSlugEntry.count;
							slug = githubSlugifier.fromHeading(slug.value + '-' + existingSlugEntry.count);
						} else {
							existingSlugEntries.set(slug.value, { count: 0 });
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
