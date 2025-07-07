const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const { makePhoneCall, getCallStatus } = require('./twilioService');
const { emitNotification } = require('./websocketService');
const cron = require('node-cron');

class ReminderService {
    constructor() {
        this.timeCronJob = null;
        this.locationCronJob = null;
        this.activeReminders = new Map(); // Track active reminders to avoid duplicates
    }

    // Start the reminder service
    start() {
        console.log('Starting Reminder Service with node-cron...');
        
        // Check for time-based reminders every 10 seconds using cron for good precision
        this.timeCronJob = cron.schedule('*/10 * * * * *', async () => {
            try {
                await this.checkTimeBasedReminders();
            } catch (error) {
                console.error('❌ Error in time-based reminder check:', error);
            }
        }, {
            timezone: "UTC",
            scheduled: false
        });

        // Check for location-based reminders every 5 minutes using cron
        this.locationCronJob = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.checkLocationBasedReminders();
            } catch (error) {
                console.error('❌ Error in location-based reminder check:', error);
            }
        }, {
            timezone: "UTC",
            scheduled: false
        });

        // Start the cron jobs
        this.timeCronJob.start();
        this.locationCronJob.start();

        console.log('✅ Reminder Service started successfully with cron jobs');
        console.log('⏰ Time-based reminders: Every 10 seconds');
        console.log('📍 Location-based reminders: Every 5 minutes');
    }

    // Stop the reminder service
    stop() {
        if (this.timeCronJob) {
            this.timeCronJob.stop();
            this.timeCronJob = null;
        }
        if (this.locationCronJob) {
            this.locationCronJob.stop();
            this.locationCronJob = null;
        }
        this.activeReminders.clear();
        console.log('Reminder Service stopped');
    }

    // Check for time-based reminders
    async checkTimeBasedReminders() {
        try {
            const now = new Date();
            const dueReminders = await Reminder.find({
                reminderDateTime: { $lte: now },
                timeNotificationSent: { $ne: true },
                isDeleted: { $ne: true }
            }).populate('user', 'email phoneNumber firstname lastname twilioPhoneNumber');

            if (dueReminders.length > 0) {
                console.log(`🕐 Found ${dueReminders.length} time-based reminder(s) due`);
            }

            for (const reminder of dueReminders) {
                // Check if reminder is already being processed
                const reminderKey = `time_${reminder._id}`;
                if (this.activeReminders.has(reminderKey)) {
                    console.log(`⏳ Reminder ${reminder._id} already being processed, skipping...`);
                    continue;
                }

                // Mark as being processed
                this.activeReminders.set(reminderKey, true);
                
                try {
                    await this.processReminder(reminder, 'time');
                } finally {
                    // Remove from active reminders after processing
                    this.activeReminders.delete(reminderKey);
                }
            }

            return dueReminders;
        } catch (error) {
            console.error('Error checking time-based reminders:', error);
            return null;
        }
    }

    // Check for location-based reminders
    async checkLocationBasedReminders() {
        try {
            const reminders = await Reminder.find({
                locationNotificationSent: { $ne: true },
                isDeleted: { $ne: true },
                'coordinates.latitude': { $exists: true, $ne: null },
                'coordinates.longitude': { $exists: true, $ne: null }
            }).populate('user', 'email phoneNumber firstname lastname twilioPhoneNumber currentLocation');

            let processedCount = 0;
            for (const reminder of reminders) {
                if (await this.isUserNearReminder(reminder)) {
                    await this.processReminder(reminder, 'location');
                    processedCount++;
                }
            }

            if (processedCount > 0) {
                console.log(`📍 Found ${processedCount} location-based reminder(s) triggered`);
            }

            return reminders.filter(r => r.locationNotificationSent);
        } catch (error) {
            console.error('Error checking location-based reminders:', error);
            return null;
        }
    }

    // Process a reminder (send notifications)
    async processReminder(reminder, triggerType) {
        try {
            const user = reminder.user;
            const reminderData = {
                id: reminder._id,
                description: reminder.description,
                locationName: reminder.locationName,
                coordinates: reminder.coordinates,
                triggerType: triggerType,
                timestamp: new Date().toISOString()
            };

            // Send email notification
            await this.sendReminderEmail(user, reminderData);

            // Make phone call if user has a Twilio number
            if (user.twilioPhoneNumber) {
                await this.makeReminderCall(user, reminderData);
            }

            // Send real-time notification via WebSocket
            emitNotification(user._id, {
                type: 'reminder_triggered',
                data: reminderData
            });

            // Mark reminder as processed based on trigger type
            if (triggerType === 'time') {
                reminder.timeNotificationSent = true;
                reminder.timeNotificationSentAt = new Date();
            } else if (triggerType === 'location') {
                reminder.locationNotificationSent = true;
                reminder.locationNotificationSentAt = new Date();
            }
            
            await reminder.save();

            console.log(`Reminder processed for user ${user._id}: ${reminder.description} (${triggerType})`);

        } catch (error) {
            console.error('Error processing reminder:', error);
        }
    }

    // Send email notification for reminder
    async sendReminderEmail(user, reminderData) {
        try {
            const subject = 'Reminder: ' + reminderData.description;
            const message = this.generateReminderEmailContent(user, reminderData);

            await sendEmail({
                email: user.email,
                subject: subject,
                message: message,
                html: this.generateReminderEmailHTML(user, reminderData)
            });

            console.log(`Reminder email sent to ${user.email}`);
        } catch (error) {
            console.error('Error sending reminder email:', error);
        }
    }

    // Make phone call for reminder with retry logic and SMS fallback
    async makeReminderCall(user, reminderData) {
        try {
            const reminder = await Reminder.findById(reminderData.id);
            if (!reminder) {
                console.error('Reminder not found for call');
                return;
            }

            // Check if we've exceeded max call attempts
            if (reminder.callAttempts >= 2) {
                console.log(`Max call attempts (2) reached for reminder ${reminder._id}. No more attempts.`);
                return;
            }

            const callMessage = this.generateReminderCallMessage(user, reminderData);
            const statusCallbackUrl = `${process.env.BASE_URL}/api/webhooks/twilio/call-status`;
            
            // Update reminder status to calling
            await Reminder.findByIdAndUpdate(reminder._id, {
                callStatus: 'calling',
                callAttempts: reminder.callAttempts + 1,
                lastCallAttempt: new Date()
            });

            // Make the call
            const callResult = await makePhoneCall({
                to: user.phoneNumber,
                from: user.twilioPhoneNumber,
                message: callMessage,
                statusCallback: statusCallbackUrl
            });

            // Update reminder with call SID
            await Reminder.findByIdAndUpdate(reminder._id, {
                callSid: callResult.sid
            });

            console.log(`📞 Reminder call initiated to ${user.phoneNumber}. Call SID: ${callResult.sid}`);
            
            // Schedule a check for call status after 35 seconds (30s timeout + 5s buffer)
            setTimeout(async () => {
                await this.checkCallStatus(reminder._id, callResult.sid);
            }, 35000);

        } catch (error) {
            console.error('Error making reminder call:', error);
            
            // Update reminder status to failed
            await Reminder.findByIdAndUpdate(reminderData.id, {
                callStatus: 'failed',
                lastCallAttempt: new Date()
            });
        }
    }

    // Check call status and handle accordingly
    async checkCallStatus(reminderId, callSid) {
        try {
            const callStatus = await getCallStatus(callSid);
            const reminder = await Reminder.findById(reminderId);
            
            if (!reminder) return;

            let newStatus = 'completed';
            let shouldRetry = false;

            switch (callStatus.status) {
                case 'completed':
                    if (callStatus.duration > 0) {
                        newStatus = 'completed';
                        console.log(`✅ Call completed successfully for reminder ${reminderId}`);
                    } else {
                        newStatus = 'no_answer';
                        shouldRetry = reminder.callAttempts < 2;
                        console.log(`📞 Call not answered for reminder ${reminderId}`);
                    }
                    break;
                case 'failed':
                case 'busy':
                    newStatus = callStatus.status;
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`❌ Call ${callStatus.status} for reminder ${reminderId}`);
                    break;
                case 'no-answer':
                    newStatus = 'no_answer';
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`📞 No answer for reminder ${reminderId}`);
                    break;
                default:
                    newStatus = 'failed';
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`❓ Unknown call status ${callStatus.status} for reminder ${reminderId}`);
            }

            // Update reminder status
            await Reminder.findByIdAndUpdate(reminderId, {
                callStatus: newStatus
            });

            // Retry call if needed
            if (shouldRetry) {
                console.log(`🔄 Retrying call for reminder ${reminderId} (attempt ${reminder.callAttempts + 1}/2)`);
                setTimeout(async () => {
                    const user = await User.findById(reminder.user);
                    const reminderData = {
                        id: reminder._id,
                        description: reminder.description,
                        triggerType: reminder.triggerType,
                        timestamp: new Date(),
                        locationName: reminder.locationName
                    };
                    await this.makeReminderCall(user, reminderData);
                }, 60000); // Wait 1 minute before retry
            } else if (newStatus !== 'completed') {
                console.log(`📞 Call failed for reminder ${reminderId}. Email notification already sent.`);
            }

        } catch (error) {
            console.error('Error checking call status:', error);
        }
    }

    // Generate email content for reminder
    generateReminderEmailContent(user, reminderData) {
        let content = `Hello ${user.firstname},\n\n`;
        content += `This is a reminder for: ${reminderData.description}\n\n`;

        if (reminderData.triggerType === 'time') {
            const triggerTime = new Date(reminderData.timestamp).toLocaleString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            content += `⏰ Time-based reminder triggered at ${triggerTime}\n`;
        } else if (reminderData.triggerType === 'location') {
            content += `📍 Location-based reminder triggered\n`;
            if (reminderData.locationName) {
                content += `Location: ${reminderData.locationName}\n`;
            }
        }

        content += `\nBest regards,\nBotie Team`;

        return content;
    }

    // Generate HTML email content for reminder
    generateReminderEmailHTML(user, reminderData) {
        const triggerIcon = reminderData.triggerType === 'time' ? '⏰' : '📍';
        const triggerText = reminderData.triggerType === 'time' ? 'Time-based reminder' : 'Location-based reminder';
        const triggerTime = new Date(reminderData.timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Read the email template
        const fs = require('fs');
        const path = require('path');
        const templatePath = path.join(__dirname, '..', 'templates', 'reminderNotificationTemplate.html');
        let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

        // Replace template variables
        htmlTemplate = htmlTemplate.replace(/{{reminderIcon}}/g, triggerIcon);
        htmlTemplate = htmlTemplate.replace(/{{userName}}/g, user.firstname);
        htmlTemplate = htmlTemplate.replace(/{{reminderDescription}}/g, reminderData.description);
        htmlTemplate = htmlTemplate.replace(/{{reminderType}}/g, triggerText);
        htmlTemplate = htmlTemplate.replace(/{{triggerTime}}/g, triggerTime);
        
        if (reminderData.locationName) {
            htmlTemplate = htmlTemplate.replace(/{{locationName}}/g, reminderData.locationName);
        } else {
            // Remove the location section if no location name
            htmlTemplate = htmlTemplate.replace(/{{#if locationName}}[\s\S]*?{{\/if}}/g, '');
        }

        return htmlTemplate;
    }

    // Generate call message for reminder
    generateReminderCallMessage(user, reminderData) {
        let message = `Hi, this is Botie. You have a reminder: ${reminderData.description}`;
        
        if (reminderData.locationName) {
            message += ` at location ${reminderData.locationName}`;
        }
        
        message += ".";
        return message;
    }

    // Handle location update from frontend (called by API endpoint)
    async handleLocationUpdate(userId, currentLocation) {
        try {
            const { latitude, longitude } = currentLocation;
            
            // Find reminders for this user that are location-based (no reminderDateTime or reminderDateTime is null)
            // and haven't been notified yet
            const locationReminders = await Reminder.find({
                user: userId,
                locationNotificationSent: false, // Only process if not already notified
                isDeleted: { $ne: true },
                $or: [
                    { reminderDateTime: null },
                    { reminderDateTime: { $exists: false } }
                ]
            }).populate('user', 'firstname lastname email phoneNumber twilioPhoneNumber');

            for (const reminder of locationReminders) {
                // Calculate distance between current location and reminder location
                const distance = this.calculateDistance(
                    latitude, longitude,
                    reminder.coordinates.latitude, reminder.coordinates.longitude
                );

                // If within 100 meters (0.1 km), trigger the reminder
                if (distance <= 0.1) {
                    const reminderKey = `location_${reminder._id}`;
                    
                    // Check if we've already processed this reminder recently
                    if (this.activeReminders.has(reminderKey)) {
                        continue;
                    }

                    // Mark as active to prevent duplicate processing
                    this.activeReminders.set(reminderKey, true);

                    // Process the reminder
                    await this.processReminder(reminder, 'location');

                    // Remove from active reminders after 5 minutes to allow re-triggering
                    setTimeout(() => {
                        this.activeReminders.delete(reminderKey);
                    }, 5 * 60 * 1000);
                }
            }
        } catch (error) {
            console.error('Error handling location update:', error);
        }
    }

    // Calculate distance between two points using Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Distance in kilometers
        return distance;
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    // Get user's active reminders
    async getUserReminders(userId) {
        try {
            const reminders = await Reminder.find({
                user: userId,
                isDeleted: { $ne: true }
            }).sort({ createdAt: -1 });

            return reminders;
        } catch (error) {
            console.error('Error getting user reminders:', error);
            throw error;
        }
    }

    // Get service status information
    getServiceStatus() {
        return {
            isRunning: this.timeCronJob !== null && this.locationCronJob !== null,
            timeCronJob: {
                isRunning: this.timeCronJob ? this.timeCronJob.running : false
            },
            locationCronJob: {
                isRunning: this.locationCronJob ? this.locationCronJob.running : false
            },
            activeRemindersCount: this.activeReminders.size,
            timestamp: new Date().toISOString()
        };
    }

    // Manually trigger time-based reminder check (for testing)
    async triggerTimeCheck() {
        try {
            console.log('🔧 Manually triggering time-based reminder check...');
            const result = await this.checkTimeBasedReminders();
            console.log(`✅ Time-based reminder check completed. Processed: ${result?.length || 0} reminders`);
            return result;
        } catch (error) {
            console.error('❌ Error in manual time check:', error);
            throw error;
        }
    }

    // Manually trigger location-based reminder check (for testing)
    async triggerLocationCheck() {
        try {
            console.log('🔧 Manually triggering location-based reminder check...');
            const result = await this.checkLocationBasedReminders();
            console.log(`✅ Location-based reminder check completed. Processed: ${result?.length || 0} reminders`);
            return result;
        } catch (error) {
            console.error('❌ Error in manual location check:', error);
            throw error;
        }
    }

    // Add a reminder to the active tracking
    addToTracking(reminderId, triggerType) {
        const key = `${triggerType}_${reminderId}`;
        this.activeReminders.set(key, true);
    }

    // Remove a reminder from active tracking
    removeFromTracking(reminderId, triggerType) {
        const key = `${triggerType}_${reminderId}`;
        this.activeReminders.delete(key);
    }

    // Reset notification status for a reminder (for testing or manual re-triggering)
    async resetNotificationStatus(reminderId, triggerType) {
        try {
            const reminder = await Reminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            if (triggerType === 'time') {
                reminder.timeNotificationSent = false;
                reminder.timeNotificationSentAt = null;
            } else if (triggerType === 'location') {
                reminder.locationNotificationSent = false;
                reminder.locationNotificationSentAt = null;
            }

            await reminder.save();
            console.log(`Notification status reset for reminder ${reminderId} (${triggerType})`);
            return reminder;
        } catch (error) {
            console.error('Error resetting notification status:', error);
            throw error;
        }
    }

    // Get notification history for a reminder
    async getNotificationHistory(reminderId) {
        try {
            const reminder = await Reminder.findById(reminderId);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            return {
                timeNotificationSent: reminder.timeNotificationSent,
                timeNotificationSentAt: reminder.timeNotificationSentAt,
                locationNotificationSent: reminder.locationNotificationSent,
                locationNotificationSentAt: reminder.locationNotificationSentAt
            };
        } catch (error) {
            console.error('Error getting notification history:', error);
            throw error;
        }
    }

    // Get pending reminders (not yet notified)
    async getPendingReminders(userId) {
        try {
            const timeBasedPending = await Reminder.find({
                user: userId,
                reminderDateTime: { $ne: null },
                timeNotificationSent: false,
                isDeleted: { $ne: true }
            });

            const locationBasedPending = await Reminder.find({
                user: userId,
                reminderDateTime: null,
                locationNotificationSent: false,
                isDeleted: { $ne: true }
            });

            return {
                timeBased: timeBasedPending,
                locationBased: locationBasedPending,
                total: timeBasedPending.length + locationBasedPending.length
            };
        } catch (error) {
            console.error('Error getting pending reminders:', error);
            throw error;
        }
    }

    // Check if user is near a reminder location
    async isUserNearReminder(reminder) {
        try {
            const user = reminder.user;
            
            // If user doesn't have current location, skip
            if (!user.currentLocation || !user.currentLocation.latitude || !user.currentLocation.longitude) {
                return false;
            }

            // Calculate distance between user's current location and reminder location
            const distance = this.calculateDistance(
                user.currentLocation.latitude,
                user.currentLocation.longitude,
                reminder.coordinates.latitude,
                reminder.coordinates.longitude
            );

            // If within 100 meters (0.1 km), consider user near the reminder
            return distance <= 0.1;
        } catch (error) {
            console.error('Error checking if user is near reminder:', error);
            return false;
        }
    }
}

// Create singleton instance
const reminderService = new ReminderService();

module.exports = reminderService;