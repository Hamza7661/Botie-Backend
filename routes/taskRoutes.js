const express = require('express');
const router = express.Router();
const { 
    getAllTasks, 
    getTaskById, 
    createTask, 
    updateTask, 
    deleteTask,
    getDeletedTasks,
    restoreTask
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { dualAuth } = require('../middleware/dualAuthMiddleware');

// Task routes with dual authentication (JWT or API Key)
router.route('/')
    .get(protect, getAllTasks)
    .post(dualAuth, createTask); // Allow both JWT and API key

router.route('/deleted')
    .get(protect, getDeletedTasks);

router.route('/:id')
    .get(protect, getTaskById)
    .put(protect, updateTask)
    .delete(protect, deleteTask);

router.route('/:id/restore')
    .put(protect, restoreTask);

module.exports = router; 