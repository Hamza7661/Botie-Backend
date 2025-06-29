const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide customer name'],
        trim: true,
    },
    address: {
        type: String,
        required: [true, 'Please provide customer address'],
        trim: true,
    },
    phoneNumber: {
        type: String,
        required: [true, 'Please provide customer phone number'],
        trim: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please provide user reference'],
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

// Compound index for soft delete queries
customerSchema.index({ isDeleted: 1, phoneNumber: 1 });
customerSchema.index({ isDeleted: 1, user: 1 });

// Query middleware to automatically filter out soft-deleted records
customerSchema.pre(/^find/, function(next) {
    // Only apply this filter if the query doesn't explicitly include deleted records
    if (!this.getQuery().includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

// Soft delete method
customerSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

// Hard delete method (for admin purposes)
customerSchema.methods.hardDelete = function() {
    return this.deleteOne();
};

// Check if customer is soft deleted
customerSchema.methods.isSoftDeleted = function() {
    return this.isDeleted === true;
};

// Static method to find customer including soft deleted ones
customerSchema.statics.findCustomerWithDeleted = function(query) {
    return this.findOne(query).setOptions({ includeDeleted: true });
};

// Static method to find all customers including soft deleted ones
customerSchema.statics.findAllWithDeleted = function(query = {}) {
    return this.find(query).setOptions({ includeDeleted: true });
};

// Static method to count customers including soft deleted ones
customerSchema.statics.countWithDeleted = function(query = {}) {
    return this.countDocuments(query).setOptions({ includeDeleted: true });
};

module.exports = mongoose.model('Customer', customerSchema); 