
import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'test_key_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_key_secret',
});

console.log("Razorpay initialized with Key ID:", process.env.RAZORPAY_KEY_ID ? "Yes" : "No");
