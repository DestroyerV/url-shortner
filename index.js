require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const url = require('url');
const mongoose = require('mongoose');
const ShortUrl = require('./models/ShortUrl.js');

const app = express();

const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function (req, res) {
  res.json({ greeting: 'hello API' });
});

async function getMaxShortUrl() {
  const maxShortUrlDoc = await ShortUrl.findOne().sort('-short_url').exec();
  return maxShortUrlDoc ? maxShortUrlDoc.short_url : 0;
}

let number = 0;

async function initializeNumberGenerator() {
  number = await getMaxShortUrl();
}

function numberGenerator() {
  return ++number;
}

app.post('/api/shorturl', async function (req, res) {
  const originalUrl = req.body.url;
  const urlPattern = /^(https|http):\/\/[^ "]+$/;
  if (!urlPattern.test(originalUrl)) {
    return res.json({ error: 'Invalid URL' });
  }

  const parsedUrl = new url.URL(originalUrl);
  const hostname = parsedUrl.hostname;
  dns.lookup(hostname, async function (err) {
    if (err) {
      res.json({ error: 'Invalid hostname' });
    } else {
      try {
        let shortedUrl = await ShortUrl.findOne({ original_url: originalUrl });
        if (shortedUrl) {
          res.json({
            original_url: shortedUrl.original_url,
            short_url: shortedUrl.short_url,
          });
        } else {
          const shortUrl = numberGenerator();
          shortedUrl = new ShortUrl({
            original_url: originalUrl,
            short_url: shortUrl,
          });

          await shortedUrl.save();
          res.json({
            original_url: originalUrl,
            short_url: shortUrl,
          });
        }
      } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

app.get('/api/shorturl/:shortUrl', async function (req, res) {
  const shortUrl = req.params.shortUrl;
  try {
    const data = await ShortUrl.findOne({ "short_url": shortUrl }).exec();
    if (!data) {
      return res.status(404).json({ "error": "No short URL found for the given input" });
    }
    res.redirect(data.original_url);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


mongoose.connect(process.env.MONGO_URI, clientOptions)
  .then(async () => {
    console.log('Connected to MongoDB');
    await initializeNumberGenerator();
    app.listen(port, function () {
      console.log(`Listening on port ${port}`);
    });
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  });
