/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from 'vs/base/common/network';
import { joinPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { generateUuid } from 'vs/base/common/uuid';
import { BACKUPS, IExtensionHostDebugParams } from 'vs/platform/environment/common/environment';
import { IPath, IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWorkbenchConstructionOptions } from 'vs/workbench/workbench.web.api';
import product from 'vs/platform/product/common/product';
import { memoize } from 'vs/base/common/decorators';

export class BrowserWindowConfiguration implements IWindowConfiguration {

	constructor(
		private readonly options: IBrowserWorkbenchEnvironmentConstructionOptions,
		private readonly payload: Map<string, string> | undefined,
		private readonly environment: IWorkbenchEnvironmentService
	) { }

	@memoize
	get sessionId(): string { return generateUuid(); }

	@memoize
	get remoteAuthority(): string | undefined { return this.options.remoteAuthority; }

	@memoize
	get connectionToken(): string | undefined { return this.options.connectionToken || this.getCookieValue('vscode-tkn'); }

	@memoize
	get backupWorkspaceResource(): URI { return joinPath(this.environment.backupHome, this.options.workspaceId); }

	@memoize
	get filesToOpenOrCreate(): IPath[] | undefined {
		if (this.payload) {
			const fileToOpen = this.payload.get('openFile');
			if (fileToOpen) {
				return [{ fileUri: URI.parse(fileToOpen) }];
			}
		}

		return undefined;
	}

	// Currently unsupported in web but should look into support
	get filesToDiff(): IPath[] | undefined { return undefined; }
	highContrast = false;
	_ = [];

	private getCookieValue(name: string): string | undefined {
		const m = document.cookie.match('(^|[^;]+)\\s*' + name + '\\s*=\\s*([^;]+)'); // See https://stackoverflow.com/a/25490531

		return m ? m.pop() : undefined;
	}
}

interface IBrowserWorkbenchEnvironmentConstructionOptions extends IWorkbenchConstructionOptions {
	workspaceId: string;
	logsPath: URI;
}

interface IExtensionHostDebugEnvironment {
	params: IExtensionHostDebugParams;
	isExtensionDevelopment: boolean;
	extensionDevelopmentLocationURI?: URI[];
	extensionTestsLocationURI?: URI;
	extensionEnabledProposedApi?: string[];
}

export class BrowserWorkbenchEnvironmentService implements IWorkbenchEnvironmentService {

	_serviceBrand: undefined;

	private _configuration: IWindowConfiguration | undefined = undefined;
	get configuration(): IWindowConfiguration {
		if (!this._configuration) {
			this._configuration = new BrowserWindowConfiguration(this.options, this.payload, this);
		}

		return this._configuration;
	}

	@memoize
	get isBuilt(): boolean { return !!product.commit; }

	@memoize
	get logsPath(): string { return this.options.logsPath.path; }

	@memoize
	get logFile(): URI { return joinPath(this.options.logsPath, 'window.log'); }

	@memoize
	get userRoamingDataHome(): URI { return URI.file('/User').with({ scheme: Schemas.userData }); }

	@memoize
	get settingsResource(): URI { return joinPath(this.userRoamingDataHome, 'settings.json'); }

	@memoize
	get argvResource(): URI { return joinPath(this.userRoamingDataHome, 'argv.json'); }

	@memoize
	get snippetsHome(): URI { return joinPath(this.userRoamingDataHome, 'snippets'); }

	@memoize
	get userDataSyncHome(): URI { return joinPath(this.userRoamingDataHome, 'sync'); }

	@memoize
	get userDataSyncLogResource(): URI { return joinPath(this.options.logsPath, 'userDataSync.log'); }

	@memoize
	get keybindingsResource(): URI { return joinPath(this.userRoamingDataHome, 'keybindings.json'); }

	@memoize
	get keyboardLayoutResource(): URI { return joinPath(this.userRoamingDataHome, 'keyboardLayout.json'); }

	@memoize
	get backupHome(): URI { return joinPath(this.userRoamingDataHome, BACKUPS); }

	@memoize
	get untitledWorkspacesHome(): URI { return joinPath(this.userRoamingDataHome, 'Workspaces'); }

	private _extensionHostDebugEnvironment: IExtensionHostDebugEnvironment | undefined = undefined;
	get debugExtensionHost(): IExtensionHostDebugParams {
		if (!this._extensionHostDebugEnvironment) {
			this._extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
		}

		return this._extensionHostDebugEnvironment.params;
	}

	get isExtensionDevelopment(): boolean {
		if (!this._extensionHostDebugEnvironment) {
			this._extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
		}

		return this._extensionHostDebugEnvironment.isExtensionDevelopment;
	}

	get extensionDevelopmentLocationURI(): URI[] | undefined {
		if (!this._extensionHostDebugEnvironment) {
			this._extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
		}

		return this._extensionHostDebugEnvironment.extensionDevelopmentLocationURI;
	}

	get extensionTestsLocationURI(): URI | undefined {
		if (!this._extensionHostDebugEnvironment) {
			this._extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
		}

		return this._extensionHostDebugEnvironment.extensionTestsLocationURI;
	}

	get extensionEnabledProposedApi(): string[] | undefined {
		if (!this._extensionHostDebugEnvironment) {
			this._extensionHostDebugEnvironment = this.resolveExtensionHostDebugEnvironment();
		}

		return this._extensionHostDebugEnvironment.extensionEnabledProposedApi;
	}

	@memoize
	get webviewExternalEndpoint(): string {
		// TODO: get fallback from product.json
		return (this.options.webviewEndpoint || 'https://{{uuid}}.vscode-webview-test.com/{{commit}}').replace('{{commit}}', product.commit || '0d728c31ebdf03869d2687d9be0b017667c9ff37');
	}

	@memoize
	get webviewResourceRoot(): string {
		return `${this.webviewExternalEndpoint}/vscode-resource/{{resource}}`;
	}

	@memoize
	get webviewCspSource(): string {
		return this.webviewExternalEndpoint.replace('{{uuid}}', '*');
	}

	// Currently unsupported in web but should look into support
	get disableExtensions() { return false; }
	get extensionsPath(): string | undefined { return undefined; }
	get verbose(): boolean { return false; }
	get disableUpdates(): boolean { return false; }
	get logExtensionHostCommunication(): boolean { return false; }
	galleryMachineIdResource?: URI;

	private payload: Map<string, string> | undefined;

	constructor(readonly options: IBrowserWorkbenchEnvironmentConstructionOptions) {
		if (options.workspaceProvider && Array.isArray(options.workspaceProvider.payload)) {
			this.payload = new Map(options.workspaceProvider.payload);
		}
	}

	private resolveExtensionHostDebugEnvironment(): IExtensionHostDebugEnvironment {
		const extensionHostDebugEnvironment: IExtensionHostDebugEnvironment = {
			params: {
				port: null,
				break: false
			},
			isExtensionDevelopment: false,
			extensionDevelopmentLocationURI: undefined
		};

		// Fill in selected extra environmental properties
		if (this.payload) {
			for (const [key, value] of this.payload) {
				switch (key) {
					case 'extensionDevelopmentPath':
						extensionHostDebugEnvironment.extensionDevelopmentLocationURI = [URI.parse(value)];
						extensionHostDebugEnvironment.isExtensionDevelopment = true;
						break;
					case 'extensionTestsPath':
						extensionHostDebugEnvironment.extensionTestsLocationURI = URI.parse(value);
						break;
					case 'debugId':
						extensionHostDebugEnvironment.params.debugId = value;
						break;
					case 'inspect-brk-extensions':
						extensionHostDebugEnvironment.params.port = parseInt(value);
						extensionHostDebugEnvironment.params.break = true;
						break;
					case 'enableProposedApi':
						extensionHostDebugEnvironment.extensionEnabledProposedApi = [];
						break;
				}
			}
		}

		return extensionHostDebugEnvironment;
	}

	//#region TODO MOVE TO NODE LAYER

	args = { _: [] };

	mainIPCHandle!: string;
	sharedIPCHandle!: string;

	nodeCachedDataDir?: string;

	driverHandle?: string;
	driverVerbose!: boolean;

	installSourcePath!: string;

	builtinExtensionsPath!: string;

	globalStorageHome!: string;
	workspaceStorageHome!: string;

	backupWorkspacesPath!: string;

	machineSettingsResource!: URI;

	userHome!: string;
	userDataPath!: string;
	appRoot!: string;
	appSettingsHome!: URI;
	execPath!: string;

	//#endregion
}
