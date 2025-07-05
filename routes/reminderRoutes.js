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

module.exports = router; 