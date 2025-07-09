const Joi = require('joi');

// Combined task/reminder validation schema for third-party API
const combinedTaskReminderSchema = Joi.object({
    heading: Joi.string().trim().allow(null, '').optional().messages({
        'string.base': 'Heading must be a string'
    }),
    summary: Joi.string().trim().allow(null, '').optional().messages({
        'string.base': 'Summary must be a string'
    }),
    description: Joi.string().trim().allow(null, '').optional().messages({
        'string.base': 'Description must be a string'
    }),
    reminder: Joi.string().trim().allow(null, '').optional().messages({
        'string.base': 'Reminder must be a string'
    }),
    reminderLocation: Joi.object({
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
    }).allow(null).optional().messages({
        'object.base': 'Reminder location must be an object with latitude and longitude'
    }),
    reminderTime: Joi.alternatives().try(Joi.date(), Joi.valid(null)).optional().messages({
        'alternatives.match': 'Reminder time must be a valid date or null'
    }),
    conversation: Joi.string().trim().allow(null, '').optional().messages({
        'string.base': 'Conversation must be a string'
    }),
    customer: Joi.object({
        name: Joi.string().trim().allow(null, '').optional().messages({
            'string.base': 'Customer name must be a string'
        }),
        address: Joi.string().trim().allow(null, '').optional().messages({
            'string.base': 'Customer address must be a string'
        }),
        phoneNumber: Joi.string().trim().allow(null, '').optional().messages({
            'string.base': 'Customer phone number must be a string'
        })
    }).allow(null).optional().messages({
        'object.base': 'Customer must be an object'
    }),
    isResolved: Joi.boolean().default(false).messages({
        'boolean.base': 'isResolved must be a boolean'
    })
}).custom((value, helpers) => {
    // Determine if this is a reminder or task based on provided data
    const hasReminder = value.reminder && value.reminder.trim() !== '';
    const hasReminderLocation = value.reminderLocation && value.reminderLocation.latitude && value.reminderLocation.longitude;
    const hasReminderTime = value.reminderTime && (value.reminderTime instanceof Date || typeof value.reminderTime === 'string');
    
    const hasTaskData = (value.heading && value.heading.trim() !== '') || 
                       (value.summary && value.summary.trim() !== '') || 
                       (value.description && value.description.trim() !== '');
    
    const hasCustomerData = value.customer && 
                           value.customer.name && value.customer.name.trim() !== '' &&
                           value.customer.address && value.customer.address.trim() !== '' &&
                           value.customer.phoneNumber && value.customer.phoneNumber.trim() !== '';

    // If this is a reminder (has reminder text)
    if (hasReminder) {
        // For reminders, we need either location or time
        if (!hasReminderLocation && !hasReminderTime) {
            return helpers.error('any.invalid', { 
                message: 'For reminders, either reminderLocation or reminderTime must be provided' 
            });
        }
        
        // If reminderLocation is provided, it must be valid
        if (value.reminderLocation && (!value.reminderLocation.latitude || !value.reminderLocation.longitude)) {
            return helpers.error('any.invalid', { 
                message: 'Reminder location must have both latitude and longitude' 
            });
        }
    }
    
    // If this is a task (has task data)
    if (hasTaskData) {
        // For tasks, we need customer data
        if (!hasCustomerData) {
            return helpers.error('any.invalid', { 
                message: 'For tasks, customer information (name, address, phoneNumber) is required' 
            });
        }
        
        // For tasks, we need at least heading and description
        if (!value.heading || value.heading.trim() === '') {
            return helpers.error('any.invalid', { 
                message: 'For tasks, heading is required' 
            });
        }
        
        if (!value.description || value.description.trim() === '') {
            return helpers.error('any.invalid', { 
                message: 'For tasks, description is required' 
            });
        }
    }
    
    // Must be either a reminder or a task, not both
    if (hasReminder && hasTaskData) {
        return helpers.error('any.invalid', { 
            message: 'Cannot create both reminder and task in the same request. Please provide either reminder data or task data, not both.' 
        });
    }
    
    // Must provide at least one type of data
    if (!hasReminder && !hasTaskData) {
        return helpers.error('any.invalid', { 
            message: 'Must provide either reminder data (reminder + location/time) or task data (heading, description, customer)' 
        });
    }
    
    return value;
});

module.exports = {
    combinedTaskReminderSchema
}; 