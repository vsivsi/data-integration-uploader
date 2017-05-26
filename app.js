const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const child = require('child_process');
const _ = require('lodash');
const argv = require('yargs')
    .usage('Usage: node $0 [options]')
    .example('node $0 -p 8080')
    .describe('p', 'port')
    .alias('p', 'port')
    .default('p', '8080')
    .describe('b', 'Backup script to run after successful validation. Will be passed two arguments: file path and file type')
    .alias('b', 'backup')
    .describe('c', 'Consul script that will get/set the header for file uploaded')
    .alias('c', 'consul')
    .implies('b', 'c')
    .implies('c', 'b')
    .help('h')
    .alias('h', 'help')
    .argv;

if (argv.consul) {
  argv.consul = path.resolve(argv.consul);
}
if (argv.backup) {
  argv.backup = path.resolve(argv.backup);
}

// Make sure upload folders exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(path.join(uploadDir, 'parsed'))) {
  fs.mkdirSync(path.join(uploadDir, 'parsed'));
}

// multer config
const upload = multer({dest: uploadDir});


// Express configuration
const app = express();
//app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/upload', function(req, res) {
  res.sendFile(path.join(__dirname, 'views/upload.html'));
});

const tscopError_re = /^TimeSeriesCopError:\s*(.*)/;

app.post('/upload',
  upload.single('datafile'),
  function(req, res) {
    console.log(`received ${req.file.originalname} as ${req.file.path}, size=${req.file.size}`);

    child.execFile(
      '/usr/local/bin/lineprotocol-standard-format',
      [
        '-i', req.file.path,
        '-o', path.join(uploadDir, 'parsed', req.file.filename)
      ],
      (err, stdout, stderr) => {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (err) {
          // Validation failed or some other unknown error
          console.log(err);
          const parseMatch = tscopError_re.exec(stdout);
          if (! parseMatch) {
            res.end('Unknown Error');
            return;
          } else {
            res.end(parseMatch[1]);  // Only send validation error message
            return;
          }
        } else {
          // parsing script exited OK, intial validation passed
          let parseResult;
          try {
            parseResult = JSON.parse(stdout);
          } catch (e) { }  // do nothing, check parseResult later
          if (!(parseResult && parseResult.header)) {
            // Bad output from parser for some reason
            // exit early
            console.log('Could not parse lineprotocol-standard-format output');
            res.end('Unknown Error');
            return;
          }

          // OK, parsing passed tests
          if (!(argv.backup && argv.consul)) {
            // Ready to send success signal back to client
            res.end('Success');
            return;
          } else {
            // Need to check with consul and then backup
            console.log('Parsing complete, checking with consul');
            // ********************
            // CONSUL CHILD PROCESS
            // ********************
            // Send header prop as input to consul script
            const consulChild = child.execFile(argv.consul, [ parseResult.header.measurement ], (err, stdout, stderr) => {
              console.log('stdout: ' + stdout);
              console.log('stderr: ' + stderr);
              if (err) {
                console.log(err);
                res.end('Unknown Error');
                return;
              }
              let consulResult;
              try {
                consulResult = JSON.parse(stdout);
              } catch (e) { } // something bad happened
              if (! consulResult) {
                console.log('Could not parse consul script output');
                res.end('Unknown Error');
                return;
              }
              // Check header JSON returned from consul against header we parsed
              // in original file. Column types and column headers should match.
              if (compareHeaders(parseResult.header, consulResult)) {
                // Validation passed, now backup
                console.log('Consul validated, backing up file');
                // ********************
                // BACKUP CHILD PROCESS
                // ********************
                child.execFile(argv.backup, [ path.resolve(req.file.path), parseResult.header.measurement ], (err, stdout, stderr) => {
                  console.log('stdout: ' + stdout);
                  console.log('stderr: ' + stderr);
                  if (err) {
                    console.log(err);
                    res.end('Unknown Error');
                    return;
                  } else {
                    console.log('restic backup successful');
                    res.end('Success');
                    return;
                  }
                });  // END BACKUP
              } else {
                // Validation failed at consul step
                let errormsg = `Validation failed, ${parseResult.header.measurement} headers and/or types have changed\n`;
                errormsg += `upload types: ${JSON.stringify(parseResult.header.types)}\n`;
                errormsg += `system types: ${JSON.stringify(consulResult.types)}\n`;
                errormsg += `upload headers: ${JSON.stringify(parseResult.header.headers)}\n`;
                errormsg += `system headers: ${JSON.stringify(consulResult.headers)}\n`;
                res.end(errormsg);
                return;
              }
            });  // END CONSUL
            // send header to consul on stdin, which should listen for data event
            consulChild.stdin.write(JSON.stringify(parseResult.header));
            consulChild.stdin.end();
          }
        }
      }
    );
  }
);

const server = app.listen(argv.port, function(){
  console.log('Server listening on port ' + argv.port);
  if (argv.script) {
    console.log('Success script: ' + argv.script);
  }
});

function compareHeaders(h1, h2) {
  if (h1 && _.isArray(h1.types) && _.isArray(h1.headers) && h2 && _.isArray(h2.types) && _.isArray(h2.headers)) {
    return _.isEqual(h1.types, h2.types) && _.isEqual(h1.headers, h2.headers);
  }
  return false;
}
