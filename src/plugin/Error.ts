class PluginError extends Error {
  type: string;
  pluginName: string;

  constructor(type: string, pluginName: string, msg: string) {
    super(`[${type}] - ${msg}`);

    this.type = type;
    this.pluginName = pluginName;

    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

export class NotEnabledError extends PluginError {
  constructor(pluginName: string) {
    const type = 'Base.NotEnabledError';

    super(type, pluginName, 'Plugin is not Enabled');

    Object.setPrototypeOf(this, NotEnabledError.prototype);
  }
}

export class AlreadyEnabledError extends PluginError {
  constructor(pluginName: string) {
    const type = 'Base.AlreadyEnabledError';

    super(type, pluginName, 'Plugin is not already Enabled, and cannot be re-Enabled');

    Object.setPrototypeOf(this, AlreadyEnabledError.prototype);
  }
}
