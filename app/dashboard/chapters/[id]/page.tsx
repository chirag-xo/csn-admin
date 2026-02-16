'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRouter } from 'next/navigation';

interface Chapter {
    id: string;
    name: string;
    stateId: string;
    cityId: string;
    status: string;
    createdAt: string;
    state: { name: string } | null;
    city: { name: string } | null;
    president: { id: string; name: string; email: string } | null;
    _count: {
        members: number;
        joinRequests: number;
    };
}

interface Member {
    id: string; // Membership ID
    user: {
        id: string;
        name: string;
        email?: string;
    };
    joinedAt: string;
    role: string;
}

interface JoinRequest {
    id: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
    createdAt: string;
}

export default function ChapterDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { session } = useAuth();
    const router = useRouter();
    const { id } = use(params);
    const [chapter, setChapter] = useState<Chapter | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Members State
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [membersPage, setMembersPage] = useState(1);
    const [membersTotal, setMembersTotal] = useState(0);
    const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
    const [removing, setRemoving] = useState(false);

    // Requests State
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(false);

    // Assign President State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState('');
    const [assigning, setAssigning] = useState(false);

    // Add Member State
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [addingMember, setAddingMember] = useState(false);

    // Manage Role State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [roleMember, setRoleMember] = useState<Member | null>(null);
    const [newRole, setNewRole] = useState('');
    const [updatingRole, setUpdatingRole] = useState(false);

    // Initial Fetch
    useEffect(() => {
        fetchChapter();
    }, [id]);

    // Fetch Members when page changes or chapter loads
    useEffect(() => {
        if (chapter) {
            fetchMembers();
        }
    }, [chapter, membersPage]);

    // Fetch Requests if allowed
    useEffect(() => {
        if (chapter && canViewRequests()) {
            fetchRequests();
        }
    }, [chapter]);

    const fetchChapter = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/chapters/${id}`);
            if (res.ok) {
                const data = await res.json();
                setChapter(data);
            } else {
                setError('Failed to load chapter');
            }
        } catch (error) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        setMembersLoading(true);
        try {
            const res = await fetch(`/api/chapters/${id}/members?page=${membersPage}&limit=20`);
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members);
                setMembersTotal(data.totalPages);
            }
        } catch (error) {
            console.error('Failed to fetch members');
        } finally {
            setMembersLoading(false);
        }
    };

    const fetchRequests = async () => {
        setRequestsLoading(true);
        try {
            const res = await fetch(`/api/chapters/${id}/requests`);
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error('Failed to fetch requests');
        } finally {
            setRequestsLoading(false);
        }
    };

    const handleRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
        try {
            const res = await fetch(`/api/chapters/requests/${requestId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            if (res.ok) {
                // Refresh data
                fetchRequests();
                fetchMembers(); // Update members if approved
                fetchChapter(); // Update counts
            } else {
                alert('Action failed');
            }
        } catch (error) {
            alert('Network error');
        }
    };

    const handleAssignPresident = async () => {
        if (!selectedMember) return;
        setAssigning(true);
        try {
            const res = await fetch(`/api/chapters/${id}/assign-president`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: selectedMember }),
            });

            if (res.ok) {
                setShowAssignModal(false);
                fetchChapter();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to assign president');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setAssigning(false);
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            }
        } catch (error) {
            console.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        setAddingMember(true);
        try {
            const res = await fetch(`/api/chapters/${id}/members/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            if (res.ok) {
                setShowAddMemberModal(false);
                setSearchQuery('');
                setSearchResults([]);
                fetchMembers();
                fetchChapter(); // Update counts
                alert('Member added successfully');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to add member');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setAddingMember(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/chapters/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.push('/dashboard/chapters');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete chapter');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setDeleting(false);
        }
    };
    // Helper to determine if user can see requests/assign president
    const canViewRequests = () => {
        if (!session) return false;
        return true; // Let API handle scoping
    };

    const canManageChapter = () => {
        if (!session) return false;
        // Super Admin, State Director, City Director
        // Super Admin, State Director, City Director
        return ['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT'].includes(session.role);
    };

    const isActiveUser = (memberRole: string) => {
        return ['VICE_PRESIDENT', 'SECRETARY'].includes(memberRole);
    }

    const handleUpdateRole = async () => {
        if (!roleMember || !newRole) return;
        setUpdatingRole(true);
        try {
            const res = await fetch(`/api/chapters/${id}/assign-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: roleMember.user.id, role: newRole }),
            });

            if (res.ok) {
                setShowRoleModal(false);
                setRoleMember(null);
                setNewRole('');
                fetchMembers();
                fetchChapter(); // Refresh counts/president if changed
                alert('Role updated successfully');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update role');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setUpdatingRole(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!removeMemberId) return;
        setRemoving(true);
        try {
            const res = await fetch(`/api/chapters/${id}/members/${removeMemberId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                setRemoveMemberId(null);
                fetchMembers(); // Refresh list
                fetchChapter(); // Refresh count
                alert('Member removed successfully');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove member');
            }
        } catch (error) {
            alert('Network error');
        } finally {
            setRemoving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (error || !chapter) return <div className="p-8 text-center text-red-600">{error || 'Chapter not found'}</div>;

    const pendingRequestsCount = chapter._count?.joinRequests || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/chapters" className="text-gray-500 hover:text-gray-700">
                    ← Back to Chapters
                </Link>
                <h1 className="text-2xl font-bold">{chapter.name}</h1>
                <div className="flex-1" />
                {canManageChapter() && (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border-none"
                    >
                        Delete Chapter
                    </button>
                )}
            </div>

            {/* Chapter Overview Card */}
            <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
                <div>
                    <div className="text-sm text-gray-500">State/City</div>
                    <div className="font-medium">
                        {chapter.state?.name || 'N/A'}, {chapter.city?.name || 'N/A'}
                    </div>
                </div>
                <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <div>
                        <span className={`px-2 py-1 rounded text-xs ${chapter.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {chapter.status}
                        </span>
                    </div>
                </div>
                <div>
                    <div className="text-sm text-gray-500">President</div>
                    <div className="font-medium">
                        {chapter.president ? (
                            <div>
                                {chapter.president.name}
                                <div className="text-xs text-gray-400">{chapter.president.email}</div>
                            </div>
                        ) : (
                            <span className="text-gray-400">Not Assigned</span>
                        )}
                    </div>
                </div>
                <div>
                    <div className="text-sm text-gray-500">Members</div>
                    <div className="font-medium text-lg">{chapter._count.members}</div>
                </div>
            </div>

            {/* Pending Requests Section - Always try to render, let API handle error/empty */}
            <div className="card p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    Pending Join Requests
                    {pendingRequestsCount > 0 && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                            {pendingRequestsCount}
                        </span>
                    )}
                </h2>

                {requestsLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div className="text-gray-500 text-sm">No pending requests</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Requested At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(req => (
                                    <tr key={req.id}>
                                        <td className="font-medium">{req.user.name}</td>
                                        <td>{req.user.email}</td>
                                        <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                                        <td className="flex gap-2">
                                            <button
                                                onClick={() => handleRequestAction(req.id, 'APPROVE')}
                                                className="btn btn-sm text-green-600 bg-green-50 hover:bg-green-100 border-none"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleRequestAction(req.id, 'REJECT')}
                                                className="btn text-red-600 bg-red-50 hover:bg-red-100 border-none btn-sm"
                                            >
                                                Reject
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Members Section */}
            <div className="card p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Members</h2>
                    <div className="flex gap-2">
                        {canManageChapter() && (
                            <button
                                onClick={() => setShowAddMemberModal(true)}
                                className="btn btn-primary btn-sm"
                            >
                                + Add Member
                            </button>
                        )}
                        {canManageChapter() && (
                            <button
                                onClick={() => setShowAssignModal(true)}
                                className="btn btn-secondary btn-sm"
                            >
                                Assign/Change President
                            </button>
                        )}
                    </div>
                </div>

                {membersLoading ? (
                    <div className="text-center py-8">Loading members...</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Joined At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-8 text-gray-500">No members found</td>
                                        </tr>
                                    ) : (
                                        members.map(member => (
                                            <tr key={member.id}>
                                                <td className="font-medium">{member.user.name}</td>
                                                <td>{member.user.email}</td>
                                                <td>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${member.role === 'PRESIDENT' ? 'bg-purple-100 text-purple-800' :
                                                        member.role === 'VICE_PRESIDENT' ? 'bg-blue-100 text-blue-800' :
                                                            member.role === 'SECRETARY' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {member.role === 'MEMBER' ? 'Member' : member.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        {canManageChapter() && member.role !== 'PRESIDENT' && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setRoleMember(member);
                                                                        setNewRole(member.role === 'MEMBER' ? 'VICE_PRESIDENT' : member.role);
                                                                        setShowRoleModal(true);
                                                                    }}
                                                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                                >
                                                                    Manage Role
                                                                </button>
                                                                <button
                                                                    onClick={() => setRemoveMemberId(member.id)}
                                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                                    title="Remove Member"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                                                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                                                                    </svg>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {membersTotal > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <button
                                    onClick={() => setMembersPage(p => Math.max(1, p - 1))}
                                    disabled={membersPage === 1}
                                    className="btn btn-sm btn-secondary"
                                >
                                    Previous
                                </button>
                                <span className="text-sm flex items-center">
                                    Page {membersPage} of {membersTotal}
                                </span>
                                <button
                                    onClick={() => setMembersPage(p => Math.min(membersTotal, p + 1))}
                                    disabled={membersPage === membersTotal}
                                    className="btn btn-sm btn-secondary"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Assign President Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Assign President</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Select Member</label>
                            <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Select a member...</option>
                                {members.map(m => (
                                    <option key={m.user.id} value={m.user.id}>
                                        {m.user.name} ({m.user.email})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Only existing members can be assigned as president.
                            </p>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setSelectedMember('');
                                }}
                                className="btn btn-secondary"
                                disabled={assigning}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignPresident}
                                className="btn btn-primary"
                                disabled={!selectedMember || assigning}
                            >
                                {assigning ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Add New Member</h3>
                            <button
                                onClick={() => setShowAddMemberModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mb-4">
                            <input
                                type="text"
                                placeholder="Search users by name or email..."
                                className="input w-full"
                                value={searchQuery}
                                onChange={(e) => handleSearchUsers(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="max-h-60 overflow-y-auto border rounded-md">
                            {searching ? (
                                <div className="p-4 text-center text-gray-500">Searching...</div>
                            ) : searchResults.length > 0 ? (
                                <ul className="divide-y">
                                    {searchResults.map(user => (
                                        <li key={user.id} className="p-3 hover:bg-gray-50 flex justify-between items-center">
                                            <div>
                                                <div className="font-medium">{user.firstName} {user.lastName}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                            <button
                                                onClick={() => handleAddMember(user.id)}
                                                disabled={addingMember}
                                                className="btn btn-sm btn-primary"
                                            >
                                                {addingMember ? 'Adding...' : 'Add'}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : searchQuery.length >= 2 ? (
                                <div className="p-4 text-center text-gray-500">No eligible users found.</div>
                            ) : (
                                <div className="p-4 text-center text-gray-400">Type to search users...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title={`Delete Chapter: ${chapter.name}?`}
                    message="Are you sure you want to delete this chapter? This will remove all members and disassociate the chapter from users and events. This action cannot be undone."
                    confirmVariant="danger"
                    loading={deleting}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}

            {removeMemberId && (
                <ConfirmDialog
                    title="Remove Member?"
                    message="Are you sure you want to remove this member? This action cannot be undone."
                    confirmVariant="danger"
                    loading={removing}
                    onConfirm={handleRemoveMember}
                    onCancel={() => setRemoveMemberId(null)}
                />
            )}

            {/* Manage Role Modal */}
            {showRoleModal && roleMember && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Manage Role</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Assigning role for <strong>{roleMember.user.name}</strong>
                        </p>

                        <div className="space-y-3">
                            <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="role"
                                    value="VICE_PRESIDENT"
                                    checked={newRole === 'VICE_PRESIDENT'}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="font-medium">Vice President</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="role"
                                    value="SECRETARY"
                                    checked={newRole === 'SECRETARY'}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="font-medium">Secretary</span>
                            </label>

                            <label className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="role"
                                    value="USER"
                                    checked={newRole === 'USER'}
                                    onChange={(e) => setNewRole(e.target.value)}
                                    className="radio radio-primary radio-sm"
                                />
                                <span className="font-medium">Member (User)</span>
                            </label>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <button
                                onClick={() => {
                                    setShowRoleModal(false);
                                    setRoleMember(null);
                                }}
                                className="btn btn-secondary btn-sm"
                                disabled={updatingRole}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateRole}
                                className="btn btn-primary btn-sm"
                                disabled={!newRole || updatingRole}
                            >
                                {updatingRole ? 'Saving...' : 'Save Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
