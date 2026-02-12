'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Session } from '@/lib/auth';

export default function DashboardNav({ session }: { session: Session }) {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const canViewUsers = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR'].includes(session.role);
    const canViewChapters = ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'].includes(session.role);

    return (
        <nav className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center space-x-8">
                        <h1 className="text-xl font-bold">CSNWorld Admin</h1>
                        <div className="flex space-x-4">
                            {canViewUsers && (
                                <Link
                                    href="/dashboard/users"
                                    className="text-gray-700 hover:text-gray-900 px-3 py-2"
                                >
                                    Users
                                </Link>
                            )}
                            {canViewChapters && (
                                <Link
                                    href="/dashboard/chapters"
                                    className="text-gray-700 hover:text-gray-900 px-3 py-2"
                                >
                                    Chapters
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">
                            {session.role.replace('_', ' ')}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="btn btn-secondary text-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
