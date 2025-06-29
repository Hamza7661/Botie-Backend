const express = require('express');
const router = express.Router();
const { 
    searchCustomers, 
    getCustomerById, 
    createCustomer, 
    updateCustomer, 
    deleteCustomer 
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

// All routes in this file are protected
router.use(protect);

// Search customers (GET /api/customers?search=mar)
router.get('/', searchCustomers);

// Create new customer
router.post('/', createCustomer);

// Get, update, delete customer by ID
router.route('/:id')
    .get(getCustomerById)
    .put(updateCustomer)
    .delete(deleteCustomer);

module.exports = router; 