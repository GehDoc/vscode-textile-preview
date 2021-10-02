/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { TextilePreviewManager } from '../features/previewManager';
import { TextileEngine } from '../textileEngine';

export class ReloadPlugins implements Command {
	public readonly id = 'textile.api.reloadPlugins';

	public constructor(
		private readonly webviewManager: TextilePreviewManager,
		private readonly engine: TextileEngine,
	) { }

	public execute(): void {
		this.engine.reloadPlugins();
		this.engine.cleanCache();
		this.webviewManager.refresh();
	}
}
