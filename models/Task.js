const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    heading: {
        type: String,
        required: [true, 'Please provide task heading'],
        trim: true,
    },
    summary: {
        type: String,
        required: [true, 'Please provide task summary'],
        trim: true,
    },
    description: {
        type: String,
        required: [true, 'Please provide task description'],
        trim: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Please provide customer reference'],
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please provide user reference'],
    },
    isResolved: {
        type: Boolean,
        default: false,
        index: true,
    },
    // Soft delete fields
    isDeleted: {
        type: Boolean,
        default: false,
        index: true,
    },
    deletedAt: {
        type: Date,
        default: null,
        index: true,
    },
}, { timestamps: true });

// Compound indexes for soft delete queries
taskSchema.index({ isDeleted: 1, user: 1 });
taskSchema.index({ isDeleted: 1, customer: 1 });

// Query middleware to automatically filter out soft-deleted records
taskSchema.pre(/^find/, function(next) {
    // Only apply this filter if the query doesn't explicitly include deleted records
    if (!this.getQuery().includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

// Populate customer and user by default
taskSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'customer',
        select: 'name address phoneNumber'
    }).populate({
        path: 'user',
        select: 'firstname lastname email'
    });
    next();
});

// Soft delete method
taskSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

// Hard delete method (for admin purposes)
taskSchema.methods.hardDelete = function() {
    return this.deleteOne();
};

// Check if task is soft deleted
taskSchema.methods.isSoftDeleted = function() {
    return this.isDeleted === true;
};

// Static method to find task including soft deleted ones
taskSchema.statics.findTaskWithDeleted = function(query) {
    return this.findOne(query).setOptions({ includeDeleted: true });
};

// Static method to find all tasks including soft deleted ones
taskSchema.statics.findAllWithDeleted = function(query = {}) {
    return this.find(query).setOptions({ includeDeleted: true });
};

// Static method to count tasks including soft deleted ones
taskSchema.statics.countWithDeleted = function(query = {}) {
    return this.countDocuments(query).setOptions({ includeDeleted: true });
};

module.exports = mongoose.model('Task', taskSchema); 