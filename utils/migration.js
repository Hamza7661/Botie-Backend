const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Migration script to add soft delete fields to existing users
 * Run this script once after deploying the soft delete feature
 */
const migrateSoftDeleteFields = async () => {
    try {
        console.log('Starting soft delete migration...');
        
        // Connect to database (you'll need to set up your connection)
        // This assumes you have a connection setup in your app
        // await mongoose.connect(process.env.MONGODB_URI);
        
        // Find all users that don't have soft delete fields
        const usersToUpdate = await User.find({
            $or: [
                { isDeleted: { $exists: false } },
                { deletedAt: { $exists: false } }
            ]
        });

        console.log(`Found ${usersToUpdate.length} users to update`);

        if (usersToUpdate.length === 0) {
            console.log('No users need migration. All users already have soft delete fields.');
            return;
        }

        // Update each user with soft delete fields
        const updatePromises = usersToUpdate.map(user => {
            return User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        isDeleted: false,
                        deletedAt: null
                    }
                }
            );
        });

        await Promise.all(updatePromises);
        
        console.log(`Successfully migrated ${usersToUpdate.length} users`);
        
        // Verify migration
        const usersWithoutFields = await User.find({
            $or: [
                { isDeleted: { $exists: false } },
                { deletedAt: { $exists: false } }
            ]
        });

        if (usersWithoutFields.length === 0) {
            console.log('Migration verification successful. All users now have soft delete fields.');
        } else {
            console.log(`Warning: ${usersWithoutFields.length} users still missing soft delete fields`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
};

/**
 * Utility function to check database health after migration
 */
const checkDatabaseHealth = async () => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isDeleted: { $ne: true } });
        const deletedUsers = await User.countDocuments({ isDeleted: true });

        console.log('Database Health Check:');
        console.log(`Total users: ${totalUsers}`);
        console.log(`Active users: ${activeUsers}`);
        console.log(`Soft deleted users: ${deletedUsers}`);
        
        return { totalUsers, activeUsers, deletedUsers };
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

// Export functions for use in other scripts
module.exports = {
    migrateSoftDeleteFields,
    checkDatabaseHealth
};

// If this script is run directly
if (require.main === module) {
    // You would need to set up your database connection here
    // mongoose.connect(process.env.MONGODB_URI)
    //     .then(() => migrateSoftDeleteFields())
    //     .then(() => checkDatabaseHealth())
    //     .then(() => {
    //         console.log('Migration completed successfully');
    //         process.exit(0);
    //     })
    //     .catch((error) => {
    //         console.error('Migration failed:', error);
    //         process.exit(1);
    //     });
    
    console.log('Migration script loaded. Import and run migrateSoftDeleteFields() to execute.');
} 