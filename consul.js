#!/usr/bin/env node
const argv = require('yargs').argv;

console.error(`consul script called with arguments: ${argv._}`);

const stdin = process.stdin,
    stdout = process.stdout;
let inputJSON = '';

stdin.setEncoding('utf8');

stdin.on('data', function (chunk) {
  inputJSON += chunk;
});

let parsedData = '';
stdin.on('end', function () {
  try {
    parsedData = JSON.parse(inputJSON);
  } catch (e) { }
  // uncomment to simulate incompatible consul data
  //parsedData.headers[0] = 'notreal';
  console.error(parsedData.headers);
  const outputJSON = JSON.stringify(parsedData, null, '  ');
  stdout.write(outputJSON);
});
