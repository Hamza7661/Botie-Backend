const Customer = require('../models/Customer');
const { emitCustomerCreated, emitCustomerUpdated, emitCustomerDeleted } = require('../services/websocketService');

// @desc    Search customers by name or phone number
// @route   GET /api/customers
// @access  Private
const searchCustomers = async (req, res) => {
    try {
        const { search } = req.query;
        const userId = req.user.id; // Get current user from auth middleware

        // Build query for current user's customers
        let query = { 
            user: userId,
            isDeleted: { $ne: true } // Exclude soft-deleted customers
        };

        // Add search filter if search parameter is provided
        if (search && search.trim() !== '') {
            const searchTerm = search.trim();
            query.$or = [
                { name: { $regex: searchTerm, $options: 'i' } },
                { phoneNumber: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Execute query with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const customers = await Customer.find(query)
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalCustomers = await Customer.countDocuments(query);
        const totalPages = Math.ceil(totalCustomers / limit);

        res.status(200).json({
            success: true,
            data: {
                customers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCustomers,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    limit
                }
            }
        });
    } catch (error) {
        console.error('Error in searchCustomers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while searching customers'
        });
    }
};

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Private
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            user: req.user.id,
            isDeleted: { $ne: true }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.status(200).json({
            success: true,
            data: customer
        });
    } catch (error) {
        console.error('Error in getCustomerById:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving customer'
        });
    }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
    try {
        const { name, address, phoneNumber } = req.body;

        // Validate required fields
        if (!name || !address || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, address, and phone number'
            });
        }

        // Check if customer with same phone number already exists for this user
        const existingCustomer = await Customer.findOne({
            phoneNumber: phoneNumber,
            user: req.user.id,
            isDeleted: { $ne: true }
        });

        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Customer with this phone number already exists'
            });
        }

        // Create new customer
        const customer = new Customer({
            name,
            address,
            phoneNumber,
            user: req.user.id
        });

        await customer.save();

        // Emit real-time update
        emitCustomerCreated(req.user.id, customer);

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: customer
        });
    } catch (error) {
        console.error('Error in createCustomer:', error);
        
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
            message: 'Server error while creating customer'
        });
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
    try {
        const { name, address, phoneNumber } = req.body;

        const customer = await Customer.findOne({
            _id: req.params.id,
            user: req.user.id,
            isDeleted: { $ne: true }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Check if phone number is being changed and if it conflicts with existing customer
        if (phoneNumber && phoneNumber !== customer.phoneNumber) {
            const existingCustomer = await Customer.findOne({
                phoneNumber: phoneNumber,
                user: req.user.id,
                _id: { $ne: req.params.id },
                isDeleted: { $ne: true }
            });

            if (existingCustomer) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer with this phone number already exists'
                });
            }
        }

        // Update fields
        if (name !== undefined) customer.name = name;
        if (address !== undefined) customer.address = address;
        if (phoneNumber !== undefined) customer.phoneNumber = phoneNumber;

        await customer.save();

        // Emit real-time update
        emitCustomerUpdated(req.user.id, customer);

        res.status(200).json({
            success: true,
            message: 'Customer updated successfully',
            data: customer
        });
    } catch (error) {
        console.error('Error in updateCustomer:', error);
        
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
            message: 'Server error while updating customer'
        });
    }
};

// @desc    Soft delete customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            user: req.user.id,
            isDeleted: { $ne: true }
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Check if customer is already soft deleted
        if (customer.isSoftDeleted()) {
            return res.status(400).json({
                success: false,
                message: 'Customer has already been deleted'
            });
        }

        // Perform soft delete
        await customer.softDelete();

        // Emit real-time update
        emitCustomerDeleted(req.user.id, customer._id);

        res.status(200).json({
            success: true,
            message: 'Customer deleted successfully',
            data: {
                deletedAt: customer.deletedAt,
                message: 'Customer has been deleted.'
            }
        });
    } catch (error) {
        console.error('Error in deleteCustomer:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting customer'
        });
    }
};

module.exports = {
    searchCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
}; 