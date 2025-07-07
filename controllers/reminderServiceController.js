const reminderService = require('../services/reminderService');
const { locationUpdateSchema } = require('../validators/reminderValidator');

// @desc    Update user location for location-based reminders
// @route   POST /api/reminders/location-update
// @access  Private
const updateLocation = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = locationUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { latitude, longitude } = value;
        const userId = req.user.id;

        // Handle location update in reminder service
        await reminderService.handleLocationUpdate(userId, { latitude, longitude });

        res.status(200).json({
            success: true,
            message: 'Location updated successfully',
            data: {
                latitude,
                longitude,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while updating location' 
        });
    }
};

// @desc    Get user's active reminders
// @route   GET /api/reminders/active
// @access  Private
const getActiveReminders = async (req, res) => {
    try {
        const userId = req.user.id;
        const reminders = await reminderService.getUserReminders(userId);

        res.status(200).json({
            success: true,
            data: {
                reminders,
                count: reminders.length
            }
        });
    } catch (error) {
        console.error('Error getting active reminders:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving active reminders' 
        });
    }
};

// @desc    Start reminder service (admin only)
// @route   POST /api/reminders/service/start
// @access  Private
const startReminderService = async (req, res) => {
    try {
        reminderService.start();
        
        res.status(200).json({
            success: true,
            message: 'Reminder service started successfully'
        });
    } catch (error) {
        console.error('Error starting reminder service:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while starting reminder service' 
        });
    }
};

// @desc    Stop reminder service (admin only)
// @route   POST /api/reminders/service/stop
// @access  Private
const stopReminderService = async (req, res) => {
    try {
        reminderService.stop();
        
        res.status(200).json({
            success: true,
            message: 'Reminder service stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping reminder service:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while stopping reminder service' 
        });
    }
};

// @desc    Get reminder service status
// @route   GET /api/reminders/service/status
// @access  Private
const getReminderServiceStatus = async (req, res) => {
    try {
        const status = reminderService.getServiceStatus();
        
        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting reminder service status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while getting reminder service status' 
        });
    }
};

// @desc    Reset notification status for a reminder
// @route   PUT /api/reminders/:id/reset-notification
// @access  Private
const resetNotificationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { triggerType } = req.body; // 'time' or 'location'

        if (!triggerType || !['time', 'location'].includes(triggerType)) {
            return res.status(400).json({
                success: false,
                message: 'triggerType must be either "time" or "location"'
            });
        }

        const reminder = await reminderService.resetNotificationStatus(id, triggerType);

        res.status(200).json({
            success: true,
            message: `Notification status reset for ${triggerType}-based reminder`,
            data: reminder
        });
    } catch (error) {
        console.error('Error resetting notification status:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error while resetting notification status' 
        });
    }
};

// @desc    Get notification history for a reminder
// @route   GET /api/reminders/:id/notification-history
// @access  Private
const getNotificationHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await reminderService.getNotificationHistory(id);

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting notification history:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error while getting notification history' 
        });
    }
};

// @desc    Get pending reminders for user
// @route   GET /api/reminders/pending
// @access  Private
const getPendingReminders = async (req, res) => {
    try {
        const userId = req.user.id;
        const pending = await reminderService.getPendingReminders(userId);

        res.status(200).json({
            success: true,
            data: pending
        });
    } catch (error) {
        console.error('Error getting pending reminders:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while getting pending reminders' 
        });
    }
};

// @desc    Manually trigger time-based reminder check (for testing)
// @route   POST /api/reminders/service/trigger-time
// @access  Private
const triggerTimeCheck = async (req, res) => {
    try {
        await reminderService.triggerTimeCheck();
        
        res.status(200).json({
            success: true,
            message: 'Time-based reminder check triggered successfully'
        });
    } catch (error) {
        console.error('Error triggering time check:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while triggering time check' 
        });
    }
};

// @desc    Manually trigger location-based reminder check (for testing)
// @route   POST /api/reminders/service/trigger-location
// @access  Private
const triggerLocationCheck = async (req, res) => {
    try {
        await reminderService.triggerLocationCheck();
        
        res.status(200).json({
            success: true,
            message: 'Location-based reminder check triggered successfully'
        });
    } catch (error) {
        console.error('Error triggering location check:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while triggering location check' 
        });
    }
};

module.exports = {
    updateLocation,
    getActiveReminders,
    startReminderService,
    stopReminderService,
    getReminderServiceStatus,
    resetNotificationStatus,
    getNotificationHistory,
    getPendingReminders,
    triggerTimeCheck,
    triggerLocationCheck
}; 