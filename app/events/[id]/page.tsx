
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null); // Ideally from session context if available, or fetch
    const [registering, setRegistering] = useState(false);
    // Actually, to know "currentUser", we need session. But this is a public page?
    // User wants "list of users with payment status".
    // If the user is logged in, they can see "Pay Now" next to their name.

    // We need to know who the current user is. Since this is client component, we might need to fetch session.
    // Let's assume we can fetch /api/auth/session to check if logged in.

    const searchParams = use(params) as any; // params is promise, but we need searchParams from next/navigation
    // Actually in Next 15, searchParams is also often a promise or prop.
    // But since this is client component, let's use useSearchParams hook.

    // We need to import useSearchParams

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();
                if (data.session) {
                    setCurrentUser(data.session);
                }
            } catch (error) {
                console.error('Error fetching session:', error);
            }
        };
        fetchSession();

        const fetchEvent = async () => {
            try {
                const res = await fetch(`/api/events/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setEvent(data);
                } else {
                    setEvent(null);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [id]);

    // Handle auto-payment trigger
    // Handle auto-payment trigger
    useEffect(() => {
        if (loading || !event) return;

        const params = new URLSearchParams(window.location.search);
        const paymentRequested = params.get('payment') === 'true';

        console.log("Payment Trigger Debug:", {
            paymentRequested,
            eventLoaded: !!event,
            userLoaded: !!currentUser,
            userId: currentUser?.userId,
            registering
        });

        // Strict check: User must be fully loaded with ID
        if (paymentRequested && event && currentUser?.userId && !registering) {
            console.log("Auto-payment initiated for:", currentUser.firstName);

            // Check if already paid to avoid loop
            const attendee = event.EventAttendee?.find((a: any) => a.userId === currentUser.userId);
            if (attendee && attendee.paymentStatus === 'PAID') {
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
                return;
            }

            // Remove the param immediately to prevent double-trigger
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);

            handlePay();
        }
    }, [event, currentUser, registering, loading]);

    const handlePay = async () => {
        if (!currentUser) {
            alert('Please login to pay');
            router.push('/login');
            return;
        }

        // TEMPORARY: Redirect to Static Payment Link for Testing
        // window.open('https://rzp.io/rzp/RRcWtgMU', '_blank');

        // --- RESTORED ORIGINAL RAZORPAY CHECKOUT FLOW ---

        setRegistering(true);
        try {
            // 1. Create Order
            const res = await fetch(`/api/events/${id}/register`, {
                method: 'POST',
            });
            const data = await res.json();

            if (!res.ok) {
                alert(data.error || data.message || 'Payment initiation failed');
                setRegistering(false);
                return;
            }

            if (data.message === 'Already paid') {
                alert('You are already registered!');
                setRegistering(false);
                window.location.reload();
                return;
            }

            // 2. Open Razorpay
            const options = {
                key: data.keyId,
                amount: data.amount,
                currency: data.currency,
                name: "CSN World",
                description: `Payment for ${event.title}`,
                order_id: data.orderId,
                handler: async function (response: any) {
                    // 3. Verify Payment
                    const verifyRes = await fetch(`/api/events/${id}/verify-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        })
                    });

                    if (verifyRes.ok) {
                        alert('Payment Successful!');
                        window.location.reload();
                    } else {
                        alert('Payment Verification Failed');
                    }
                },
                prefill: {
                    name: currentUser.name || "User",
                    email: currentUser.email || "",
                    contact: ""
                },
                theme: {
                    color: "#3399cc"
                }
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.on('payment.failed', function (response: any) {
                alert(response.error.description);
            });
            rzp1.open();

        } catch (error) {
            alert('Something went wrong');
            console.error(error);
        } finally {
            setRegistering(false);
        }
    };

    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this meeting? This action cannot be undone.')) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert('Meeting deleted successfully');
                router.push(`/dashboard/chapters/${event?.chapterId || ''}?tab=meetings`);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete meeting');
            }
        } catch (error) {
            alert('Something went wrong');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading event...</div>;
    if (!event) return <div className="min-h-screen flex items-center justify-center">Event not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
            {/* Payment Processing Overlay */}
            {(registering || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment') === 'true')) && (
                <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
                    <h2 className="text-2xl font-bold text-gray-800">Initializing Payment...</h2>
                    <p className="text-gray-600">Please complete the payment in the popup.</p>
                </div>
            )}
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <div className="mb-6 max-w-4xl mx-auto">
                <Link
                    href={`/dashboard/chapters/${event.chapterId}?tab=meetings`}
                    className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to Meetings
                </Link>
            </div>

            <div className="max-w-4xl mx-auto bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-8">
                    <div className="text-center mb-8">
                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                            {event.type}
                        </span>
                        <h1 className="mt-4 text-3xl font-extrabold text-gray-900">{event.title}</h1>
                        <p className="mt-2 text-gray-500">{event.Chapter?.name}</p>
                    </div>

                    <div className="border-t border-gray-200 py-6">
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                                <dt className="text-sm font-medium text-gray-500">Date & Time</dt>
                                <dd className="mt-1 text-lg text-gray-900">
                                    {new Date(event.date).toLocaleDateString()} at {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </dd>
                            </div>
                            <div className="sm:col-span-1">
                                <dt className="text-sm font-medium text-gray-500">Location</dt>
                                <dd className="mt-1 text-lg text-gray-900 mb-2">{event.location}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-500">About</dt>
                                <dd className="mt-1 text-gray-900">{event.description}</dd>
                            </div>
                        </dl>
                        <div className="border-t border-gray-100 pt-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Entry Fee</h3>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {event.entryFee ? `₹${event.entryFee}` : 'Free'}
                                    </p>
                                </div>

                                {currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.userId === event.creatorId || currentUser.role === 'PRESIDENT') && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        {deleting ? 'Deleting...' : 'Delete Meeting'}
                                    </button>
                                )}

                                {/* Show Pay/Register button for non-attendees or pending attendees */}
                                {currentUser && !event.EventAttendee?.some((a: any) => a.userId === currentUser.userId) && (
                                    null)}
                            </div>
                        </div>
                    </div>

                    {/* Attendees List */}
                    <div className="mt-8 border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Attendees & Payment Status</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {event.EventAttendee?.length > 0 ? (
                                        event.EventAttendee.map((attendee: any) => (
                                            <tr key={attendee.userId}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10">
                                                            {attendee.User.profilePhoto ? (
                                                                <img className="h-10 w-10 rounded-full" src={attendee.User.profilePhoto} alt="" />
                                                            ) : (
                                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                                    {attendee.User.firstName[0]}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{attendee.User.firstName} {attendee.User.lastName}</div>
                                                            {/* <div className="text-sm text-gray-500">{attendee.User.email}</div> */}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${attendee.status === 'GOING' ? 'bg-green-100 text-green-800' :
                                                        attendee.status === 'INVITED' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {attendee.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${attendee.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                                                        attendee.paymentStatus === 'PENDING' ? 'bg-orange-100 text-orange-800' :
                                                            'bg-red-100 text-red-800'
                                                        }`}>
                                                        {attendee.paymentStatus}
                                                    </span>
                                                    {currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.userId === event.creatorId || currentUser.role === 'PRESIDENT') && (
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm('Remove this attendee?')) return;
                                                                try {
                                                                    const res = await fetch(`/api/events/${id}/attendees/${attendee.id}`, { method: 'DELETE' });
                                                                    if (res.ok) {
                                                                        alert('Attendee removed');
                                                                        window.location.reload();
                                                                    } else {
                                                                        alert('Failed to remove');
                                                                    }
                                                                } catch (e) {
                                                                    console.error(e);
                                                                    alert('Error removing attendee');
                                                                }
                                                            }}
                                                            className="ml-2 text-red-600 hover:text-red-900 text-xs underline"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {currentUser && currentUser.userId === attendee.userId && attendee.paymentStatus !== 'PAID' && (
                                                        <button
                                                            onClick={handlePay}
                                                            disabled={registering}
                                                            className="text-blue-600 hover:text-blue-900 font-bold border border-blue-600 px-3 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50"
                                                        >
                                                            {registering ? 'Processing...' : 'Pay Now'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                                No attendees found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
