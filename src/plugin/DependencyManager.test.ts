import Base from './Base.js';
import DependencyManager, { type BehaviorToMetasMap, type FqnMetaMap } from './DependencyManager.js';
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
  let partialFqnMetaMap: FqnMetaMap;
  let partialBehaviorMetasMap: BehaviorToMetasMap;
  let partialMetaList: LoaderMeta[];

  function resetHostMock() {
    // Cleans up host mock junk from snapshot
    vi.mocked(host.getOption).mockReset();
    vi.mocked(host.setOption).mockReset();
  }

  beforeEach(() => {
    // Hide logging errors via DEBUG
    // eslint-disable-next-line
    vi.spyOn(console, 'log').mockImplementation(() => {});

    host = new Host();
    mgr = new DependencyManager(host);

    const pluginDef = class extends Base {};

    manifest1 = {
      accessors: { plug2: 'plugin2-behavior' },
      behaviors: ['plugin1-behavior', 'common1'],
      name: 'Plugin1',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest2 = {
      behaviors: ['plugin2-behavior', 'common1'],
      name: 'Plugin2',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest3 = {
      accessors: {
        plug1: 'Plugin1-v0.0.1',
        plug4: 'plugin4-behavior'
      },
      behaviors: ['plugin3-behavior'],
      name: 'Plugin3',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest4 = {
      accessors: { plug2: 'Plugin2-v0.0.1' },
      behaviors: ['plugin4-behavior'],
      name: 'Plugin4',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest5 = {
      accessors: { cyclic: 'Plugin6-v0.0.1' },
      behaviors: ['plugin5-behavior'],
      name: 'Plugin5',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest6 = {
      accessors: { cyclic: 'Plugin5-v0.0.1' },
      behaviors: ['plugin6-behavior'],
      name: 'Plugin6',
      pluginPath: '',
      version: '0.0.1',
      type: PluginType.SERVICE
    };

    manifest7 = {
      accessors: { self: 'Plugin7-v0.0.1' },
      behaviors: ['plugin7-behavior'],
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

    partialFqnMetaMap = {
      [`${loaderMeta1.manifest.name}-v${loaderMeta1.manifest.version}`]: loaderMeta1,
      [`${loaderMeta2.manifest.name}-v${loaderMeta2.manifest.version}`]: loaderMeta2,
      [`${loaderMeta3.manifest.name}-v${loaderMeta3.manifest.version}`]: loaderMeta3,
      [`${loaderMeta4.manifest.name}-v${loaderMeta4.manifest.version}`]: loaderMeta4
    };

    partialBehaviorMetasMap = {
      common1: new Set([loaderMeta1, loaderMeta2]),
      'plugin1-behavior': new Set([loaderMeta1]),
      'plugin2-behavior': new Set([loaderMeta2]),
      'plugin3-behavior': new Set([loaderMeta3]),
      'plugin4-behavior': new Set([loaderMeta4]),
      'plugin5-behavior': new Set([loaderMeta5]),
      'plugin6-behavior': new Set([loaderMeta6]),
      'plugin7-behavior': new Set([loaderMeta7]),
      [DependencyManager.getFullyQualifiedName(loaderMeta1)]: new Set([loaderMeta1]),
      [DependencyManager.getFullyQualifiedName(loaderMeta2)]: new Set([loaderMeta2]),
      [DependencyManager.getFullyQualifiedName(loaderMeta3)]: new Set([loaderMeta3]),
      [DependencyManager.getFullyQualifiedName(loaderMeta4)]: new Set([loaderMeta4]),
      [DependencyManager.getFullyQualifiedName(loaderMeta6)]: new Set([loaderMeta6]),
      [DependencyManager.getFullyQualifiedName(loaderMeta7)]: new Set([loaderMeta7])
    };

    partialMetaList = [loaderMeta1, loaderMeta2, loaderMeta3, loaderMeta4];

    partialMetaList.concat([loaderMeta5, loaderMeta6, loaderMeta7]).forEach((loaderMeta: LoaderMeta) => {
      loaderMeta.pluginDefinition.prototype.manifest = loaderMeta.manifest;
      loaderMeta.pluginDefinition.prototype.enable = vi.fn().mockResolvedValue(true);
      loaderMeta.pluginDefinition.prototype.start = vi.fn().mockResolvedValue(loaderMeta);
      loaderMeta.pluginDefinition.prototype.stop = vi.fn().mockResolvedValue(loaderMeta);
    });

    loaderMeta2.pluginDefinition.prototype.start = vi.fn().mockReturnValue(
      // Wowsa, 10s startup!?
      new Promise(r => setTimeout(() => r(`pluginStarted [delayed]: ${loaderMeta2.manifest.name}`), 10000))
    );
  });

  describe('Hydrating Maps', () => {
    describe('hydrateFqnToMetaMap', () => {
      it('should detect already loaded FQNs and build a failmap', () => {
        // Simulate Plugin1 already loaded
        mgr.fqnInstanceMap = {
          [DependencyManager.getFullyQualifiedName(loaderMeta1)]: new loaderMeta1.pluginDefinition({
            host,
            manifest: manifest1
          })
        };

        mgr.hydrateFqnToMetaMap([loaderMeta1]);

        expect(mgr.fqnFailMap).toMatchSnapshot();
      });

      it('should detect duplicate FQNs attempting to load', () => {
        expect(() => mgr.hydrateFqnToMetaMap([loaderMeta1, loaderMeta1])).toThrow('DuplicateName');
      });

      it('should accept newly discovered Loader Metas, mapped by FQN', () => {
        expect(mgr.hydrateFqnToMetaMap(partialMetaList)).toMatchSnapshot();
      });
    });

    describe('hydrateBehaviorToMetaMap', () => {
      it('should associate all listed behaviors to the given LoaderMetas', () => {
        mgr.hydrateBehaviorToMetaMap([loaderMeta1]);
        expect(mgr.behaviorToMetasMap).toHaveProperty('plugin1-behavior');
        expect(mgr.behaviorToMetasMap).toHaveProperty('common1');
      });

      it('should associate all listed behaviors to the given LoaderMetas, with versions', () => {
        mgr.hydrateBehaviorToMetaMap([loaderMeta1]);
        expect(mgr.behaviorToMetasMap['plugin1-behavior-v0.0.1']).toBeDefined();
        expect(mgr.behaviorToMetasMap['common1-v0.0.1']).toBeDefined();
      });

      it('should allow multiple LoaderMetas to satisfy a single BehaviorName', () => {
        mgr.hydrateBehaviorToMetaMap([loaderMeta1, loaderMeta2]);
        expect(mgr.behaviorToMetasMap['plugin1-behavior']).toBeDefined();
        expect(mgr.behaviorToMetasMap['plugin1-behavior']).toHaveLength(1);
        expect(mgr.behaviorToMetasMap['common1']).toBeDefined();
        expect(mgr.behaviorToMetasMap['common1']).toHaveLength(2);
      });
    });

    describe('Hydration Resolver Helpers', () => {
      beforeEach(() => {
        mgr.behaviorToMetasMap = partialBehaviorMetasMap;
      });

      describe('getFqnsForBehaviorName', () => {
        it('should throw an error if a BehaviorName cannot be resolved', () => {
          expect(() => mgr.getFqnsForBehaviorName('missingAccessor')).toThrow('DependencyMissing');
        });

        it('should return a list of FQNs that satisfy the BehaviorName', () => {
          const fqns = mgr.getFqnsForBehaviorName('common1');
          expect(fqns).toMatchSnapshot();
          expect(fqns).toHaveLength(2);
        });
      });

      describe('getAccessorNamesForMetas', () => {
        it('should return a unique list of AccessorNames for all provided LoaderMetas', () => {
          expect(mgr.getAccessorNamesForMetas(new Set(partialMetaList))).toMatchSnapshot();
        });
      });
    });

    describe('hydrateFqnToLoadChainMap', () => {
      beforeEach(() => {
        vi.spyOn(mgr, 'hydrateFqnToLoadChainMap');

        mgr.behaviorToMetasMap = partialBehaviorMetasMap;
      });

      it('should throw an error for a Cyclic Reference in an ChainMap', () => {
        // Handling a request for 'Plugin1-v0.0.1'
        vi.spyOn(mgr, 'getFqnsForBehaviorName')
          // First call will for 'Plugin1-v0.0.1' will return itself
          .mockReturnValueOnce(new Set(['Plugin1-v0.0.1']))
          // Sub-call (dependencies) will return itself!
          .mockReturnValueOnce(new Set(['Plugin1-v0.0.1']));
        vi.spyOn(mgr, 'getAccessorNamesForMetas')
          // First call for depenency's accessors provide for recursion
          .mockReturnValueOnce(new Set(['plugin1-behavior']));

        expect(() => mgr.hydrateFqnToLoadChainMap(new Set(['Plugin1-v0.0.1']))).toThrowError('CyclicReference');
      });

      it('should throw an error for a missing AccessorName', () => {
        expect(() => mgr.hydrateFqnToLoadChainMap(new Set(['missingAccessorName']))).toThrow('DependencyMissing');
      });

      it('should resolve the dependency chain for a "generic" BehaviorName', () => {
        // Handling a request for 'common1'
        vi.spyOn(mgr, 'getFqnsForBehaviorName')
          // Default to Plugin2
          .mockReturnValue(new Set(['Plugin2-v0.0.1']))
          // First call will for 'common1' will return both FQNs
          .mockReturnValueOnce(new Set(['Plugin1-v0.0.1', 'Plugin2-v0.0.1']))
          // Sub-call (dependencies) will return Plugin2
          .mockReturnValueOnce(new Set(['Plugin2-v0.0.1']))
          // Plugin1 is now being tested in recursed call
          .mockReturnValueOnce(new Set(['Plugin1-v0.0.1']));
        // We recurse Plugin2 for both Plugin1 dep, and itself

        vi.spyOn(mgr, 'getAccessorNamesForMetas')
          // Default to an empty Set
          .mockReturnValue(new Set())
          // First call for depenency's accessors
          .mockReturnValueOnce(new Set(['plugin2-behavior']))
          // Plugin1 is now being tested in recursed call,
          .mockReturnValueOnce(new Set(['plugin2-behavior']));

        mgr.fqnMetaMap = partialFqnMetaMap;
        mgr.hydrateFqnToLoadChainMap(new Set(['common1']));

        expect(mgr.hydrateFqnToLoadChainMap).toHaveBeenCalledTimes(3);
        expect(mgr.getFqnsForBehaviorName).toHaveBeenCalledTimes(6);
        expect(mgr.getAccessorNamesForMetas).toHaveBeenCalledTimes(4);
        expect(mgr.accessorToFqnChainMap).toMatchSnapshot();
      });
    });
  });

  describe('Loading the Dependency Chain', () => {
    describe('Mapping Accessor Aliases', () => {
      it("should map the FQN instances to the alias names defined in a Manifest's Alias Mapping", async () => {
        mgr.fqnMetaMap = partialFqnMetaMap;
        mgr.fqnInstanceMap = {
          ['Plugin2-v0.0.1']: new loaderMeta2.pluginDefinition({ host, manifest: manifest2 })
        };

        vi.spyOn(mgr, 'getFqnsForBehaviorName').mockReturnValue(new Set(['Plugin2-v0.0.1']));

        // eslint-disable-next-line
        await expect(mgr.mapAccessorAliasesToInstances(manifest1.accessors!)).resolves.toMatchSnapshot();
      });

      it('should handle a Manifest missing an Alias Mapping', async () => {
        vi.spyOn(mgr, 'getFqnsForBehaviorName');

        // eslint-disable-next-line
        await expect(mgr.mapAccessorAliasesToInstances(manifest2.accessors!)).resolves.toMatchSnapshot();

        expect(mgr.getFqnsForBehaviorName).not.toHaveBeenCalled();
      });
    });

    describe('Plugin Factory/Instantiation', () => {
      it('should instantiate a long-starting Plugin', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.advanceTimersByTime(60000);
        vi.spyOn(mgr, 'mapAccessorAliasesToInstances').mockResolvedValue({});

        mgr.fqnMetaMap = partialFqnMetaMap;

        const plugin = await mgr.pluginFactory('Plugin2-v0.0.1');

        expect(plugin).toBeDefined();
        expect(plugin.enable).toHaveBeenCalled();
        expect(plugin.start).toHaveBeenCalled();

        resetHostMock();

        expect(plugin).toMatchSnapshot();
      });

      it('should throw an Error on Plugin Start Failures', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.advanceTimersByTime(60000);
        vi.spyOn(mgr, 'mapAccessorAliasesToInstances').mockResolvedValue({});

        // eslint-disable-next-line
        (loaderMeta2.pluginDefinition.prototype.start as any).mockRejectedValue('Not going to load');

        mgr.fqnMetaMap = partialFqnMetaMap;

        await expect(mgr.pluginFactory('Plugin2-v0.0.1')).rejects.toThrow('DependencyChainError');
      });

      it('should skip previously processed Plugins', async () => {
        vi.spyOn(mgr, 'loadChainMap');

        mgr.fqnInstanceMap = {
          previouslyLoaded: new loaderMeta1.pluginDefinition({ host, manifest: manifest1 })
        };

        await mgr.loadChainMap(new Set(['previouslyLoaded']));

        expect(mgr.loadChainMap).toBeCalledTimes(1);
      });

      it('should recursively processed Plugin Loads', async () => {
        vi.spyOn(mgr, 'loadChainMap');
        vi.spyOn(mgr, 'pluginFactory').mockResolvedValue(
          new loaderMeta2.pluginDefinition({ host, manifest: manifest2 })
        );

        mgr.accessorToFqnChainMap = {
          'Plugin1-v0.0.1': new Set(),
          'Plugin2-v0.0.1': new Set(['Plugin2-v0.0.1'])
        };

        await mgr.loadChainMap(new Set(['Plugin1-v0.0.1']));

        expect(mgr.loadChainMap).toBeCalledTimes(2);
      });

      it('should load the entire metalist', async () => {
        vi.spyOn(mgr, 'hydrateFqnToMetaMap').mockReturnValue({});
        vi.spyOn(mgr, 'hydrateBehaviorToMetaMap').mockReturnValue({});
        vi.spyOn(mgr, 'hydrateFqnToLoadChainMap').mockReturnValue({});
        vi.spyOn(mgr, 'loadChainMap').mockImplementation(vi.fn() as any);

        await mgr.loadPluginDefinitions([loaderMeta2]);

        expect(mgr.hydrateFqnToMetaMap).toHaveBeenCalled();
        expect(mgr.hydrateBehaviorToMetaMap).toHaveBeenCalled();
        expect(mgr.hydrateFqnToMetaMap).toHaveBeenCalled();
        expect(mgr.loadChainMap).toHaveBeenCalled();
      });
    });
  });
});
