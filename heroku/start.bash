#!/usr/bin/env bash

cd "`dirname $0`/.."

pwd

env

if [[ ${PROC_TYPE} == 'node' ]]; then
    node server.js
elif [[ ${PROC_TYPE} == 'php' ]]; then
    vendor/bin/heroku-php-nginx -C heroku/nginx_vhost.conf public/
elif [[ ${PROC_TYPE} == 'dev' ]]; then
    echo "[[ You still must start your PHP server manually ]]"
    echo "[[ But you're lucky, here's the command to do it: ]]"
    echo "[[ php bin/console server:run -vvv --no-ansi 9999 ]]"
    node node_modules\nodemon\bin\nodemon.js server.js
else
    echo "Don't know what to run :("
    exit 1
fi

