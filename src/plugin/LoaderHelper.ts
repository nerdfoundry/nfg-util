class LoaderHelper {
  resolve(modulePath: string) {
    return require.resolve(modulePath);
  }

  get cache() {
    return require.cache;
  }
}

export default new LoaderHelper();
