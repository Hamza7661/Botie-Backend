const Reminder = require('../models/Reminder');
const User = require('../models/User');
const reminderService = require('../services/reminderService');

// @desc    Handle Twilio call status webhook
// @route   POST /api/webhooks/twilio/call-status
// @access  Public (Twilio webhook)
const handleTwilioCallStatus = async (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        
        console.log(`📞 Twilio webhook received for call ${CallSid}: ${CallStatus}`);

        // Find reminder by call SID
        const reminder = await Reminder.findOne({ callSid: CallSid });
        if (!reminder) {
            console.log(`No reminder found for call SID: ${CallSid}`);
            return res.status(200).send('OK');
        }

        // Update reminder status based on call status
        let newStatus = 'completed';
        let shouldRetry = false;

        switch (CallStatus) {
                            case 'completed':
                    if (CallDuration > 0) {
                        newStatus = 'completed';
                        console.log(`✅ Call completed successfully for reminder ${reminder._id}`);
                    } else {
                        newStatus = 'no_answer';
                        shouldRetry = reminder.callAttempts < 2;
                        console.log(`📞 Call not answered for reminder ${reminder._id}`);
                    }
                    break;
                case 'failed':
                case 'busy':
                    newStatus = CallStatus;
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`❌ Call ${CallStatus} for reminder ${reminder._id}`);
                    break;
                case 'no-answer':
                    newStatus = 'no_answer';
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`📞 No answer for reminder ${reminder._id}`);
                    break;
                default:
                    newStatus = 'failed';
                    shouldRetry = reminder.callAttempts < 2;
                    console.log(`❓ Unknown call status ${CallStatus} for reminder ${reminder._id}`);
        }

        // Update reminder status
        await Reminder.findByIdAndUpdate(reminder._id, {
            callStatus: newStatus
        });

                    // Handle retry or SMS fallback
            if (shouldRetry) {
                console.log(`🔄 Scheduling retry for reminder ${reminder._id} (attempt ${reminder.callAttempts + 1}/2)`);
            setTimeout(async () => {
                const user = await User.findById(reminder.user);
                const reminderData = {
                    reminderId: reminder._id,
                    description: reminder.description,
                    triggerType: reminder.triggerType,
                    timestamp: new Date(),
                    locationName: reminder.locationName
                };
                await reminderService.makeReminderCall(user, reminderData);
            }, 60000); // Wait 1 minute before retry
        } else if (newStatus !== 'completed') {
            console.log(`📞 Call failed for reminder ${reminder._id}. Email notification already sent.`);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error handling Twilio webhook:', error);
        res.status(500).send('Error');
    }
};

module.exports = {
    handleTwilioCallStatus
}; 