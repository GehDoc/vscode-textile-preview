// From : https://github.com/microsoft/vscode-extension-samples/blob/master/helloworld-test-sample/src/test/runTest.ts
import * as path from 'path';

import { runTests } from 'vscode-test';

async function main() {
	try {
		// The folder containing the workspace root folder
		const workspaceRoot = path.relative(__dirname, '../../test-workspace')

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');

		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './');

		// Download VS Code, unzip it and run the integration test
		await runTests({ launchArgs: [workspaceRoot], extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error('Failed to run tests',err);
		process.exit(1);
	}
}

main();