const User = require('../models/User');
const { registerSchema, loginSchema } = require('../validators/authValidator');
const sendEmail = require('../services/emailService');
const { assignPhoneNumberToUser } = require('../services/twilioService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

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
                // Case 1: User exists but is soft deleted - reactivate the existing user
                existingUser.firstname = firstname;
                existingUser.lastname = lastname;
                existingUser.phoneNumber = phoneNumber;
                existingUser.address = address;
                existingUser.password = password;
                existingUser.profession = profession;
                existingUser.professionDescription = professionDescription;
                existingUser.isDeleted = false;
                existingUser.deletedAt = null;
                existingUser.isEmailVerified = false; // Reset email verification

                const verificationToken = existingUser.getEmailVerificationToken();
                await existingUser.save();

                const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verifyemail?token=${verificationToken}`;
                const message = `Thank you for re-registering! Please verify your email by copying and pasting this link into your browser: \n\n ${verifyUrl} \n\n This link will expire in 10 minutes.`;

                try {
                    const templatePath = path.join(__dirname, '..', 'templates', 'emailVerificationTemplate.html');
                    let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
                    htmlTemplate = htmlTemplate.replace(/{{verifyUrl}}/g, verifyUrl);

                    await sendEmail({
                        email: existingUser.email,
                        subject: 'Email Verification - Account Reactivation',
                        message,
                        html: htmlTemplate,
                    });
                    res.status(201).json({ 
                        success: true, 
                        message: 'Registration successful. Please check your email to verify your account.'
                    });
                } catch (err) {
                    console.error(err);
                    existingUser.emailVerificationToken = undefined;
                    existingUser.emailVerificationTokenExpires = undefined;
                    await existingUser.save({ validateBeforeSave: false });
                    return res.status(500).json({ success: false, message: 'Email could not be sent' });
                }
            } else if (existingUser.isEmailVerified) {
                // Case 2: User is fully registered and verified.
                return res.status(400).json({ success: false, message: 'User already exists' });
            } else {
                // Case 3: User registered but hasn't verified. Resend email.
                const verificationToken = existingUser.getEmailVerificationToken();
                await existingUser.save();

                const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verifyemail?token=${verificationToken}`;
                const message = `You have already started the registration process. Please verify your email by copying this link into your browser: \n\n ${verifyUrl} \n\n This link expires in 10 minutes.`;

                try {
                    const templatePath = path.join(__dirname, '..', 'templates', 'emailVerificationTemplate.html');
                    let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
                    htmlTemplate = htmlTemplate.replace(/{{verifyUrl}}/g, verifyUrl);

                    await sendEmail({
                        email: existingUser.email,
                        subject: 'Complete Your Registration',
                        message,
                        html: htmlTemplate,
                    });
                    
                    return res.status(500).json({ success: false, message: 'An email has been sent for registration. Please check your inbox to verify.' });
                
                } catch (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Email could not be sent' });
                }
            }
        } else {
            // Case 4: No existing user - create new user
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

            const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verifyemail?token=${verificationToken}`;
            const message = `Thank you for registering! Please verify your email by copying and pasting this link into your browser: \n\n ${verifyUrl} \n\n This link will expire in 10 minutes.`;

            try {
                const templatePath = path.join(__dirname, '..', 'templates', 'emailVerificationTemplate.html');
                let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
                htmlTemplate = htmlTemplate.replace(/{{verifyUrl}}/g, verifyUrl);

                await sendEmail({
                    email: user.email,
                    subject: 'Email Verification',
                    message,
                    html: htmlTemplate,
                });
                res.status(201).json({ 
                    success: true, 
                    message: 'Registration successful. Please check your email to verify your account.'
                });
            } catch (err) {
                console.error(err);
                user.emailVerificationToken = undefined;
                user.emailVerificationTokenExpires = undefined;
                await user.save({ validateBeforeSave: false });
                return res.status(500).json({ success: false, message: 'Email could not be sent' });
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
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
            return res.status(400).sendFile(templatePath);
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
        return res.sendFile(templatePath);

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
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

        if (!user.isEmailVerified) {
            return res.status(401).json({ success: false, message: 'Please verify your email to login' });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
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

        const resetUrl = `${req.protocol}://${req.get('host')}/resetpassword?token=${resetToken}`;

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