/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as nls from 'vscode-nls';
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone, locale: vscode.env.language })();

import { CommandManager } from './commandManager';
import * as commands from './commands/index';
// FIXME: import { registerPasteSupport } from './languageFeatures/copyPaste';
import { registerDefinitionSupport } from './languageFeatures/definitions';
import { registerDiagnosticSupport } from './languageFeatures/diagnostics';
import { TextileLinkProvider, registerDocumentLinkSupport } from './languageFeatures/documentLinks';
import { TextileDocumentSymbolProvider, registerDocumentSymbolSupport } from './languageFeatures/documentSymbols';
// FIXME: import { registerDropIntoEditorSupport } from './languageFeatures/dropIntoEditor';
import { registerFindFileReferenceSupport } from './languageFeatures/fileReferences';
import { registerFoldingSupport } from './languageFeatures/folding';
import { registerPathCompletionSupport } from './languageFeatures/pathCompletions';
import { TextileReferencesProvider, registerReferencesSupport } from './languageFeatures/references';
import { registerRenameSupport } from './languageFeatures/rename';
// FIXME: import { registerSmartSelectSupport } from './languageFeatures/smartSelect';
import { registerWorkspaceSymbolSupport } from './languageFeatures/workspaceSymbols';
import { ILogger, VsCodeOutputLogger } from './logging';
import { ITextileParser, TextileJSEngine, TextileParsingProvider } from './textileEngine';
import { getTextileExtensionContributions } from './textileExtensions';
import { TextileDocumentRenderer } from './preview/documentRenderer';
import { TextilePreviewManager } from './preview/previewManager';
import { ContentSecurityPolicyArbiter, ExtensionContentSecurityPolicyArbiter, PreviewSecuritySelector } from './preview/security';
import { githubSlugifier } from './slugify';
import { TextileTableOfContentsProvider } from './tableOfContents';
//import { loadDefaultTelemetryReporter, TelemetryReporter } from './telemetryReporter';
import { ITextileWorkspace, VsCodeTextileWorkspace } from './workspace';


export function activate(context: vscode.ExtensionContext) {
	/* Disabled for textile
	const telemetryReporter = loadDefaultTelemetryReporter();
	context.subscriptions.push(telemetryReporter);
	*/

	const contributions = getTextileExtensionContributions(context);
	context.subscriptions.push(contributions);

	const logger = new VsCodeOutputLogger();
	context.subscriptions.push(logger);

	const cspArbiter = new ExtensionContentSecurityPolicyArbiter(context.globalState, context.workspaceState);
	const commandManager = new CommandManager();

	const engine = new TextileJSEngine(contributions, githubSlugifier, logger);
	const workspace = new VsCodeTextileWorkspace();
	const parser = new TextileParsingProvider(engine, workspace);
	const tocProvider = new TextileTableOfContentsProvider(parser, workspace, logger);
	context.subscriptions.push(workspace, parser, tocProvider);

	const contentProvider = new TextileDocumentRenderer(engine, context, cspArbiter, contributions, logger);
	const previewManager = new TextilePreviewManager(contentProvider, workspace, logger, contributions, tocProvider);
	context.subscriptions.push(previewManager);

	context.subscriptions.push(registerTextileLanguageFeatures(parser, workspace, commandManager, tocProvider, logger));
	context.subscriptions.push(registerTextileCommands(commandManager, previewManager, /* Disabled for textile : telemetryReporter, */ cspArbiter, engine, tocProvider));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
		previewManager.updateConfiguration();
	}));
}

function registerTextileLanguageFeatures(
	parser: ITextileParser,
	workspace: ITextileWorkspace,
	commandManager: CommandManager,
	tocProvider: TextileTableOfContentsProvider,
	logger: ILogger,
): vscode.Disposable {
	const selector: vscode.DocumentSelector = { language: 'textile', scheme: '*' };

	const linkProvider = new TextileLinkProvider(parser, workspace, logger);
	const referencesProvider = new TextileReferencesProvider(parser, workspace, tocProvider, logger);
	const symbolProvider = new TextileDocumentSymbolProvider(tocProvider, logger);

	return vscode.Disposable.from(
		linkProvider,
		referencesProvider,

		// Language features
		registerDefinitionSupport(selector, referencesProvider),
		registerDiagnosticSupport(selector, workspace, linkProvider, commandManager, referencesProvider, tocProvider, logger),
		registerDocumentLinkSupport(selector, linkProvider),
		registerDocumentSymbolSupport(selector, tocProvider, logger),
		// FIXME : registerDropIntoEditorSupport(selector),
		registerFindFileReferenceSupport(commandManager, referencesProvider),
		registerFoldingSupport(selector, parser, tocProvider),
		// FIXME : registerPasteSupport(selector),
		registerPathCompletionSupport(selector, workspace, parser, linkProvider),
		registerReferencesSupport(selector, referencesProvider),
		registerRenameSupport(selector, workspace, referencesProvider, parser.slugifier),
		// FIXME : registerSmartSelectSupport(selector, parser, tocProvider),
		registerWorkspaceSymbolSupport(workspace, symbolProvider),
	);
}

function registerTextileCommands(
	commandManager: CommandManager,
	previewManager: TextilePreviewManager,
	// Disabled for textile : telemetryReporter: TelemetryReporter,
	cspArbiter: ContentSecurityPolicyArbiter,
	engine: TextileJSEngine,
	tocProvider: TextileTableOfContentsProvider,
): vscode.Disposable {
	const previewSecuritySelector = new PreviewSecuritySelector(cspArbiter, previewManager);

	commandManager.register(new commands.ShowPreviewCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowPreviewToSideCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowLockedPreviewToSideCommand(previewManager /* Disabled for textile : , telemetryReporter */));
	commandManager.register(new commands.ShowSourceCommand(previewManager));
	commandManager.register(new commands.RefreshPreviewCommand(previewManager, engine));
	commandManager.register(new commands.MoveCursorToPositionCommand());
	commandManager.register(new commands.ShowPreviewSecuritySelectorCommand(previewSecuritySelector, previewManager));
	commandManager.register(new commands.OpenDocumentLinkCommand(tocProvider));
	commandManager.register(new commands.ToggleLockCommand(previewManager));
	commandManager.register(new commands.RenderDocument(engine));
	commandManager.register(new commands.ReloadPlugins(previewManager, engine));
	return commandManager;
}
