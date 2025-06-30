const crypto = require('crypto');

// API Key Authentication Middleware
const apiKeyAuth = (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];

        // Check if required headers are present
        if (!apiKey || !timestamp || !signature) {
            return res.status(401).json({
                success: false,
                message: 'Missing required authentication headers'
            });
        }

        // Validate timestamp (prevent replay attacks)
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

        // Add API client info to request
        req.apiClient = {
            apiKey: apiKey,
            isThirdParty: true
        };

        next();
    } catch (error) {
        console.error('API Key Auth Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Generate API key for third-party apps
const generateApiKey = () => {
    const sharedSecret = process.env.API_SHARED_SECRET;
    if (!sharedSecret) {
        throw new Error('API_SHARED_SECRET not configured');
    }

    const timestamp = Date.now().toString();
    const apiKey = crypto.randomBytes(32).toString('hex');
    const signature = crypto
        .createHmac('sha256', sharedSecret)
        .update(`${apiKey}:${timestamp}`)
        .digest('hex');

    return {
        apiKey,
        timestamp,
        signature
    };
};

module.exports = {
    apiKeyAuth,
    generateApiKey
}; 