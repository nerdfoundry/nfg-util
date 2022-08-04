import Base from './Base.js';
import DependencyManager, {
  DependencyChainError,
  type BehaviourToMetasMap,
  type FqnMetaMap
} from './DependencyManager.js';
import Host from './Host.js';
import { PluginType, type Manifest } from './index.js';
import type { LoaderMeta } from './Loader.js';

vi.useFakeTimers({ shouldAdvanceTime: true });
vi.spyOn(global, 'setTimeout');

vi.mock('../core/Logger.js');
vi.mock('./Host.js');
vi.mock('./Relay.js');

describe('DependencyManager', () => {
  let host: Host;
  let mgr: DependencyManager;

  let manifest1: Manifest,
    manifest2: Manifest,
    manifest3: Manifest,
    manifest4: Manifest,
    manifest5: Manifest,
    manifest6: Manifest,
    manifest7: Manifest;
  let loaderMeta1: LoaderMeta,
    loaderMeta2: LoaderMeta,
    loaderMeta3: LoaderMeta,
    loaderMeta4: LoaderMeta,
    loaderMeta5: LoaderMeta,
    loaderMeta6: LoaderMeta,
    loaderMeta7: LoaderMeta;
  let pluginNameMap: FqnMetaMap;
  let behaviourNameMap: BehaviourToMetasMap;
  let pluginNames: string[];
  let metaList: LoaderMeta[];

  function resetHostMock() {
    // Cleans up host mock junk from snapshot
    vi.mocked(host.getOption).mockReset();
    vi.mocked(host.setOption).mockReset();
  }

  beforeEach(() => {
    // Hide logging errors via DEBUG
    vi.spyOn(console, 'log').mockImplementation(() => {});

    host = new Host();
    mgr = new DependencyManager(host);

    const pluginDef = class extends Base {};

    manifest1 = {
      accessors: { plug2: 'plugin2-behaviour' },
      behaviours: ['plugin1-behaviour', 'common1'],
      name: 'Plugin1',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest2 = {
      behaviours: ['plugin2-behaviour', 'common1'],
      name: 'Plugin2',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest3 = {
      accessors: {
        plug1: 'Plugin1-v0.0.1',
        plug4: 'plugin4-behaviour'
      },
      behaviours: ['plugin3-behaviour'],
      name: 'Plugin3',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest4 = {
      accessors: { plug2: 'Plugin2-v0.0.1' },
      behaviours: ['plugin4-behaviour'],
      name: 'Plugin4',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest5 = {
      accessors: { cyclic: 'Plugin6-v0.0.1' },
      behaviours: ['plugin5-behaviour'],
      name: 'Plugin5',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest6 = {
      accessors: { cyclic: 'Plugin5-v0.0.1' },
      behaviours: ['plugin6-behaviour'],
      name: 'Plugin6',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest7 = {
      accessors: { self: 'Plugin7-v0.0.1' },
      behaviours: ['plugin7-behaviour'],
      name: 'Plugin7',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    loaderMeta1 = {
      pluginDefinition: pluginDef,
      manifest: manifest1
    };
    loaderMeta2 = {
      pluginDefinition: pluginDef,
      manifest: manifest2
    };
    loaderMeta3 = {
      pluginDefinition: pluginDef,
      manifest: manifest3
    };
    loaderMeta4 = {
      pluginDefinition: pluginDef,
      manifest: manifest4
    };
    loaderMeta5 = {
      pluginDefinition: pluginDef,
      manifest: manifest5
    };
    loaderMeta6 = {
      pluginDefinition: pluginDef,
      manifest: manifest6
    };
    loaderMeta7 = {
      pluginDefinition: pluginDef,
      manifest: manifest7
    };

    pluginNameMap = {
      [`${loaderMeta1.manifest.name}-v${loaderMeta1.manifest.version}`]: loaderMeta1,
      [`${loaderMeta2.manifest.name}-v${loaderMeta2.manifest.version}`]: loaderMeta2,
      [`${loaderMeta3.manifest.name}-v${loaderMeta3.manifest.version}`]: loaderMeta3,
      [`${loaderMeta4.manifest.name}-v${loaderMeta4.manifest.version}`]: loaderMeta4
    };

    behaviourNameMap = {
      common1: [loaderMeta1, loaderMeta2],
      'plugin1-behaviour': [loaderMeta1],
      'plugin2-behaviour': [loaderMeta2],
      'plugin3-behaviour': [loaderMeta3],
      'plugin4-behaviour': [loaderMeta4],
      'plugin5-behaviour': [loaderMeta5],
      'plugin6-behaviour': [loaderMeta6],
      'plugin7-behaviour': [loaderMeta7],
      [DependencyManager.getFullyQualifiedName(loaderMeta1)]: [loaderMeta1],
      [DependencyManager.getFullyQualifiedName(loaderMeta2)]: [loaderMeta2],
      [DependencyManager.getFullyQualifiedName(loaderMeta3)]: [loaderMeta3],
      [DependencyManager.getFullyQualifiedName(loaderMeta4)]: [loaderMeta4],
      [DependencyManager.getFullyQualifiedName(loaderMeta6)]: [loaderMeta6],
      [DependencyManager.getFullyQualifiedName(loaderMeta7)]: [loaderMeta7]
    };

    pluginNames = Object.keys(pluginNameMap);
    metaList = [loaderMeta1, loaderMeta2, loaderMeta3, loaderMeta4];

    metaList.concat([loaderMeta5, loaderMeta6, loaderMeta7]).forEach((loaderMeta: LoaderMeta) => {
      const pluginName = loaderMeta.manifest.name;
      loaderMeta.pluginDefinition.prototype.manifest = loaderMeta.manifest;
      loaderMeta.pluginDefinition.prototype.enable = vi
        .fn()
        .mockReturnValue(Promise.resolve(`pluginEnabled: ${pluginName}`));
      loaderMeta.pluginDefinition.prototype.start = vi
        .fn()
        .mockReturnValue(Promise.resolve(`pluginStarted: ${pluginName}`));
      loaderMeta.pluginDefinition.prototype.stop = vi
        .fn()
        .mockReturnValue(Promise.resolve(`pluginStopped: ${pluginName}`));
    });

    loaderMeta2.pluginDefinition.prototype.start = vi.fn().mockReturnValue(
      // Wowsa, 10s startup!?
      new Promise(r => setTimeout(() => r(`pluginStarted [delayed]: ${loaderMeta2.manifest.name}`), 10000))
    );

    mgr.behaviourToMetasMap = behaviourNameMap;
    mgr.fqnMetaMap = pluginNameMap;
  });

  describe('Utilities', () => {
    it('should return a list of all Accessors within a group of Plugins', () => {
      expect(mgr.getAccessorNamesForMetas(metaList)).toMatchSnapshot();
    });

    it('should build an Alias Map for Accessors', async () => {
      mgr.fqnInstanceMap = {
        [DependencyManager.getFullyQualifiedName(loaderMeta2)]: new loaderMeta2.pluginDefinition({
          host,
          manifest: manifest2,
          accessors: {}
        })
      };

      const aliases = [
        await mgr.mapAccessorAliasesToInstances(manifest1.accessors!),
        await mgr.mapAccessorAliasesToInstances(manifest3.accessors!),
        await mgr.mapAccessorAliasesToInstances(manifest4.accessors!)
      ];

      resetHostMock();

      await expect(aliases).toMatchSnapshot();
    });

    it('should normalize an Accessor to all satisfying Plugin Names', () => {
      expect(mgr.getFqnsForAccessorName(DependencyManager.getFullyQualifiedName(loaderMeta1))).toMatchObject([
        'Plugin1-v0.0.1'
      ]);
      expect(mgr.getFqnsForAccessorName(DependencyManager.getFullyQualifiedName(loaderMeta2))).toMatchObject([
        'Plugin2-v0.0.1'
      ]);
      expect(mgr.getFqnsForAccessorName('plugin2-behaviour')).toMatchObject(['Plugin2-v0.0.1']);
      expect(mgr.getFqnsForAccessorName('common1')).toMatchObject(['Plugin1-v0.0.1', 'Plugin2-v0.0.1']);
    });
  });

  describe('Build Plugin Name Map', () => {
    it('should error when a duplicate name of a plugin is found', () => {
      expect(() => mgr.hydrateFqnToMetaMap([loaderMeta1, loaderMeta1])).toThrow('DuplicateName');
    });

    it('should return a named mapping of all Plugins', () => {
      expect(mgr.hydrateFqnToMetaMap(metaList)).toMatchSnapshot();
    });

    it('should return a named mapping of Plugin Behaviours', () => {
      expect(mgr.hydrateBehaviourToMetaMap(metaList)).toMatchSnapshot();
    });
  });

  describe('Build Accessor Chain Map', () => {
    it('should not allow self references', () => {
      expect(() => mgr.hydrateAccessorToFqnChainMap(['plugin7-behaviour'])).toThrow('SelfReference');
    });

    it('should not allow cyclical dependencies', () => {
      const name5 = DependencyManager.getFullyQualifiedName(loaderMeta5);
      const name6 = DependencyManager.getFullyQualifiedName(loaderMeta6);

      const behaviourNameMap: BehaviourToMetasMap = {
        [name5]: [loaderMeta5],
        [name6]: [loaderMeta6]
      };

      mgr.behaviourToMetasMap = behaviourNameMap;

      expect(() => mgr.hydrateAccessorToFqnChainMap([name5, name6])).toThrow('Cyclical');
    });

    it('should fail when attempting to load missing Plugins', () => {
      expect(() => mgr.hydrateAccessorToFqnChainMap(['UnknownPlugin'])).toThrow('PluginMissing');
    });

    it('should fail when attempting to load missing Dependencies', () => {
      delete mgr.behaviourToMetasMap['Plugin7-v0.0.1'];
      expect(() => mgr.hydrateAccessorToFqnChainMap(['plugin7-behaviour'])).toThrow('DependencyMissing');
    });

    it('should build a proper Plugin Dependency tree from Plugin Names', () => {
      expect(mgr.hydrateAccessorToFqnChainMap(pluginNames)).toMatchSnapshot();
    });
  });

  describe('Loading a Chain Map', () => {
    it('should load an entire Chain Map from the Plugin Name Map', async () => {
      const loadMap: Record<string, LoaderMeta> = {};
      vi.spyOn(mgr, 'pluginFactory').mockImplementation(async pluginName => {
        if (!loadMap[pluginName]) {
          loadMap[pluginName] = pluginNameMap[pluginName];
        }

        const retInst = new loadMap[pluginName].pluginDefinition({
          host,
          manifest: loadMap[pluginName].manifest,
          accessors: {}
        });

        return retInst;
      });

      const chainMap = {
        Plugin1: ['Plugin2'],
        Plugin3: ['Plugin1', 'Plugin4'],
        Plugin4: ['Plugin2']
      };

      mgr.accessorToFqnChainMap = chainMap;

      const loadChain = await mgr.loadChainMap(pluginNames);

      expect(mgr.pluginFactory).toHaveBeenCalledTimes(4);

      resetHostMock();

      expect(loadChain).toMatchSnapshot();
      expect(loadMap).toMatchSnapshot(); //normally would be mgr.loadMap, but we're mocking impl
    });

    it('should properly identify individual failed plugins upon loading', () => {
      const failMap: Record<string, DependencyChainError> = {};

      vi.spyOn(mgr, 'pluginFactory').mockImplementation(pluginName => {
        const newError = new DependencyChainError(pluginName, new Error('Test Error'));
        failMap[pluginName] = newError;
        throw newError;
      });

      const name1 = DependencyManager.getFullyQualifiedName(loaderMeta1);
      const name2 = DependencyManager.getFullyQualifiedName(loaderMeta2);
      const name3 = DependencyManager.getFullyQualifiedName(loaderMeta3);
      const name4 = DependencyManager.getFullyQualifiedName(loaderMeta4);

      const chainMap = {
        [name1]: [name2],
        [name3]: [name1, name4],
        [name4]: [name2]
      };

      mgr.accessorToFqnChainMap = chainMap;

      return mgr.loadChainMap(pluginNames).catch(err => {
        expect(mgr.fqnInstanceMap).toMatchObject({});
        expect(failMap).toMatchSnapshot(); //normally would be mgr.loadMap, but we're mocking impl
        expect(mgr.pluginFactory).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading Plugin Instances', () => {
    it('should load a Plugin Instance', async () => {
      vi.spyOn(mgr, 'mapAccessorAliasesToInstances').mockImplementation(async () => {
        return {
          plug2: [
            new loaderMeta2.pluginDefinition({
              host,
              manifest: manifest2,
              accessors: {}
            })
          ]
        };
      });

      expect(mgr.pluginFactory('Plugin1-v0.0.1')).resolves.toMatchSnapshot();
      expect(mgr.pluginFactory('Plugin2-v0.0.1')).resolves.toMatchSnapshot();
    });

    it('should throw an Error when a Plugin load fails to initialize', async () => {
      const loaderMeta: any = {
        manifest: loaderMeta1.manifest,
        pluginDefinition: vi.fn().mockImplementation(() => {
          throw new Error('Test Error: PluginLoadError');
        })
      };

      const pluginNameMap: FqnMetaMap = {
        FakePlugin: loaderMeta
      };

      mgr.fqnMetaMap = pluginNameMap;

      try {
        await mgr.pluginFactory('FakePlugin');
      } catch (err) {
        const errCasted = err as DependencyChainError;

        expect(err).toBeInstanceOf(DependencyChainError);
        expect(errCasted.toString()).toMatch('DependencyChainError');
        expect(errCasted.chainMap).toEqual(['FakePlugin']);
        expect(errCasted.origError).toBeInstanceOf(Error);
        expect(errCasted.origError.toString()).toMatch('PluginLoadError');
      }
    });
  });

  describe('Loading Plugin Definitions', () => {
    it('should load the entire Plugin Dependency tree into a single Promise result', async () => {
      vi.runAllTimers();

      const loadMap = await mgr.loadPluginDefinitions([loaderMeta2, loaderMeta1]);

      resetHostMock();

      expect(setTimeout).toHaveBeenCalledTimes(1);

      expect(loadMap).toMatchSnapshot();
    });

    it('should not allow known plugins to be re-loaded', async () => {
      const name1 = DependencyManager.getFullyQualifiedName(loaderMeta1);

      mgr.fqnInstanceMap = {
        [name1]: new loaderMeta3.pluginDefinition({
          host,
          manifest: manifest3,
          accessors: {}
        })
      };

      await mgr.loadPluginDefinitions([loaderMeta1]);

      resetHostMock();

      expect(mgr.fqnInstanceMap).toMatchSnapshot();
      expect(mgr.fqnFailMap).toMatchSnapshot();
      expect(mgr.fqnFailMap[name1].origError.toString()).toMatch('Already Loaded');
    });
  });

  describe('Unloading Plugin Instances', () => {
    it('should stop and remove the Plugin successfully', async () => {
      const plug1Inst = new loaderMeta1.pluginDefinition({
        host,
        manifest: manifest1,
        accessors: {}
      });

      plug1Inst.manifest = loaderMeta1.manifest;

      mgr.fqnInstanceMap = {
        Plugin1: plug1Inst
      };

      await mgr.unloadPluginInstance(loaderMeta1.manifest.name);

      expect(mgr.fqnInstanceMap).not.toHaveProperty('Plugin1');
    });

    it('should catch errors while stopping a Plugin', async () => {
      try {
        await mgr.unloadPluginInstance(loaderMeta1.manifest.name);
      } catch (err) {
        expect((err as Error).toString()).toMatch("undefined (reading 'stop')");
      }
    });
  });
});
