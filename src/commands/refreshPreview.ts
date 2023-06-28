/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { TextileEngine } from '../textileEngine';
import { TextilePreviewManager } from '../preview/previewManager';

export class RefreshPreviewCommand implements Command {
	public readonly id = 'textile.preview.refresh';

	public constructor(
		private readonly webviewManager: TextilePreviewManager,
		private readonly engine: TextileEngine
	) { }

	public execute() {
		this.engine.cleanCache();
		this.webviewManager.refresh();
	}
}
