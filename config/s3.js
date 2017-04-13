const s3 = require('s3');
const s3Client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});

module.exports = s3Client;
