import _get from 'lodash.get';
import _set from 'lodash.set';
import PluginRelay from './Relay';

const SETTINGS = {};

export default class PluginHost {
  relay: PluginRelay;

  constructor() {
    this.relay = new PluginRelay();
  }

  getOption(path: string) {
    return _get(SETTINGS, path);
  }

  setOption(path: string, val: any) {
    _set(SETTINGS, path, val);
  }
}
