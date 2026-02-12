import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DashboardNav from '@/components/DashboardNav';
import { AuthProvider } from '@/components/AuthProvider';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session) {
        redirect('/login');
    }

    return (
        <AuthProvider initialSession={session}>
            <div className="min-h-screen bg-gray-50">
                <DashboardNav session={session} />
                <main className="max-w-7xl mx-auto px-4 py-8">
                    {children}
                </main>
            </div>
        </AuthProvider>
    );
}
