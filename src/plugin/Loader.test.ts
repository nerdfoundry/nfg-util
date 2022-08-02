import * as fs from 'fs';
import { PluginType, type PluginManifest } from './Base';
import DependencyManager from './DependencyManager';
import PluginHost from './Host';
import PluginLoader from './Loader';
import LoaderHelper from './LoaderHelper';

expect.addSnapshotSerializer({
  test: val => typeof val === 'string',
  print: val => (val as string).replace(/\\/g, '/')
});

jest.mock('fs');

jest.mock('../core/Logger', () => {
  const Mock: any = jest.fn();
  // const Mock: any = console.log;
  // Mock.extend = msg => {
  //   const prevExtend = Mock.extend;
  //   const extended = Mock.bind(console, msg, '->');
  //   extended.extend = prevExtend;
  //   return extended;
  // };

  Mock.extend = jest.fn().mockReturnValue(Mock);

  return Mock;
});

jest.mock('./Host', () => {
  const Mock = {
    setOption: jest.fn()
  };

  return jest.fn(() => Mock);
});

jest.mock('./DependencyManager', () => {
  const Mock = {
    loadPluginDefinitions: jest.fn().mockReturnValue(Promise.resolve('depManagerLoaded'))
  };

  return jest.fn(() => Mock);
});

jest.mock('./LoaderHelper', () => {
  const Mock = {
    resolve: jest.fn(),
    cache: {}
  };

  return Mock;
});

jest.mock(
  'fakePlugin',
  () => {
    const MockInstance = {
      enable: () => {
        MockInstance.enabled = true;
        return Promise.resolve();
      },
      enabled: false
    };

    const Mock: any = {
      default: jest.fn(() => MockInstance)
    };

    return Mock;
  },
  { virtual: true }
);

jest.mock(
  'fakePluginInvalid',
  () => {
    const MockInstance = {
      enable: () => {
        MockInstance.enabled = true;
        return Promise.resolve();
      },
      enabled: false
    };

    const Mock: any = {
      default: jest.fn(() => MockInstance)
    };

    return Mock;
  },
  { virtual: true }
);

jest.mock(
  'fakePluginBroken',
  () => {
    const MockInstance = {
      enable: () => {
        MockInstance.enabled = true;
        return Promise.resolve();
      },
      enabled: false
    };

    const Mock: any = {
      default: jest.fn(() => MockInstance)
    };

    return Mock;
  },
  { virtual: true }
);

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let host: PluginHost;
  let depMgr: DependencyManager;

  let manifest: PluginManifest;

  beforeEach(() => {
    loader = new PluginLoader({ pluginPaths: ['fakePluginPath'], pluginTypes: [PluginType.SERVICE] });
    host = new PluginHost();
    depMgr = new DependencyManager(host);

    manifest = {
      accessors: { plug2: 'plugin2-behaviour' },
      behaviours: ['plugin1-behaviour', 'common1'],
      name: 'Plugin1',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    jest.spyOn(console, 'log').mockImplementation(jest.fn());
  });

  describe('Plugin Loading', () => {
    it('should unload invalid plugins from memory', () => {
      jest
        .spyOn(LoaderHelper, 'resolve')
        .mockReturnValueOnce('fakePluginInvalid')
        .mockReturnValueOnce('fakePluginInvalid2');

      LoaderHelper.cache['fakePluginInvalid'] = { children: [{ filename: 'fakePluginInvalid', children: [] }] } as any;
      LoaderHelper.cache['fakePluginInvalid2'] = { children: [] } as any;

      loader.unloadModule('fakePluginInvalid', '');

      expect(LoaderHelper.cache).not.toHaveProperty('fakePluginInvalid');
    });

    it('should skip unloading Plugins outside of the namespace', () => {
      LoaderHelper.cache['fakePluginInvalid'] = { children: [] } as any;

      loader.unloadModule('fakePluginInvalid', 'basePath');

      expect(LoaderHelper.cache).toHaveProperty('fakePluginInvalid');
    });
  });

  describe('Plugin Scanning', () => {
    it('should return properly found Plugins in a Directory', async () => {
      jest
        .spyOn(fs, 'readdir')
        .mockImplementationOnce((path, _opts, cb) => {
          return cb(null, ['file1', 'file2', 'package.json'] as any);
        })
        .mockImplementationOnce((path, _opts, cb) => {
          return cb(null, ['file3', 'file4', 'package.json'] as any);
        });

      jest.spyOn(fs, 'readFile').mockImplementation((_path, cb) => {
        return cb(null, Buffer.from('{ "MANIFEST": { "type": "SERVICE" }, "name":"FakePlugin", "version": "1.0.0" }'));
      });

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toMatchSnapshot();
      await expect(loader.findPluginManifest('jsPluginDir')).resolves.toMatchSnapshot();
      // Default response doesn't have a plugin file
      await expect(loader.findPluginManifest('noPluginPath')).resolves.toBeUndefined();
    });

    it("should return an undefined value when a Plugin isn't properly identified", async () => {
      jest.spyOn(fs, 'readdir').mockImplementationOnce((_path, _opts, cb) => {
        return cb(null, ['file1', 'file2', 'package.json'] as any);
      });

      jest.spyOn(fs, 'readFile').mockImplementation((_path, cb) => {
        return cb(null, Buffer.from('{  "name":"NotAPlugin", "version": "1.0.0" }'));
      });

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toBeUndefined();
    });

    it('should skip plugins not meant for the current runtime (aka domain)', async () => {
      jest.spyOn(fs, 'readdir').mockImplementationOnce((_path, _opts, cb) => {
        return cb(null, ['file1', 'file2', 'package.json'] as any);
      });

      jest.spyOn(fs, 'readFile').mockImplementation((_path, cb) => {
        return cb(null, Buffer.from('{ "MANIFEST": { "type": "GUI" }, "name":"FakePlugin", "version": "1.0.0" }'));
      });

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toBeUndefined();
    });

    it('should find all Plugins in a Scan Directory', async () => {
      jest
        .spyOn(fs, 'readdir')
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, ['pluginDir1', 'pluginDir2'] as any);
        })
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, ['index.plugin.ts'] as any);
        })
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, ['index.plugin.js'] as any);
        });

      jest.spyOn(fs, 'stat').mockImplementation((_path, _opts, cb) => {
        return cb(null, { isDirectory: jest.fn().mockReturnValue(true) } as any);
      });

      jest.spyOn(loader, 'findPluginManifest').mockResolvedValue(manifest);

      await expect(loader.detectPluginPackages('anyFakeDir')).resolves.toMatchSnapshot();
    });

    it('should skip non-directories in a Scan Directory', async () => {
      jest
        .spyOn(fs, 'readdir')
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, ['notAFolder', 'pluginDir1'] as any);
        })
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, ['index.plugin.ts'] as any);
        });

      jest
        .spyOn(fs, 'stat')
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, { isDirectory: jest.fn().mockReturnValue(false) } as any);
        })
        .mockImplementationOnce((_path, _opts, cb) => {
          return cb(null, { isDirectory: jest.fn().mockReturnValue(true) } as any);
        });

      await expect(loader.detectPluginPackages('anyFakeDir')).resolves.toMatchSnapshot();
    });

    it('should find all Plugins in all Scan Directories', async () => {
      jest.spyOn(loader, 'detectPluginPackages').mockResolvedValue([manifest]);

      await expect(loader.scanForPlugins(['fakePath'])).resolves.toMatchSnapshot();
    });

    it('should throw an error when failing to detect plugins', async () => {
      jest.spyOn(loader, 'detectPluginPackages').mockImplementation(() => {
        throw new Error('TestError: Failed to detect');
      });

      try {
        await loader.scanForPlugins(['fakePath']);
      } catch (err) {
        expect(err).toBeDefined();
        expect((err as Error).toString()).toMatch('Failed to detect');
      }
    });
  });

  describe('PluginLoader Initialization', () => {
    it('should load the plugin from the disk', async () => {
      await loader.init();

      expect(depMgr.loadPluginDefinitions).toHaveBeenCalled();
    });

    it('should utilize the Dependency Manager to load Plugins', async () => {
      jest.spyOn(loader, 'scanForPlugins').mockResolvedValue([manifest]);

      await loader.init();

      expect(depMgr.loadPluginDefinitions).toHaveBeenCalled();
    });

    it('should throw an error when initializing', async () => {
      jest.spyOn(loader, 'scanForPlugins').mockImplementationOnce(path => {
        throw new Error('Test Error: PluginLoad');
      });

      await expect(loader.init()).rejects.toThrow('Test Error: PluginLoad');
    });
  });
});
