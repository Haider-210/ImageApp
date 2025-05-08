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

// Cosmos DB
const mongoClient = new MongoClient(process.env.COSMOS_CONN);
let imagesCol, commentsCol;
mongoClient.connect().then(() => {
  const db = mongoClient.db('ImageDB');
  imagesCol = db.collection('Images');
  commentsCol = db.collection('Comments');
});

// Blob Storage
const blobSvc = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONN);
const containerClient = blobSvc.getContainerClient('images');

// Redis Cache
const redisClient = redis.createClient({
  socket: { host: process.env.REDIS_HOST, port: 6380, tls: true },
  password: process.env.REDIS_KEY
});
redisClient.connect();

// Multer
const upload = multer({ storage: multer.memoryStorage() });

// Role middleware
function requireRole(role) { /* ... */ }

// Routes (with caching)
// GET /api/images uses redisClient.get / setEx
// POST /api/images clears cache
// GET/POST comments similarly

app.listen(process.env.PORT, () => console.log(`API on ${process.env.PORT}`));
