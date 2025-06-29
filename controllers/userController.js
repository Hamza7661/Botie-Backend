const User = require('../models/User');
const { releasePhoneNumber } = require('../services/twilioService');

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            res.status(200).json({
                success: true,
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
                    updatedAt: user.updatedAt,
                }
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
    } catch (error) {
        console.error('Error in getUserById:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving user' 
        });
    }
};

// @desc    Soft delete user by ID
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if user is already soft deleted
        if (user.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'User has already been deleted' 
            });
        }

        // Release Twilio phone number if assigned
        if (user.twilioPhoneSid) {
            try {
                await releasePhoneNumber(user.twilioPhoneSid);
                console.log(`Released Twilio phone number ${user.twilioPhoneNumber} for user ${user._id}`);
            } catch (twilioError) {
                console.error('Failed to release Twilio phone number:', twilioError);
                // Continue with soft delete even if Twilio release fails
            }
        }

        // Perform soft delete
        await user.softDelete();

        res.status(200).json({ 
            success: true, 
            message: 'User account has been deactivated successfully',
            data: {
                userId: user._id,
                email: user.email,
                deletedAt: user.deletedAt,
                twilioPhoneReleased: !!user.twilioPhoneSid,
                message: 'Your account has been deleted'
            }
        });
    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while deleting user' 
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
const editUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot update a deactivated account' 
            });
        }

        // Note: For simplicity, we assume a user can only edit their own profile.
        // In a multi-tenant or admin scenario, you'd add another check here, e.g.:
        // if (req.user.id !== user._id.toString() && !req.user.isAdmin) {
        //     return res.status(401).json({ message: 'User not authorized' });
        // }

        // Update fields
        const updateFields = {};
        if (req.body.firstname !== undefined) updateFields.firstname = req.body.firstname;
        if (req.body.lastname !== undefined) updateFields.lastname = req.body.lastname;
        if (req.body.phoneNumber !== undefined) updateFields.phoneNumber = req.body.phoneNumber;
        if (req.body.address !== undefined) updateFields.address = req.body.address;
        if (req.body.profession !== undefined) updateFields.profession = req.body.profession;
        if (req.body.professionDescription !== undefined) updateFields.professionDescription = req.body.professionDescription;

        // Apply updates
        Object.assign(user, updateFields);
        const updatedUser = await user.save();

        res.status(200).json({
            success: true,
            message: 'User profile updated successfully',
            data: {
                _id: updatedUser._id,
                firstname: updatedUser.firstname,
                lastname: updatedUser.lastname,
                email: updatedUser.email,
                phoneNumber: updatedUser.phoneNumber,
                address: updatedUser.address,
                profession: updatedUser.profession,
                professionDescription: updatedUser.professionDescription,
                twilioPhoneNumber: updatedUser.twilioPhoneNumber,
                twilioPhoneFriendlyName: updatedUser.twilioPhoneFriendlyName,
                twilioPhoneStatus: updatedUser.twilioPhoneStatus,
                updatedAt: updatedUser.updatedAt,
            }
        });
    } catch (error) {
        console.error('Error in editUser:', error);
        
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
            message: 'Server error while updating user' 
        });
    }
};

// @desc    Get user profile (current user)
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if user is soft deleted
        if (user.isSoftDeleted()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account has been deactivated' 
            });
        }

        res.status(200).json({
            success: true,
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
                updatedAt: user.updatedAt,
            }
        });
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while retrieving profile' 
        });
    }
};

// @desc    Get all customers for a user
// @route   GET /api/users/:id/customers
// @access  Private
const getCustomersByUserId = async (req, res) => {
    try {
        const userId = req.params.id;
        const Customer = require('../models/Customer');

        // Find all customers for the user (excluding soft-deleted)
        const customers = await Customer.find({ 
            user: userId, 
            isDeleted: { $ne: true } 
        });

        res.status(200).json({
            success: true,
            data: customers
        });
    } catch (error) {
        console.error('Error in getCustomersByUserId:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving customers for user'
        });
    }
};

module.exports = {
    getUserById,
    deleteUser,
    editUser,
    getUserProfile,
    getCustomersByUserId,
}; 