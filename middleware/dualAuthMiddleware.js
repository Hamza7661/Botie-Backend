const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');

// Dual Authentication Middleware (JWT or API Key)
const dualAuth = async (req, res, next) => {
    try {
        // Check for JWT token first
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            // JWT Authentication
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            req.user = user;
            req.authType = 'jwt';
            return next();
        }
        
        // Check for API Key authentication
        const apiKey = req.headers['x-api-key'];
        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];
        
        if (apiKey && timestamp && signature) {
            // API Key Authentication
            const currentTime = Date.now();
            const requestTime = parseInt(timestamp);
            const timeWindow = 5 * 60 * 1000; // 5 minutes

            if (Math.abs(currentTime - requestTime) > timeWindow) {
                return res.status(401).json({
                    success: false,
                    message: 'Request timestamp is too old or too new'
                });
            }

            // Verify signature
            const sharedSecret = process.env.API_SHARED_SECRET;
            if (!sharedSecret) {
                console.error('API_SHARED_SECRET not configured');
                return res.status(500).json({
                    success: false,
                    message: 'Server configuration error'
                });
            }

            // Create expected signature
            const expectedSignature = crypto
                .createHmac('sha256', sharedSecret)
                .update(`${apiKey}:${timestamp}`)
                .digest('hex');

            // Compare signatures
            if (signature !== expectedSignature) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid signature'
                });
            }

            // For API key auth, extract user info from request
            // Option 1: User ID in request body
            const userId = req.body.userId || req.query.userId;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'userId is required for API key authentication'
                });
            }
            
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            req.user = user;
            req.authType = 'api_key';
            req.apiClient = {
                apiKey: apiKey,
                isThirdParty: true
            };
            
            return next();
        }
        
        // No valid authentication found
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no valid token or API key provided'
        });
        
    } catch (error) {
        console.error('Dual Auth Error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

module.exports = {
    dualAuth
}; 