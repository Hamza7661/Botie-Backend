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

// All routes in this file are protected
router.use(protect);

// Task routes
router.route('/')
    .get(getAllTasks)
    .post(createTask);

router.route('/deleted')
    .get(getDeletedTasks);

router.route('/:id')
    .get(getTaskById)
    .put(updateTask)
    .delete(deleteTask);

router.route('/:id/restore')
    .put(restoreTask);

module.exports = router; 