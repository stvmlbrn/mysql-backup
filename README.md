#MySQL Backup
A handy Node.js script to backup MySQL databases to Amazon S3.

##Getting Started
* Clone this repo: `git clone https://github.com/stevemilburn/mysql-backup.git && cd mysql-backup`
* Run `npm install`
* The script uses [dotenv](http://www.npmjs.com/package/dotenv) to access environment variables. Be sure to set the correct path to your .env file when requiring dotenv in app.js. Required environment variables are:
** S3_ACCESS_KEY = Your AWS access key
** S3_SECRET_KEY = Your AWS secret key
** S3_BUCKET = Name of the bucket you are uploading to
** CRONALARM_KEY = The API key for [CronAlarm](https://www.cronalarm.com). If you do not want to integrate with CronAlarm you can remove the lines for calling the CronAlarm API and begin execution with the `connection.queryAsync...`. 
** BACKUP_PATH = Path to the directory where the files will be backed up before uploading to S3.