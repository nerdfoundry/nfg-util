# TODO

* Clean up language between Accessor and Behavior
 Names
  * AccessorName is the *requested* name for a Behavior
  * BehaviorName is the *provided* name for a Behavior
  * They differ because an AccessorName *might* not exist and that could be catastrophic, or the plugin could gracefully handle it (ie, optional support to/via other plugins). But it's guaranteed a BehaviorName to exist, because they are retrieved from all Plugins on "scan" and announce their ability to *provide*.

* Get linting fully configured

* Fix up docs
  * Pull over old guide stuff?
  * FQN in current README is defined late, move the definition earlier!


  "DELETE?_predev:build": "npm i && npm run clean",
  "DELETE?_dev:build": "NODE_ENV=development concurrently -r 'npm:dev:build:*'",
  "DELETE?_dev:build:bundle": "EXTERNALS=\"./node_modules*\" FORCEBUILDONLY=1 RUNTIMEPLATFORM=node FILESRC=index.ts .scripts/builder.mts",
  "DELETE?_dev:build:types": "npm run _typecheck",
