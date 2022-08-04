import _get from 'lodash.get';
import _set from 'lodash.set';
import Relay from './Relay.js';

const SETTINGS = {};

export default class Host {
  relay: Relay;

  constructor() {
    this.relay = new Relay();
  }

  getOption(path: string) {
    return _get(SETTINGS, path);
  }

  setOption(path: string, val: any) {
    _set(SETTINGS, path, val);
  }
}
