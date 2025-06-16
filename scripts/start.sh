#!/bin/sh

export NODE_ENV=production

set -e

ts-node database/manage.ts init

node dist/main
