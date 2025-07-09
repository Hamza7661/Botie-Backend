const { generateApiKey } = require('../middleware/apiKeyMiddleware');
const User = require('../models/User');
const Task = require('../models/Task');
const Customer = require('../models/Customer');
const Reminder = require('../models/Reminder');
const { taskSchema } = require('../validators/taskValidator');
const { combinedTaskReminderSchema } = require('../validators/apiValidator');
const { emitTaskCreated, emitReminderCreated } = require('../services/websocketService');
const { sendThirdPartyTaskNotification } = require('../services/emailService');

// @desc    Generate API key for third-party apps
// @route   POST /api/generate-api-key
// @access  Private (admin only)
const generateApiKeyForApp = async (req, res) => {
    try {
        // This endpoint should be protected and only accessible by admins
        // You can add additional admin checks here
        
        const apiKeyData = generateApiKey();
        
        res.status(200).json({
            success: true,
            message: 'API key generated successfully',
            data: {
                apiKey: apiKeyData.apiKey,
                timestamp: apiKeyData.timestamp,
                signature: apiKeyData.signature,
                instructions: {
                    headers: {
                        'x-api-key': apiKeyData.apiKey,
                        'x-timestamp': apiKeyData.timestamp,
                        'x-signature': apiKeyData.signature
                    },
                    note: 'Include these headers in all API requests. Generate new signature for each request using the shared secret.'
                }
            }
        });
    } catch (error) {
        console.error('Error generating API key:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate API key'
        });
    }
};

// @desc    Test API key authentication
// @route   GET /api/test-api-key
// @access  API Key protected
const testApiKeyAuth = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'API key authentication successful',
            data: {
                apiClient: req.apiClient,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in test API key:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get user by Twilio call SID
// @route   GET /api/getuserbyassignedSID
// @access  API Key protected
const getUserByAssignedSID = async (req, res) => {
    try {
        const callSid = req.headers['call-sid'];

        if (!callSid) {
            return res.status(400).json({
                success: false,
                message: 'Call SID is required in headers'
            });
        }

        // Find user by Twilio phone SID
        const user = await User.findOne({
            twilioPhoneSid: callSid,
            isDeleted: { $ne: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found for the provided call SID'
            });
        }

        // Return user information (excluding sensitive data)
        res.status(200).json({
            success: true,
            message: 'User found successfully',
            data: {
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phoneNumber: user.phoneNumber,
                address: user.address,
                profession: user.profession,
                professionDescription: user.professionDescription,
                twilioPhoneNumber: user.twilioPhoneNumber,
                twilioPhoneFriendlyName: user.twilioPhoneFriendlyName,
                twilioPhoneStatus: user.twilioPhoneStatus,
                isEmailVerified: user.isEmailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error in getUserByAssignedSID:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving user information'
        });
    }
};

// @desc    Get user by Twilio assigned phone number
// @route   GET /api/getuserbyassignednumber
// @access  API Key protected
const getUserByAssignedNumber = async (req, res) => {
    try {
        const assignedNumber = req.headers['assigned-number'];

        if (!assignedNumber) {
            return res.status(400).json({
                success: false,
                message: 'Assigned number is required in headers'
            });
        }

        // Find user by Twilio phone number
        const user = await User.findOne({
            twilioPhoneNumber: assignedNumber,
            isDeleted: { $ne: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found for the provided assigned number'
            });
        }

        // Return user information (excluding sensitive data)
        res.status(200).json({
            success: true,
            message: 'User found successfully',
            data: {
                _id: user._id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phoneNumber: user.phoneNumber,
                address: user.address,
                profession: user.profession,
                professionDescription: user.professionDescription,
                twilioPhoneNumber: user.twilioPhoneNumber,
                twilioPhoneFriendlyName: user.twilioPhoneFriendlyName,
                twilioPhoneStatus: user.twilioPhoneStatus,
                isEmailVerified: user.isEmailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Error in getUserByAssignedNumber:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving user information'
        });
    }
};

// @desc    Create task or reminder for user by Twilio assigned phone number
// @route   POST /api/create-task-for-user
// @access  API Key protected
const createTaskForUser = async (req, res) => {
    try {
        const assignedNumber = req.headers['assigned-number'];

        if (!assignedNumber) {
            return res.status(400).json({
                success: false,
                message: 'Assigned number is required in headers'
            });
        }

        // Find user by Twilio phone number
        const user = await User.findOne({
            twilioPhoneNumber: assignedNumber,
            isDeleted: { $ne: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found for the provided assigned number'
            });
        }

        // Validate request body using the combined schema
        const { error, value } = combinedTaskReminderSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        const { 
            heading, 
            summary, 
            description, 
            reminder, 
            reminderLocation, 
            reminderTime, 
            conversation, 
            customer: customerData, 
            isResolved 
        } = value;

        // Check if customer exists (by phone number)
        let customer = await Customer.findOne({ 
            phoneNumber: customerData.phoneNumber,
            user: user._id // Ensure customer belongs to this user
        });

        if (!customer) {
            // Create new customer
            customer = new Customer({
                ...customerData,
                user: user._id
            });
            await customer.save();
        }

        // Determine if this should be a reminder or task based on provided data
        const hasReminder = reminder && reminder.trim() !== '';
        const hasReminderLocation = reminderLocation && reminderLocation.latitude && reminderLocation.longitude;
        const hasReminderTime = reminderTime && reminderTime instanceof Date;
        
        const hasTaskData = (heading && heading.trim() !== '') || 
                           (summary && summary.trim() !== '') || 
                           (description && description.trim() !== '');
        
        const hasCustomerData = customerData && 
                               customerData.name && customerData.name.trim() !== '' &&
                               customerData.address && customerData.address.trim() !== '' &&
                               customerData.phoneNumber && customerData.phoneNumber.trim() !== '';

        let result;
        let resultType;

        if (hasReminder && (hasReminderLocation || hasReminderTime)) {
            // Create a reminder
            const reminderData = {
                description: reminder,
                user: user._id
            };

            // Add coordinates if provided
            if (hasReminderLocation) {
                reminderData.coordinates = reminderLocation;
                reminderData.locationName = null; // Will be set to null as per existing logic
            }

            // Add reminder time if provided
            if (hasReminderTime) {
                reminderData.reminderDateTime = reminderTime;
            }

            const reminderObj = new Reminder(reminderData);
            await reminderObj.save();

            // Emit real-time update
            emitReminderCreated(user._id, reminderObj);

            result = reminderObj;
            resultType = 'reminder';
        } else if (hasTaskData && hasCustomerData) {
            // Create a task
            const task = new Task({
                heading: heading || '',
                summary: summary || '',
                description: description || '',
                conversation: conversation || null,
                isResolved: isResolved || false,
                customer: customer._id,
                user: user._id
            });

            await task.save();

            // Populate customer details for response
            await task.populate('customer', 'name address phoneNumber');

            // Emit real-time update
            emitTaskCreated(user._id, task);

            // Send email notification for tasks
            await sendThirdPartyTaskNotification(user, task, customer);

            result = task;
            resultType = 'task';
        } else {
            // This should not happen due to validation, but handle gracefully
            return res.status(400).json({
                success: false,
                message: 'Invalid request: Must provide either reminder data or task data with customer information'
            });
        }

        res.status(201).json({
            success: true,
            message: `${resultType === 'reminder' ? 'Reminder' : 'Task'} created successfully`,
            data: {
                [resultType]: result,
                user: {
                    _id: user._id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    profession: user.profession
                },
                type: resultType
            }
        });
    } catch (error) {
        console.error('Error in createTaskForUser:', error);
        
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
            message: 'Server error while creating task/reminder' 
        });
    }
};

module.exports = {
    generateApiKeyForApp,
    testApiKeyAuth,
    getUserByAssignedSID,
    getUserByAssignedNumber,
    createTaskForUser
}; 