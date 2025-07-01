const express = require('express');
const path = require('path');
const { 
    register, 
    verifyEmail, 
    login, 
    changePassword, 
    forgotPassword, 
    resetPassword,
    resendVerification
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Serve Google verification file
router.get('/verifyemail/google6b553eca38d3da73.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'google6b553eca38d3da73.html'));
});

router.post('/register', register);
router.get('/verifyemail', verifyEmail);
router.post('/login', login);
router.post('/resend-verification', resendVerification);
router.put('/changepassword', protect, changePassword);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);

module.exports = router; 