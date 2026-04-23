const sgMail = require('@sendgrid/mail');

// Set the API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * @param {Object} options 
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text version (Crucial for deliverability)
 */
const sendEmail = async (options) => {
    // 1. Create a plain-text version if not provided 
    // Spam filters dislike HTML-only emails.
    const plainText = options.text || options.html.replace(/<[^>]*>?/gm, '').trim();

    const msg = {
        to: options.email,
        from: {
            name: "Al-Ikroom Islamic Institute",
            email: process.env.EMAIL_FROM 
        },
        subject: options.subject,
        text: plainText, 
        html: options.html,
        // 2. Mail Settings for better deliverability
        mailSettings: {
            sandboxMode: {
                enable: false
            }
        },
        // 3. Tracking Settings
        // High spam scores often come from aggressive click tracking.
        trackingSettings: {
            clickTracking: { enable: false }, 
            openTracking: { enable: false }
        }
    };

    try {
        const response = await sgMail.send(msg);
        
        // SendGrid returns an array; [0] is the actual response
        if (response[0].statusCode >= 200 && response[0].statusCode < 300) {
            console.log(`✅ Email sent to ${options.email}`);
        }
    } catch (error) {
        // Detailed error handling to see EXACTLY why SendGrid rejected it
        if (error.response) {
            console.error('❌ SendGrid Error Details:', JSON.stringify(error.response.body, null, 2));
        } else {
            console.error('❌ Email Utility Error:', error.message);
        }
        throw new Error('Email service unavailable. Please try again later.');
    }
};

module.exports = sendEmail;
