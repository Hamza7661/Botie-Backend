const express = require('express');
const router = express.Router();
const { generateApiKeyForApp, testApiKeyAuth, getUserByAssignedSID, getUserByAssignedNumber, createTaskForUser } = require('../controllers/apiController');
const { apiKeyAuth } = require('../middleware/apiKeyMiddleware');
const { protect } = require('../middleware/authMiddleware');

// Generate API key (admin only)
router.post('/generate-api-key', protect, generateApiKeyForApp);

// Test API key authentication
router.get('/test-api-key', apiKeyAuth, testApiKeyAuth);

// Get user by Twilio call SID (third-party apps)
router.get('/getuserbyassignedSID', apiKeyAuth, getUserByAssignedSID);

// Get user by Twilio assigned phone number (third-party apps)
router.get('/getuserbyassignednumber', apiKeyAuth, getUserByAssignedNumber);

// Create task or reminder for user by Twilio assigned phone number (third-party apps)
router.post('/create-task-for-user', apiKeyAuth, createTaskForUser);

module.exports = router; 