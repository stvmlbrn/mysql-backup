'use strict';

require('dotenv').config();

var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var mysql = require('mysql');
var connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS
});
var fs = require('fs');


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
      if (db.Database !== 'information_schema' && db.Database !== 'book-images') {
        allDatabases.push(db.Database);

        actions.push(  
          new Promise(function(resolve, reject) {
            let wstream = fs.createWriteStream(db.Database + '.sql');            
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
    var files = allDatabases.map((db) => db += '.sql');

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


