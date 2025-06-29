const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, 'Please provide a first name'],
        trim: true,
    },
    lastname: {
        type: String,
        required: [true, 'Please provide a last name'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email',
        ],
    },
    phoneNumber: {
        type: String,
        required: [true, 'Please provide a phone number'],
    },
    address: {
        type: String,
        trim: true,
    },
    // Twilio phone number fields
    twilioPhoneNumber: {
        type: String,
        default: null,
    },
    twilioPhoneSid: {
        type: String,
        default: null,
    },
    twilioPhoneFriendlyName: {
        type: String,
        default: null,
    },
    twilioPhoneStatus: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: null,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false,
    },
    profession: {
        type: String,
        trim: true,
    },
    professionDescription: {
        type: String,
        trim: true,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    // Soft delete fields
    isDeleted: {
        type: Boolean,
        default: false,
        index: true, // Index for performance on soft delete queries
    },
    deletedAt: {
        type: Date,
        default: null,
        index: true, // Index for performance on soft delete queries
    },
}, { timestamps: true });

// Compound index for soft delete queries
userSchema.index({ isDeleted: 1, email: 1 });

// Query middleware to automatically filter out soft-deleted records
userSchema.pre(/^find/, function(next) {
    // Only apply this filter if the query doesn't explicitly include deleted records
    if (!this.getQuery().includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Soft delete method
userSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

// Hard delete method (for admin purposes)
userSchema.methods.hardDelete = function() {
    return this.deleteOne();
};

// Check if user is soft deleted
userSchema.methods.isSoftDeleted = function() {
    return this.isDeleted === true;
};

// Generate and hash email verification token
userSchema.methods.getEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(20).toString('hex');

    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    this.emailVerificationTokenExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return verificationToken;
};

// Generate and hash password reset token
userSchema.methods.getPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to passwordResetToken field
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire time to 10 minutes
    this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

// Static method to find user including soft deleted ones
userSchema.statics.findUserWithDeleted = function(query) {
    return this.findOne(query).setOptions({ includeDeleted: true });
};

// Static method to find all users including soft deleted ones
userSchema.statics.findAllWithDeleted = function(query = {}) {
    return this.find(query).setOptions({ includeDeleted: true });
};

// Static method to count users including soft deleted ones
userSchema.statics.countWithDeleted = function(query = {}) {
    return this.countDocuments(query).setOptions({ includeDeleted: true });
};

module.exports = mongoose.model('User', userSchema); 