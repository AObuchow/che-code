/**********************************************************************
 * Copyright (c) 2022 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

/* eslint-disable header/header */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

import * as fs from 'fs-extra';
import * as objects from '../src/objects';
import * as path from 'path';
import * as vscode from 'vscode';

import { SHOW_RESOURCES_INFORMATION_COMMAND, SHOW_WARNING_MESSAGE_COMMAND } from '../src/constants';

import { Container } from 'inversify';
import { K8sHelper, K8SRawResponse } from '../src/k8s-helper';
import { ResourceMonitor } from '../src/resource-monitor';

// import { ResMon } from '../src/resource-monitor-plugin';

describe('Test Resource Monitor Plugin', () => {
  let container: Container;
  const sendRawQueryMethod = jest.fn();
  const createStatusBar = jest.fn();
  process.env.HOSTNAME = 'workspace';

  const namespace = 'che-namespace';

  const uri: vscode.Uri = {
    authority: '',
    fragment: '',
    fsPath: '',
    path: '',
    query: '',
    scheme: '',
    toJSON: jest.fn(),
    toString: jest.fn(),
    with: jest.fn(),
  };
  const context: vscode.ExtensionContext = {
    environmentVariableCollection: {
      persistent: false,
      append: jest.fn(),
      clear: jest.fn(),
      delete: jest.fn(),
      forEach: jest.fn(),
      get: jest.fn(),
      prepend: jest.fn(),
      replace: jest.fn(),
    },
    secrets: {
      get: jest.fn(),
      delete: jest.fn(),
      store: jest.fn(),
      onDidChange: jest.fn(),
    },
    extensionPath: '',
    extensionUri: uri,
    logUri: uri,
    storageUri: uri,
    globalStorageUri: uri,
    globalState: {
      keys: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      setKeysForSync: jest.fn(),
    },
    globalStoragePath: '',
    logPath: '',
    storagePath: '',
    subscriptions: [],
    workspaceState: {
      keys: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
    },
    asAbsolutePath: jest.fn(),
    extensionMode: 3,
    extension: {
      id: '',
      extensionUri: uri,
      extensionPath: '',
      isActive: true,
      packageJSON: {},
      extensionKind: 2,
      exports: {},
      activate: jest.fn(),
    }    
  };

const statusBarItem: vscode.StatusBarItem = {
    id: '',
    name: '',
    backgroundColor: '',
    accessibilityInformation: undefined,
    alignment: 1,
    color: '',
    text: '',
    tooltip: '',
    command: '',
    priority: 0,
    dispose: jest.fn(),
    hide: jest.fn(),
    show: jest.fn(),
  };

  let coreApiMock;
  const mockListNamespacedPodMethod = jest.fn();

  beforeEach(() => {
    container = new Container();
    jest.restoreAllMocks();
    jest.resetAllMocks();

    coreApiMock = {
      listNamespacedPod: mockListNamespacedPodMethod,
    };
    const getCoreApiMethod = jest.fn();
    const k8sHelper = {
      getCoreApi: getCoreApiMethod,
      sendRawQuery: sendRawQueryMethod,
    } as any;
    getCoreApiMethod.mockReturnValue(coreApiMock);

    container.bind(ResourceMonitor).toSelf().inSingletonScope();
    container.bind(K8sHelper).toConstantValue(k8sHelper);

    // Prepare StatusBarItem
    vscode.window.createStatusBarItem = createStatusBar;
    createStatusBar.mockReturnValue(statusBarItem);
  });

  describe('show', () => {
    test('Read Pod and Metrics information', async () => {

      const resMonitor = container.get(ResourceMonitor);
      const requestMetricServer: K8SRawResponse = {
        data: '',
        error: '',
        statusCode: 200,
      };
      sendRawQueryMethod.mockReturnValueOnce(requestMetricServer);
      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [''],
        },
      });

      await resMonitor.show();

      expect(sendRawQueryMethod).toBeCalledTimes(1);
    });
  });

  describe('getContainersInfo', () => {
    test('Read Pod information', async () => {
      const json = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const resMonitor = container.get(ResourceMonitor);
      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(json)],
        },
      });

      const containers: objects.Container[] = await resMonitor.getContainersInfo();

      expect(containers.length).toBe(5);
      expect(containers[0]).toEqual({ name: 'che-jwtproxy7yc7hvrc', cpuLimit: 500, memoryLimit: 2000000000 });
      expect(containers[1]).toEqual({ name: 'maven', cpuLimit: 0, memoryLimit: 1000000000 });
      expect(containers[2]).toEqual({ name: 'vscode-javauil', cpuLimit: 0, memoryLimit: 200000 });
      expect(containers[3]).toEqual({ name: 'che-machine-exec122', cpuLimit: 5000, memoryLimit: 20000 });
      expect(containers[4]).toEqual({ name: 'theia-idewf0', cpuLimit: 0, memoryLimit: 536870912 });
    });
  });

  describe('getMetrics', () => {
    test('Read metrics information', async () => {
      const podJson = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const metricsJson = await fs.readFile(path.join(__dirname, '_data', 'podMetrics.json'), 'utf8');
      const metricsInfo: K8SRawResponse = {
        data: metricsJson,
        error: '',
        statusCode: 200,
      };
      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(podJson)],
        },
      });
      sendRawQueryMethod.mockReturnValue(metricsInfo);
      const resMonitor = container.get(ResourceMonitor);
      await resMonitor.getContainersInfo();
      const containers = await resMonitor.getMetrics();
      expect(containers.length).toBe(5);
      expect(containers[0]).toEqual({
        name: 'che-jwtproxy7yc7hvrc',
        cpuLimit: 500,
        memoryLimit: 2000000000,
        cpuUsed: 250,
        memoryUsed: 100000000,
      });
      expect(containers[1]).toEqual({
        name: 'maven',
        cpuLimit: 0,
        memoryLimit: 1000000000,
        cpuUsed: 100,
        memoryUsed: 153600000,
      });
      expect(containers[2]).toEqual({
        name: 'vscode-javauil',
        cpuLimit: 0,
        memoryLimit: 200000,
        cpuUsed: 20,
        memoryUsed: 100000,
      });
      expect(containers[3]).toEqual({
        name: 'che-machine-exec122',
        cpuLimit: 5000,
        memoryLimit: 20000,
        cpuUsed: 15,
        memoryUsed: 10,
      });
      expect(containers[4]).toEqual({
        name: 'theia-idewf0',
        cpuLimit: 0,
        memoryLimit: 536870912,
        cpuUsed: 10,
        memoryUsed: 5242880,
      });
      // Check status bar
      expect(statusBarItem.text).toBe('$(ellipsis) Mem: 0.26/3.54 GB 7% $(pulse) CPU: 395 m');
      expect(statusBarItem.color).toBe('#FFFFFF');
      expect(statusBarItem.tooltip).toBe('Workspace resources');
    });

    test('Cannot read metrics', async () => {
      const podJson = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const metricsInfo: K8SRawResponse = {
        data: 'Error from server (Forbidden)',
        error: 'Error from server (Forbidden)',
        statusCode: 403,
      };

      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(podJson)],
        },
      });
      sendRawQueryMethod.mockReturnValueOnce(metricsInfo);
      const resMonitor = container.get(ResourceMonitor);
      await resMonitor.getContainersInfo();
      await resMonitor.getMetrics();

      // Check status bar
      expect(statusBarItem.text).toBe('$(ban) Resources');
      expect(statusBarItem.color).toBe('#FFFFFF');
      expect(statusBarItem.tooltip).toBe('Resources Monitor');
    });

    test('Pod metrics are not ready (Metrics server returns 404)', async () => {
      const podJson = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const metricsInfo: K8SRawResponse = {
        data: 'No resource available',
        error: 'No resource available',
        statusCode: 404,
      };

      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(podJson)],
        },
      });
      sendRawQueryMethod.mockReturnValueOnce(metricsInfo);
      const resMonitor = container.get(ResourceMonitor);
      await resMonitor.getContainersInfo();
      await resMonitor.getMetrics();

      // Check status bar
      expect(statusBarItem.text).toBe('Waiting metrics...');
    });

    test('Status bar should be marked as warning with container information', async () => {
      const podJson = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const metricsJson = await fs.readFile(path.join(__dirname, '_data', 'limitedMemoryMetrics.json'), 'utf8');
      const metricsInfo: K8SRawResponse = {
        data: metricsJson,
        error: '',
        statusCode: 200,
      };

      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(podJson)],
        },
      });
      sendRawQueryMethod.mockReturnValueOnce(metricsInfo);
      const resMonitor = container.get(ResourceMonitor);
      await resMonitor.getContainersInfo();
      await resMonitor.getMetrics();

      // Check status bar
      expect(statusBarItem.text).toBe('$(ellipsis) Mem: 950/1000 MB 95% $(pulse) CPU: 100 m');
      expect(statusBarItem.color).toBe('#FFCC00');
      expect(statusBarItem.tooltip).toBe('maven container');
    });
  });

  describe('showDetailedInfo', () => {
    test('Show detailed infot in quick pick window', async () => {
      const podJson = await fs.readFile(path.join(__dirname, '_data', 'podInfo.json'), 'utf8');
      const metricsJson = await fs.readFile(path.join(__dirname, '_data', 'podMetrics.json'), 'utf8');
      const metricsInfo: K8SRawResponse = {
        data: metricsJson,
        error: '',
        statusCode: 200,
      };

      mockListNamespacedPodMethod.mockResolvedValue({
        body: {
          items: [JSON.parse(podJson)],
        },
      });
      sendRawQueryMethod.mockReturnValueOnce(metricsInfo);
      const resMonitor = container.get(ResourceMonitor);
      await resMonitor.getContainersInfo();
      await resMonitor.getMetrics();

      resMonitor.showDetailedInfo();

      const item1: vscode.QuickPickItem = {
        label: 'che-jwtproxy7yc7hvrc',
        detail: 'Mem (MB): 100 (Used) / 2000 (Limited) | CPU : 250m (Used) / 500m (Limited)',
      };
      const item2: vscode.QuickPickItem = {
        label: 'maven',
        detail: 'Mem (MB): 153 (Used) / 1000 (Limited) | CPU : 100m (Used) / not set (Limited)',
      };
      const item3: vscode.QuickPickItem = {
        label: 'vscode-javauil',
        detail: 'Mem (MB): 0 (Used) / 0 (Limited) | CPU : 20m (Used) / not set (Limited)',
      };
      const item4: vscode.QuickPickItem = {
        label: 'che-machine-exec122',
        detail: 'Mem (MB): 0 (Used) / 0 (Limited) | CPU : 15m (Used) / 5000m (Limited)',
      };
      const item5: vscode.QuickPickItem = {
        label: 'theia-idewf0',
        detail: 'Mem (MB): 5 (Used) / 536 (Limited) | CPU : 10m (Used) / not set (Limited)',
      };
      expect(vscode.window.showQuickPick).toHaveBeenCalledWith([item1, item2, item3, item4, item5], {});
    });
  });
  describe('start', () => {
    test('Resource Monitor initialization', async () => {
      const resMonitor = container.get(ResourceMonitor);
      const spyGetContainers = jest.spyOn(resMonitor, 'getContainersInfo');
      spyGetContainers.mockResolvedValue([]);

      const spyRequestMetricsServer = jest.spyOn(resMonitor, 'requestMetricsServer');
      spyRequestMetricsServer.mockResolvedValue(undefined);
      
      resMonitor.start(context, namespace);

      expect(vscode.commands.registerCommand).toHaveBeenCalledWith('resources-monitor-show-resources-information', expect.any(Function));
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(1);
      expect(statusBarItem.alignment).toBe(1);
      expect(statusBarItem.color).toBe('#FFFFFF');
      expect(statusBarItem.show).toHaveBeenCalledTimes(1);
      expect(statusBarItem.command).toBe(SHOW_RESOURCES_INFORMATION_COMMAND);
    });
  });

  describe('showWarningMessage', () => {
    test('Show warning notification with a message', async () => {
      const resMonitor = container.get(ResourceMonitor);

      resMonitor.showWarningMessage();

      expect(vscode.window.showWarningMessage).toBeCalledWith(expect.any(String));
    });
  });

  describe('requestMetricsServer', () => {
    test('Throw an exception if Metrics server is not available', async () => {
      const response: K8SRawResponse = {
        data: 'service unavailable',
        error: 'service unavailable',
        statusCode: 503,
      };

      const newContainer = new Container();
      newContainer.bind(ResourceMonitor).toSelf().inSingletonScope();
      const mockSendQueryMethod = jest.fn();
      const k8sHelper = {
        sendRawQuery: mockSendQueryMethod,
      } as any;
      mockSendQueryMethod.mockReturnValue(response);
      newContainer.bind(K8sHelper).toConstantValue(k8sHelper);

      const resMonitor = newContainer.get(ResourceMonitor);
      await expect(resMonitor.requestMetricsServer()).rejects.toThrow('Cannot connect to Metrics Server. Status code: 503. Error: service unavailable');
        expect(statusBarItem.text).toBe('$(ban) Resources');
        expect(statusBarItem.command).toBe(SHOW_WARNING_MESSAGE_COMMAND);
      expect(mockSendQueryMethod).toBeCalledTimes(1);
      expect(mockSendQueryMethod).toBeCalledWith('/apis/metrics.k8s.io/v1beta1/', {
        url: '/apis/metrics.k8s.io/v1beta1/',
      });
    });

  });
});
