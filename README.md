# nfg-util

Utilities, scripts, and library for NFG-based projects.

## Running/Building

For Active Development:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml up
```

For a Development bundle:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.dev-build.yml up
```

For a Production bundle:

```sh
docker-compose -f ./docker-compose.yml -f ./docker-compose.prod.yml up
```

### Adding Dependencies

While running in `Active Development` mode, simply exec `npm` or attach into the running container:

```sh
docker exec -it nfg-util npm i -D someutil

#or

docker exec -it nfg-util ash # You're now in a shell!
```

## Files

| Path          | Description                                |
| ------------- | ------------------------------------------ |
| tsconfig.json | Base `tsconfig.json` for all NFG projects. |

## Namespaces

| Namespace | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| build     | Build toolchain code.                                                  |
| core      | Core/Common Utility functions that are effectively namespace-agnostic. |
| plugin    | ESM-based Plugin Architecture.                                         |



### Plugin

#### DependencyManager

General Code Flow:

- loadPluginDefinitions()
    - hydrateFqnToMetaMap()
      * Detects duplicate FQNs
      * Detects previously loaded FQNs
      * Accepts newly discovered plugin metas
      * Throws errors if dupes found earlier
    - hydrateBehaviourToMetaMap()
      * Maps all Behaviors across all Metas to said Metas
      * Multiple Metas can satisfy a Behavior
    - hydrateAccessorToFqnMap()
      * For valid MetaLoaders, detects if any plugins provide desired accessor names,
        throws error if missing
      - getFqnsForAccessorName() - retrieves all FQNs for a particular Accessor Name
      - getAccessorNamesForMetas() - retrieves unique AccessorNames for all loading Metas
      * Determines all FQNs for Accessors of Dependency MetaLoaders
      * Error Checks for Cyclical Resolutions, and throws
      * Recursive call if there are any Dependency AccessorNames
    - loadChainMap()
      * Skips already loading/loaded Plugin Instances
      * Recursively Loads, starting at bottom leaf so there's no dependencies needed to start
      - loadPluginInstance()
        * For an FQN, an AccessorAliasInstanceMap mapping will be created that points to all Plugins providing the behavior defined by the AccessorAlias
        * For an FQN, a Plugin Instance will be created
        * Enable Plugin
        * Start Plugin, injecting Host, LoaderManifest, and the new AccessorAliasInstanceMap
