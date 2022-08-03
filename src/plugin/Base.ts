import { AlreadyEnabledError, NotEnabledError } from './Error';
import Host from './Host';

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
  behaviours?: Array<Behavior>;
  pluginPath: string;
  name: string;
  type: PluginType;
  version: string;
  // views?: object; //TODO: Type this out with sub-views
}

export type AccessorAliasMap = Record<AccessorAlias, Array<Base>>;

export interface IPluginOptions {
  host: Host;
  manifest: Manifest;
  // Resolved Accessors, from DepMgr
  accessors: AccessorAliasMap;
}

export default class Base {
  static ROOT_KEY: string = 'Plugins';

  accessors: AccessorAliasMap;
  host: Host;
  manifest: Manifest;
  enabled: boolean = false;
  status: PluginStatus = PluginStatus.STOPPED;

  constructor(options: IPluginOptions) {
    this.accessors = options.accessors!;
    this.host = options.host;
    this.manifest = Object.freeze(options.manifest);
    this.enabled = this.getSetting('enabled') || false;

    if (this.manifest.behaviours && false === this.manifest.behaviours.includes(this.manifest.name)) {
      this.manifest.behaviours.push(this.manifest.name);
    }
  }

  async start(): Promise<any> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    this.status = PluginStatus.STARTED;

    return Promise.resolve(this);
  }

  async stop(): Promise<any> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    this.status = PluginStatus.STOPPED;

    return Promise.resolve(this);
  }

  async restart(): Promise<any> {
    return this.stop().then(() => this.start());
  }

  async enable(): Promise<any> {
    if (true === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new AlreadyEnabledError(this.manifest.name);
    }

    this.enabled = true;

    return Promise.resolve(this);
  }

  async disable(): Promise<any> {
    if (false === this.enabled) {
      this.status = PluginStatus.ERRORED;
      throw new NotEnabledError(this.manifest.name);
    }

    await this.stop();

    this.enabled = false;

    return Promise.resolve(this);
  }

  getSetting(settingPath: string) {
    return this.host.getOption(`${Base.ROOT_KEY}.${this.manifest.name}.${settingPath}`);
  }

  setSetting(settingPath: string, val: any) {
    this.host.setOption(`${Base.ROOT_KEY}.${this.manifest.name}.${settingPath}`, val);
  }
}
