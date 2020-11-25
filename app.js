
'use strict';

const process = require('process'); // Required to mock environment variables

// [START gae_storage_app]
const {format} = require('util');
const express = require('express');
const Multer = require('multer');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
var fs = require('fs');
var cors = require('cors');

const {Storage} = require('@google-cloud/storage');

// Instantiate a storage client
const storage = new Storage();

const app = express();
app.set('view engine', 'pug');
app.use(bodyParser.json({ limit : '200MB'}));
app.use(cors());

// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
});

// A bucket is a container for objects (files).
const bucket = storage.bucket('contenedor-archivos-clientes-lo-digital');

// Display a form for uploading files.
app.get('/', (req, res) => {
  res.render('form.pug');
});

// Process the file upload and upload to Google Cloud Storage.
app.post('/save', multer.single('file'), (req, res, next) => {
  console.log(req.file);
  if (!req.file) {
    res.status(400).send('No file uploaded.');
    return;
  }

  // Create a new blob in the bucket and upload the file data.
  const blob = bucket.file(req.file.originalname);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on('error', (err) => {
    next(err);
  });

  blobStream.on('finish', () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = format(
      `https://storage.googleapis.com/contenedor-archivos-clientes-lo-digital/${req.file.originalname}`
    );
    res.status(200).send(JSON.stringify(publicUrl));
  });

  blobStream.end(req.file.buffer);
  return;
  
});


// delete bucket 
app.post('/delete', (req, res, next) => {
  console.log(req.body);
  deleteObjectGCP('contenedor-archivos-clientes-lo-digital', req.body.name);

});

// delete bucket 
app.post('/download', (req, res, next) => {
  console.log(req.body);
  dowloadGCP('contenedor-archivos-clientes-lo-digital', req.body.name);
});

function deleteObjectGCP(bucketName, filename) {
  // [START storage_delete_file]
  /**
   * TODO(developer): Uncomment the following lines before running the sample.
   */
  // const bucketName = 'Name of a bucket, e.g. my-bucket';
  // const filename = 'File to delete, e.g. file.txt';

  // Imports the Google Cloud client library
  const {Storage} = require('@google-cloud/storage');

  // Creates a client
  const storage = new Storage();

  async function deleteFile() {
    // Deletes the file from the bucket
    await storage.bucket(bucketName).file(filename).delete();

    console.log(`gs://${bucketName}/${filename} deleted.`);
  }

  deleteFile().catch(console.error);
  // [END storage_delete_file]
}

const path = require('path');
const cwd = path.join(__dirname, '..');

function dowloadGCP(
  bucketName = 'contenedor-archivos-clientes-lo-digital',
  srcFilename,
  destFilename = path.join(cwd, srcFilename)
) {

  // Imports the Google Cloud client library
  const {Storage} = require('@google-cloud/storage');

  // Creates a client
  const storage = new Storage();

  async function downloadFile() {
    const options = {
      // The path to which the file should be downloaded, e.g. "./file.txt"
      destination: destFilename,
    };

    // Downloads the file
   await storage.bucket(bucketName).file(srcFilename).download(options)


    console.log(
      `gs://${bucketName}/${srcFilename} downloaded to ${destFilename}.`
    );
  }
  downloadFile();
}

//--------------------------------------------------------------------------------------------------------------------------------------
// implementacion mailer
app.post('/email', function(request, response){
  console.log(request.body);
  main(request.body);
  return response.send(JSON.stringify("ok", null, 4));
});
// implementacion de html to pdf
app.post('/htmlToPdf', async function(request ,response){  
  await new Promise((resolve)=>{
    let config = {           
      "format": "Letter",        // allowed units: A3, A4, A5, Legal, Letter, Tabloid     
      paginationOffset: 1,       // Override the initial pagination number
      "header": {
        "height": "50mm",        
      },
      "footer": {
        "height": "25mm",        
      },
    }
    const pdf = require('html-pdf');
     pdf.create(request.body.body,config).toFile('./html-pdf.pdf', function(err, res) {
      if (err){
      } else {
        resolve(res)
      }
  });
  }).then(()=>{
    new Promise((resolve)=>{
      fs.readFile('./html-pdf.pdf', 'base64', function(err ,data) {
        if (err) throw err;
        resolve(data);
      });
    }).then((file)=>{
      return response.send(JSON.stringify(file, null, 4));
    });
  });
});

// async..await is not allowed in global scope, must use a wrapper
async function main(email) {
  // Generate test SMTP service account from ethereal.email
  // Only needed if you don't have a real mail account for testing
  let testAccount = await nodemailer.createTestAccount();

  // create reusable transporter object using the default SMTP transport
  let transporter = nodemailer.createTransport({
      pool: false,
      host: 'mail.lodigital.cl',
      port: 465,
      auth: {
          user: "aviso@lodigital.cl", // generated ethereal user
          pass: "Epsilon2020" // generated ethereal password
      },
      tls: {
          rejectUnauthorized: false
      }
  });
  // send mail with defined transport object
  let info = await transporter.sendMail({
      from: 'aviso@lodigital.cl', // sender address
      to: email.to, // list of receivers
      subject: email.subject, // Subject line
      text: email.content, // plain text body
      //html: '<b>Hello world?</b>' // html body,
      attachments : email.attachments
  });
}

// [END gae_storage_app]

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = app;