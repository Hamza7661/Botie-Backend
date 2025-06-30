const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');

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

// Send third-party task notification email
const sendThirdPartyTaskNotification = async (user, task, customer) => {
    try {
        // Read the HTML template
        const templatePath = path.join(__dirname, '../templates/thirdPartyTaskNotificationTemplate.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf8');
        
        // Replace placeholders with actual data
        const replacements = {
            '{{taskHeading}}': task.heading,
            '{{taskSummary}}': task.summary,
            '{{taskDescription}}': task.description,
            '{{taskStatus}}': task.isResolved ? 'Resolved' : 'Pending',
            '{{taskCreatedAt}}': new Date(task.createdAt).toLocaleString(),
            '{{taskId}}': task._id,
            '{{customerName}}': customer.name,
            '{{customerAddress}}': customer.address,
            '{{customerPhone}}': customer.phoneNumber,
            '{{conversation}}': task.conversation || 'No conversation data available',
            '{{currentDate}}': new Date().toLocaleString()
        };
        
        // Apply replacements
        Object.keys(replacements).forEach(key => {
            htmlTemplate = htmlTemplate.replace(new RegExp(key, 'g'), replacements[key]);
        });
        
        // Create plain text version
        const textMessage = `
New Job Booked via AI Agent

Job Details:
- Title: ${task.heading}
- Summary: ${task.summary}
- Description: ${task.description}
- Status: ${task.isResolved ? 'Resolved' : 'Pending'}
- Created: ${new Date(task.createdAt).toLocaleString()}
- Task ID: ${task._id}

Customer Information:
- Name: ${customer.name}
- Address: ${customer.address}
- Phone: ${customer.phoneNumber}

This job was automatically booked through our AI agent system. Please review the details and contact the customer to schedule the work.

Generated on ${new Date().toLocaleString()}
        `.trim();
        
        // Send email
        await sendEmail({
            email: user.email,
            subject: `🎯 New Job Booked via AI Agent - ${task.heading}`,
            message: textMessage,
            html: htmlTemplate
        });
        
        console.log(`Third-party task notification email sent to ${user.email}`);
        
    } catch (error) {
        console.error('Error sending third-party task notification email:', error);
        // Don't throw error to avoid breaking the task creation process
    }
};

module.exports = {
    sendEmail,
    sendThirdPartyTaskNotification
}; 