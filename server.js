const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost/layo-investment', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  media: { type: String }, // Store media URL or path
  mediaType: { type: String, enum: ['image', 'video'] },
});
const Product = mongoose.model('Product', productSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  pickupLocation: { type: String, required: true },
  quantity: { type: Number, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model('Order', orderSchema);

// Seller Schema for Authentication
const sellerSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const Seller = mongoose.model('Seller', sellerSchema);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|mp4/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos are allowed'));
    }
  },
});

// Initialize Seller (Run once to create default seller)
async function initializeSeller() {
  const username = 'admin';
  const password = 'Layo@1ly'; // From previous context
  const hashedPassword = await bcrypt.hash(password, 10);
  await Seller.findOneAndUpdate(
    { username },
    { username, password: hashedPassword },
    { upsert: true }
  );
}
initializeSeller();

// Middleware for Seller Authentication
async function authenticateSeller(req, res, next) {
  const { username, password } = req.body;
  const seller = await Seller.findOne({ username });
  if (!seller || !(await bcrypt.compare(password, seller.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  next();
}

// API Endpoints

// Get All Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Product (Seller Panel)
app.post('/api/products', authenticateSeller, upload.single('media'), async (req, res) => {
  try {
    const { name, price, description, category, mediaType } = req.body;
    const media = req.file ? `/uploads/${req.file.filename}` : '';
    const product = new Product({ name, price, description, category, media, mediaType });
    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Product (Seller Panel)
app.delete('/api/products/:id', authenticateSeller, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, phone, pickupLocation, quantity, productId } = req.body;
    const order = new Order({ customerName, phone, pickupLocation, quantity, productId });
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve Uploaded Files
app.use('/uploads', express.static('uploads'));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));