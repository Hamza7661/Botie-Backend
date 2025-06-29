const express = require('express');
const router = express.Router();
const { getUserById, deleteUser, editUser, getUserProfile, getCustomersByUserId } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes in this file are protected
router.use(protect);

// Get current user's profile
router.get('/profile', getUserProfile);

router.route('/:id')
    .get(getUserById)
    .delete(deleteUser)
    .put(editUser);

// Get all customers for a user
router.get('/:id/customers', getCustomersByUserId);

module.exports = router; 