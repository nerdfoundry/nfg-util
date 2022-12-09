#!/bin/sh

# Run project in linked development mode.
# This will enable local linking for iterative development with unpublished libs

docker-compose \
  -f ./docker-compose.yml \
  -f ./docker-compose.dev.yml \
  -f ./docker-compose.dev_linked.yml \
  up
