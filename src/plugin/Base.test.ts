import Base, { PluginStatus, PluginType, type Manifest } from './Base.js';
import Host from './Host.js';

vi.mock('./Host', () => ({
  default: vi.fn(() => ({
    getOption: vi.fn(),
    setOption: vi.fn()
  }))
}));

describe('Plugin Base', () => {
  let base: Base;
  let host: Host;

  beforeEach(() => {
    const manifest: Manifest = {
      behaviors: [],
      name: 'fakePlugin',
      type: PluginType.SERVICE,
      pluginPath: '',
      version: '1.0.0'
    };

    host = new Host();
    base = new Base({
      host,
      manifest,
      accessors: {}
    });
  });

  it('should assign the name as a Behavior on initializing', () => {
    expect(base.manifest.behaviors).toContain('fakePlugin');
  });

  it('should throw an Error when not enabled on start', async () => {
    await expect(base.start()).rejects.toThrow('NotEnabledError');
  });

  it('should be in an errored state when failed on start', async () => {
    try {
      await base.start();
      expect(false).toBeTruthy(); // should fail, but never hit!
    } catch (err) {
      expect(base.status).toBe(PluginStatus.ERRORED);
    }
  });

  it('should start if enabled', async () => {
    base.enabled = true;

    await base.start();

    expect(base.status).toBe(PluginStatus.STARTED);
  });

  it('should throw an Error when not enabled on stop', async () => {
    await expect(base.stop()).rejects.toThrow('NotEnabledError');
  });

  it('should be in an errored state when failed on stop', async () => {
    try {
      await base.stop();
      expect(false).toBeTruthy(); // should fail, but never hit!
    } catch (err) {
      expect(base.status).toBe(PluginStatus.ERRORED);
    }
  });

  it('should stop if enabled', async () => {
    base.enabled = true;
    base.status = PluginStatus.STARTED;

    await base.stop();

    expect(base.status).toBe(PluginStatus.STOPPED);
  });

  it('should restart', async () => {
    vi.spyOn(base, 'stop').mockReturnValue(Promise.resolve(base));
    vi.spyOn(base, 'start').mockReturnValue(Promise.resolve(base));

    await expect(base.restart()).resolves.toBeTruthy();
  });

  it('should throw an Error when already enabled on enabling', async () => {
    base.enabled = true;

    await expect(base.enable()).rejects.toThrow('AlreadyEnabledError');
  });

  it('should be in an errored state when failed on enable', async () => {
    try {
      base.enabled = true;

      await base.enable();
      expect(false).toBeTruthy(); // should fail, but never hit!
    } catch (err) {
      expect(base.status).toBe(PluginStatus.ERRORED);
    }
  });

  it('should enable if disabled', async () => {
    await base.enable();
    expect(base.enabled).toBe(true);
  });

  it('should throw an Error when not enabled on disabling', async () => {
    await expect(base.disable()).rejects.toThrow('NotEnabledError');
  });

  it('should be in an errored state when failed on disabling', async () => {
    try {
      await base.disable();
      expect(false).toBeTruthy(); // should fail, but never hit!
    } catch (err) {
      expect(base.status).toBe(PluginStatus.ERRORED);
    }
  });

  it('should disable if enabled', async () => {
    base.enabled = true;

    await base.disable();
    expect(base.enabled).toBe(false);
  });

  it('should delegate setting to the host with a predetermined pattern', () => {
    base.getSetting('someSetting');

    expect(host.getOption).toHaveBeenCalledWith('Plugins.fakePlugin.someSetting');
  });

  it('should delegate setting to the host with a predetermined pattern', () => {
    base.setSetting('anotherSetting', 'someValue');

    expect(host.setOption).toHaveBeenCalledWith('Plugins.fakePlugin.anotherSetting', 'someValue');
  });
});
