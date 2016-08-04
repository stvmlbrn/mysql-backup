'use strict';

require('dotenv').config({path: '/home/acps/mysql-backup/.env'});

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

var moment = require('moment');
var backupDate = moment().format('M-D-YY');

var allDatabases = [];
var actions = [];

//Add any databases that do not need backed up in the 'ignore' array.
var ignore = [
  'information_schema',
  'book-images'
];

connection.connect();

Promise.promisifyAll(connection);

rp(`http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/start`)
  .then(() => {
    return connection.queryAsync('show databases');
  })
	.then(dbs => {
    dbs.forEach(db => {
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
    allDatabases.forEach(db => {
      actions.push(
        new Promise(function(resolve, reject) {
          var params = {
            localFile: process.env.BACKUP_PATH + db +'.sql.gz',
            s3Params: {
              Bucket: process.env.S3_BUCKET,
              Key: backupDate + '/' + db + '.sql.gz',
              ServerSideEncryption: 'AES256',
              StorageClass: 'STANDARD_IA' //STANDARD_ID = infrequent access = cheaper storage costs.
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
	.then(() => {
    return rp(`http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/end`);
  })
  .then(() => process.exit())
  .catch(err => {
    console.log(err);
    process.exit();
  });


