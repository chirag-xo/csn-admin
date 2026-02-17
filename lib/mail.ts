
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    },
});

export async function sendMeetingInvite(to: string[], meetingDetails: any) {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
        console.warn('Email credentials not found. Skipping email sending.');
        return;
    }

    const { title, date, time, venue, description, entryFee, link: originalLink } = meetingDetails;
    const link = `${originalLink}?payment=true`;

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
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL SENT] Subject: "${title}" | Recipients: ${to.length} | MessageID: ${info.messageId}`);
        console.log(`[EMAIL RECIPIENTS]:`, to);
    } catch (error) {
        console.error('[EMAIL FAILED] Error sending meeting invite:', error);
    }
}
