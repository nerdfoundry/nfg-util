import PluginBase, { PluginStatus, PluginType, type PluginManifest } from './Base';
import PluginHost from './Host';

jest.mock('./Host', () =>
  jest.fn(() => ({
    getOption: jest.fn(),
    setOption: jest.fn()
  }))
);

describe('Plugin Base', () => {
  let base: PluginBase;
  let host: PluginHost;

  beforeEach(() => {
    const manifest: PluginManifest = {
      behaviours: [],
      name: 'fakePlugin',
      type: PluginType.SERVICE,
      pluginPath: '',
      version: '1.0.0'
    };

    host = new PluginHost();
    base = new PluginBase({
      host,
      manifest,
      accessors: {}
    });
  });

  it('should assign the name as a Behaviour on initializing', () => {
    expect(base.manifest.behaviours).toContain('fakePlugin');
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
    jest.spyOn(base, 'stop').mockReturnValue(Promise.resolve(false));
    jest.spyOn(base, 'start').mockReturnValue(Promise.resolve(true));

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
