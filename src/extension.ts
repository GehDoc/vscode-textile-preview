/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as nls from 'vscode-nls';
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();

import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import LinkProvider from './features/documentLinkProvider';
import TextileDocumentSymbolProvider from './features/documentSymbolProvider';
import TextileFoldingProvider from './features/foldingProvider';
import { TextileContentProvider } from './features/previewContentProvider';
import { TextilePreviewManager } from './features/previewManager';
import TextileWorkspaceSymbolProvider from './features/workspaceSymbolProvider';
import { Logger } from './logger';
import { TextileEngine } from './textileEngine';
import { getTextileExtensionContributions } from './textileExtensions';
import { ExtensionContentSecurityPolicyArbiter, PreviewSecuritySelector, ContentSecurityPolicyArbiter } from './security';
//import { loadDefaultTelemetryReporter, TelemetryReporter } from './telemetryReporter';
import { githubSlugifier } from './slugify';


export function activate(context: vscode.ExtensionContext) {
	/* Disabled for textile
	const telemetryReporter = loadDefaultTelemetryReporter();
	context.subscriptions.push(telemetryReporter);
	*/

	const contributions = getTextileExtensionContributions(context);
	context.subscriptions.push(contributions);

	const cspArbiter = new ExtensionContentSecurityPolicyArbiter(context.globalState, context.workspaceState);
	const engine = new TextileEngine(contributions, githubSlugifier);
	const logger = new Logger();

	const contentProvider = new TextileContentProvider(engine, context, cspArbiter, contributions, logger);
	const symbolProvider = new TextileDocumentSymbolProvider(engine);
	const previewManager = new TextilePreviewManager(contentProvider, logger, contributions);
	context.subscriptions.push(previewManager);

	context.subscriptions.push(registerTextileLanguageFeatures(symbolProvider, engine));
	context.subscriptions.push(registerTextileCommands(previewManager, /* Disabled for textile : telemetryReporter, */ cspArbiter, engine));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
		logger.updateConfiguration();
		previewManager.updateConfiguration();
	}));
}

function registerTextileLanguageFeatures(
	symbolProvider: TextileDocumentSymbolProvider,
	engine: TextileEngine
): vscode.Disposable {
	const selector: vscode.DocumentSelector = { language: 'textile', scheme: '*' };

	const charPattern = '(\\p{Alphabetic}|\\p{Number}|\\p{Nonspacing_Mark})';

	return vscode.Disposable.from(
		vscode.languages.setLanguageConfiguration('textile', {
			wordPattern: new RegExp(`${charPattern}((${charPattern}|[_])?${charPattern})*`, 'ug'),
		}),
		vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider),
		vscode.languages.registerDocumentLinkProvider(selector, new LinkProvider()),
		vscode.languages.registerFoldingRangeProvider(selector, new TextileFoldingProvider(engine)),
		vscode.languages.registerWorkspaceSymbolProvider(new TextileWorkspaceSymbolProvider(symbolProvider))
	);
}

function registerTextileCommands(
	previewManager: TextilePreviewManager,
	// Disabled for textile : telemetryReporter: TelemetryReporter,
	cspArbiter: ContentSecurityPolicyArbiter,
	engine: TextileEngine
): vscode.Disposable {
	const previewSecuritySelector = new PreviewSecuritySelector(cspArbiter, previewManager);

	const commandManager = new CommandManager();
	commandManager.register(new commands.ShowPreviewCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowPreviewToSideCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowLockedPreviewToSideCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowSourceCommand(previewManager));
	commandManager.register(new commands.RefreshPreviewCommand(previewManager, engine));
	commandManager.register(new commands.MoveCursorToPositionCommand());
	commandManager.register(new commands.ShowPreviewSecuritySelectorCommand(previewSecuritySelector, previewManager));
	commandManager.register(new commands.OpenDocumentLinkCommand(engine));
	commandManager.register(new commands.ToggleLockCommand(previewManager));
	commandManager.register(new commands.RenderDocument(engine));
	return commandManager;
}

