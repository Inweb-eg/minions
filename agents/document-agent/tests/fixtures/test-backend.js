import express from 'express';
import mongoose from 'mongoose';

const app = express();
const router = express.Router();

// Mongoose Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  age: Number,
  active: Boolean
});

// Mongoose Model
const User = mongoose.model('User', UserSchema);

// Middleware
const authenticate = async (req, res, next) => {
  // Authentication logic
  next();
};

const validate = (req, res, next) => {
  // Validation logic
  next();
};

/**
 * Get all users
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
async function getAllUsers(req, res) {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get user by ID
 */
async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create new user
 */
async function createUser(req, res) {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Service functions
/**
 * Find users by criteria
 */
async function findUsersByCriteria(criteria) {
  return await User.find(criteria);
}

/**
 * Calculate user statistics
 */
function calculateUserStats(users) {
  return {
    total: users.length,
    active: users.filter(u => u.active).length
  };
}

// Express routes
app.get('/api/users', authenticate, validate, getAllUsers);
app.get('/api/users/:id', authenticate, getUserById);
app.post('/api/users', authenticate, validate, createUser);
app.put('/api/users/:id', authenticate, async (req, res) => {
  // Inline handler
  res.json({ updated: true });
});
app.delete('/api/users/:id', authenticate, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(204).send();
});

// Router routes
router.get('/profile', authenticate, (req, res) => {
  res.json({ profile: req.user });
});

router.post('/login', async (req, res) => {
  // Login logic
  res.json({ token: 'jwt-token' });
});

export { User, getAllUsers, getUserById, createUser };
