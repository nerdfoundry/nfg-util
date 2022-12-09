#!/bin/sh

# Run a Production Build against source

docker-compose \
  -f ./docker-compose.yml \
  -f ./docker-compose.prod.yml \
  up
