import { AlreadyEnabledError, NotEnabledError } from './Error.js';
import Host from './Host.js';

export enum PluginType {
  SERVICE = 'SERVICE',
  GUI_COMMON = 'GUI_COMMON',
  GUI_MAIN = 'GUI_MAIN'
}

export enum PluginStatus {
  STOPPED,
  STARTED,
  PAUSED,
  ERRORED
}

type Behavior = string;
type AccessorAlias = string;

export interface Manifest {
  // Accessor Manifest Config
  accessors?: Record<AccessorAlias, Behavior>;
  behaviors?: Behavior[];
  pluginPath: string;
  name: string;
  type: PluginType;
  version: string;
  // views?: object; //TODO: Type this out with sub-views
}

export type AccessorAliasInstanceMap = Record<AccessorAlias, Set<Base>>;

export interface IPluginOptions {
  host: Host;
  manifest: Manifest;
  // Resolved Accessors, from DepMgr
  accessors?: AccessorAliasInstanceMap;
}

export default class Base {
  static ROOT_KEY = 'Plugins';

  accessors: AccessorAliasInstanceMap;
  host: Host;
  manifest: Manifest;
  enabled = false;
  status: PluginStatus = PluginStatus.STOPPED;

  constructor(options: IPluginOptions) {
    this.accessors = options.accessors || {};
    this.host = options.host;
    this.manifest = Object.freeze(options.manifest);
    this.enabled = this.getSetting('enabled') || false;

    if (this.manifest.behaviors && false === this.manifest.behaviors.includes(this.manifest.name)) {
      this.manifest.behaviors.push(this.manifest.name);
    }
  }

  async start(): Promise<this> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    this.status = PluginStatus.STARTED;

    return Promise.resolve(this);
  }

  async stop(): Promise<this> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    this.status = PluginStatus.STOPPED;

    return Promise.resolve(this);
  }

  async restart(): Promise<this> {
    return this.stop().then(() => this.start());
  }

  async enable(): Promise<this> {
    if (true === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new AlreadyEnabledError(this.manifest.name);
    }

    this.enabled = true;

    return Promise.resolve(this);
  }

  async disable(): Promise<this> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    await this.stop();

    this.enabled = false;

    return Promise.resolve(this);
  }

  get _settingPath() {
    return `${Base.ROOT_KEY}.${this.manifest.name}`;
  }

  getSetting(settingPath: string) {
    return this.host.getOption(`${this._settingPath}.${settingPath}`);
  }

  // eslint-disable-next-line
  setSetting(settingPath: string, val: any) {
    this.host.setOption(`${Base.ROOT_KEY}.${this.manifest.name}.${settingPath}`, val);
  }
}
