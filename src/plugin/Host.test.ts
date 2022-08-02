import _get from 'lodash.get';
import _set from 'lodash.set';
import PluginHost from './Host';

jest.mock('lodash.set', () => jest.fn());
jest.mock('lodash.get', () => jest.fn());

jest.mock('./Relay');

describe('Plugin Host', () => {
  let host: PluginHost;

  beforeEach(() => {
    host = new PluginHost();
  });

  it('should set an option', () => {
    host.setOption('option.key', 'someValue');

    expect(_set).toHaveBeenCalled();
  });

  it('should get an option', () => {
    host.getOption('option.key');

    expect(_get).toHaveBeenCalled();
  });
});
