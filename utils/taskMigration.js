const mongoose = require('mongoose');
const Task = require('../models/Task');
const Customer = require('../models/Customer');

/**
 * Migration script to set up task and customer collections
 * Run this script once after deploying the task management feature
 */
const setupTaskCollections = async () => {
    try {
        console.log('Starting task management migration...');
        
        // Create indexes for Customer collection
        console.log('Creating Customer indexes...');
        await Customer.collection.createIndex({ isDeleted: 1 });
        await Customer.collection.createIndex({ deletedAt: 1 });
        await Customer.collection.createIndex({ isDeleted: 1, phoneNumber: 1 });
        console.log('Customer indexes created successfully');

        // Create indexes for Task collection
        console.log('Creating Task indexes...');
        await Task.collection.createIndex({ isDeleted: 1 });
        await Task.collection.createIndex({ deletedAt: 1 });
        await Task.collection.createIndex({ isDeleted: 1, user: 1 });
        await Task.collection.createIndex({ isDeleted: 1, customer: 1 });
        await Task.collection.createIndex({ user: 1 });
        await Task.collection.createIndex({ customer: 1 });
        console.log('Task indexes created successfully');

        console.log('Task management migration completed successfully');
        
    } catch (error) {
        console.error('Task migration failed:', error);
        throw error;
    }
};

/**
 * Utility function to check task management system health
 */
const checkTaskSystemHealth = async () => {
    try {
        const totalCustomers = await Customer.countDocuments();
        const activeCustomers = await Customer.countDocuments({ isDeleted: { $ne: true } });
        const deletedCustomers = await Customer.countDocuments({ isDeleted: true });

        const totalTasks = await Task.countDocuments();
        const activeTasks = await Task.countDocuments({ isDeleted: { $ne: true } });
        const deletedTasks = await Task.countDocuments({ isDeleted: true });

        console.log('Task Management System Health Check:');
        console.log(`Total customers: ${totalCustomers}`);
        console.log(`Active customers: ${activeCustomers}`);
        console.log(`Soft deleted customers: ${deletedCustomers}`);
        console.log(`Total tasks: ${totalTasks}`);
        console.log(`Active tasks: ${activeTasks}`);
        console.log(`Soft deleted tasks: ${deletedTasks}`);
        
        return { 
            customers: { total: totalCustomers, active: activeCustomers, deleted: deletedCustomers },
            tasks: { total: totalTasks, active: activeTasks, deleted: deletedTasks }
        };
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

// Export functions for use in other scripts
module.exports = {
    setupTaskCollections,
    checkTaskSystemHealth
};

// If this script is run directly
if (require.main === module) {
    // You would need to set up your database connection here
    // mongoose.connect(process.env.MONGO_URI)
    //     .then(() => setupTaskCollections())
    //     .then(() => checkTaskSystemHealth())
    //     .then(() => {
    //         console.log('Task management migration completed successfully');
    //         process.exit(0);
    //     })
    //     .catch((error) => {
    //         console.error('Task management migration failed:', error);
    //         process.exit(1);
    //     });
    
    console.log('Task management migration script loaded. Import and run setupTaskCollections() to execute.');
} 