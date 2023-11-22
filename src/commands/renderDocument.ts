/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { TextileJSEngine } from '../textileEngine';
import { ITextDocument } from '../types/textDocument';

export class RenderDocument implements Command {
	public readonly id = 'textile.api.render';

	public constructor(
		private readonly engine: TextileJSEngine
	) { }

	public async execute(document: ITextDocument | string): Promise<string> {
		return (await (this.engine.render(document))).html;
	}
}
