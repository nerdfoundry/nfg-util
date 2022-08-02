import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import Logger from '../core/Logger.js';
import PluginBase, { type PluginManifest } from './Base';
import DependencyManager, { type PluginLoadMap } from './DependencyManager';
import PluginHost from './Host';
import LoaderHelper from './LoaderHelper';

const MODULE_NAME: string = path.basename(__filename, path.extname(__filename));
const log = Logger.extend(MODULE_NAME);
const PACKAGE_IDENTIFIER = /.*package.json$/;

//@ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20497
const ReadDir: (path: string, options?: any) => Promise<Array<string>> = util.promisify(fs.readdir);
//@ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20497
const ReadFile: (path: string, options?: any) => Promise<string> = util.promisify(fs.readFile);
//@ts-ignore https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20497
const FileStat: (path: string, options?: any) => Promise<fs.Stats> = util.promisify(fs.stat);

//TODO: Consider generating a hashmap of known plugins
// First load will enable, and generate
// Subsequent loads will update generated map

export interface IInitOptions {
  pluginPaths: Array<string>;
  pluginTypes: Array<string>;
}

export interface ILoaderMeta {
  manifest: PluginManifest;
  pluginDefinition: typeof PluginBase;
}

export default class PluginLoader {
  static MANIFEST_KEY: string = 'MANIFEST';

  pluginHost?: PluginHost;
  depMgr?: DependencyManager;

  constructor(public options: IInitOptions) {
    this.options.pluginTypes = options.pluginTypes.map(o => o.toUpperCase());
  }

  async init(): Promise<PluginLoadMap> {
    const _DEBUG = log.extend('init');

    _DEBUG('Scanning for Plugin Packages...');

    this.pluginHost = new PluginHost();
    this.depMgr = new DependencyManager(this.pluginHost);

    this.setOptions();

    const pluginManifests = await this.scanForPlugins(this.options.pluginPaths);

    // Attempt to load the Plugin from the filesystem
    const loaderInfos = pluginManifests.reduce((classes: Array<ILoaderMeta>, manifest) => {
      classes.push({
        manifest,
        pluginDefinition: require(manifest.pluginPath).default
      });

      return classes;
    }, []);

    return this.depMgr.loadPluginDefinitions(loaderInfos);
  }

  setOptions() {
    // To be set by concrete class
  }

  async scanForPlugins(topLevelPaths: Array<string>): Promise<Array<PluginManifest>> {
    let foundManifests: Array<PluginManifest> = [];

    const _DEBUG = log.extend('scanForPlugins');

    _DEBUG(`Initiating Plugin Detection for ${topLevelPaths.length} Scan Directories`);

    try {
      for (let path of topLevelPaths) {
        const detPlugs: Array<PluginManifest> = await this.detectPluginPackages(path);
        foundManifests = foundManifests.concat(detPlugs);
      }
    } catch (err) {
      _DEBUG('Error loading Plugin from disk...');
      throw err;
    }

    _DEBUG(`Scan Complete, found ${foundManifests.length} Plugin Manifests`);

    return foundManifests;
  }

  async detectPluginPackages(scanDir: string): Promise<Array<PluginManifest>> {
    const _DEBUG = log.extend('detectPluginPackages');

    _DEBUG(`Scanning folder for Plugin Entries: ${scanDir}`);

    const potentialPluginDirs = await ReadDir(scanDir);
    const foundPlugins: Array<PluginManifest> = [];

    for (let pluginDir of potentialPluginDirs) {
      const isDir = (await FileStat(path.join(scanDir, pluginDir))).isDirectory();

      if (!isDir) {
        continue;
      }

      const entry = await this.findPluginManifest(path.join(scanDir, pluginDir));

      if (entry) {
        foundPlugins.push(entry);
      }
    }

    return foundPlugins;
  }

  async findPluginManifest(pluginDir: string): Promise<PluginManifest | undefined> {
    const _DEBUG = log.extend('findPluginEntrypoint');
    const pluginDirContents = await ReadDir(pluginDir);

    // Find the package file by the identifier
    let packagePath = pluginDirContents.find(fileName => PACKAGE_IDENTIFIER.test(fileName));
    if (!packagePath) {
      return;
    }

    packagePath = path.join(pluginDir, packagePath);

    const rawFile = await ReadFile(packagePath, 'utf8');
    const packageObj = JSON.parse(rawFile);
    const manifest = packageObj[PluginLoader.MANIFEST_KEY];

    if (!manifest) {
      return;
    }

    _DEBUG(`Detected Plugin: ${packageObj.name}`);

    // Ensure the plugin is intended for the runtime type (PluginType Enum)
    if (false === this.options.pluginTypes.includes((manifest.type as string).toUpperCase())) {
      return undefined;
    }

    return {
      ...manifest,
      pluginPath: pluginDir,
      name: packageObj.name,
      version: packageObj.version
    };
  }

  unloadModule(moduleName: string, baseDirectory: string) {
    // Check if this is a module nested within the given baseDirectory
    // Avoids removing things outside of the namespace of the plugin root
    if (-1 === moduleName.indexOf(baseDirectory)) {
      return;
    }

    let solvedName = LoaderHelper.resolve(moduleName),
      nodeModule = LoaderHelper.cache[solvedName];

    if (nodeModule) {
      for (let i = 0; i < nodeModule.children.length; i++) {
        let child = nodeModule.children[i];
        this.unloadModule(child.filename, baseDirectory);
      }

      log.extend('ModuleUnload')(`Incorrect type for runtime: ${solvedName}`);

      delete LoaderHelper.cache[solvedName];
    }
  }
}
