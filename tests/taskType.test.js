const mongoose = require('mongoose');
const { TaskType } = require('../models/Task');
const { getTaskTypeName, getAllTaskTypes, isValidTaskType } = require('../utils/taskTypeUtils');

// Mock MongoDB connection for testing
beforeAll(async () => {
    // Mock mongoose connection
    await mongoose.connect('mongodb://localhost:27017/test', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe('Task Type Enum Tests', () => {
    test('TaskType enum should have correct values', () => {
        expect(TaskType.APPOINTMENT).toBe(1);
        expect(TaskType.REMINDER).toBe(2);
    });

    test('getTaskTypeName should return correct names', () => {
        expect(getTaskTypeName(TaskType.APPOINTMENT)).toBe('Appointment');
        expect(getTaskTypeName(TaskType.REMINDER)).toBe('Reminder');
        expect(getTaskTypeName(999)).toBe('Unknown');
    });

    test('getAllTaskTypes should return all types', () => {
        const types = getAllTaskTypes();
        expect(types).toHaveLength(2);
        expect(types).toContainEqual({ number: 1, name: 'Appointment' });
        expect(types).toContainEqual({ number: 2, name: 'Reminder' });
    });

    test('isValidTaskType should validate correctly', () => {
        expect(isValidTaskType(TaskType.APPOINTMENT)).toBe(true);
        expect(isValidTaskType(TaskType.REMINDER)).toBe(true);
        expect(isValidTaskType(999)).toBe(false);
        expect(isValidTaskType('invalid')).toBe(false);
    });
});

describe('Task Model Type Field Tests', () => {
    const Task = require('../models/Task');

    beforeEach(async () => {
        await Task.deleteMany({});
    });

    test('should create task with valid type', async () => {
        const taskData = {
            heading: 'Test Task',
            summary: 'Test Summary',
            description: 'Test Description',
            type: TaskType.APPOINTMENT,
            customer: new mongoose.Types.ObjectId(),
            user: new mongoose.Types.ObjectId()
        };

        const task = new Task(taskData);
        await task.save();

        expect(task.type).toBe(TaskType.APPOINTMENT);
        expect(task.heading).toBe('Test Task');
    });

    test('should create task with reminder type', async () => {
        const taskData = {
            heading: 'Reminder Task',
            summary: 'Reminder Summary',
            description: 'Reminder Description',
            type: TaskType.REMINDER,
            customer: new mongoose.Types.ObjectId(),
            user: new mongoose.Types.ObjectId()
        };

        const task = new Task(taskData);
        await task.save();

        expect(task.type).toBe(TaskType.REMINDER);
    });

    test('should fail with invalid type', async () => {
        const taskData = {
            heading: 'Test Task',
            summary: 'Test Summary',
            description: 'Test Description',
            type: 999, // Invalid type
            customer: new mongoose.Types.ObjectId(),
            user: new mongoose.Types.ObjectId()
        };

        const task = new Task(taskData);
        
        try {
            await task.save();
            fail('Should have thrown validation error');
        } catch (error) {
            expect(error.name).toBe('ValidationError');
            expect(error.message).toContain('Task type must be either 1 (Appointment) or 2 (Reminder)');
        }
    });

    test('should use default type when not provided', async () => {
        const taskData = {
            heading: 'Test Task',
            summary: 'Test Summary',
            description: 'Test Description',
            customer: new mongoose.Types.ObjectId(),
            user: new mongoose.Types.ObjectId()
        };

        const task = new Task(taskData);
        await task.save();

        expect(task.type).toBe(TaskType.APPOINTMENT); // Default value
    });
}); 