/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { TextileEngine } from '../textileEngine';
import { SkinnyTextDocument } from '../tableOfContentsProvider';

export class RenderDocument implements Command {
	public readonly id = 'textile.api.render';

	public constructor(
		private readonly engine: TextileEngine
	) { }

	public async execute(document: SkinnyTextDocument | string): Promise<string> {
		return (await (this.engine.render(document))).html;
	}
}
