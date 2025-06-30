/**
 * WebSocket Service for real-time notifications
 */

// Emit task created event to specific user
const emitTaskCreated = (userId, taskData) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('task-created', {
                type: 'task-created',
                data: taskData,
                timestamp: new Date().toISOString()
            });
            console.log(`Task created notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting task created event:', error);
    }
};

// Emit task updated event to specific user
const emitTaskUpdated = (userId, taskData) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('task-updated', {
                type: 'task-updated',
                data: taskData,
                timestamp: new Date().toISOString()
            });
            console.log(`Task updated notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting task updated event:', error);
    }
};

// Emit task deleted event to specific user
const emitTaskDeleted = (userId, taskId) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('task-deleted', {
                type: 'task-deleted',
                data: { taskId },
                timestamp: new Date().toISOString()
            });
            console.log(`Task deleted notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting task deleted event:', error);
    }
};

// Emit customer created event to specific user
const emitCustomerCreated = (userId, customerData) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('customer-created', {
                type: 'customer-created',
                data: customerData,
                timestamp: new Date().toISOString()
            });
            console.log(`Customer created notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting customer created event:', error);
    }
};

// Emit customer updated event to specific user
const emitCustomerUpdated = (userId, customerData) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('customer-updated', {
                type: 'customer-updated',
                data: customerData,
                timestamp: new Date().toISOString()
            });
            console.log(`Customer updated notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting customer updated event:', error);
    }
};

// Emit customer deleted event to specific user
const emitCustomerDeleted = (userId, customerId) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('customer-deleted', {
                type: 'customer-deleted',
                data: { customerId },
                timestamp: new Date().toISOString()
            });
            console.log(`Customer deleted notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting customer deleted event:', error);
    }
};

// Emit general notification to specific user
const emitNotification = (userId, notification) => {
    try {
        if (global.io) {
            global.io.to(`user-${userId}`).emit('notification', {
                type: 'notification',
                data: notification,
                timestamp: new Date().toISOString()
            });
            console.log(`Notification sent to user ${userId}`);
        }
    } catch (error) {
        console.error('Error emitting notification:', error);
    }
};

// Broadcast to all connected clients (admin notifications)
const broadcastToAll = (event, data) => {
    try {
        if (global.io) {
            global.io.emit(event, {
                type: event,
                data: data,
                timestamp: new Date().toISOString()
            });
            console.log(`Broadcast event ${event} sent to all clients`);
        }
    } catch (error) {
        console.error('Error broadcasting event:', error);
    }
};

module.exports = {
    emitTaskCreated,
    emitTaskUpdated,
    emitTaskDeleted,
    emitCustomerCreated,
    emitCustomerUpdated,
    emitCustomerDeleted,
    emitNotification,
    broadcastToAll
}; 