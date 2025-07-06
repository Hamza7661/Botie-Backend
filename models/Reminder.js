const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
    description: {
        type: String,
        required: [true, 'Please provide reminder description'],
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Please provide user reference'],
        index: true
    },
    coordinates: {
        latitude: {
            type: Number,
            required: [true, 'Please provide latitude coordinate'],
            min: [-90, 'Latitude must be between -90 and 90'],
            max: [90, 'Latitude must be between -90 and 90']
        },
        longitude: {
            type: Number,
            required: [true, 'Please provide longitude coordinate'],
            min: [-180, 'Longitude must be between -180 and 180'],
            max: [180, 'Longitude must be between -180 and 180']
        }
    },
    locationName: {
        type: String,
        trim: true,
        maxlength: [200, 'Location name cannot exceed 200 characters']
    },
    reminderDateTime: {
        type: Date,
        required: false,
        default: null,
        index: true
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
reminderSchema.index({ isDeleted: 1, user: 1 });
reminderSchema.index({ isDeleted: 1, coordinates: '2dsphere' }); // Geospatial index for location-based queries

// Query middleware to automatically filter out soft-deleted records
reminderSchema.pre(/^find/, function(next) {
    // Only apply this filter if the query doesn't explicitly include deleted records
    if (!this.getQuery().includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

// Populate user by default
reminderSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'user',
        select: 'firstname lastname email'
    });
    next();
});

// Soft delete method
reminderSchema.methods.softDelete = function() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

// Hard delete method (for admin purposes)
reminderSchema.methods.hardDelete = function() {
    return this.deleteOne();
};

// Check if reminder is soft deleted
reminderSchema.methods.isSoftDeleted = function() {
    return this.isDeleted === true;
};

// Static method to find reminder including soft deleted ones
reminderSchema.statics.findReminderWithDeleted = function(query) {
    return this.findOne(query).setOptions({ includeDeleted: true });
};

// Static method to find all reminders including soft deleted ones
reminderSchema.statics.findAllWithDeleted = function(query = {}) {
    return this.find(query).setOptions({ includeDeleted: true });
};

// Static method to count reminders including soft deleted ones
reminderSchema.statics.countWithDeleted = function(query = {}) {
    return this.countDocuments(query).setOptions({ includeDeleted: true });
};

// Static method to find reminders near a location
reminderSchema.statics.findNearLocation = function(longitude, latitude, maxDistance = 10000) {
    return this.find({
        coordinates: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistance // in meters
            }
        }
    });
};

module.exports = mongoose.model('Reminder', reminderSchema); 