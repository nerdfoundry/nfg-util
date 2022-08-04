import uniq from 'lodash.uniq';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import Logger from '../core/Logger.js';
import Base, { type AccessorAliasMap, type Manifest } from './Base.js';
import Host from './Host.js';
import { type ILoaderMeta } from './Loader.js';

const MODULE_NAME: string = path.basename(__filename, path.extname(__filename));
const log = Logger.extend(MODULE_NAME);

export type PluginNameMap = Record<string, ILoaderMeta>;

export type BehaviourNameMap = Record<string, Array<ILoaderMeta>>;

export type PluginLoadMap = Record<string, Promise<Base>>;

export type PluginFailMap = Record<string, DependencyChainError>;

export type PluginChainMap = Record<string, Array<string>>;

export class DependencyChainError extends Error {
  origError: Error;
  chainMap: Array<string> = [];

  constructor(pluginName: string, origError: Error) {
    super(`[DependencyChainError] - ${pluginName} has failed an entire dependency chain`);

    this.origError = origError;
    this.chainMap.push(pluginName);

    Error.captureStackTrace(this, DependencyChainError);
  }
}

export default class DependencyManager extends EventEmitter {
  behaviourNameMap: BehaviourNameMap = {};
  chainMap: PluginChainMap = {};
  failMap: PluginFailMap = {};
  loadMap: PluginLoadMap = {};
  pluginNameMap: PluginNameMap = {};

  static getFullyQualifiedName(resource: ILoaderMeta | Base) {
    return `${resource.manifest.name}-v${resource.manifest.version}`;
  }

  constructor(public pluginHost: Host) {
    super();

    let loaded = 0;
    let total = 0;
    this.on('detected', (names: Array<string>) => {
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
  async loadPluginDefinitions(loaderInfos: Array<ILoaderMeta>): Promise<PluginLoadMap> {
    const pluginNameMap = this.buildPluginNameMap(loaderInfos);
    // Assume Plugin Names as Accessor Names for newly loaded Plugins
    const pluginNames = Object.keys(pluginNameMap);

    this.emit('detected', pluginNames);

    // Plugin names already loaded result in an error
    for (let name of pluginNames.concat()) {
      if (this.loadMap.hasOwnProperty(name)) {
        // Remove from known Plugin names and new name map to avoid further processing
        pluginNames.splice(pluginNames.indexOf(name), 1);
        delete pluginNameMap[name];
        this.failMap[name] = new DependencyChainError(name, new Error('Already Loaded'));
      } else {
        this.pluginNameMap[name] = pluginNameMap[name];
      }
    }

    // Blind overwrite of previously named mappings with new mapping.
    // This should normally only be due to newly loaded Plugins adding their behaviour to a previous list.
    const behaviourNameMap = this.buildBehaviourNameMap(loaderInfos);
    const behaviourNames = Object.keys(behaviourNameMap);
    behaviourNames.forEach(name => (this.behaviourNameMap[name] = behaviourNameMap[name]));

    const chainMap = this.buildAccessorChainMap(pluginNames);
    const chainNames = Object.keys(chainMap);
    chainNames.forEach(name => (this.chainMap[name] = chainMap[name]));

    await this.loadChainMap(pluginNames);

    return this.loadMap;
  }

  buildPluginNameMap(loaderMetas: Array<ILoaderMeta>): PluginNameMap {
    const hasDupe: Array<string> = [];

    const pluginMap = loaderMetas.reduce<PluginNameMap>((map, loaderMeta: ILoaderMeta) => {
      const name = DependencyManager.getFullyQualifiedName(loaderMeta);
      // Semaphore, must be handled outside of reduction or causes an uncaught exception
      if (map[name]) {
        hasDupe.push(name);
      } else {
        map[name] = loaderMeta;
      }

      return map;
    }, {});

    //@ts-ignore:next-line
    if (0 < hasDupe.length) {
      throw new Error(`${MODULE_NAME} - [DuplicateName] Duplicate Plugins detected: ${hasDupe.join(', ')}`);
    }

    return pluginMap;
  }

  buildBehaviourNameMap(pluginLoaderMetas: Array<ILoaderMeta>): BehaviourNameMap {
    let retMap: BehaviourNameMap = {};

    return pluginLoaderMetas.reduce<BehaviourNameMap>((map, pluginClass: ILoaderMeta) => {
      const { behaviours } = pluginClass.manifest as Manifest;
      const name = DependencyManager.getFullyQualifiedName(pluginClass);
      if (behaviours) {
        behaviours.forEach(behaviour => {
          map[behaviour] = map[behaviour] || [];
          (map[behaviour] as Array<Object>).push(pluginClass);
        });
      }
      // Ensure the Plugin name listed as a Behaviour
      map[name] = map[name] || [];
      (map[name] as Array<Object>).push(pluginClass);
      return map;
    }, retMap);
  }

  getAccessorNamesForPlugins(accessorGroup: Array<ILoaderMeta>): Array<string> {
    const names = accessorGroup.reduce((names: Array<string>, accessorPlugin) => {
      if (accessorPlugin.manifest.accessors) {
        const subAccessorNames = Object.values(accessorPlugin.manifest.accessors);
        names = subAccessorNames.concat(names);
      }

      return names;
    }, []);

    return uniq(names).sort();
  }

  accessorNameToPluginNames(accessorName: string): Array<string> {
    if (!this.behaviourNameMap[accessorName]) {
      throw new Error(`${MODULE_NAME} - [DependencyMissing] Missing Dependency for Accessor: ${accessorName}`);
    }

    return uniq(
      this.behaviourNameMap[accessorName].map(loaderMeta => DependencyManager.getFullyQualifiedName(loaderMeta))
    ).sort();
  }

  buildAccessorChainMap(
    accessorNames: Array<string>,
    chainMap: PluginChainMap = {},
    pluginChain: Array<string> = []
  ): PluginChainMap {
    for (let accessorName of accessorNames) {
      // Skip if this has been processed before
      if (chainMap[accessorName]) {
        continue;
      }

      // Look up accessor for all Plugins that satisfy it
      const behaviourGroup = this.behaviourNameMap[accessorName];
      // Break immediately if Accessor/Plugin is missing
      if (!behaviourGroup || 0 == behaviourGroup.length) {
        throw new Error(`${MODULE_NAME} - [PluginMissing] No reference found for Accessor: ${accessorName}`);
      }

      // Get all Plugin Names of the iterated Accessor
      const accessorPluginNames = new Set(this.accessorNameToPluginNames(accessorName));
      // Get all dependency Accessor Names of the Plugins in the behaviourGroup
      const dependencyAccessorNames = this.getAccessorNamesForPlugins(behaviourGroup);
      // Convert all Accessor Names into their associative Plugin Names
      const dependencyPluginNames = dependencyAccessorNames
        ? dependencyAccessorNames.reduce<Array<string>>(
            (plugins: Array<string>, name: string) => plugins.concat(this.accessorNameToPluginNames(name)),
            []
          )
        : [];
      // Break if self referenced
      const pluginsSelfRef = dependencyPluginNames.filter(pluginName => accessorPluginNames.has(pluginName));
      if (0 !== pluginsSelfRef.length) {
        throw new Error(`${MODULE_NAME} - [SelfReference] Invalid Self Reference: ${[...pluginsSelfRef].join(', ')}`);
      }

      // Break if cyclic reference
      const pluginsCyclical = dependencyPluginNames.filter(pluginName => pluginChain.includes(pluginName));
      if (0 !== pluginsCyclical.length) {
        throw new Error(`${MODULE_NAME} - [Cyclical] Dependency Detected: ${pluginChain.join(' -> ')}`);
      }

      // Sub-Accessors exist, so we need to recursively build their chain maps
      if (0 !== dependencyPluginNames.length) {
        // If existing, update the known Accessors for the chosen
        //  `associatedAccessorName` to be loaded after the newly found ones
        chainMap[accessorName] = uniq(dependencyPluginNames);

        // Recursively detect depencency tree
        //   - Make sure we know about ourselves in the Plugin chain, but don't update the
        //     original for subsequent sibling iterations!
        this.buildAccessorChainMap(dependencyPluginNames, chainMap, pluginChain.concat(accessorName));
      }
    }

    return chainMap;
  }

  async loadChainMap(pluginNames: Array<string>): Promise<Array<Base>> {
    const pluginLoads = pluginNames.map(async pluginName => {
      // Already loaded, let's shortcut
      if (this.loadMap.hasOwnProperty(pluginName)) {
        return this.loadMap[pluginName];
      }

      let loadChain: any = Promise.resolve();

      const pluginChainList = this.chainMap[pluginName];

      // If we have a dependency Plugin Chain, recursively process it...
      if (pluginChainList) {
        loadChain = loadChain.then(() => this.loadChainMap(pluginChainList));
      }

      loadChain = loadChain.then(() => this.loadPluginInstance(pluginName));

      this.loadMap[pluginName] = loadChain;

      return loadChain;
    });

    return await Promise.all(pluginLoads);
  }

  async mapAccessorAliases(accessorAliasDefinitions: { [accessorName: string]: string }): Promise<AccessorAliasMap> {
    const aliasNames = Object.keys(accessorAliasDefinitions);
    const map: AccessorAliasMap = {};

    for (let alias of aliasNames) {
      const pluginNames: Array<string> = this.accessorNameToPluginNames(accessorAliasDefinitions[alias]);

      map[alias] = await Promise.all(pluginNames.map(pluginName => this.loadMap[pluginName]));
    }

    return map;
  }

  async loadPluginInstance(pluginName: string): Promise<Base> {
    try {
      const loaderMeta = this.pluginNameMap[pluginName];
      const accessorAliasMap = loaderMeta.manifest.accessors
        ? await this.mapAccessorAliases(loaderMeta.manifest.accessors)
        : null;

      // Previously loaded Plugins re-use instances for subsequent requests
      // Not loaded, so we instantiate and load!
      const pluginInstance: Base = new (loaderMeta.pluginDefinition as any)({
        host: this.pluginHost,
        manifest: loaderMeta.manifest,
        accessors: accessorAliasMap
      });

      const promiseChain = Promise.resolve()
        .then(() => pluginInstance.enable())
        .then(() => pluginInstance.start())
        .then(() => this.emit('loaded', pluginInstance))
        .then(() => pluginInstance);

      return promiseChain;
    } catch (err) {
      const errCasted = err as Error;

      log('Error enabling/starting Plugin...', errCasted);

      const newError = new DependencyChainError(pluginName, errCasted);
      this.failMap[pluginName] = newError;
      throw newError;
    }
  }

  //TODO Finish unloading of plugins thoroughly
  async unloadPluginInstance(pluginName: string): Promise<Base> {
    try {
      const pluginInstance = await this.loadMap[pluginName];

      await pluginInstance.stop();

      // const accessorNames = this.getAccessorNamesForPlugins([pluginInstance]);

      delete this.loadMap[pluginName];
      delete this.pluginNameMap[pluginName];
      // accessorNames.forEach(n => this.behaviourNameMap[n].splice(this.behaviourNameMap[n].indexOf(n), 1));

      return pluginInstance;
    } catch (err) {
      log('Error stopping Plugin...', err);

      throw err;
    }
  }
}
