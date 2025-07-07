const express = require('express');
const router = express.Router();
const { handleTwilioCallStatus } = require('../controllers/webhookController');

// Twilio webhook routes (no authentication required)
router.route('/twilio/call-status')
    .post(handleTwilioCallStatus);

module.exports = router; 