const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Task = require('../models/Task');

/**
 * Migration script to add user field to existing customers
 * This script will backfill the user field for existing customers based on their associated tasks
 */
const migrateCustomerUserField = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');

        // Find all customers that don't have a user field
        const customersWithoutUser = await Customer.find({
            user: { $exists: false }
        }).setOptions({ includeDeleted: true });

        console.log(`Found ${customersWithoutUser.length} customers without user field`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const customer of customersWithoutUser) {
            // Find the first task that uses this customer
            const task = await Task.findOne({ 
                customer: customer._id 
            }).setOptions({ includeDeleted: true });

            if (task && task.user) {
                // Update customer with user field
                customer.user = task.user;
                await customer.save();
                updatedCount++;
                console.log(`Updated customer ${customer.name} with user ${task.user}`);
            } else {
                skippedCount++;
                console.log(`Skipped customer ${customer.name} - no associated task found`);
            }
        }

        console.log(`Migration completed:`);
        console.log(`- Updated: ${updatedCount} customers`);
        console.log(`- Skipped: ${skippedCount} customers (no associated tasks)`);

        // Verify the migration
        const totalCustomers = await Customer.countDocuments().setOptions({ includeDeleted: true });
        const customersWithUser = await Customer.countDocuments({ user: { $exists: true } }).setOptions({ includeDeleted: true });
        
        console.log(`Total customers: ${totalCustomers}`);
        console.log(`Customers with user field: ${customersWithUser}`);
        
        if (customersWithUser === totalCustomers) {
            console.log('✅ Migration completed successfully!');
        } else {
            console.log('⚠️  Migration incomplete - some customers still missing user field');
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
    migrateCustomerUserField();
}

module.exports = { migrateCustomerUserField }; 