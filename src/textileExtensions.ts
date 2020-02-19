/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { Disposable } from './util/dispose';
import * as arrays from './util/arrays';

const resolveExtensionResource = (extension: vscode.Extension<any>, resourcePath: string): vscode.Uri => {
	return vscode.Uri.file(path.join(extension.extensionPath, resourcePath));
};

const resolveExtensionResources = (extension: vscode.Extension<any>, resourcePaths: unknown): vscode.Uri[] => {
	const result: vscode.Uri[] = [];
	if (Array.isArray(resourcePaths)) {
		for (const resource of resourcePaths) {
			try {
				result.push(resolveExtensionResource(extension, resource));
			} catch (e) {
				// noop
			}
		}
	}
	return result;
};

export interface TextileContributions {
	readonly previewScripts: ReadonlyArray<vscode.Uri>;
	readonly previewStyles: ReadonlyArray<vscode.Uri>;
	readonly previewResourceRoots: ReadonlyArray<vscode.Uri>;
	readonly textileItPlugins: Map<string, Thenable<(md: any) => any>>;
}

export namespace TextileContributions {
	export const Empty: TextileContributions = {
		previewScripts: [],
		previewStyles: [],
		previewResourceRoots: [],
		textileItPlugins: new Map()
	};

	export function merge(a: TextileContributions, b: TextileContributions): TextileContributions {
		return {
			previewScripts: [...a.previewScripts, ...b.previewScripts],
			previewStyles: [...a.previewStyles, ...b.previewStyles],
			previewResourceRoots: [...a.previewResourceRoots, ...b.previewResourceRoots],
			textileItPlugins: new Map([...a.textileItPlugins.entries(), ...b.textileItPlugins.entries()]),
		};
	}

	function uriEqual(a: vscode.Uri, b: vscode.Uri): boolean {
		return a.toString() === b.toString();
	}

	export function equal(a: TextileContributions, b: TextileContributions): boolean {
		return arrays.equals(a.previewScripts, b.previewScripts, uriEqual)
			&& arrays.equals(a.previewStyles, b.previewStyles, uriEqual)
			&& arrays.equals(a.previewResourceRoots, b.previewResourceRoots, uriEqual)
			&& arrays.equals(Array.from(a.textileItPlugins.keys()), Array.from(b.textileItPlugins.keys()));
	}

	export function fromExtension(
		extension: vscode.Extension<any>
	): TextileContributions {
		const contributions = extension.packageJSON && extension.packageJSON.contributes;
		if (!contributions) {
			return TextileContributions.Empty;
		}

		const previewStyles = getContributedStyles(contributions, extension);
		const previewScripts = getContributedScripts(contributions, extension);
		const previewResourceRoots = previewStyles.length || previewScripts.length ? [vscode.Uri.file(extension.extensionPath)] : [];
		const textileItPlugins = getContributedTextileJSPlugins(contributions, extension);

		return {
			previewScripts,
			previewStyles,
			previewResourceRoots,
			textileItPlugins
		};
	}

	function getContributedTextileJSPlugins(
		contributes: any,
		extension: vscode.Extension<any>
	): Map<string, Thenable<(md: any) => any>> {
		const map = new Map<string, Thenable<(md: any) => any>>();
		if (contributes['textile.textileItPlugins']) {
			map.set(extension.id, extension.activate().then(() => {
				if (extension.exports && extension.exports.extendTextileJS) {
					return (md: any) => extension.exports.extendTextileJS(md);
				}
				return (md: any) => md;
			}));
		}
		return map;
	}

	function getContributedScripts(
		contributes: any,
		extension: vscode.Extension<any>
	) {
		return resolveExtensionResources(extension, contributes['textile.previewScripts']);
	}

	function getContributedStyles(
		contributes: any,
		extension: vscode.Extension<any>
	) {
		return resolveExtensionResources(extension, contributes['textile.previewStyles']);
	}
}

export interface TextileContributionProvider {
	readonly extensionPath: string;
	readonly contributions: TextileContributions;
	readonly onContributionsChanged: vscode.Event<this>;

	dispose(): void;
}

class VSCodeExtensionTextileContributionProvider extends Disposable implements TextileContributionProvider {
	private _contributions?: TextileContributions;

	public constructor(
		public readonly extensionPath: string,
	) {
		super();

		vscode.extensions.onDidChange(() => {
			const currentContributions = this.getCurrentContributions();
			const existingContributions = this._contributions || TextileContributions.Empty;
			if (!TextileContributions.equal(existingContributions, currentContributions)) {
				this._contributions = currentContributions;
				this._onContributionsChanged.fire(this);
			}
		}, undefined, this._disposables);
	}

	private readonly _onContributionsChanged = this._register(new vscode.EventEmitter<this>());
	public readonly onContributionsChanged = this._onContributionsChanged.event;

	public get contributions(): TextileContributions {
		if (!this._contributions) {
			this._contributions = this.getCurrentContributions();
		}
		return this._contributions;
	}

	private getCurrentContributions(): TextileContributions {
		return vscode.extensions.all
			.map(TextileContributions.fromExtension)
			.reduce(TextileContributions.merge, TextileContributions.Empty);
	}
}

export function getTextileExtensionContributions(context: vscode.ExtensionContext): TextileContributionProvider {
	return new VSCodeExtensionTextileContributionProvider(context.extensionPath);
}
