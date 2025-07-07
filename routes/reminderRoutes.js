const express = require('express');
const router = express.Router();
const { 
    getAllReminders, 
    getReminderById, 
    createReminder, 
    updateReminder, 
    deleteReminder,
    getDeletedReminders,
    restoreReminder,
    findRemindersNearLocation
} = require('../controllers/reminderController');

const {
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
} = require('../controllers/reminderServiceController');
const { protect } = require('../middleware/authMiddleware');

// Reminder routes with JWT authentication
router.route('/')
    .get(protect, getAllReminders)
    .post(protect, createReminder);

router.route('/near')
    .get(protect, findRemindersNearLocation);

router.route('/deleted')
    .get(protect, getDeletedReminders);

router.route('/:id')
    .get(protect, getReminderById)
    .put(protect, updateReminder)
    .delete(protect, deleteReminder);

router.route('/:id/restore')
    .put(protect, restoreReminder);

// Reminder service routes
router.route('/location-update')
    .post(protect, updateLocation);

router.route('/active')
    .get(protect, getActiveReminders);

router.route('/service/start')
    .post(protect, startReminderService);

router.route('/service/stop')
    .post(protect, stopReminderService);

router.route('/service/status')
    .get(protect, getReminderServiceStatus);

// Manual trigger routes (for testing)
router.route('/service/trigger-time')
    .post(protect, triggerTimeCheck);

router.route('/service/trigger-location')
    .post(protect, triggerLocationCheck);

// Notification management routes
router.route('/pending')
    .get(protect, getPendingReminders);

router.route('/:id/reset-notification')
    .put(protect, resetNotificationStatus);

router.route('/:id/notification-history')
    .get(protect, getNotificationHistory);

module.exports = router; 