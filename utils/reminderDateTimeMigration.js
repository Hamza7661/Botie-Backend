const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');

/**
 * Migration script to add reminderDateTime field to existing reminders
 * This script will set reminderDateTime to createdAt for existing reminders
 */
async function migrateReminderDateTime() {
    try {
        console.log('Starting reminderDateTime migration...');
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/botie';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find all reminders that don't have reminderDateTime field
        const remindersWithoutDateTime = await Reminder.find({
            reminderDateTime: { $exists: false }
        });

        console.log(`Found ${remindersWithoutDateTime.length} reminders without reminderDateTime field`);

        if (remindersWithoutDateTime.length === 0) {
            console.log('No reminders need migration. All reminders already have reminderDateTime field.');
            return;
        }

        // Update each reminder to set reminderDateTime to createdAt
        let updatedCount = 0;
        for (const reminder of remindersWithoutDateTime) {
            try {
                await Reminder.updateOne(
                    { _id: reminder._id },
                    { 
                        $set: { 
                            reminderDateTime: reminder.createdAt 
                        } 
                    }
                );
                updatedCount++;
                console.log(`Updated reminder ${reminder._id} with reminderDateTime: ${reminder.createdAt}`);
            } catch (error) {
                console.error(`Error updating reminder ${reminder._id}:`, error.message);
            }
        }

        console.log(`Migration completed. Updated ${updatedCount} out of ${remindersWithoutDateTime.length} reminders.`);

        // Verify migration
        const remainingRemindersWithoutDateTime = await Reminder.find({
            reminderDateTime: { $exists: false }
        });

        if (remainingRemindersWithoutDateTime.length === 0) {
            console.log('✅ Migration verification successful: All reminders now have reminderDateTime field.');
        } else {
            console.log(`⚠️  Migration verification failed: ${remainingRemindersWithoutDateTime.length} reminders still missing reminderDateTime field.`);
        }

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    migrateReminderDateTime()
        .then(() => {
            console.log('Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateReminderDateTime }; 