const mongoose = require('mongoose');
const Task = require('../models/Task');
const Customer = require('../models/Customer');
const User = require('../models/User');
require('dotenv').config();

const migrateIsResolvedField = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Find all tasks that don't have isResolved field
        const tasksWithoutIsResolved = await Task.find({
            isResolved: { $exists: false }
        }).setOptions({ includeDeleted: true });

        console.log(`Found ${tasksWithoutIsResolved.length} tasks without isResolved field`);

        if (tasksWithoutIsResolved.length > 0) {
            // Update all tasks to add isResolved field with default value false
            const result = await Task.updateMany(
                { isResolved: { $exists: false } },
                { $set: { isResolved: false } }
            ).setOptions({ includeDeleted: true });

            console.log(`Successfully updated ${result.modifiedCount} tasks with isResolved field`);
        } else {
            console.log('All tasks already have isResolved field');
        }

        // Verify the migration
        const totalTasks = await Task.countDocuments().setOptions({ includeDeleted: true });
        const tasksWithIsResolved = await Task.countDocuments({ isResolved: { $exists: true } }).setOptions({ includeDeleted: true });
        
        console.log(`Total tasks: ${totalTasks}`);
        console.log(`Tasks with isResolved field: ${tasksWithIsResolved}`);
        
        if (totalTasks === tasksWithIsResolved) {
            console.log('✅ Migration completed successfully!');
        } else {
            console.log('❌ Migration incomplete - some tasks still missing isResolved field');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    migrateIsResolvedField();
}

module.exports = { migrateIsResolvedField }; 