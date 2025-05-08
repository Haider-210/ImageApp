require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const redis = require('redis');

const mockAuth = require('./middleware/mockAuth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(mockAuth);

// Cosmos DB setup
const mongoClient = new MongoClient(process.env.COSMOS_CONN);
let imagesCol, commentsCol;
mongoClient.connect()
  .then(() => {
    const db = mongoClient.db('ImageDB');
    imagesCol = db.collection('Images');
    commentsCol = db.collection('Comments');
    console.log('✅ Connected to Cosmos DB');
  })
  .catch(err => {
    console.error('❌ Cosmos DB connection failed', err);
    process.exit(1);
  });

// Blob Storage setup
const blobSvc = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONN);
const containerClient = blobSvc.getContainerClient('images');

// Redis setup
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: 6380,
    tls: true
  },
  password: process.env.REDIS_KEY
});

// Only one connect() call, and only start server after it succeeds
(async () => {
  try {
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    // Now that Redis (and Cosmos) are ready, start HTTP server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
  } catch (err) {
    console.error('❌ Redis connection failed', err);
    process.exit(1);
  }
})();

// Multer for uploads
const upload = multer({ storage: multer.memoryStorage() });

// Role‐check middleware
function requireRole(role) {
  return (req, res, next) => {
    const roles = (req.authInfo && req.authInfo.roles) || [];
    if (roles.includes(role)) return next();
    res.status(403).json({ error: 'Forbidden: missing role ' + role });
  };
}

// GET /api/images
app.get('/api/images', async (req, res) => {
  try {
    const cache = await redisClient.get('images');
    if (cache) return res.json(JSON.parse(cache));
    const imgs = await imagesCol.find().sort({ createdAt: -1 }).toArray();
    await redisClient.setEx('images', 30, JSON.stringify(imgs));
    res.json(imgs);
  } catch (err) {
    console.error('Error in GET /api/images', err);
    res.status(500).send('Error fetching images');
  }
});

// POST /api/images (upload)
app.post(
  '/api/images',
  requireRole('creator'),
  upload.single('photo'),
  async (req, res) => {
    try {
      const blobName = `${Date.now()}-${req.file.originalname}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(req.file.buffer, req.file.size);

      const record = {
        blobUrl: blockBlobClient.url,
        metadata: req.body,
        uploader: req.user.oid,
        createdAt: new Date()
      };
      const result = await imagesCol.insertOne(record);
      await redisClient.del('images');
      res.json({ id: result.insertedId, ...record });
    } catch (err) {
      console.error('Error in POST /api/images', err);
      res.status(500).send('Upload failed');
    }
  }
);

// GET comments
app.get('/api/images/:id/comments', async (req, res) => {
  try {
    const key = `comments_${req.params.id}`;
    const cache = await redisClient.get(key);
    if (cache) return res.json(JSON.parse(cache));
    const comms = await commentsCol
      .find({ imageId: req.params.id })
      .sort({ timestamp: -1 })
      .toArray();
    await redisClient.setEx(key, 30, JSON.stringify(comms));
    res.json(comms);
  } catch (err) {
    console.error('Error in GET /api/images/:id/comments', err);
    res.status(500).send('Error fetching comments');
  }
});

// POST comment
app.post(
  '/api/images/:id/comments',
  requireRole('consumer'),
  async (req, res) => {
    try {
      const comment = {
        imageId: req.params.id,
        userId: req.user.oid,
        text: req.body.text,
        rating: req.body.rating,
        timestamp: new Date()
      };
      const result = await commentsCol.insertOne(comment);
      await redisClient.del(`comments_${req.params.id}`);
      res.json({ id: result.insertedId, ...comment });
    } catch (err) {
      console.error('Error in POST /api/images/:id/comments', err);
      res.status(500).send('Comment failed');
    }
  }
);

