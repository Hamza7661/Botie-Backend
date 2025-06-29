const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
    const msg = {
        to: options.email,
        from: {
            name: process.env.EMAIL_FROM_NAME,
            email: process.env.EMAIL_FROM,
        },
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);

        if (error.response) {
            console.error(error.response.body);
        }
        // Re-throw the error to be handled by the controller
        throw new Error('Email could not be sent');
    }
};

module.exports = sendEmail; 