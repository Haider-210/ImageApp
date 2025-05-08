require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const mockAuth = require('./middleware/mockAuth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(mockAuth);

// --- MongoDB (Cosmos DB for Mongo API) ---
const mongoClient = new MongoClient(process.env.COSMOS_CONN);
let imagesCol, commentsCol;

// --- Blob Storage ---
const blobSvc = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONN);
const containerClient = blobSvc.getContainerClient('images');

// --- Multer (memory upload) ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Role Middleware ---
function requireRole(role) {
  return (req, res, next) => {
    const roles = (req.authInfo?.roles || []);
    if (roles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden: missing role ' + role });
  };
}

// --- Routes ---

// List images directly from Cosmos (Redis caching disabled for demo)
app.get('/api/images', async (req, res) => {
  try {
    const images = await imagesCol.find().sort({ createdAt: -1 }).toArray();
    res.json(images);
  } catch (err) {
    console.error('Error in GET /api/images:', err);
    res.status(500).send('Failed to load images');
  }
});

// Upload image (creators only)
app.post('/api/images', requireRole('creator'), upload.single('photo'), async (req, res) => {
  try {
    const blobName = `${Date.now()}-${req.file.originalname}`;
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.upload(req.file.buffer, req.file.size);

    const record = {
      title: req.body.title,
      caption: req.body.caption,
      url: blobClient.url,
      uploader: req.user.oid,
      createdAt: new Date()
    };

    const result = await imagesCol.insertOne(record);
    res.json({ id: result.insertedId, ...record });
  } catch (err) {
    console.error('Error in POST /api/images:', err);
    res.status(500).send('Image upload failed');
  }
});

// Get comments for image (directly from Cosmos)
app.get('/api/images/:id/comments', async (req, res) => {
  try {
    const comments = await commentsCol.find({ imageId: req.params.id }).sort({ timestamp: -1 }).toArray();
    res.json(comments);
  } catch (err) {
    console.error('Error in GET comments:', err);
    res.status(500).send('Failed to fetch comments');
  }
});

// Post comment/rating (consumers only)
app.post('/api/images/:id/comments', requireRole('consumer'), async (req, res) => {
  try {
    const comment = {
      imageId: req.params.id,
      userId: req.user.oid,
      text: req.body.text,
      rating: req.body.rating,
      timestamp: new Date()
    };

    const result = await commentsCol.insertOne(comment);
    res.json({ id: result.insertedId, ...comment });
  } catch (err) {
    console.error('Error in POST comments:', err);
    res.status(500).send('Failed to post comment');
  }
});

// --- Startup: connect Mongo then start server ---
async function startServer() {
  try {
    console.log('🚀 Connecting to Cosmos DB...');
    await mongoClient.connect();
    const db = mongoClient.db('ImageDB');
    imagesCol = db.collection('Images');
    commentsCol = db.collection('Comments');
    console.log('✅ MongoDB connected');

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`🌐 Server listening on port ${port}`));
  } catch (err) {
    console.error('❌ Startup failure:', err);
    process.exit(1);
  }
}

startServer();
