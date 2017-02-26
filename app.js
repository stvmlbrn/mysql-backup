var appRoot = require('app-root-path');
require('dotenv').config({path: appRoot + '/.env'});

var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var path = require('path');
var mysql = require('mysql');
var connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS
});
var fs = require('fs');
var s3 = require('s3');
var s3Client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});
var rp = require('request-promise');
var os = require('os');
var util = require('util');

var moment = require('moment');
var backupDate = moment().format('M-D-YY');

var allDatabases = [];
var actions = [];

//Add any databases that do not need backed up in the 'ignore' array.
var ignore = [
  'information_schema'
];

//For sending results to CronAlarm
var formData = {
  success: 1,
  server: os.hostname(),
  path: __filename,
  message: ''
};

connection.connect();

Promise.promisifyAll(connection);

rp(`http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/start`)
  .then(() => {
    return connection.queryAsync('show databases');
  })
	.then(dbs => {
    dbs.map(db => {
      if (ignore.indexOf(db.Database) === -1) {
        allDatabases.push(db.Database);

        //Create an array of promises that will spawn the mysqldump child process
        //and create the individual backup files.
        actions.push(
          new Promise(function(resolve, reject) {
            let wstream = fs.createWriteStream(process.env.BACKUP_PATH + db.Database + '.sql');
            let mysqldump = spawn('mysqldump', [
              '-u',
              process.env.DB_USER,
              '-p' + process.env.DB_PASS,
              db.Database
            ]);

            mysqldump.stdout
              .pipe(wstream);

            wstream.on('finish', () => resolve());
            wstream.on('error', (err) => reject(err));
          })
        );
      }
    });

    return Promise.all(actions); //execute the backups
	})
  .then(() => {
    //gzip each backup file.
    var files = allDatabases.map((db) => process.env.BACKUP_PATH + db + '.sql');

    files.unshift('-f');

    return new Promise(function(resolve, reject) {
      let gzip = spawn('gzip', files);

      gzip.on('close', () => resolve());
      gzip.stderr.on('data', (data) => reject(data));
    });
  })
  .then(() => {
    actions = [];

    //create an array of promises to upload each backup file to S3.
    allDatabases.map(db => {
      actions.push(
        new Promise(function(resolve, reject) {
          var params = {
            localFile: process.env.BACKUP_PATH + db +'.sql.gz',
            s3Params: {
              Bucket: process.env.S3_BUCKET,
              Key: backupDate + '/' + db + '.sql.gz',
              ServerSideEncryption: 'AES256',
              StorageClass: 'STANDARD_IA' //STANDARD_IA = infrequent access = cheaper storage costs.
            }
          };
          var uploader = s3Client.uploadFile(params);

          uploader.on('end', () => resolve());
          uploader.on('error', (err) => reject(err));
        })
      );
    });

     return Promise.all(actions); //perform the uploads
  })
  .catch(err => {
    formData.success = 0;
    formData.message = util.inspect(err);
  })
  .finally(() => {
    return rp({
      method: 'POST',
      uri: `http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/end`,
      form: formData
    })
  })
  .then(() => process.exit());
