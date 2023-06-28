/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from '../commandManager';
import { TextilePreviewManager } from '../preview/previewManager';

export class ToggleLockCommand implements Command {
	public readonly id = 'textile.preview.toggleLock';

	public constructor(
		private readonly previewManager: TextilePreviewManager
	) { }

	public execute() {
		this.previewManager.toggleLock();
	}
}
