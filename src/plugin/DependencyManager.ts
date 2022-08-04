import { EventEmitter } from 'node:events';
import path from 'node:path';
import Logger from '../core/Logger.js';
import Base, { type AccessorAliasInstanceMap } from './Base.js';
import Host from './Host.js';
import { type LoaderMeta } from './Loader.js';

const MODULE_NAME: string = path.basename(__filename, path.extname(__filename));
const log = Logger.extend(MODULE_NAME);

export type FqnMetaMap = Record<string, LoaderMeta>;

export type BehaviourToMetasMap = Record<string, LoaderMeta[]>;

export type FqnInstanceMap = Record<string, Base>;

export type FqnFailMap = Record<string, DependencyChainError>;

export type AccessorToFqnChainMap = Record<string, string[]>;

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

export default class DependencyManager extends EventEmitter {
  behaviourToMetasMap: BehaviourToMetasMap = {};
  accessorToFqnChainMap: AccessorToFqnChainMap = {};
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
    this.hydrateFqnToMetaMap(loaderMetas);
    this.hydrateBehaviourToMetaMap(loaderMetas);

    const unloadedFqns = Object.keys(this.fqnMetaMap);

    this.emit('detected', unloadedFqns);

    this.hydrateAccessorToFqnChainMap(unloadedFqns);

    return this.loadChainMap(unloadedFqns);
  }

  hydrateFqnToMetaMap(loaderMetas: LoaderMeta[]): FqnMetaMap {
    const hasDupe: string[] = [];

    loaderMetas.forEach(loaderMeta => {
      const name = DependencyManager.getFullyQualifiedName(loaderMeta);

      // Duplicates attempting to load
      if (this.fqnMetaMap[name]) {
        hasDupe.push(name);
      } else if (this.fqnInstanceMap[name]) {
        // Plugin by name has already *been* loaded
        this.fqnFailMap[name] = new DependencyChainError(name, new Error('Already Loaded'));
      } else {
        // New plugin, let's accept it!
        this.fqnMetaMap[name] = loaderMeta;
      }
    });

    //@ts-ignore:next-line
    if (0 < hasDupe.length) {
      //FIXME: Turn into typed error!
      throw new Error(`${MODULE_NAME} - [DuplicateName] Duplicate Plugins detected: ${hasDupe.join(', ')}`);
    }

    return this.fqnMetaMap;
  }

  hydrateBehaviourToMetaMap(loaderMetas: LoaderMeta[]): BehaviourToMetasMap {
    loaderMetas.forEach(loaderMeta => {
      const name = DependencyManager.getFullyQualifiedName(loaderMeta);
      const { behaviours } = loaderMeta.manifest;

      // Ensure the FQN is also listed as a Behaviour
      if (behaviours?.concat(name)) {
        behaviours.forEach(behaviour => {
          this.behaviourToMetasMap[behaviour] = this.behaviourToMetasMap[behaviour] || [];
          this.behaviourToMetasMap[behaviour].push(loaderMeta);
        });
      }
    });

    return this.behaviourToMetasMap;
  }

  /**
   * Retrieves unique FQNs for an AccessorName
   */
  getFqnsForAccessorName(accessorName: string): string[] {
    // FIXME: Do we need to check here?
    // We're already checking in hydrateAccessorToFqnMap. Is this useful outside of this class?
    // if (!this.behaviourToMetaMap[accessorName]) {
    //   throw new Error(`${MODULE_NAME} - [DependencyMissing] Missing Dependency for Accessor: ${accessorName}`);
    // }

    // Assumes Behaviors are Hydrated!
    return this.behaviourToMetasMap[accessorName].map(DependencyManager.getFullyQualifiedName).sort();
  }

  /**
   * Iterates over LoaderMetas and builds unique array of AccessorNames
   */
  getAccessorNamesForMetas(loaderMetas: LoaderMeta[]): string[] {
    const names = loaderMetas.reduce((names: Set<string>, accessorPlugin) => {
      if (accessorPlugin.manifest.accessors) {
        Object.values(accessorPlugin.manifest.accessors).forEach(behaviorName => names.add(behaviorName));
      }

      return names;
    }, new Set<string>());

    return [...names].sort();
  }

  /**
   * Breadth First Search, Post-Order to determine resolved
   * order of dependencies for a grouping of Accessor Names
   */
  hydrateAccessorToFqnChainMap(accessorNames: string[], currChain: string[] = []): AccessorToFqnChainMap {
    for (let accessorName of accessorNames) {
      // Skip if this has been processed before
      if (this.accessorToFqnChainMap[accessorName]) {
        continue;
      }

      // Look up Accessor for all Plugins that satisfy it
      const metasForAccessorName = this.behaviourToMetasMap[accessorName];

      // Break immediately if Accessor/Plugin is missing
      if (0 == metasForAccessorName?.length) {
        //FIXME: Type this error!
        //FIXME: Chain error??? When/where do we need those even??
        throw new Error(`${MODULE_NAME} - [PluginMissing] No Plugin Manifests provide for Accessor: ${accessorName}`);
      }

      // Get all Plugin Names of the iterated Accessor
      const fqnsForAccessorName = this.getFqnsForAccessorName(accessorName);
      // Get all dependency Accessor Names of the Plugins in the behaviourGroup
      const dependencyAccessorNames = this.getAccessorNamesForMetas(metasForAccessorName);

      // Convert all Accessor Names into their associative Plugin Names
      let dependencyFQNs: string[] = [];

      // "Unzip" all FQNs across the dependencies' AccessorNames
      if (dependencyAccessorNames) {
        dependencyAccessorNames.forEach(
          accessorName => (dependencyFQNs = dependencyFQNs.concat(this.getFqnsForAccessorName(accessorName)))
        );
      }

      // Break if cyclic reference (aka, this chain tried loading this dependency before)
      const pluginsCyclical = dependencyFQNs.filter(pluginName => currChain.includes(pluginName));
      if (0 !== pluginsCyclical.length) {
        throw new Error(`${MODULE_NAME} - [Cyclical] Dependency Detected: ${currChain.join(' -> ')}`);
      }

      // Sub-Accessors may exist, so we need to recursively build their chain maps
      if (0 !== dependencyFQNs.length) {
        // If existing, update the known Accessors for the chosen
        //  `associatedAccessorName` to be loaded after the newly found ones
        this.accessorToFqnChainMap[accessorName] = dependencyFQNs;

        // Recursively detect depencency tree
        //   - Make sure we know about ourselves in the Plugin Chain, but don't update the
        //     original for subsequent sibling iterations (creates duplicates)!
        this.hydrateAccessorToFqnChainMap(dependencyAccessorNames, currChain.concat(accessorName));
      }
    }

    return this.accessorToFqnChainMap;
  }

  /**
   * Breadth First Search, Post-Order to Instantiate Plugin Instances
   */
  async loadChainMap(pluginNames: string[]): Promise<FqnInstanceMap> {
    for (let pluginName of pluginNames) {
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

  async mapAccessorAliasesToInstances(accessorAliasDefinitions: {
    [accessorName: string]: string;
  }): Promise<AccessorAliasInstanceMap> {
    //FIXME: Missing plugins in the loadMap should probably fail catastrophically!

    const aliasNames = Object.keys(accessorAliasDefinitions);

    return aliasNames.reduce<AccessorAliasInstanceMap>((map, alias) => {
      const pluginNames = this.getFqnsForAccessorName(accessorAliasDefinitions[alias]);

      pluginNames.forEach(pluginName => {
        if (this.fqnInstanceMap[pluginName]) {
          map[alias] = map[alias] || [];
          map[alias].push(this.fqnInstanceMap[pluginName]);
        } else {
          //FIXME: Could this even happen? The idea is that a plugin has an accessor
          // for a plugin that hasn't be considered for load
          const newError = new DependencyChainError(pluginName, new Error(`No Plugins loaded for Accessor: ${alias}!`));
          this.fqnFailMap[pluginName] = newError;
          throw newError;
        }
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
      const pluginInstance: Base = new (loaderMeta.pluginDefinition as any)({
        host: this.pluginHost,
        manifest: loaderMeta.manifest,
        accessors: accessorAliasMap
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

  //TODO Finish unloading of plugins thoroughly
  async unloadPluginInstance(pluginName: string): Promise<Base> {
    try {
      const pluginInstance = this.fqnInstanceMap[pluginName];

      await pluginInstance.stop();

      // const accessorNames = this.getAccessorNamesForPlugins([pluginInstance]);

      delete this.fqnInstanceMap[pluginName];
      delete this.fqnMetaMap[pluginName];
      // accessorNames.forEach(n => this.behaviourToMetaMap[n].splice(this.behaviourToMetaMap[n].indexOf(n), 1));

      return pluginInstance;
    } catch (err) {
      log('Error stopping Plugin...', err);

      throw err;
    }
  }
}
