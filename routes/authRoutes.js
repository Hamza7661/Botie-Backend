const express = require('express');
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

router.post('/register', register);
router.get('/verifyemail', verifyEmail);
router.post('/login', login);
router.post('/resend-verification', resendVerification);
router.put('/changepassword', protect, changePassword);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);

module.exports = router; 