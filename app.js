const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const child = require('child_process');
const argv = require('yargs')
    .usage('Usage: node $0 [options]')
    .example('node $0 -p 8080')
    .describe('p', 'port')
    .alias('p', 'port')
    .default('p', '8080')
    .describe('s', 'Script to run after successful validation. Will be passed two arguments: file path and file type')
    .alias('s', 'script')
    .help('h')
    .alias('h', 'help')
    .argv;

if (argv.script) {
  argv.script = path.resolve(argv.script);
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
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/upload', function(req, res) {
  res.sendFile(path.join(__dirname, 'views/upload.html'));
});

const filetype_re = /^Success. (\S+)\..+/;

app.post('/upload',
  upload.single('datafile'),
  function(req, res) {
    console.log(`received ${req.file.originalname} as ${req.file.path}, size=${req.file.size}`);
    child.execFile(
      '/usr/local/bin/node',
      [
        'node_modules/.bin/lineprotocol-standard-format',
        '-i', req.file.path,
        '-o', path.join(uploadDir, 'parsed', req.file.filename)
      ],
      (err, stdout, stderr) => {
        console.log('stdout: ' + stdout);
        console.log('stderr: ' + stderr);
        if (err) {
          console.log(err);
        } else {
          const match = filetype_re.exec(stdout);
          if (match) {
            const filetype = match[1];
            console.log(`matched ${filetype}`);
            if (argv.script) {
              console.log('Attempting to run script');
              child.execFile(argv.script, [ path.resolve(req.file.path), filetype ], (err, stdout, stderr) => {
                console.log('stdout: ' + stdout);
                console.log('stderr: ' + stderr);
                if (err) {
                  console.log(err);
                } else {
                  console.log('restic backup successful');
                }
              });
            }
          }
        }
        res.end(stdout);
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
