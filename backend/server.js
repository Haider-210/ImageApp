require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const redis = require('redis');

const mockAuth = require('./middleware/mockAuth'); // ✅ Simulated user auth

const app = express();
app.use(cors());
app.use(express.json());
app.use(mockAuth); // ✅ Inject mock user into all requests

// --- Cosmos DB ---
const mongoClient = new MongoClient(process.env.COSMOS_CONN);
let imagesCol, commentsCol;
mongoClient.connect().then(() => {
  const db = mongoClient.db('ImageDB');
  imagesCol = db.collection('Images');
  commentsCol = db.collection('Comments');
});

// --- Blob Storage ---
const blobSvc = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONN);
const containerClient = blobSvc.getContainerClient('images');

// --- Redis Cache ---
const redisClient = redis.createClient({
  socket: { host: process.env.REDIS_HOST, port: 6380, tls: true },
  password: process.env.REDIS_KEY
});

//redisClient.connect().catch(console.error);


// --- Multer for uploads ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Middleware to enforce roles ---
function requireRole(role) {
  return (req, res, next) => {
    const roles = req.authInfo && req.authInfo.roles || [];
    if (roles.includes(role)) return next();
    res.status(403).json({ error: 'Forbidden: missing role ' + role });
  };
}

// --- Routes ---

// List images (with caching)
app.get('/api/images', async (req, res) => {
  const cache = await redisClient.get('images');
  if (cache) return res.json(JSON.parse(cache));
  const imgs = await imagesCol.find().toArray();
  await redisClient.setEx('images', 30, JSON.stringify(imgs));
  res.json(imgs);
});

// Upload image (creators only)
app.post('/api/images',
  requireRole('creator'), // ✅ Check mock role
  upload.single('photo'),
  async (req, res) => {
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
  }
);

// Get comments for image (with caching)
app.get('/api/images/:id/comments', async (req, res) => {
  const key = `comments_${req.params.id}`;
  const cache = await redisClient.get(key);
  if (cache) return res.json(JSON.parse(cache));
  const comms = await commentsCol.find({ imageId: req.params.id }).toArray();
  await redisClient.setEx(key, 30, JSON.stringify(comms));
  res.json(comms);
});

// Post comment/rating (consumers only)
app.post('/api/images/:id/comments',
  requireRole('consumer'), // ✅ Check mock role
  async (req, res) => {
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
  }
);

app.listen(process.env.PORT, () => console.log(`API listening on port ${process.env.PORT}`));
