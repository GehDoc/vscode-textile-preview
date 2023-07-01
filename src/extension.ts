/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as nls from 'vscode-nls';
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone, locale: vscode.env.language })();

import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import { TextileLinkProvider } from './languageFeatures/documentLinkProvider';
import { TextileDocumentSymbolProvider } from './languageFeatures/documentSymbolProvider';
// FIXME: import { registerDropIntoEditor } from './features/dropIntoEditor';
import { registerFindFileReferences } from './languageFeatures/fileReferences';
import { TextileFoldingProvider } from './languageFeatures/foldingProvider';
import { TextilePathCompletionProvider } from './languageFeatures/pathCompletions';
import { TextileReferencesProvider } from './languageFeatures/references';
// FIXME: import { TextileRenameProvider } from './languageFeatures/rename';
// FIXME: import TextileSmartSelect from './features/smartSelect';
import { TextileWorkspaceSymbolProvider } from './languageFeatures/workspaceSymbolProvider';
import { Logger } from './logger';
import { TextileEngine } from './textileEngine';
import { getTextileExtensionContributions } from './textileExtensions';
import { TextileContentProvider } from './preview/previewContentProvider';
import { TextilePreviewManager } from './preview/previewManager';
import { ContentSecurityPolicyArbiter, ExtensionContentSecurityPolicyArbiter, PreviewSecuritySelector } from './preview/security';
import { githubSlugifier } from './slugify';
// import { loadDefaultTelemetryReporter, TelemetryReporter } from './telemetryReporter';
import { VsCodeTextileWorkspaceContents } from './workspaceContents';


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
	const commandManager = new CommandManager();

	const contentProvider = new TextileContentProvider(engine, context, cspArbiter, contributions, logger);
	const symbolProvider = new TextileDocumentSymbolProvider(engine);
	const previewManager = new TextilePreviewManager(contentProvider, logger, contributions, engine);
	context.subscriptions.push(previewManager);

	context.subscriptions.push(registerTextileLanguageFeatures(commandManager, symbolProvider, engine));
	context.subscriptions.push(registerTextileCommands(commandManager, previewManager, /* Disabled for textile : telemetryReporter, */ cspArbiter, engine));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
		logger.updateConfiguration();
		previewManager.updateConfiguration();
	}));
}

function registerTextileLanguageFeatures(
	commandManager: CommandManager,
	symbolProvider: TextileDocumentSymbolProvider,
	engine: TextileEngine
): vscode.Disposable {
	const selector: vscode.DocumentSelector = { language: 'textile', scheme: '*' };

	const linkProvider = new TextileLinkProvider(engine);
	const workspaceContents = new VsCodeTextileWorkspaceContents();

	const referencesProvider = new TextileReferencesProvider(linkProvider, workspaceContents, engine, githubSlugifier);
	return vscode.Disposable.from(
		vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider),
		vscode.languages.registerDocumentLinkProvider(selector, linkProvider),
		vscode.languages.registerFoldingRangeProvider(selector, new TextileFoldingProvider(engine)),
		// FIXME: vscode.languages.registerSelectionRangeProvider(selector, new TextileSmartSelect(engine)),
		vscode.languages.registerWorkspaceSymbolProvider(new TextileWorkspaceSymbolProvider(symbolProvider, workspaceContents)),
		vscode.languages.registerReferenceProvider(selector, referencesProvider),
		// FIXME: vscode.languages.registerRenameProvider(selector, new TextileRenameProvider(referencesProvider, workspaceContents, githubSlugifier)),
		TextilePathCompletionProvider.register(selector, engine, linkProvider),
		// FIXME : registerDropIntoEditor(selector),
		registerFindFileReferences(commandManager, referencesProvider),
	);
}

function registerTextileCommands(
	commandManager: CommandManager,
	previewManager: TextilePreviewManager,
	// Disabled for textile : telemetryReporter: TelemetryReporter,
	cspArbiter: ContentSecurityPolicyArbiter,
	engine: TextileEngine
): vscode.Disposable {
	const previewSecuritySelector = new PreviewSecuritySelector(cspArbiter, previewManager);

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
	commandManager.register(new commands.ReloadPlugins(previewManager, engine));
	return commandManager;
}

