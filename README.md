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
