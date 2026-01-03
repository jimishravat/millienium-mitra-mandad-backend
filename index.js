// server.js
import express, { json, urlencoded } from 'express';
import { connect } from 'mongoose';
import cors from 'cors';
import { config } from 'dotenv';
import router from './routes.js';
import cookieParser from 'cookie-parser';
import User from './models/User.js';
import Admin from './models/Admin.js';
import { hashPassword } from './helper.js';


// Load environment variables
config();

const app = express();

// Database connection status tracker
let isDbConnected = false;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.29.123:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.use(json());
app.use(urlencoded({ extended: true }));
app.use(cookieParser());

// Database connection
connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mitramandal')
  .then(async () => {
    isDbConnected = true;
    console.log('✅ MongoDB connected successfully');
    
    // Seed default admin user if no users exist
    await seedDefaultAdmin();

   
  })
  .catch((err) => {
    isDbConnected = false;
    console.error('❌ MongoDB connection error:', err);
  });

// Seeding function
const seedDefaultAdmin = async () => {
  try {
    const userCount = await User.countDocuments();
    
    if (userCount === 0) {
      console.log('📝 No users found. Creating default admin user...');
      
      // Default password: user_00000
      const defaultPassword = 'user_00000';
      const hashedPassword = await hashPassword(defaultPassword);
      
      // Create default user
      const defaultUser = new User({
        userID: '00000',
        name: 'Admin',
        mobile: '0000000000',
        password: hashedPassword,
        isDefaultPassword: true,
        isUserActive: true
      });
      
      await defaultUser.save();
      console.log('✅ Default user created successfully');
      console.log(`📌 Default credentials - Mobile: 0000000000, Password: ${defaultPassword}`);
      
      // Check if Admin document exists
      let adminDoc = await Admin.findOne();
      
      if (!adminDoc) {
        // Create new Admin document with default user
        adminDoc = new Admin({
          adminUserID: ['00000'],
          interestPerMonth: 0,
          defaultPrincipalAmount: 0,
          dateOfEMI: 1
        });
        
        await adminDoc.save();
        console.log('✅ Default admin document created successfully');
      } else {
        // Add to existing admin document if not already there
        if (!adminDoc.adminUserID.includes('00000')) {
          adminDoc.adminUserID.push('00000');
          await adminDoc.save();
          console.log('✅ Default user added to admin document');
        }
      }
    } else {
      console.log(`✅ Database already has ${userCount} user(s). Skipping seed.`);
    }
  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  }
};

// Routes
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/users', require('./routes/users'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    database: isDbConnected ? 'connected' : 'disconnected'
  });
});

// Database status endpoint
app.get('/api/db-status', (req, res) => {
  res.status(isDbConnected ? 200 : 503).json({
    connected: isDbConnected,
    message: isDbConnected ? 'Database is connected' : 'Database is disconnected',
    timestamp: new Date().toISOString()
  });
});

app.use(router);
// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



export default app;