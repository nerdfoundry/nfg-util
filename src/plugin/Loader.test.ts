import * as fs from 'node:fs/promises';
import DependencyManager from './DependencyManager.js';
import Host from './Host.js';
import { PluginType, type Manifest } from './index.js';
import Loader from './Loader.js';
import LoaderHelper from './LoaderHelper.js';

vi.mock('node:fs/promises', () => {
  const MockInstance = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn()
  };

  return MockInstance;
});

vi.mock('../core/Logger.js');

vi.mock('./Host.js', () => {
  const MockInstance = {
    setOption: vi.fn()
  };

  return {
    default: vi.fn(() => MockInstance)
  };
});

vi.mock('./DependencyManager.js', () => {
  const MockInstance = {
    loadPluginDefinitions: vi.fn(() => Promise.resolve('depManagerLoaded'))
  };

  return {
    default: vi.fn(() => MockInstance)
  };
});

vi.mock('./LoaderHelper.js', () => ({
  default: {
    resolve: vi.fn(),
    cache: {}
  }
}));

vi.mock('fakePlugin', () => {
  const MockInstance = {
    enable: () => {
      MockInstance.enabled = true;
      return Promise.resolve();
    },
    enabled: false
  };

  return {
    default: vi.fn().mockReturnValue(MockInstance)
  };
});

vi.mock('fakePluginInvalid', () => {
  const MockInstance = {
    enable: () => {
      MockInstance.enabled = true;
      return Promise.resolve();
    },
    enabled: false
  };

  const Mock: any = {
    default: vi.fn(() => MockInstance)
  };

  return Mock;
});

vi.mock('fakePluginBroken', () => {
  const MockInstance = {
    enable: () => {
      MockInstance.enabled = true;
      return Promise.resolve();
    },
    enabled: false
  };

  const Mock: any = {
    default: vi.fn(() => MockInstance)
  };

  return Mock;
});

describe('PluginLoader', () => {
  let loader: Loader;
  let host: Host;
  let depMgr: DependencyManager;
  let manifest: Manifest;

  beforeEach(() => {
    loader = new Loader({ pluginPaths: ['fakePluginPath'], pluginTypes: [PluginType.SERVICE] });
    host = new Host();
    depMgr = new DependencyManager(host);

    manifest = {
      accessors: { plug2: 'plugin2-behaviour' },
      behaviours: ['plugin1-behaviour', 'common1'],
      name: 'Plugin1',
      pluginPath: 'fakePlugin',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    // Hide logging errors via DEBUG
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('Plugin Loading', () => {
    it('should unload invalid plugins from memory', () => {
      vi.spyOn(LoaderHelper, 'resolve')
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
      vi.spyOn(fs, 'readdir')
        .mockResolvedValue([] as any)
        .mockResolvedValueOnce(['file1', 'file2', 'package.json'] as any)
        .mockResolvedValueOnce(['file3', 'file4', 'package.json'] as any);

      vi.spyOn(fs, 'readFile').mockResolvedValue(
        Buffer.from('{ "MANIFEST": { "type": "SERVICE" }, "name":"FakePlugin", "version": "1.0.0" }')
      );

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toMatchSnapshot();
      await expect(loader.findPluginManifest('jsPluginDir')).resolves.toMatchSnapshot();
      // Default response doesn't have a plugin file
      await expect(loader.findPluginManifest('noPluginPath')).resolves.toBeUndefined();
    });

    it("should return an undefined value when a Plugin isn't properly identified", async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValueOnce(['file1', 'file2', 'package.json'] as any);

      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from('{  "name":"NotAPlugin", "version": "1.0.0" }'));

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toBeUndefined();
    });

    it('should skip plugins not meant for the current runtime (aka domain)', async () => {
      vi.spyOn(fs, 'readdir').mockResolvedValueOnce(['file1', 'file2', 'package.json'] as any);

      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(
        Buffer.from('{ "MANIFEST": { "type": "GUI" }, "name":"FakePlugin", "version": "1.0.0" }')
      );

      // Use the impls above for these
      await expect(loader.findPluginManifest('tsPluginDir')).resolves.toBeUndefined();
    });

    it('should find all Plugins in a Scan Directory', async () => {
      vi.spyOn(fs, 'readdir')
        .mockResolvedValueOnce(['pluginDir1', 'pluginDir2'] as any)
        .mockResolvedValueOnce(['index.plugin.ts'] as any)
        .mockResolvedValueOnce(['index.plugin.js'] as any);

      vi.spyOn(fs, 'stat').mockResolvedValue({ isDirectory: vi.fn().mockReturnValue(true) } as any);

      vi.spyOn(loader, 'findPluginManifest').mockResolvedValue(manifest);

      await expect(loader.detectPluginPackages('anyFakeDir')).resolves.toMatchSnapshot();
    });

    it('should skip non-directories in a Scan Directory', async () => {
      vi.spyOn(fs, 'readdir')
        .mockResolvedValueOnce(['notAFolder', 'pluginDir1'] as any)
        .mockResolvedValueOnce(['index.plugin.ts'] as any);

      vi.spyOn(fs, 'stat')
        .mockResolvedValueOnce({ isDirectory: vi.fn().mockReturnValue(false) } as any)
        .mockResolvedValueOnce({ isDirectory: vi.fn().mockReturnValue(true) } as any);

      await expect(loader.detectPluginPackages('anyFakeDir')).resolves.toMatchSnapshot();
    });

    it('should find all Plugins in all Scan Directories', async () => {
      vi.spyOn(loader, 'detectPluginPackages').mockResolvedValue([manifest]);

      await expect(loader.scanForPlugins(['fakePath'])).resolves.toMatchSnapshot();
    });

    it('should throw an error when failing to detect plugins', async () => {
      vi.spyOn(loader, 'detectPluginPackages').mockImplementation(() => {
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
    it('should load the plugin definitions from the disk', async () => {
      vi.spyOn(loader, 'scanForPlugins').mockResolvedValue([manifest]);
      vi.spyOn(depMgr, 'loadPluginDefinitions').mockResolvedValue({});

      await loader.init();

      expect(loader.scanForPlugins).toHaveBeenCalled();
      expect(depMgr.loadPluginDefinitions).toHaveBeenCalled();
    });

    it('should utilize the Dependency Manager to load Plugins', async () => {
      vi.spyOn(loader, 'scanForPlugins').mockResolvedValue([manifest]);

      await loader.init();

      expect(depMgr.loadPluginDefinitions).toHaveBeenCalled();
    });

    it('should throw an error when initializing', async () => {
      vi.spyOn(loader, 'scanForPlugins').mockImplementationOnce(path => {
        throw new Error('Test Error: PluginLoad');
      });

      await expect(loader.init()).rejects.toThrow('Test Error: PluginLoad');
    });
  });
});
