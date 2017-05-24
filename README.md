# MySQL Backup
A Node.js script to backup MySQL databases to Amazon S3. Note - this script spawns `mysqldump`
so it needs to exist in the path local to where you are running this program.

## Getting Started
* Clone this repo: `git clone https://github.com/stvmlbrn/mysql-backup.git && cd mysql-backup`
* Run `npm install`
* The script uses [dotenv](http://www.npmjs.com/package/dotenv) to access environment variables. You'll need to manually
created the .env file and add the required variables.

## Required environment variables
* S3_ACCESS_KEY = Your AWS access key
* S3_SECRET_KEY = Your AWS secret key
* S3_BUCKET = Name of the bucket you are uploading to
* BACKUP_PATH = Path to the directory where the files will be backed up before uploading to S3.

## Optional environment variables
* CRONALARM_KEY = The API key for [CronAlarm](https://www.cronalarm.com). If you do not want to integrate with CronAlarm you can
run the script with the `-nomonitor` parameter.
