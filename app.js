'use strict';

require('dotenv').config();

var Promise = require('bluebird');
var mysql = require('mysql');
var connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASS
});
var spawn = require('child_process').spawnSync;
var allDatabases = [];

connection.connect();

Promise.promisifyAll(connection);


connection.queryAsync('show databases')
	.then(dbs => {
    dbs.forEach(db => {
      if (db.Database !== 'information_schema') {
        allDatabases.push(db.Database);
        let ls = spawn('ls', ['-lh', '/usr']);
        console.log(ls.stdout);
      }
    });
	})
  .then(() => console.log(allDatabases))
	.then(() => process.exit());


