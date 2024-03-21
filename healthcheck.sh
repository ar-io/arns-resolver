#!/usr/bin/env sh

exec /nodejs/bin/node -e 'require("http").get("http://localhost:6000/ar-io/resolver/healthcheck", (res) => { if(res.statusCode !== 200) process.exit(1); }).on("error", (err) => { process.exit(1); })'
