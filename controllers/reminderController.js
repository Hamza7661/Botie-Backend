const Reminder = require('../models/Reminder');
const { reminderSchema, reminderUpdateSchema, reminderPaginationSchema, locationSearchSchema } = require('../validators/reminderValidator');
const { emitReminderCreated, emitReminderUpdated, emitReminderDeleted } = require('../services/websocketService');

// @desc    Get all reminders with pagination
// @route   GET /api/reminders
// @access  Private
const getAllReminders = async (req, res) => {
    try {
        // Validate pagination parameters
        const { error, value } = reminderPaginationSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { page, limit, search, sortBy, sortOrder } = value;
        const skip = (page - 1) * limit;

        // Build query
        let query = { user: req.user.id };
        
        // Only apply search filter if search is not null, undefined, or empty
        if (search && search.trim() !== '') {
            query.$or = [
                { description: { $regex: search.trim(), $options: 'i' } },
                { locationName: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Build sort object
        let sortObject = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const reminders = await Reminder.find(query)
            .sort(sortObject)
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalReminders = await Reminder.countDocuments({ ...query, isDeleted: { $ne: true } });
        const totalPages = Math.ceil(totalReminders / limit);

        res.status(200).json({
            success: true,
            data: {
                reminders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalReminders,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error in getAllReminders:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving reminders' 
        });
    }
};

// @desc    Get reminder by ID
// @route   GET /api/reminders/:id
// @access  Private
const getReminderById = async (req, res) => {
    try {
        const reminder = await Reminder.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!reminder) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reminder not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: reminder
        });
    } catch (error) {
        console.error('Error in getReminderById:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving reminder' 
        });
    }
};

// @desc    Create new reminder
// @route   POST /api/reminders
// @access  Private
const createReminder = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = reminderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { description, coordinates, locationName, reminderDateTime } = value;

        // Set locationName to null if coordinates are provided but no locationName or if it's empty string
        const finalLocationName = (coordinates && !locationName) || locationName === '' ? null : locationName;

        // Create reminder
        const reminder = new Reminder({
            description,
            coordinates,
            locationName: finalLocationName,
            reminderDateTime,
            user: req.user.id
        });

        await reminder.save();

        // Emit real-time update
        emitReminderCreated(req.user.id, reminder);

        res.status(201).json({
            success: true,
            message: 'Reminder created successfully',
            data: reminder
        });
    } catch (error) {
        console.error('Error in createReminder:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error',
                errors: validationErrors
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Server error while creating reminder' 
        });
    }
};

// @desc    Update reminder
// @route   PUT /api/reminders/:id
// @access  Private
const updateReminder = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = reminderUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const reminder = await Reminder.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!reminder) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reminder not found' 
            });
        }

        // Check if reminder is soft deleted
        if (reminder.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot update a deleted reminder' 
            });
        }

        // Update reminder fields
        const updateFields = {};
        if (value.description !== undefined) updateFields.description = value.description;
        if (value.coordinates !== undefined) updateFields.coordinates = value.coordinates;
        if (value.reminderDateTime !== undefined) updateFields.reminderDateTime = value.reminderDateTime;
        
        // Handle locationName logic: set to null if coordinates are provided but no locationName or if it's empty string
        if (value.locationName !== undefined) {
            updateFields.locationName = value.locationName === '' ? null : value.locationName;
        } else if (value.coordinates !== undefined && value.locationName === undefined) {
            // If coordinates are being updated but locationName is not provided, set it to null
            updateFields.locationName = null;
        }

        // Apply updates
        Object.assign(reminder, updateFields);
        const updatedReminder = await reminder.save();

        // Emit real-time update
        emitReminderUpdated(req.user.id, updatedReminder);

        res.status(200).json({
            success: true,
            message: 'Reminder updated successfully',
            data: updatedReminder
        });
    } catch (error) {
        console.error('Error in updateReminder:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error',
                errors: validationErrors
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating reminder' 
        });
    }
};

// @desc    Soft delete reminder
// @route   DELETE /api/reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!reminder) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reminder not found' 
            });
        }

        // Check if reminder is already soft deleted
        if (reminder.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reminder has already been deleted' 
            });
        }

        // Perform soft delete
        await reminder.softDelete();

        // Emit real-time update
        emitReminderDeleted(req.user.id, reminder);

        res.status(200).json({ 
            success: true, 
            message: 'Reminder deleted successfully',
            data: {
                deletedAt: reminder.deletedAt,
                message: 'Reminder has been deleted.'
            }
        });
    } catch (error) {
        console.error('Error in deleteReminder:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting reminder' 
        });
    }
};

// @desc    Get deleted reminders
// @route   GET /api/reminders/deleted
// @access  Private
const getDeletedReminders = async (req, res) => {
    try {
        // Validate pagination parameters
        const { error, value } = reminderPaginationSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { page, limit, search, sortBy, sortOrder } = value;
        const skip = (page - 1) * limit;

        // Build query for deleted reminders
        let query = { 
            user: req.user.id,
            isDeleted: true 
        };
        
        // Only apply search filter if search is not null, undefined, or empty
        if (search && search.trim() !== '') {
            query.$or = [
                { description: { $regex: search.trim(), $options: 'i' } },
                { locationName: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Build sort object
        let sortObject = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query
        const reminders = await Reminder.find(query)
            .sort(sortObject)
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalReminders = await Reminder.countDocuments(query);
        const totalPages = Math.ceil(totalReminders / limit);

        res.status(200).json({
            success: true,
            data: {
                reminders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalReminders,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error in getDeletedReminders:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving deleted reminders' 
        });
    }
};

// @desc    Restore deleted reminder
// @route   PUT /api/reminders/:id/restore
// @access  Private
const restoreReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findReminderWithDeleted({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!reminder) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reminder not found' 
            });
        }

        // Check if reminder is soft deleted
        if (!reminder.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reminder is not deleted' 
            });
        }

        // Restore reminder
        reminder.isDeleted = false;
        reminder.deletedAt = null;
        await reminder.save();

        // Emit real-time update
        emitReminderUpdated(req.user.id, reminder);

        res.status(200).json({
            success: true,
            message: 'Reminder restored successfully',
            data: reminder
        });
    } catch (error) {
        console.error('Error in restoreReminder:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while restoring reminder' 
        });
    }
};

// @desc    Find reminders near location
// @route   GET /api/reminders/near
// @access  Private
const findRemindersNearLocation = async (req, res) => {
    try {
        // Validate location parameters
        const { error, value } = locationSearchSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { latitude, longitude, maxDistance } = value;

        // Find reminders near the specified location
        const reminders = await Reminder.find({
            user: req.user.id,
            coordinates: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    },
                    $maxDistance: maxDistance
                }
            }
        }).limit(50); // Limit results to prevent overwhelming response

        res.status(200).json({
            success: true,
            data: {
                reminders,
                searchLocation: { latitude, longitude },
                maxDistance,
                totalFound: reminders.length
            }
        });
    } catch (error) {
        console.error('Error in findRemindersNearLocation:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while searching for reminders near location' 
        });
    }
};

module.exports = {
    getAllReminders,
    getReminderById,
    createReminder,
    updateReminder,
    deleteReminder,
    getDeletedReminders,
    restoreReminder,
    findRemindersNearLocation
}; 