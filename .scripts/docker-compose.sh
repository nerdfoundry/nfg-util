#!/bin/sh

clear

echo -e "Force Installing npm packages\n"

npm i --force 1> /dev/null

echo -e "Running in docker-compose without an Environment Config...\nYou can run interactively by attaching:\n\t\tdocker exec -it `hostname` npm run dev\n\nOr you can press CTRL+C, and pick an EnvConfig:\n\t\ti.e., docker-compose -f ./docker-compose.yml -f ./docker-compose.<Env>.yml up"

tail -f /dev/null
