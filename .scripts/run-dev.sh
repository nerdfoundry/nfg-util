#!/bin/sh

# Run project in standard development mode

docker-compose \
  -f ./docker-compose.yml \
  -f ./docker-compose.dev.yml \
  up
