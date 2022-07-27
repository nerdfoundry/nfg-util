import envPlugin from '@chialab/esbuild-plugin-env';
import htmlPlugin from '@chialab/esbuild-plugin-html';
import esbuild, { type BuildOptions, type Platform } from 'esbuild';
import { definedProps } from '../core/index.js';
//@ts-ignore
import copyStaticFiles from 'esbuild-copy-static-files';
import sassPlugin from 'esbuild-plugin-sass';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

export interface ESBuilderOptions {
  dirStatic: string;
  dirOut: string;
  dirSrc: string;
  devPort: number;
  forceBuildOnly: boolean;
  nodeEnv: string;
  verbose: boolean;

  buildOptions: BuildOptions;
}

const DEFAULT_ESBUILDEROPTIONS: Partial<ESBuilderOptions> = {
  devPort: 9000,
  dirOut: 'dist',
  dirSrc: path.resolve('src'),
  dirStatic: 'static',
  forceBuildOnly: false,
  nodeEnv: 'development',
  verbose: false,

  buildOptions: {
    assetNames: isProd ? undefined : '[name]',
    bundle: true,
    metafile: true,
    minify: isProd,
    platform: 'browser',
    sourcemap: isProd ? false : 'inline',
    target: 'esnext'
  }
};

const ENV_ESBUILDEOPTIONS: Partial<ESBuilderOptions> = {
  devPort: !!process.env.DEVPORT ? parseInt(process.env.DEVPORT!) : undefined,
  dirSrc: !!process.env.DIRSRC ? path.resolve(process.env.DIRSRC!) : undefined!,
  dirOut: !!process.env.DIROUT ? process.env.DIROUT! : undefined!,
  dirStatic: !!process.env.DIRSTATIC ? process.env.DIRSTATIC! : undefined!,
  forceBuildOnly: !!process.env.FORCEBUILDONLY,
  nodeEnv: process.env.NODE_ENV || 'development',
  verbose: !!process.env.VERBOSE,

  buildOptions: {
    metafile: true,
    minify: isProd,
    outdir: !!process.env.DIROUT ? process.env.DIROUT! : undefined,
    platform: !!process.env.RUNTIMEPLATFORM ? (process.env.RUNTIMEPLATFORM as Platform) : undefined,
    sourcemap: isProd ? false : 'inline',
    target: !!process.env.JSTARGET ? process.env.JSTARGET! : undefined,
    logLevel: !!process.env.VERBOSE ? 'debug' : 'info'
  }
};

/**
 * Browser-first ESBuilder
 *
 * Override getters, or supply input options to constructor to override behavior!
 *
 * Available Environment Variables
 * DEVPORT - Port to run Dev Server on, defaults to `9000`
 * DIROUT - Output directory for bundle(s), defaults to 'dist'
 * DIRSRC - Source directory for input(s), defaults to 'src'
 * DIRSTATIC - Input directory for static files, defaults to 'static'
 * EXTERNALS - Libs to consider external and not included in bundle(s) (i.e., './node_modules/*'), defaults to []
 * FILESRC - Input filename(s) for entrypoints, separated by '|' (i.e., 'index.html|anotherView.html'),
 *            defaults to 'index.html'
 * FORCEBUILDONLY - Set to anything to force an output build, useful for when NODE_ENV=development,
 *            but you want to see the source instead of a dev server
 * JSTARGET - ESBuild-specific JS Target, defaults to 'esnext'
 * NODE_ENV - Your standard node env variable, defaults to 'development'
 * RUNTIMEPLATFORM - ESBuild-specific Platform target, defaults to 'browser'
 * VERBOSE - Set to anything to output extra info when building
 */
export class ESBuilder {
  public isProd = isProd;

  /**
   * Resolve proper Root Path for project
   */
  get rootPath() {
    return this._options.dirSrc || ENV_ESBUILDEOPTIONS.dirSrc || DEFAULT_ESBUILDEROPTIONS.dirSrc!;
  }

  /**
   * Dynamic resolution of Entrypoints for ESBuild, relative to `dirRoot`
   *
   * See: https://esbuild.github.io/api/#entry-points
   */
  get entryPoints(): BuildOptions['entryPoints'] {
    // Grab ENV value, or default to index.html
    const entryPoints = (!!process.env.FILESRC ? process.env.FILESRC.split('|') : []) || ['index.html'];

    console.log('Root Path:', this.rootPath);

    // Build path relative to root dir
    return entryPoints.map(ep => path.join(this.rootPath, ep));
  }

  /**
   * Dynamic resolution of Externals for ESBuild
   *
   * See: https://esbuild.github.io/api/#external
   */
  get externals(): BuildOptions['external'] {
    return (!!process.env.EXTERNALS ? process.env.EXTERNALS.split('|') : []) || [];
  }

  /**
   * Available loaders to ESBuild
   *
   * See: https://esbuild.github.io/api/#loader
   */
  get loaders(): BuildOptions['loader'] {
    return {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.png': 'file',
      '.svg': 'file'
    };
  }

  /**
   * Build Plugin array for ESBuild pipeline
   */
  get plugins(): BuildOptions['plugins'] {
    return [
      envPlugin(),
      htmlPlugin(),
      sassPlugin(),
      copyStaticFiles({
        src: this._options.dirStatic,
        dest: this._options.dirOut
      })
    ];
  }

  /**
   * Dynamically generates options as needed, typically upon ready to build or serve for dev.
   */
  get options(): ESBuilderOptions {
    let opts = Object.assign(
      {},
      definedProps(this._options),
      definedProps<ESBuilderOptions>(DEFAULT_ESBUILDEROPTIONS),
      definedProps<ESBuilderOptions>(ENV_ESBUILDEOPTIONS)
    );

    // Continue building based on Defaults+ENV
    opts = Object.assign(opts, {
      buildOptions: Object.assign(
        definedProps<BuildOptions>(DEFAULT_ESBUILDEROPTIONS.buildOptions!),
        definedProps<BuildOptions>(ENV_ESBUILDEOPTIONS.buildOptions!),
        definedProps<BuildOptions>(opts.buildOptions),
        {
          outdir: opts.dirOut,
          entryPoints: this.entryPoints,
          external: this.externals,
          loader: this.loaders
        }
      )
    });

    if (opts.verbose) {
      console.log('Input Options', this._options);
      console.log('Default Options', DEFAULT_ESBUILDEROPTIONS);
      console.log('ENV-based Options', ENV_ESBUILDEOPTIONS);
      console.log('Derived Options', opts);
    }

    return opts;
  }

  constructor(private _options: Partial<ESBuilderOptions> = {}) {}

  /**
   * Perform Build, based on environment and options
   */
  async build() {
    const opts = this.options;

    if (opts.forceBuildOnly || this.isProd) {
      await this._runBuild(opts);
    } else {
      await this._runDevServer(opts);
    }
  }

  /**
   * Run build only and complete
   */
  protected async _runBuild(opts: ESBuilderOptions) {
    const buildResult = await esbuild.build(opts.buildOptions);

    if (opts.verbose) {
      console.log('Build Result', buildResult);
    }

    console.log(`Build (${opts.nodeEnv}) Complete:\n\tBuildDir: ${opts.dirOut}`);
  }

  /**
   * Run Dev Server for continuous building and serving files.
   * Useful for web-work, not so much node-work
   */
  protected async _runDevServer(opts: ESBuilderOptions) {
    const { host, port } = await esbuild.serve(
      {
        port: opts.devPort,
        servedir: opts.dirOut
      },
      opts.buildOptions
    );

    console.log(`Dev Server Running:\n\tServeDir:  ${opts.dirOut}\n\tDevServer: ${host}:${port}`);
  }
}
