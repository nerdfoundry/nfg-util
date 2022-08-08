import { EventEmitter } from 'node:events';
import path from 'node:path';
import Logger from '../core/Logger.js';
import Base, { type AccessorAliasInstanceMap } from './Base.js';
import Host from './Host.js';
import { type LoaderMeta } from './Loader.js';

const MODULE_NAME: string = path.basename(__filename, path.extname(__filename));
const log = Logger.extend(MODULE_NAME);

export type FqnMetaMap = Record<string, LoaderMeta>;
export type BehaviorToMetasMap = Record<string, Set<LoaderMeta>>;
export type FqnInstanceMap = Record<string, Base>;
export type FqnFailMap = Record<string, PluginLoadedError>;
export type FqnToLoadChainMap = Record<string, Set<string>>;

export class DependencyChainError extends Error {
  origError: Error;
  chainMap: string[] = [];

  constructor(pluginName: string, origError: Error) {
    super(`[DependencyChainError] - ${pluginName} has failed an entire dependency chain - ${origError.message}`);

    this.origError = origError;
    this.chainMap.push(pluginName);

    Error.captureStackTrace(this, DependencyChainError);
  }
}

export class PluginLoadedError extends Error {
  constructor(fqn: string) {
    super(
      `[PluginLoaded] - This Plugin Name & Version are already Loaded. To load the Manifest being used now the previous Plugin must be Unloaded! Plugin FQN: ${fqn}`
    );

    Error.captureStackTrace(this, PluginLoadedError);
  }
}

export class DependencyMissingError extends Error {
  constructor(behaviorName: string) {
    super(`[DependencyMissing] - Missing Dependency for Accessor: ${behaviorName}`);

    Error.captureStackTrace(this, DependencyMissingError);
  }
}

export class CyclicReferenceError extends Error {
  constructor(chain: string[]) {
    super(`CyclicReference] Dependency Chain has a Cyclic Reference Detected: ${chain.join(' -> ')}`);

    Error.captureStackTrace(this, CyclicReferenceError);
  }
}

export default class DependencyManager extends EventEmitter {
  behaviorToMetasMap: BehaviorToMetasMap = {};
  accessorToFqnChainMap: FqnToLoadChainMap = {};
  // Review this... Does it make sense?? Needs a better chain history?
  fqnFailMap: FqnFailMap = {};
  fqnInstanceMap: FqnInstanceMap = {};
  fqnMetaMap: FqnMetaMap = {};

  static getFullyQualifiedName(resource: LoaderMeta | Base) {
    return `${resource.manifest.name}-v${resource.manifest.version}`;
  }

  constructor(public pluginHost: Host) {
    super();

    let loaded = 0,
      total = 0;

    this.on('detected', (names: string[]) => {
      total = names.length;
      log(`Detected ${total} plugins`);
    });

    this.on('loaded', (pluginInstance: Base) => {
      loaded++;
      log(`(${loaded}/${total}) - Loaded: ${pluginInstance.manifest.name}`);
    });
  }

  /**
   * Load Plugin Definitions into the Dependency tree for auto-injection
   */
  async loadPluginDefinitions(loaderMetas: LoaderMeta[]): Promise<FqnInstanceMap> {
    // From the incoming LoaderMetas, map FQN -> LoaderMetas
    this.hydrateFqnToMetaMap(loaderMetas);
    // From the incoming LoaderMetas, map Behaviors -> LoaderMetas
    const unloadedFqnsMap = this.hydrateBehaviorToMetaMap(loaderMetas);

    const unloadedFqns = new Set(Object.keys(unloadedFqnsMap));

    this.emit('detected', unloadedFqns);

    // Hydrate the Accessor to FQN ChainMap, aka, a dependency tree.
    this.hydrateFqnToLoadChainMap(unloadedFqns);

    return this.loadChainMap(unloadedFqns);
  }

  hydrateFqnToMetaMap(loaderMetas: LoaderMeta[]): FqnMetaMap {
    const hasDupe: string[] = [];

    loaderMetas.forEach(loaderMeta => {
      const name = DependencyManager.getFullyQualifiedName(loaderMeta);

      // Duplicates attempting to load
      if (this.fqnInstanceMap[name]) {
        // Plugin by FQN is instantiated already, it needs to be unloaded first
        this.fqnFailMap[name] = new PluginLoadedError(name);
      } else if (this.fqnMetaMap[name]) {
        hasDupe.push(name);
      } else {
        // New plugin, let's accept it!
        this.fqnMetaMap[name] = loaderMeta;
      }
    });

    if (0 < hasDupe.length) {
      //FIXME: Turn into typed error!
      throw new Error(`${MODULE_NAME} - [DuplicateName] Duplicate Plugins detected: ${hasDupe.join(', ')}`);
    }

    return this.fqnMetaMap;
  }

  hydrateBehaviorToMetaMap(loaderMetas: LoaderMeta[]): BehaviorToMetasMap {
    const newMappings: BehaviorToMetasMap = {};

    loaderMetas.forEach(loaderMeta => {
      const fqn = DependencyManager.getFullyQualifiedName(loaderMeta);
      const { behaviors, version } = loaderMeta.manifest;

      if (behaviors) {
        behaviors.forEach(behavior => {
          const behaviorVer = `${behavior}-v${version}`;
          // Ensure both simple and versioned BehaviorNames are mapped
          this.behaviorToMetasMap[behavior] = this.behaviorToMetasMap[behavior] || new Set();
          this.behaviorToMetasMap[behaviorVer] = this.behaviorToMetasMap[behaviorVer] || new Set();

          this.behaviorToMetasMap[behavior].add(loaderMeta);
          this.behaviorToMetasMap[behaviorVer].add(loaderMeta);
        });
      }

      // Ensure the FQN is also listed as a Behavior
      this.behaviorToMetasMap[fqn] = this.behaviorToMetasMap[fqn] || new Set();
      this.behaviorToMetasMap[fqn].add(loaderMeta);
      newMappings[fqn] = this.behaviorToMetasMap[fqn];
    });

    return newMappings;
  }

  /**
   * Retrieves unique FQNs for an BehaviorName
   */
  getFqnsForBehaviorName(behaviorName: string): Set<string> {
    // BehaviorName was never loaded for some reason, maybe the user didn't add the plugin in the ecoystem?
    if (!this.behaviorToMetasMap[behaviorName]) {
      throw new DependencyMissingError(behaviorName);
    }

    const names: Set<string> = new Set();

    for (const loaderMeta of this.behaviorToMetasMap[behaviorName]) {
      names.add(DependencyManager.getFullyQualifiedName(loaderMeta));
    }

    return names;
  }

  /**
   * Iterates over LoaderMetas and builds unique array of AccessorNames
   */
  getAccessorNamesForMetas(loaderMetas: Set<LoaderMeta>): Set<string> {
    return Array.from(loaderMetas).reduce<Set<string>>((names, { manifest }) => {
      if (manifest.accessors) {
        Object.values(manifest.accessors).forEach(behaviorName => names.add(behaviorName));
      }

      return names;
    }, new Set());
  }

  /**
   * Depth First Search, Post-Order to determine resolved
   * order of dependencies for a grouping of Accessor Names
   */
  hydrateFqnToLoadChainMap(behaviorNames: Set<string>, currChain: string[] = []): FqnToLoadChainMap {
    for (const currBehaviorName of behaviorNames) {
      const isFQN = !!this.fqnMetaMap[currBehaviorName];
      // Get all FQNs of the current BehaviorName to store
      const behaviorFqns = this.getFqnsForBehaviorName(currBehaviorName);
      // Get all LoaderMetas for the current BehaviorName
      const metasForBehaviorName = this.behaviorToMetasMap[currBehaviorName];
      // Get all dependencies' AccessorNames
      const dependencyAccessorNames = this.getAccessorNamesForMetas(metasForBehaviorName);

      // Convert all Accessor Names into their associative Plugin Names
      const dependencyFQNs: Set<string> = new Set();
      // "Unzip" all FQNs across the dependencies' AccessorNames
      dependencyAccessorNames.forEach(accessorName =>
        this.getFqnsForBehaviorName(accessorName).forEach(fqn => dependencyFQNs.add(fqn))
      );

      // The *actual* dependencies used depends on whether this BehaviorName is an FQN or not!
      // Non-FQNs should resolve to actual FQNs, and FQNs should continue their dependency resolution
      //  via AccessorNames.
      const actualDeps = isFQN ? dependencyFQNs : behaviorFqns;

      // Ensure we don't have a Cyclic Reference in our ChainMap
      if (currChain.includes(currBehaviorName)) {
        throw new CyclicReferenceError(currChain.concat(currBehaviorName));
      }

      // We have dependencies to load!
      if (0 !== actualDeps.size) {
        this.hydrateFqnToLoadChainMap(
          actualDeps,
          // Make sure we know about ourselves in the chain listing while we're curried
          // into the recursive call, but we don't want to modify the current chain for
          // siblings as they process (which would in turn guarantee false-positives)
          currChain.concat(currBehaviorName)
        );
      }

      this.accessorToFqnChainMap[currBehaviorName] = actualDeps;
    }

    return this.accessorToFqnChainMap;
  }

  /**
   * Depth First Search, Post-Order to Instantiate Plugin Instances
   */
  async loadChainMap(pluginNames: Set<string>): Promise<FqnInstanceMap> {
    for (const pluginName of pluginNames) {
      // Already loading/loaded, skip
      if (this.fqnInstanceMap[pluginName]) {
        continue;
      }

      const pluginChainList = this.accessorToFqnChainMap[pluginName];

      // If we have a dependency Plugin Chain, recursively process it...
      if (pluginChainList) {
        await this.loadChainMap(pluginChainList);
      }

      this.fqnInstanceMap[pluginName] = await this.pluginFactory(pluginName);
    }

    return this.fqnInstanceMap;
  }

  /**
   * For a Manifest's AccessorName alias mapping, we will retrive the
   * instances and mirror the alias mapping for the Plugin's access.
   *
   * This assumes hydrating the AccessorToFqnChainMap has been performed
   * to ensure Dependency Resolution will always succeed.
   */
  async mapAccessorAliasesToInstances(
    accessorAliasManifest: Record<string, string>
  ): Promise<AccessorAliasInstanceMap> {
    if (!accessorAliasManifest) {
      return {};
    }

    const aliasNames = Object.keys(accessorAliasManifest);

    return aliasNames.reduce<AccessorAliasInstanceMap>((map, aliasName) => {
      const behaviorName = accessorAliasManifest[aliasName];
      const behaviorFqns = this.getFqnsForBehaviorName(behaviorName);

      behaviorFqns.forEach(fqn => {
        map[aliasName] = map[aliasName] || new Set();
        map[aliasName].add(this.fqnInstanceMap[fqn]);
      });

      return map;
    }, {});
  }

  async pluginFactory(pluginName: string): Promise<Base> {
    try {
      const loaderMeta = this.fqnMetaMap[pluginName];
      const accessorAliasMap = loaderMeta.manifest.accessors
        ? await this.mapAccessorAliasesToInstances(loaderMeta.manifest.accessors)
        : null;

      // Create the instance!
      const pluginInstance = new loaderMeta.pluginDefinition({
        host: this.pluginHost,
        manifest: loaderMeta.manifest,
        accessors: accessorAliasMap ?? undefined
      });

      // FIXME: Might need to check if user disabled,
      // or if errored before maybe don't reload
      await pluginInstance.enable();
      await pluginInstance.start();

      this.emit('loaded', pluginInstance);

      return pluginInstance;
    } catch (err) {
      const errCasted = err as Error;

      log('Error enabling/starting Plugin...', errCasted);

      const newError = new DependencyChainError(pluginName, errCasted);
      this.fqnFailMap[pluginName] = newError;
      throw newError;
    }
  }

  //FIXME Finish unloading of plugins thoroughly
  async unloadPluginInstance(pluginName: string): Promise<Base> {
    try {
      const pluginInstance = this.fqnInstanceMap[pluginName];

      await pluginInstance.stop();

      // const accessorNames = this.getAccessorNamesForPlugins([pluginInstance]);

      delete this.fqnInstanceMap[pluginName];
      delete this.fqnMetaMap[pluginName];
      // accessorNames.forEach(n => this.behaviorToMetaMap[n].splice(this.behaviorToMetaMap[n].indexOf(n), 1));

      return pluginInstance;
    } catch (err) {
      log('Error stopping Plugin...', err);

      throw err;
    }
  }
}
