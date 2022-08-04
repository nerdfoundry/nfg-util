import _get from 'lodash.get';
import _set from 'lodash.set';
import Host from './Host.js';

vi.mock('lodash.set', vi.fn().mockReturnValue({ default: vi.fn() }));
vi.mock('lodash.get', vi.fn().mockReturnValue({ default: vi.fn() }));

vi.mock('./Relay.js', vi.fn().mockReturnValue({ default: vi.fn() }));

describe('Plugin Host', () => {
  let host: Host;

  beforeEach(() => {
    host = new Host();
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
