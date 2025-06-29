const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Task = require('../models/Task');
const Customer = require('../models/Customer');

describe('Task Update with Customer Data', () => {
    let testUser, testTask, testCustomer, authToken;

    beforeAll(async () => {
        // Create test user
        testUser = new User({
            firstname: 'Test',
            lastname: 'User',
            email: 'test@example.com',
            phoneNumber: '1234567890',
            password: 'password123',
            isEmailVerified: true
        });
        await testUser.save();

        // Create test customer
        testCustomer = new Customer({
            name: 'Original Customer',
            address: 'Original Address',
            phoneNumber: '+1234567890'
        });
        await testCustomer.save();

        // Create test task
        testTask = new Task({
            heading: 'Original Task',
            summary: 'Original Summary',
            description: 'Original Description',
            customer: testCustomer._id,
            user: testUser._id
        });
        await testTask.save();

        // Get auth token
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
        
        authToken = loginResponse.body.token;
    });

    afterAll(async () => {
        await User.deleteMany({});
        await Task.deleteMany({});
        await Customer.deleteMany({});
        await mongoose.connection.close();
    });

    test('should update task and customer data when customer data is provided', async () => {
        const updateData = {
            heading: 'Updated Task Heading',
            summary: 'Updated Summary',
            description: 'Updated Description',
            customer: {
                name: 'Updated Customer Name',
                address: 'Updated Address, Miami Florida',
                phoneNumber: '+212313213'
            }
        };

        const response = await request(app)
            .put(`/api/tasks/${testTask._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.heading).toBe('Updated Task Heading');
        expect(response.body.data.customer.name).toBe('Updated Customer Name');
        expect(response.body.data.customer.address).toBe('Updated Address, Miami Florida');
        expect(response.body.data.customer.phoneNumber).toBe('+212313213');

        // Verify customer was actually updated in database
        const updatedCustomer = await Customer.findById(testCustomer._id);
        expect(updatedCustomer.name).toBe('Updated Customer Name');
        expect(updatedCustomer.address).toBe('Updated Address, Miami Florida');
        expect(updatedCustomer.phoneNumber).toBe('+212313213');
    });

    test('should update only task data when no customer data is provided', async () => {
        const updateData = {
            heading: 'Only Task Updated',
            summary: 'Only Summary Updated'
        };

        const response = await request(app)
            .put(`/api/tasks/${testTask._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.heading).toBe('Only Task Updated');
        expect(response.body.data.summary).toBe('Only Summary Updated');
        expect(response.body.data.customer.name).toBe('Updated Customer Name'); // Should remain unchanged
    });

    test('should create new customer if customer with phone number does not exist', async () => {
        const updateData = {
            customer: {
                name: 'New Customer',
                address: 'New Address',
                phoneNumber: '+9999999999'
            }
        };

        const response = await request(app)
            .put(`/api/tasks/${testTask._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.customer.name).toBe('New Customer');
        expect(response.body.data.customer.phoneNumber).toBe('+9999999999');

        // Verify new customer was created
        const newCustomer = await Customer.findOne({ phoneNumber: '+9999999999' });
        expect(newCustomer).toBeTruthy();
        expect(newCustomer.name).toBe('New Customer');
    });
}); 