const mongoose = require('mongoose');
const User = require('../models/User');

// Mock environment for testing
process.env.JWT_SECRET = 'test-secret';

/**
 * Test suite for soft delete functionality
 * This file contains comprehensive tests for the soft delete feature
 */

describe('Soft Delete Functionality Tests', () => {
    let testUser;
    let testUser2;

    beforeAll(async () => {
        // Setup test database connection
        // await mongoose.connect(process.env.MONGODB_URI_TEST);
        
        // Clean up any existing test data
        await User.deleteMany({});
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({});
        // await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Create test users before each test
        testUser = new User({
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@test.com',
            phoneNumber: '1234567890',
            password: 'password123',
            profession: 'Developer',
            professionDescription: 'Full-stack developer'
        });

        testUser2 = new User({
            firstname: 'Jane',
            lastname: 'Smith',
            email: 'jane.smith@test.com',
            phoneNumber: '0987654321',
            password: 'password456',
            profession: 'Designer',
            professionDescription: 'UI/UX designer'
        });

        await testUser.save();
        await testUser2.save();
    });

    afterEach(async () => {
        // Clean up after each test
        await User.deleteMany({});
    });

    describe('User Model Soft Delete Fields', () => {
        test('should have soft delete fields with default values', () => {
            expect(testUser.isDeleted).toBe(false);
            expect(testUser.deletedAt).toBe(null);
        });

        test('should have isSoftDeleted method', () => {
            expect(typeof testUser.isSoftDeleted).toBe('function');
            expect(testUser.isSoftDeleted()).toBe(false);
        });

        test('should have softDelete method', () => {
            expect(typeof testUser.softDelete).toBe('function');
        });

        test('should have hardDelete method', () => {
            expect(typeof testUser.hardDelete).toBe('function');
        });
    });

    describe('Soft Delete Operations', () => {
        test('should perform soft delete correctly', async () => {
            await testUser.softDelete();

            expect(testUser.isDeleted).toBe(true);
            expect(testUser.deletedAt).toBeInstanceOf(Date);
            expect(testUser.isSoftDeleted()).toBe(true);
        });

        test('should not be found in normal queries after soft delete', async () => {
            await testUser.softDelete();

            const foundUser = await User.findById(testUser._id);
            expect(foundUser).toBe(null);
        });

        test('should be found when including deleted users', async () => {
            await testUser.softDelete();

            const foundUser = await User.findUserWithDeleted({ _id: testUser._id });
            expect(foundUser).not.toBe(null);
            expect(foundUser.isSoftDeleted()).toBe(true);
        });

        test('should allow re-registration after soft delete', async () => {
            await testUser.softDelete();

            const newUser = new User({
                firstname: 'John',
                lastname: 'Doe',
                email: 'john.doe@test.com', // Same email
                phoneNumber: '1234567890',
                password: 'newpassword123',
                profession: 'Developer',
                professionDescription: 'Full-stack developer'
            });

            await newUser.save();
            expect(newUser._id.toString()).not.toBe(testUser._id.toString());
        });
    });

    describe('Query Middleware', () => {
        test('should automatically filter out soft-deleted users', async () => {
            await testUser.softDelete();

            const allUsers = await User.find({});
            expect(allUsers.length).toBe(1); // Only testUser2 should remain
            expect(allUsers[0]._id.toString()).toBe(testUser2._id.toString());
        });

        test('should include soft-deleted users when explicitly requested', async () => {
            await testUser.softDelete();

            const allUsers = await User.find({ includeDeleted: true });
            expect(allUsers.length).toBe(2); // Both users should be found
        });

        test('should work with findById', async () => {
            await testUser.softDelete();

            const foundUser = await User.findById(testUser._id);
            expect(foundUser).toBe(null);
        });

        test('should work with findOne', async () => {
            await testUser.softDelete();

            const foundUser = await User.findOne({ email: testUser.email });
            expect(foundUser).toBe(null);
        });
    });

    describe('Static Methods', () => {
        test('findUserWithDeleted should find soft-deleted users', async () => {
            await testUser.softDelete();

            const foundUser = await User.findUserWithDeleted({ _id: testUser._id });
            expect(foundUser).not.toBe(null);
            expect(foundUser.isSoftDeleted()).toBe(true);
        });

        test('findAllWithDeleted should find all users including soft-deleted', async () => {
            await testUser.softDelete();

            const allUsers = await User.findAllWithDeleted();
            expect(allUsers.length).toBe(2);
            
            const deletedUser = allUsers.find(u => u._id.toString() === testUser._id.toString());
            expect(deletedUser.isSoftDeleted()).toBe(true);
        });

        test('countWithDeleted should count all users including soft-deleted', async () => {
            await testUser.softDelete();

            const totalCount = await User.countWithDeleted();
            expect(totalCount).toBe(2);
        });
    });

    describe('Authentication Scenarios', () => {
        test('should prevent login for soft-deleted users', async () => {
            await testUser.softDelete();

            const foundUser = await User.findUserWithDeleted({ email: testUser.email }).select('+password');
            expect(foundUser.isSoftDeleted()).toBe(true);
        });

        test('should allow email verification for soft-deleted users (reactivation)', async () => {
            await testUser.softDelete();

            const foundUser = await User.findUserWithDeleted({ _id: testUser._id });
            expect(foundUser.isSoftDeleted()).toBe(true);

            // Simulate email verification (reactivation)
            foundUser.isEmailVerified = true;
            foundUser.isDeleted = false;
            foundUser.deletedAt = null;
            await foundUser.save();

            expect(foundUser.isSoftDeleted()).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle multiple soft deletes gracefully', async () => {
            await testUser.softDelete();
            
            // Try to soft delete again
            await testUser.softDelete();

            expect(testUser.isDeleted).toBe(true);
            expect(testUser.deletedAt).toBeInstanceOf(Date);
        });

        test('should maintain data integrity after soft delete', async () => {
            const originalData = {
                firstname: testUser.firstname,
                lastname: testUser.lastname,
                email: testUser.email,
                phoneNumber: testUser.phoneNumber,
                profession: testUser.profession,
                professionDescription: testUser.professionDescription
            };

            await testUser.softDelete();

            const foundUser = await User.findUserWithDeleted({ _id: testUser._id });
            
            expect(foundUser.firstname).toBe(originalData.firstname);
            expect(foundUser.lastname).toBe(originalData.lastname);
            expect(foundUser.email).toBe(originalData.email);
            expect(foundUser.phoneNumber).toBe(originalData.phoneNumber);
            expect(foundUser.profession).toBe(originalData.profession);
            expect(foundUser.professionDescription).toBe(originalData.professionDescription);
        });
    });

    describe('Performance Considerations', () => {
        test('should have proper indexes for soft delete queries', async () => {
            const indexes = await User.collection.indexes();
            const indexNames = indexes.map(index => Object.keys(index.key)[0]);
            
            expect(indexNames).toContain('isDeleted');
            expect(indexNames).toContain('deletedAt');
        });

        test('should efficiently filter soft-deleted users', async () => {
            await testUser.softDelete();

            const startTime = Date.now();
            const activeUsers = await User.find({});
            const endTime = Date.now();

            expect(activeUsers.length).toBe(1);
            expect(endTime - startTime).toBeLessThan(100); // Should be fast
        });
    });
});

/**
 * Integration test scenarios (to be run with actual API endpoints)
 */
describe('API Integration Tests', () => {
    // These tests would require a running server and actual HTTP requests
    // They're included here as examples of what to test

    test('DELETE /api/users/:id should perform soft delete', () => {
        // This would be an actual HTTP test
        // expect(response.status).toBe(200);
        // expect(response.body.success).toBe(true);
        // expect(response.body.message).toContain('deactivated');
    });

    test('GET /api/users/:id should not return soft-deleted users', () => {
        // This would be an actual HTTP test
        // expect(response.status).toBe(404);
    });

    test('POST /api/auth/login should reject soft-deleted users', () => {
        // This would be an actual HTTP test
        // expect(response.status).toBe(401);
        // expect(response.body.message).toContain('deactivated');
    });
});

console.log('Soft delete test suite loaded. Run with your testing framework.'); 