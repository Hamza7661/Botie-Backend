const Joi = require('joi');

// Customer validation schema
const customerSchema = Joi.object({
    name: Joi.string().required().trim().min(2).max(100).messages({
        'string.empty': 'Customer name is required',
        'string.min': 'Customer name must be at least 2 characters long',
        'string.max': 'Customer name cannot exceed 100 characters'
    }),
    address: Joi.string().required().trim().min(5).max(500).messages({
        'string.empty': 'Customer address is required',
        'string.min': 'Customer address must be at least 5 characters long',
        'string.max': 'Customer address cannot exceed 500 characters'
    }),
    phoneNumber: Joi.string().required().trim().pattern(/^[\+]?[1-9][\d]{0,15}$/).messages({
        'string.empty': 'Customer phone number is required',
        'string.pattern.base': 'Please provide a valid phone number'
    })
});

// Task validation schema
const taskSchema = Joi.object({
    heading: Joi.string().required().trim().min(3).max(200).messages({
        'string.empty': 'Task heading is required',
        'string.min': 'Task heading must be at least 3 characters long',
        'string.max': 'Task heading cannot exceed 200 characters'
    }),
    summary: Joi.string().required().trim().min(10).max(500).messages({
        'string.empty': 'Task summary is required',
        'string.min': 'Task summary must be at least 10 characters long',
        'string.max': 'Task summary cannot exceed 500 characters'
    }),
    description: Joi.string().required().trim().max(2000).messages({
        'string.empty': 'Task description is required',
        'string.max': 'Task description cannot exceed 2000 characters'
    }),
    isResolved: Joi.boolean().default(false).messages({
        'boolean.base': 'isResolved must be a boolean value'
    }),
    customer: customerSchema.required()
});

// Task update validation schema (all fields optional)
const taskUpdateSchema = Joi.object({
    heading: Joi.string().trim().min(3).max(200).optional().messages({
        'string.min': 'Task heading must be at least 3 characters long',
        'string.max': 'Task heading cannot exceed 200 characters'
    }),
    summary: Joi.string().trim().min(10).max(500).optional().messages({
        'string.min': 'Task summary must be at least 10 characters long',
        'string.max': 'Task summary cannot exceed 500 characters'
    }),
    description: Joi.string().trim().max(2000).optional().messages({
        'string.max': 'Task description cannot exceed 2000 characters'
    }),
    isResolved: Joi.boolean().optional().messages({
        'boolean.base': 'isResolved must be a boolean value'
    }),
    customer: customerSchema.optional()
});

// Pagination validation schema
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    search: Joi.string().trim().max(100).allow('').optional().messages({
        'string.max': 'Search term cannot exceed 100 characters'
    }),
    sortBy: Joi.string().valid('createdAt', 'heading', 'customer.name').default('createdAt').messages({
        'any.only': 'Sort by must be one of: createdAt, heading, customer.name'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'Sort order must be either asc or desc'
    })
});

module.exports = {
    taskSchema,
    taskUpdateSchema,
    customerSchema,
    paginationSchema
}; 