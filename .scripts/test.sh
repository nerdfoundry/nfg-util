#!/bin/sh

# Run Tests in the project.

docker-compose \
  -f ./docker-compose.yml \
  -f ./docker-compose.dev.yml \
  -f ./docker-compose.test.yml \
  up
