/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ILogger } from './logging';
import { ITextileParser } from './textileEngine';
import { Token } from '../libs/textile-js/textile'; // Added for Textile
import { githubSlugifier, Slug, Slugifier } from './slugify';
import { ITextDocument } from './types/textDocument';
import { Disposable } from './util/dispose';
import { isTextileFile } from './util/file';
import { Schemes } from './util/schemes';
import { TextileDocumentInfoCache } from './util/workspaceCache';
import { ITextileWorkspace } from './workspace';

export interface TocEntry {
	readonly slug: Slug;
	readonly text: string;
	readonly level: number;
	readonly line: number;

	/**
	 * The entire range of the header section.
	 *
	* For the doc:
	 *
	 * ```md
	 * h1. Head
	 *
	 * text
	 * 
	 * h1. Next head
	 * ```
	 *
	 * This is the range from `h1. Head` to `h1. Next head`
	 */
	readonly sectionLocation: vscode.Location;

	/**
	 * The range of the header declaration.
	 *
	 * For the doc:
	 *
	 * ```md
	 * h1. Head
	 *
	 * text
	 * ```
	 *
	 * This is the range of `h1. Head`
	 */
	readonly headerLocation: vscode.Location;

	/**
	 * The range of the header text.
	 *
	 * For the doc:
	 *
	 * ```md
	 * h1. Head
	 *
	 * text
	 * ```
	 *
	 * This is the range of `Head`
	 */
	readonly headerTextLocation: vscode.Location;
}

export class TableOfContents {

	public static async create(parser: ITextileParser, document: ITextDocument,): Promise<TableOfContents> {
		const entries = await this.buildToc(parser, document);
		return new TableOfContents(entries, parser.slugifier);
	}

	public static async createForDocumentOrNotebook(parser: ITextileParser, document: ITextDocument): Promise<TableOfContents> {
		if (document.uri.scheme === Schemes.notebookCell) {
			const notebook = vscode.workspace.notebookDocuments
				.find(notebook => notebook.getCells().some(cell => cell.document === document));

			if (notebook) {
				return TableOfContents.createForNotebook(parser, notebook);
			}
		}

		return this.create(parser, document);
	}

	public static async createForNotebook(parser: ITextileParser, notebook: vscode.NotebookDocument): Promise<TableOfContents> {
		const entries: TocEntry[] = [];

		for (const cell of notebook.getCells()) {
			if (cell.kind === vscode.NotebookCellKind.Markup && isTextileFile(cell.document)) {
				entries.push(...(await this.buildToc(parser, cell.document)));
			}
		}
		return new TableOfContents(entries, parser.slugifier);
	}

	// -- Begin : modified for textile
	private static async buildToc(parser: ITextileParser, document: ITextDocument): Promise<TocEntry[]> {
		const toc: TocEntry[] = [];
		const tokens = await parser.tokenize(document);

		const existingSlugEntries = new Map<string, { count: number }>();
		const jsonmlUtils = await parser.jsonmlUtils();
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

						const headerLocation = new vscode.Location(document.uri,
							new vscode.Range(lineNumber, 0, lineNumber, line.text.length));

						const headerTextLocation = new vscode.Location(document.uri,
							new vscode.Range(lineNumber, line.text.match(/^\s*h[1-6]\.\s*/)?.[0].length ?? 0, lineNumber, line.text.length));

						toc.push({
							slug,
							text: text,
							level: level,
							line: lineNumber,
							sectionLocation: headerLocation, // Populated in next steps
							headerLocation,
							headerTextLocation
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
				sectionLocation: new vscode.Location(document.uri,
					new vscode.Range(
						entry.sectionLocation.range.start,
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

	public static readonly empty = new TableOfContents([], githubSlugifier);

	private constructor(
		public readonly entries: readonly TocEntry[],
		private readonly slugifier: Slugifier,
	) { }

	public lookup(fragment: string): TocEntry | undefined {
		const slug = this.slugifier.fromHeading(fragment);
		return this.entries.find(entry => entry.slug.equals(slug));
	}
	// -- End : modified for textile
}

export class TextileTableOfContentsProvider extends Disposable {

	private readonly _cache: TextileDocumentInfoCache<TableOfContents>;

	constructor(
		private readonly parser: ITextileParser,
		workspace: ITextileWorkspace,
		private readonly logger: ILogger,
	) {
		super();
		this._cache = this._register(new TextileDocumentInfoCache<TableOfContents>(workspace, doc => {
			this.logger.verbose('TableOfContentsProvider', `create - ${doc.uri}`);
			return TableOfContents.create(parser, doc);
		}));
	}

	public async get(resource: vscode.Uri): Promise<TableOfContents> {
		return await this._cache.get(resource) ?? TableOfContents.empty;
	}

	public getForDocument(doc: ITextDocument): Promise<TableOfContents> {
		return this._cache.getForDocument(doc);
	}

	public createForNotebook(notebook: vscode.NotebookDocument): Promise<TableOfContents> {
		return TableOfContents.createForNotebook(this.parser, notebook);
	}
}
