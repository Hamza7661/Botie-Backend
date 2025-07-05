const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index'); // Assuming your main app file exports the app
const { TaskType } = require('../models/Task');
const Task = require('../models/Task');
const User = require('../models/User');
const Customer = require('../models/Customer');

// Mock data
let testUser;
let testCustomer;
let testTasks = [];

// Mock MongoDB connection for testing
beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Create test user
    testUser = new User({
        firstname: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        password: 'password123',
        isEmailVerified: true
    });
    await testUser.save();

    // Create test customer
    testCustomer = new Customer({
        name: 'Test Customer',
        address: '123 Test St, Test City',
        phoneNumber: '+1234567891',
        user: testUser._id
    });
    await testCustomer.save();

    // Create test tasks
    const taskData = [
        {
            heading: 'Appointment Task 1',
            summary: 'First appointment task',
            description: 'Description for appointment task 1',
            type: TaskType.APPOINTMENT,
            customer: testCustomer._id,
            user: testUser._id
        },
        {
            heading: 'Appointment Task 2',
            summary: 'Second appointment task',
            description: 'Description for appointment task 2',
            type: TaskType.APPOINTMENT,
            customer: testCustomer._id,
            user: testUser._id
        },
        {
            heading: 'Reminder Task 1',
            summary: 'First reminder task',
            description: 'Description for reminder task 1',
            type: TaskType.REMINDER,
            customer: testCustomer._id,
            user: testUser._id
        },
        {
            heading: 'Reminder Task 2',
            summary: 'Second reminder task',
            description: 'Description for reminder task 2',
            type: TaskType.REMINDER,
            customer: testCustomer._id,
            user: testUser._id
        }
    ];

    testTasks = await Task.insertMany(taskData);
});

afterAll(async () => {
    await Task.deleteMany({});
    await Customer.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
});

describe('Task Type Filtering Tests', () => {
    test('should filter tasks by appointment type', async () => {
        const response = await request(app)
            .get('/api/tasks?type=1')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(2);
        expect(response.body.data.tasks.every(task => task.type === TaskType.APPOINTMENT)).toBe(true);
    });

    test('should filter tasks by reminder type', async () => {
        const response = await request(app)
            .get('/api/tasks?type=2')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(2);
        expect(response.body.data.tasks.every(task => task.type === TaskType.REMINDER)).toBe(true);
    });

    test('should return all tasks when no type filter is provided', async () => {
        const response = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(4);
    });

    test('should combine type filter with search', async () => {
        const response = await request(app)
            .get('/api/tasks?type=1&search=appointment')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(2);
        expect(response.body.data.tasks.every(task => 
            task.type === TaskType.APPOINTMENT && 
            (task.heading.toLowerCase().includes('appointment') || 
             task.summary.toLowerCase().includes('appointment') ||
             task.description.toLowerCase().includes('appointment'))
        )).toBe(true);
    });

    test('should sort by type when requested', async () => {
        const response = await request(app)
            .get('/api/tasks?sortBy=type&sortOrder=asc')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tasks).toHaveLength(4);
        
        // Check if tasks are sorted by type (appointments first, then reminders)
        const types = response.body.data.tasks.map(task => task.type);
        expect(types).toEqual([1, 1, 2, 2]);
    });

    test('should return 400 for invalid type filter', async () => {
        const response = await request(app)
            .get('/api/tasks?type=999')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Type filter must be either 1 (Appointment) or 2 (Reminder)');
    });
});

describe('Task Types Endpoint Tests', () => {
    test('should return all available task types', async () => {
        const response = await request(app)
            .get('/api/tasks/types')
            .set('Authorization', `Bearer ${testUser.generateAuthToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data).toContainEqual({ number: 1, name: 'Appointment' });
        expect(response.body.data).toContainEqual({ number: 2, name: 'Reminder' });
    });
}); 