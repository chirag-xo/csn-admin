
import nodemailer from 'nodemailer';

export async function sendMeetingInvite(to: string[], meetingDetails: any) {
    // Create transporter INSIDE function to ensure env vars are loaded in serverless
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports (587 uses STARTTLS)
        auth: {
            user: process.env.SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
        tls: {
            ciphers: 'SSLv3', // Help with some handshake issues
            rejectUnauthorized: false
        },
        // Increase timeouts to prevent 'Greeting never received' errors
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 10000      // 10 seconds
    });

    // Debug logging for production troubleshooting
    console.log('[EMAIL DEBUG] ENV CHECK:', {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_FROM: process.env.SMTP_FROM,
        hasPassword: !!process.env.SMTP_PASS || !!process.env.EMAIL_PASS,
        recipientCount: to.length,
        NODE_ENV: process.env.NODE_ENV
    });

    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
        console.warn('[EMAIL WARN] Email credentials not found. Skipping email sending.');
        return;
    }

    const { title, date, time, venue, description, entryFee, link: originalLink } = meetingDetails;
    const link = 'https://rzp.io/rzp/a82nmzwR';

    const mailOptions = {
        from: process.env.SMTP_FROM || process.env.EMAIL_USER, // Use configured sender or fallback to user
        to: process.env.SMTP_FROM || process.env.EMAIL_USER, // Send to self
        bcc: to, // Blind copy all recipients for privacy
        subject: `Invitation: ${title}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>You are invited to ${title}!</h2>
                <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Venue:</strong> ${venue}</p>
                ${entryFee ? `<p><strong>Entry Fee:</strong> ₹${entryFee}</p>` : ''}
                <p>${description}</p>
                <br/>
                <a href="${link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a>
            </div>
        `,
    };

    try {
        console.log('[EMAIL] Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL SENT] Subject: "${title}" | Recipients: ${to.length} | MessageID: ${info.messageId}`);
        console.log(`[EMAIL RECIPIENTS]:`, to);
    } catch (error) {
        console.error('[EMAIL FAILED] Error sending meeting invite:', error);
        console.error('[EMAIL FAILED] Error details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
        });
    }
}
