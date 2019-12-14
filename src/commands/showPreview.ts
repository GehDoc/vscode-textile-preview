/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { Command } from '../commandManager';
import { TextilePreviewManager, DynamicPreviewSettings } from '../features/previewManager';
// disabled : import { TelemetryReporter } from '../telemetryReporter';

interface ShowPreviewSettings {
	readonly sideBySide?: boolean;
	readonly locked?: boolean;
}

async function showPreview(
	webviewManager: TextilePreviewManager,
	/* disabled : telemetryReporter: TelemetryReporter, */
	uri: vscode.Uri | undefined,
	previewSettings: ShowPreviewSettings,
): Promise<any> {
	let resource = uri;
	if (!(resource instanceof vscode.Uri)) {
		if (vscode.window.activeTextEditor) {
			// we are relaxed and don't check for textile files
			resource = vscode.window.activeTextEditor.document.uri;
		}
	}

	if (!(resource instanceof vscode.Uri)) {
		if (!vscode.window.activeTextEditor) {
			// this is most likely toggling the preview
			return vscode.commands.executeCommand('textile.showSource');
		}
		// nothing found that could be shown or toggled
		return;
	}

	const resourceColumn = (vscode.window.activeTextEditor && vscode.window.activeTextEditor.viewColumn) || vscode.ViewColumn.One;
	webviewManager.openDynamicPreview(resource, {
		resourceColumn: resourceColumn,
		previewColumn: previewSettings.sideBySide ? resourceColumn + 1 : resourceColumn,
		locked: !!previewSettings.locked
	});

	/* disabled :
	telemetryReporter.sendTelemetryEvent('openPreview', {
		where: previewSettings.sideBySide ? 'sideBySide' : 'inPlace',
		how: (uri instanceof vscode.Uri) ? 'action' : 'pallete'
	});
	*/
}

export class ShowPreviewCommand implements Command {
	public readonly id = 'textile.showPreview';

	public constructor(
		private readonly webviewManager: TextilePreviewManager
		/* disabled :
		private readonly telemetryReporter: TelemetryReporter
		*/
	) { }

	public execute(mainUri?: vscode.Uri, allUris?: vscode.Uri[], previewSettings?: DynamicPreviewSettings) {
		for (const uri of Array.isArray(allUris) ? allUris : [mainUri]) {
			showPreview(this.webviewManager, /* disabled : this.telemetryReporter, */ uri, {
				sideBySide: false,
				locked: previewSettings && previewSettings.locked
			});
		}
	}
}

export class ShowPreviewToSideCommand implements Command {
	public readonly id = 'textile.showPreviewToSide';

	public constructor(
		private readonly webviewManager: TextilePreviewManager
		/* disabled :
		private readonly telemetryReporter: TelemetryReporter
		*/
	) { }

	public execute(uri?: vscode.Uri, previewSettings?: DynamicPreviewSettings) {
		showPreview(this.webviewManager, /* disabled : this.telemetryReporter, */ uri, {
			sideBySide: true,
			locked: previewSettings && previewSettings.locked
		});
	}
}


export class ShowLockedPreviewToSideCommand implements Command {
	public readonly id = 'textile.showLockedPreviewToSide';

	public constructor(
		private readonly webviewManager: TextilePreviewManager
		/* disabled :
		private readonly telemetryReporter: TelemetryReporter
		*/
	) { }

	public execute(uri?: vscode.Uri) {
		showPreview(this.webviewManager, /* disabled : this.telemetryReporter, */ uri, {
			sideBySide: true,
			locked: true
		});
	}
}
