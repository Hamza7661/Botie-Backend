const Task = require('../models/Task');
const Customer = require('../models/Customer');
const { taskSchema, taskUpdateSchema, paginationSchema } = require('../validators/taskValidator');

// @desc    Get all tasks with pagination
// @route   GET /api/tasks
// @access  Private
const getAllTasks = async (req, res) => {
    try {
        // Validate pagination parameters
        const { error, value } = paginationSchema.validate(req.query);
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
                { heading: { $regex: search.trim(), $options: 'i' } },
                { summary: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Build sort object
        let sortObject = {};
        if (sortBy === 'customer.name') {
            // For sorting by customer name, we'll need to handle this differently
            sortObject = { 'customer.name': sortOrder === 'asc' ? 1 : -1 };
        } else {
            sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // Execute query
        const tasks = await Task.find(query)
            .sort(sortObject)
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalTasks = await Task.countDocuments({ ...query, isDeleted: { $ne: true } });
        const totalPages = Math.ceil(totalTasks / limit);

        res.status(200).json({
            success: true,
            data: {
                tasks,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalTasks,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error in getAllTasks:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving tasks' 
        });
    }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!task) {
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('Error in getTaskById:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving task' 
        });
    }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = taskSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { heading, summary, description, isResolved, customer: customerData } = value;

        // Check if customer exists (by phone number)
        let customer = await Customer.findOne({ 
            phoneNumber: customerData.phoneNumber 
        });

        if (!customer) {
            // Create new customer
            customer = new Customer({
                ...customerData,
                user: req.user.id
            });
            await customer.save();
        }

        // Create task
        const task = new Task({
            heading,
            summary,
            description,
            isResolved: isResolved || false,
            customer: customer._id,
            user: req.user.id
        });

        await task.save();

        // Populate customer details for response
        await task.populate('customer', 'name address phoneNumber');

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: task
        });
    } catch (error) {
        console.error('Error in createTask:', error);
        
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
            message: 'Server error while creating task' 
        });
    }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
    try {
        // Validate request body
        const { error, value } = taskUpdateSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const task = await Task.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!task) {
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        // Check if task is soft deleted
        if (task.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot update a deleted task' 
            });
        }

        // Update task fields
        const updateFields = {};
        if (value.heading !== undefined) updateFields.heading = value.heading;
        if (value.summary !== undefined) updateFields.summary = value.summary;
        if (value.description !== undefined) updateFields.description = value.description;
        if (value.isResolved !== undefined) updateFields.isResolved = value.isResolved;

        // Handle customer update if provided
        if (value.customer) {
            let customer = await Customer.findOne({ 
                phoneNumber: value.customer.phoneNumber 
            });

            if (customer) {
                // Update existing customer data
                customer.name = value.customer.name;
                customer.address = value.customer.address;
                customer.phoneNumber = value.customer.phoneNumber;
                await customer.save();
            } else {
                // Create new customer
                customer = new Customer({
                    ...value.customer,
                    user: req.user.id
                });
                await customer.save();
            }

            updateFields.customer = customer._id;
        }

        // Apply updates
        Object.assign(task, updateFields);
        const updatedTask = await task.save();

        // Populate customer details for response
        await updatedTask.populate('customer', 'name address phoneNumber');

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        console.error('Error in updateTask:', error);
        
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
            message: 'Server error while updating task' 
        });
    }
};

// @desc    Soft delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
    try {
        const task = await Task.findOne({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!task) {
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        // Check if task is already soft deleted
        if (task.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Task has already been deleted' 
            });
        }

        // Perform soft delete
        await task.softDelete();

        res.status(200).json({ 
            success: true, 
            message: 'Task deleted successfully',
            data: {
                deletedAt: task.deletedAt,
                message: 'Task has been deleted.'
            }
        });
    } catch (error) {
        console.error('Error in deleteTask:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting task' 
        });
    }
};

// @desc    Get deleted tasks (for admin/restore purposes)
// @route   GET /api/tasks/deleted
// @access  Private
const getDeletedTasks = async (req, res) => {
    try {
        // Validate pagination parameters
        const { error, value } = paginationSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { page, limit, search, sortBy, sortOrder } = value;
        const skip = (page - 1) * limit;

        // Build query for deleted tasks
        let query = { 
            user: req.user.id,
            isDeleted: true 
        };
        
        // Only apply search filter if search is not null, undefined, or empty
        if (search && search.trim() !== '') {
            query.$or = [
                { heading: { $regex: search.trim(), $options: 'i' } },
                { summary: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        // Build sort object
        let sortObject = {};
        if (sortBy === 'customer.name') {
            sortObject = { 'customer.name': sortOrder === 'asc' ? 1 : -1 };
        } else {
            sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }

        // Execute query
        const tasks = await Task.find(query)
            .sort(sortObject)
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalTasks = await Task.countDocuments(query);
        const totalPages = Math.ceil(totalTasks / limit);

        res.status(200).json({
            success: true,
            data: {
                tasks,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalTasks,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error in getDeletedTasks:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving deleted tasks' 
        });
    }
};

// @desc    Restore deleted task
// @route   PUT /api/tasks/:id/restore
// @access  Private
const restoreTask = async (req, res) => {
    try {
        const task = await Task.findTaskWithDeleted({ 
            _id: req.params.id, 
            user: req.user.id 
        });

        if (!task) {
            return res.status(404).json({ 
                success: false, 
                message: 'Task not found' 
            });
        }

        // Check if task is soft deleted
        if (!task.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Task is not deleted' 
            });
        }

        // Restore task
        task.isDeleted = false;
        task.deletedAt = null;
        await task.save();

        // Populate customer details for response
        await task.populate('customer', 'name address phoneNumber');

        res.status(200).json({
            success: true,
            message: 'Task restored successfully',
            data: task
        });
    } catch (error) {
        console.error('Error in restoreTask:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while restoring task' 
        });
    }
};

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getDeletedTasks,
    restoreTask
}; 