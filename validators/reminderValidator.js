const Joi = require('joi');

// Reminder validation schema
const reminderSchema = Joi.object({
    description: Joi.string().required().trim().max(2000).messages({
        'string.empty': 'Reminder description is required',
        'string.max': 'Description cannot exceed 2000 characters'
    }),
    coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).required().messages({
            'number.base': 'Latitude must be a number',
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'any.required': 'Latitude is required'
        }),
        longitude: Joi.number().min(-180).max(180).required().messages({
            'number.base': 'Longitude must be a number',
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'any.required': 'Longitude is required'
        })
    }).required().messages({
        'object.base': 'Coordinates must be an object',
        'any.required': 'Coordinates are required'
    }),
    locationName: Joi.string().trim().max(200).allow('').optional().messages({
        'string.max': 'Location name cannot exceed 200 characters'
    }),
    reminderDateTime: Joi.alternatives().try(Joi.date(), Joi.valid(null)).optional().messages({
        'alternatives.match': 'Reminder date and time must be a valid date or null'
    })
});

// Reminder update validation schema (all fields optional)
const reminderUpdateSchema = Joi.object({
    description: Joi.string().trim().max(2000).optional().messages({
        'string.max': 'Description cannot exceed 2000 characters'
    }),
    coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90).required().messages({
            'number.base': 'Latitude must be a number',
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'any.required': 'Latitude is required'
        }),
        longitude: Joi.number().min(-180).max(180).required().messages({
            'number.base': 'Longitude must be a number',
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'any.required': 'Longitude is required'
        })
    }).optional().messages({
        'object.base': 'Coordinates must be an object'
    }),
    locationName: Joi.string().trim().max(200).allow('').optional().messages({
        'string.max': 'Location name cannot exceed 200 characters'
    }),
    reminderDateTime: Joi.alternatives().try(Joi.date(), Joi.valid(null)).optional().messages({
        'alternatives.match': 'Reminder date and time must be a valid date or null'
    })
});

// Pagination validation schema for reminders
const reminderPaginationSchema = Joi.object({
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
    sortBy: Joi.string().valid('createdAt', 'description', 'locationName', 'reminderDateTime').default('createdAt').messages({
        'any.only': 'Sort by must be one of: createdAt, description, locationName, reminderDateTime'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'Sort order must be either asc or desc'
    })
});

// Location-based search schema
const locationSearchSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
        'number.base': 'Latitude must be a number',
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90',
        'any.required': 'Latitude is required'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
        'number.base': 'Longitude must be a number',
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180',
        'any.required': 'Longitude is required'
    }),
    maxDistance: Joi.number().min(1).max(50000).default(10000).messages({
        'number.base': 'Max distance must be a number',
        'number.min': 'Max distance must be at least 1 meter',
        'number.max': 'Max distance cannot exceed 50,000 meters'
    })
});

module.exports = {
    reminderSchema,
    reminderUpdateSchema,
    reminderPaginationSchema,
    locationSearchSchema
}; 