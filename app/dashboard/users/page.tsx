'use client';

import { useState, useEffect } from 'react';
import RoleAssignmentModal from '@/components/RoleAssignmentModal';
import ConfirmDialog from '@/components/ConfirmDialog';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
    state?: { name: string };
    city?: { name: string };
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        userId: string;
        userName: string;
        type: 'verify' | 'unverify' | 'deactivate' | 'activate';
    } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(search && { search }),
            });

            const res = await fetch(`/api/users?${params}`);
            const data = await res.json();

            if (res.ok) {
                setUsers(data.users);
                setTotal(data.total);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [page, search]);

    const handleVerifyToggle = async (id: string) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/users/${id}/verify`, {
                method: 'PATCH',
            });

            if (res.ok) {
                fetchUsers();
                setConfirmAction(null);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update verification');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/users/${id}/deactivate`, {
                method: 'PATCH',
            });

            if (res.ok) {
                fetchUsers();
                setConfirmAction(null);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to deactivate user');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleActivate = async (id: string) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/users/${id}/activate`, {
                method: 'PATCH',
            });

            if (res.ok) {
                fetchUsers();
                setConfirmAction(null);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to activate user');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setIsProcessing(false);
        }
    };

    const totalPages = Math.ceil(total / 20);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Users</h1>
                <div className="flex gap-4">
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="input w-64"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <>
                    <div className="card overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>State</th>
                                    <th>City</th>
                                    <th>Status</th>
                                    <th>Verified</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {user.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>{user.state?.name || '-'}</td>
                                        <td>{user.city?.name || '-'}</td>
                                        <td>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${user.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            {user.isVerified ? (
                                                <span className="text-green-600">✓</span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedUser(user);
                                                        setShowRoleModal(true);
                                                    }}
                                                    className="text-blue-600 hover:underline text-sm"
                                                >
                                                    Assign Role
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmAction({
                                                            userId: user.id,
                                                            userName: user.name,
                                                            type: user.isVerified ? 'unverify' : 'verify'
                                                        });
                                                    }}
                                                    className="text-green-600 hover:underline text-sm"
                                                >
                                                    {user.isVerified ? 'Unverify' : 'Verify'}
                                                </button>
                                                {user.isActive ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmAction({
                                                                userId: user.id,
                                                                userName: user.name,
                                                                type: 'deactivate'
                                                            });
                                                        }}
                                                        className="text-red-600 hover:underline text-sm"
                                                    >
                                                        Deactivate
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmAction({
                                                                userId: user.id,
                                                                userName: user.name,
                                                                type: 'activate'
                                                            });
                                                        }}
                                                        className="text-green-600 hover:underline text-sm"
                                                    >
                                                        Activate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn btn-secondary disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="px-4 py-2">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="btn btn-secondary disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {showRoleModal && selectedUser && (
                <RoleAssignmentModal
                    user={selectedUser}
                    onClose={() => {
                        setShowRoleModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={() => {
                        setShowRoleModal(false);
                        setSelectedUser(null);
                        fetchUsers();
                    }}
                />
            )}

            {confirmAction && (
                <ConfirmDialog
                    title={`${confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)} ${confirmAction.userName}?`}
                    message={
                        confirmAction.type === 'deactivate'
                            ? `Are you sure you want to deactivate ${confirmAction.userName}? This will remove them from all chapters.`
                            : `Are you sure you want to ${confirmAction.type} ${confirmAction.userName}?`
                    }
                    confirmVariant={
                        confirmAction.type === 'deactivate'
                            ? 'danger'
                            : confirmAction.type === 'activate'
                                ? 'success'
                                : 'primary'
                    }
                    loading={isProcessing}
                    onConfirm={() => {
                        if (confirmAction.type === 'verify' || confirmAction.type === 'unverify') {
                            handleVerifyToggle(confirmAction.userId);
                        } else if (confirmAction.type === 'deactivate') {
                            handleDeactivate(confirmAction.userId);
                        } else if (confirmAction.type === 'activate') {
                            handleActivate(confirmAction.userId);
                        }
                    }}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
}
