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
var backupDir = path.join(path.resolve(), 'backups/');

var allDatabases = [];
var actions = [];
var ignore = [
  'information_schema',
  'book-images'
];

connection.connect();

Promise.promisifyAll(connection);

connection.queryAsync('show databases')
	.then(dbs => {

    dbs.forEach(db => {
      if (ignore.indexOf(db.Database) === -1) {
        allDatabases.push(db.Database);

        actions.push(  
          new Promise(function(resolve, reject) {
            let wstream = fs.createWriteStream(backupDir + db.Database + '.sql');            
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
	})
  .then(() => {
    return Promise.all(actions)
  })
  .then(() => {
    var files = allDatabases.map((db) => backupDir + db + '.sql');

    files.unshift('-f');

    return new Promise(function(resolve, reject) {
      let gzip = spawn('gzip', files);

      gzip.on('close', () => resolve());
      gzip.stderr.on('data', (data) => reject(data));
    });
  })
	.then(() => process.exit())
  .catch(err => {
    console.log(err);
    process.exit();
  });


