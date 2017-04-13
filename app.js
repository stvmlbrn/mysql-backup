const appRoot = require('app-root-path');
require('dotenv').config({path: `${appRoot}/.env`});

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');
const rp = require('request-promise');
const os = require('os');
const util = require('util');
const moment = require('moment');
const Promise = require('bluebird');

const ignore = require(`${appRoot}/config/ignore`);
const db = require(`${appRoot}/config/db`);
const s3Client = require(`${appRoot}/config/s3`);

const monitor = process.argv[2] === '-nomonitor' ? false : true;  //determine if using CronAlarm
var allDatabases = []; //names of all databases to be backed up

//For sending results to CronAlarm
const formData = {
  success: 1,
  server: os.hostname(),
  path: __filename,
  message: ''
};

// If using CronAlarm, call the start API
// Otherwise, start the promise chain with Promise.resolve()
(monitor ? rp(`http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/start`) : Promise.resolve())
  .then(() => db.queryAsync('show databases'))
  .then((dbs) => {
    let actions = [];
    dbs.map((db) => {
      if (ignore.indexOf(db.Database) === -1) {
        allDatabases.push(db.Database);

        actions.push(
          new Promise(function(resolve, reject) {
            let wstream = fs.createWriteStream(process.env.BACKUP_PATH + db.Database + '.sql');
            let mysqldump = spawn('mysqldump', [
              '-u',
              process.env.DB_USER,
              '-p' + process.env.DB_PASS,
              db.Database
            ]);

            mysqldump.stdout.pipe(wstream);

            wstream.on('finish', () => resolve());
            wstream.on('error', (err) => reject(err));
          })
        );
      }
    });

    return Promise.all(actions);
  })
  .then(() => {
    //gzip each backup file
    let files = allDatabases.map((db) => process.env.BACKUP_PATH + db + '.sql');
    files.unshift('-f');

    return new Promise(function(resolve, reject) {
      let gzip = spawn('gzip', files);

      gzip.on('close', () => resolve());
      gzip.stderr.on('data', (data) => reject(data));
    });
  })
  .then(() => {
    let actions = [];
    const backupDate = moment().format('M-D-YY');

    //create an array of promises to upload each backup file to S3.
    allDatabases.map((db) => {
      actions.push(
        new Promise(function(resolve, reject) {
          let params = {
            localFile: `${process.env.BACKUP_PATH}${db}.sql.gz`,
            s3Params: {
              Bucket: process.env.S3_BUCKET,
              Key: `${backupDate}/${db}.sql.gz`,
              ServerSideEncryption: 'AES256',
              StorageClass: 'STANDARD_IA' //STANDARD_IA = infrequent access = cheaper storage costs.
            }
          };
          let uploader = s3Client.uploadFile(params);

          uploader.on('end', () => resolve());
          uploader.on('error', (err) => reject(err));
        })
      );
    });

     return Promise.all(actions); //perform the uploads
  })
  .catch((err) => {
    formData.success = 0;
    formData.message = util.inspect(err);
  })
  .finally(() => {
    if (monitor) {
      return rp({
        method: 'POST',
        uri: `http://api.cronalarm.com/v2/${process.env.CRONALARM_KEY}/end`,
        form: formData
      })
    }

    return Promise.resolve();
  })
  .then(() => process.exit());
