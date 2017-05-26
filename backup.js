#!/usr/bin/env node
const argv = require('yargs').argv;

console.log(`backup up ${argv._}`);
// Exit 0 for success. If backup fails exit with error
// and client will see "Unknown Error"
process.exit(0);
