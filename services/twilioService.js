const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

/**
 * Get available phone numbers from Twilio
 * @param {string} countryCode - Country code (e.g., 'US', 'CA')
 * @param {string} areaCode - Area code (optional)
 * @returns {Promise<Array>} Array of available phone numbers
 */
const getAvailablePhoneNumbers = async (countryCode = 'US', areaCode = null) => {
    try {
        const params = {
            limit: 10, // Get 10 available numbers
            voiceEnabled: true,
            smsEnabled: true
        };

        if (areaCode) {
            params.areaCode = areaCode;
        }

        const numbers = await client.availablePhoneNumbers(countryCode)
            .local
            .list(params);

        return numbers.map(number => ({
            phoneNumber: number.phoneNumber,
            friendlyName: number.friendlyName,
            locality: number.locality,
            region: number.region,
            country: number.country
        }));
    } catch (error) {
        console.error('Error getting available phone numbers:', error);
        throw new Error('Failed to get available phone numbers');
    }
};

/**
 * Purchase a phone number from Twilio
 * @param {string} phoneNumber - The phone number to purchase
 * @param {string} friendlyName - Friendly name for the phone number
 * @returns {Promise<Object>} Purchased phone number details
 */
const purchasePhoneNumber = async (phoneNumber, friendlyName = null) => {
    try {
        const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
        
        const phoneNumberConfig = {
            phoneNumber: phoneNumber,
            friendlyName: friendlyName || `User-${Date.now()}`
        };

        // Add voice webhook URL if TWILIO_WEBHOOK_URL is configured
        if (webhookUrl) {
            phoneNumberConfig.voiceUrl = webhookUrl;
        }

        const incomingPhoneNumber = await client.incomingPhoneNumbers
            .create(phoneNumberConfig);

        return {
            sid: incomingPhoneNumber.sid,
            phoneNumber: incomingPhoneNumber.phoneNumber,
            friendlyName: incomingPhoneNumber.friendlyName,
            status: incomingPhoneNumber.status
        };
    } catch (error) {
        console.error('Error purchasing phone number:', error);
        throw new Error('Failed to purchase phone number');
    }
};

/**
 * Release a phone number back to Twilio
 * @param {string} phoneNumberSid - The SID of the phone number to release
 * @returns {Promise<boolean>} Success status
 */
const releasePhoneNumber = async (phoneNumberSid) => {
    try {
        await client.incomingPhoneNumbers(phoneNumberSid).remove();
        return true;
    } catch (error) {
        console.error('Error releasing phone number:', error);
        throw new Error('Failed to release phone number');
    }
};

/**
 * Assign a new phone number to a user
 * @param {string} userId - User ID
 * @param {string} userName - User's name for friendly name
 * @param {string} countryCode - Country code (defaults to TWILIO_COUNTRY_CODE from env, or 'US')
 * @param {string} areaCode - Area code (optional)
 * @returns {Promise<Object>} Assigned phone number details
 */
const assignPhoneNumberToUser = async (userId, userName, countryCode = null, areaCode = null) => {
    try {
        // Use country code from env or default to 'US'
        const targetCountryCode = countryCode || process.env.TWILIO_COUNTRY_CODE || 'US';
        
        // Get available phone numbers
        const availableNumbers = await getAvailablePhoneNumbers(targetCountryCode, areaCode);
        
        if (availableNumbers.length === 0) {
            throw new Error(`No available phone numbers in ${targetCountryCode}`);
        }

        // Select the first available number
        const selectedNumber = availableNumbers[0];
        
        // Purchase the phone number
        const friendlyName = `${userName}-${userId}`;
        const purchasedNumber = await purchasePhoneNumber(selectedNumber.phoneNumber, friendlyName);

        return {
            ...purchasedNumber,
            originalAreaCode: selectedNumber.locality,
            originalRegion: selectedNumber.region,
            countryCode: targetCountryCode
        };
    } catch (error) {
        console.error('Error assigning phone number to user:', error);
        throw error;
    }
};

/**
 * List all phone numbers for the account
 * @returns {Promise<Array>} Array of phone numbers
 */
const listAllPhoneNumbers = async () => {
    try {
        const phoneNumbers = await client.incomingPhoneNumbers.list();
        return phoneNumbers.map(number => ({
            sid: number.sid,
            phoneNumber: number.phoneNumber,
            friendlyName: number.friendlyName,
            status: number.status,
            capabilities: number.capabilities,
            dateCreated: number.dateCreated
        }));
    } catch (error) {
        console.error('Error listing phone numbers:', error);
        throw new Error('Failed to list phone numbers');
    }
};

module.exports = {
    getAvailablePhoneNumbers,
    purchasePhoneNumber,
    releasePhoneNumber,
    assignPhoneNumberToUser,
    listAllPhoneNumbers
}; 