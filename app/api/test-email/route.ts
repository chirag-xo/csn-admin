
import { NextResponse } from 'next/server';
import { sendMeetingInvite } from '@/lib/mail';

export async function GET() {
    const title = "CSN Global Summit (Test Email)";
    const date = new Date().toISOString();
    const time = "10:00 AM";
    const venue = "Grand Hyatt, Mumbai";
    const entryFee = 1500;
    const description = "This is a TEST email to verify SMTP configuration.";
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/events/preview-id?payment=true`;

    // Trigger test email to the sender themselves
    const recipient = process.env.EMAIL_USER || 'info@csnworld.com';
    console.log(`Attempting to send test email to ${recipient}...`);

    await sendMeetingInvite([recipient], {
        title,
        date,
        time,
        venue,
        description,
        entryFee,
        link
    });

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
            <div style="background-color: #dbfbb6; padding: 10px; border-radius: 4px; text-align: center; margin-bottom: 20px; color: #3c763d;">
                <strong>Test Email Sent!</strong> Check your terminal logs and your inbox/spam folder for <em>${recipient}</em>.
            </div>
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #333;">You are invited to ${title}!</h2>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Venue:</strong> ${venue}</p>
                ${entryFee ? `<p><strong>Entry Fee:</strong> ₹${entryFee}</p>` : ''}
                <hr style="border: 0; border-top: 1px solid #ddd; margin: 15px 0;" />
                <p>${description}</p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <a href="${link}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Pay Now</a>
            </div>
            <p style="margin-top: 30px; text-align: center; color: #888; font-size: 12px;">This is a system generated email from CSN Admin.</p>
        </div>
    `;

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html',
        },
    });
}
