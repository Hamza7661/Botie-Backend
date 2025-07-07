const User = require('../models/User');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const { sendEmail } = require('../services/emailService');
const { assignPhoneNumberToUser } = require('../services/twilioService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Helper function to get the correct protocol for URL generation
const getProtocol = (req) => {
    // In production, force HTTPS
    if (process.env.NODE_ENV === 'production') {
        return 'https';
    }
    // Check for X-Forwarded-Proto header (common when behind proxy/load balancer)
    if (req.headers['x-forwarded-proto'] === 'https') {
        return 'https';
    }
    // Check for X-Forwarded-Ssl header
    if (req.headers['x-forwarded-ssl'] === 'on') {
        return 'https';
    }
    // Fallback to request protocol
    return req.protocol;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { firstname, lastname, email, phoneNumber, address, password, profession, professionDescription } = value;

        // Check for existing user including soft-deleted ones
        const existingUser = await User.findUserWithDeleted({ email });

        if (existingUser) {
            if (existingUser.isSoftDeleted()) {
                // User is soft-deleted - hard delete and allow new registration
                await existingUser.hardDelete();
                console.log(`Hard deleted soft-deleted user with email: ${email}`);
            } else if (!existingUser.isEmailVerified) {
                // User exists but email not verified - tell them to verify first
                return res.status(400).json({ 
                    success: false, 
                    message: 'An account with this email address already exists but is not verified. Please check your email and verify your account before logging in.' 
                });
            } else {
                // User is active and verified - block registration
                return res.status(400).json({ 
                    success: false, 
                    message: 'An account with this email address already exists and is verified. Please login instead or use a different email address.' 
                });
            }
        }
        
        // Create new user (either no existing user or soft-deleted user was just deleted)
        const user = new User({
            firstname,
            lastname,
            email,
            phoneNumber,
            address,
            password,
            profession,
            professionDescription,
        });

        const verificationToken = user.getEmailVerificationToken();
        await user.save();

        const verifyUrl = `${getProtocol(req)}://${req.get('host')}/api/auth/verifyemail?token=${verificationToken}`;
        const message = `Thank you for registering! Please verify your email by copying and pasting this link into your browser: \n\n ${verifyUrl} \n\n This link will expire in 10 minutes.`;

        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'emailVerificationTemplate.html');
            let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(/{{verifyUrl}}/g, verifyUrl);

            await sendEmail({
                email: user.email,
                subject: 'Botie Account Verification',
                message,
                html: htmlTemplate,
            });
            res.status(201).json({ 
                success: true, 
                message: 'Registration successful. Please check your email to verify your account.'
            });
        } catch (err) {
            console.error('Registration error:', err);
            user.emailVerificationToken = undefined;
            user.emailVerificationTokenExpires = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (err) {
        console.error('Registration error:', err);
        // Check if it's a MongoDB duplicate key error (email already exists)
        if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
            return res.status(400).json({ 
                success: false, 
                message: 'An account with this email address already exists. Please login instead or use a different email address.' 
            });
        }
        // Check if it's a validation error
        if (err.name === 'ValidationError') {
            const errorMessages = Object.values(err.errors).map(error => error.message);
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error: ' + errorMessages.join(', ') 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Registration failed. Please try again later or contact support if the problem persists.' 
        });
    }
};

// @desc    Verify email
// @route   GET /api/auth/verifyemail
// @access  Public
exports.verifyEmail = async (req, res, next) => {
    try {
        const emailVerificationToken = crypto
            .createHash('sha256')
            .update(req.query.token)
            .digest('hex');

        // Include soft-deleted users in verification (they might be reactivating)
        const user = await User.findUserWithDeleted({
            emailVerificationToken,
            emailVerificationTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            const templatePath = path.join(__dirname, '..', 'templates', 'emailVerifiedErrorTemplate.html');
            const errorTemplate = fs.readFileSync(templatePath, 'utf-8');
            return res.status(400).send(errorTemplate);
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        
        // If user was soft deleted, reactivate them
        if (user.isSoftDeleted()) {
            user.isDeleted = false;
            user.deletedAt = null;
        }

        // Assign Twilio phone number during email verification
        try {
            const userName = `${user.firstname} ${user.lastname}`;
            const twilioPhone = await assignPhoneNumberToUser(
                user._id.toString(),
                userName
                // Country code will be taken from TWILIO_COUNTRY_CODE env variable
            );

            user.twilioPhoneNumber = twilioPhone.phoneNumber;
            user.twilioPhoneSid = twilioPhone.sid;
            user.twilioPhoneFriendlyName = twilioPhone.friendlyName;
            user.twilioPhoneStatus = 'active';
            
            console.log(`Assigned Twilio phone number ${twilioPhone.phoneNumber} to user ${user._id}`);
        } catch (twilioError) {
            console.error('Twilio phone assignment failed:', twilioError);
            // Continue with verification even if Twilio fails
            user.twilioPhoneStatus = 'failed';
        }
        
        await user.save({ validateBeforeSave: false });

        const templatePath = path.join(__dirname, '..', 'templates', 'emailVerifiedSuccessTemplate.html');
        const successTemplate = fs.readFileSync(templatePath, 'utf-8');
        return res.send(successTemplate);

    } catch (err) {
        console.error(err);
        const errorHtml = `
        <!DOCTYPE html>
        <html lang=\"en\">\n        <head>\n            <meta charset=\"UTF-8\">\n            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n            <title>Server Error</title>\n            <style>\n                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }\n                .container { background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-align: center; max-width: 600px; }\n                .icon { color: #dc3545; font-size: 50px; margin-bottom: 20px; }\n                h1 { margin: 0 0 15px; color: #333333; }\n                p { color: #555555; line-height: 1.6; }\n            </style>\n        </head>\n        <body>\n            <div class=\"container\">\n                <div class=\"icon\">&#9888;</div>\n                <h1>Server Error</h1>\n                <p>We encountered an error while processing your email verification. Please try again later or contact support if the problem persists.</p>\n            </div>\n        </body>\n        </html>`;
        res.status(500).send(errorHtml);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
        }

        const { email, password } = value;

        // Include soft-deleted users in login check to provide appropriate message
        const user = await User.findUserWithDeleted({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(401).json({ 
                success: false, 
                message: 'Account has been deleted.' 
            });
        }

        // Check password first before email verification
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Only check email verification if password is correct
        if (!user.isEmailVerified) {
            return res.status(401).json({ success: false, message: 'Please verify your email to login' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1d',
        });

        res.status(200).json({ 
            success: true, 
            token,
            data: {
                user: {
                    _id: user._id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    address: user.address,
                    twilioPhoneNumber: user.twilioPhoneNumber,
                    twilioPhoneStatus: user.twilioPhoneStatus,
                    profession: user.profession,
                    professionDescription: user.professionDescription,
                    isEmailVerified: user.isEmailVerified,
                    createdAt: user.createdAt
                }
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Change user password
// @route   PUT /api/auth/changepassword
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
        }
        
        // req.user.id is from the 'protect' middleware
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot change password for a deactivated account' 
            });
        }

        const isMatch = await user.matchPassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        // Include soft-deleted users in password reset (they might want to reactivate)
        const user = await User.findUserWithDeleted({ email });

        if (!user) {
            // Send success response to prevent email enumeration
            return res.status(200).json({ success: true, message: 'If a user with that email exists, a password reset link has been sent.' });
        }

        // Check if user is soft deleted and provide appropriate message
        if (user.isSoftDeleted()) {
            return res.status(200).json({ 
                success: true, 
                message: 'If a user with that email exists, a password reset link has been sent. Note: If your account was deactivated, you may need to re-register.' 
            });
        }

        const resetToken = user.getPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${getProtocol(req)}://${req.get('host')}/resetpassword?token=${resetToken}`;

        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'passwordResetTemplate.html');
            let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(/{{resetUrl}}/g, resetUrl);

            await sendEmail({
                email: user.email,
                subject: 'Password Reset Request',
                message: `To reset your password, please click this link: ${resetUrl}`,
                html: htmlTemplate,
            });

            res.status(200).json({ success: true, message: 'If a user with that email exists, a password reset link has been sent.' });
        } catch (err) {
            console.error(err);
            user.passwordResetToken = undefined;
            user.passwordResetTokenExpires = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const passwordResetToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        // Include soft-deleted users in password reset
        const user = await User.findUserWithDeleted({
            passwordResetToken,
            passwordResetTokenExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot reset password for a deactivated account. Please contact support or re-register.' 
            });
        }

        user.password = req.body.newPassword;
        user.passwordResetToken = undefined;
        user.passwordResetTokenExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Resend email verification
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide an email address' 
            });
        }

        // Find user by email (including soft-deleted users)
        const user = await User.findUserWithDeleted({ email });

        if (!user) {
            // Send success response to prevent email enumeration
            return res.status(200).json({ 
                success: true, 
                message: 'If a user with that email exists, a verification link has been sent.' 
            });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(200).json({ 
                success: true, 
                message: 'If a user with that email exists, a verification link has been sent. Note: If your account was deactivated, you may need to re-register.' 
            });
        }

        // Check if email is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is already verified' 
            });
        }

        // Generate new verification token
        const verificationToken = user.getEmailVerificationToken();
        await user.save();

        const verifyUrl = `${getProtocol(req)}://${req.get('host')}/api/auth/verifyemail?token=${verificationToken}`;
        const message = `Please verify your email by copying and pasting this link into your browser: \n\n ${verifyUrl} \n\n This link will expire in 10 minutes.`;

        try {
            const templatePath = path.join(__dirname, '..', 'templates', 'emailVerificationTemplate.html');
            let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
            htmlTemplate = htmlTemplate.replace(/{{verifyUrl}}/g, verifyUrl);

            await sendEmail({
                email: user.email,
                subject: 'Botie Account Verification - Resend',
                message,
                html: htmlTemplate,
            });

            res.status(200).json({ 
                success: true, 
                message: 'Verification email sent successfully. Please check your inbox.' 
            });
        } catch (err) {
            console.error('Email sending failed:', err);
            // Clear the verification token if email fails
            user.emailVerificationToken = undefined;
            user.emailVerificationTokenExpires = undefined;
            await user.save({ validateBeforeSave: false });
            
            return res.status(500).json({ 
                success: false, 
                message: 'Email could not be sent. Please try again later.' 
            });
        }
    } catch (err) {
        console.error('Error in resendVerification:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
}; 