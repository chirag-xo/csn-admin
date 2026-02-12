'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Chapter {
    id: string;
    name: string;
    state: { name: string } | null;
    city: { name: string } | null;
    memberCount: number;
    president: { firstName: string; lastName: string; email: string } | null;
    status: string;
}

interface State {
    id: string;
    name: string;
}

interface City {
    id: string;
    name: string;
}

export default function ChaptersPage() {
    const { session } = useAuth();
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        stateId: '',
        cityId: '',
    });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const canCreate = session && session.role !== 'PRESIDENT';
    const fetchChapters = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/chapters');
            const data = await res.json();

            if (res.ok) {
                setChapters(data.chapters);
            }
        } catch (error) {
            console.error('Failed to fetch chapters:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStates = async () => {
        try {
            const res = await fetch('/api/public/states');
            const data = await res.json();
            if (res.ok) {
                setStates(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch states:', error);
        }
    };

    const fetchCities = async (stateId: string) => {
        try {
            const res = await fetch(`/api/public/cities?stateId=${stateId}`);
            const data = await res.json();
            if (res.ok) {
                setCities(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
        }
    };

    useEffect(() => {
        fetchChapters();
        fetchStates();
    }, []);

    useEffect(() => {
        if (formData.stateId) {
            fetchCities(formData.stateId);
        } else {
            setCities([]);
        }
    }, [formData.stateId]);

    // Handle state change: reset city
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStateId = e.target.value;
        setFormData(prev => ({ ...prev, stateId: newStateId, cityId: '' }));
    };

    const handleCreateChapter = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setCreating(true);

        try {
            const res = await fetch('/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                setShowCreateModal(false);
                setFormData({ name: '', stateId: '', cityId: '' });
                fetchChapters();
            } else {
                setError(data.error || 'Failed to create chapter');
            }
        } catch (error) {
            setError('Network error');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteChapter = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/chapters/${confirmDelete.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                fetchChapters();
                setConfirmDelete(null);
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


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Chapters</h1>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                    >
                        + Create Chapter
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="card overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Chapter Name</th>
                                <th>State</th>
                                <th>City</th>
                                <th>Members</th>
                                <th>President</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chapters.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center text-gray-500 py-8">
                                        No chapters found
                                    </td>
                                </tr>
                            ) : (
                                chapters.map((chapter) => (
                                    <tr key={chapter.id}>
                                        <td className="font-medium">{chapter.name}</td>
                                        <td>{chapter.state?.name || 'N/A'}</td>
                                        <td>{chapter.city?.name || 'N/A'}</td>
                                        <td>{chapter.memberCount}</td>
                                        <td>
                                            {chapter.president ? (
                                                <div>
                                                    <div className="font-medium">
                                                        {chapter.president.firstName} {chapter.president.lastName}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {chapter.president.email}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">Not assigned</span>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${chapter.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                {chapter.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-3">
                                                <Link
                                                    href={`/dashboard/chapters/${chapter.id}`}
                                                    className="text-blue-600 hover:underline text-sm"
                                                >
                                                    View Details
                                                </Link>
                                                {canCreate && (
                                                    <button
                                                        onClick={() => setConfirmDelete({ id: chapter.id, name: chapter.name })}
                                                        className="text-red-600 hover:underline text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Chapter Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Create New Chapter</h2>

                        <form onSubmit={handleCreateChapter} className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Chapter Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    className="input w-full"
                                    required
                                    minLength={3}
                                    maxLength={100}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    State *
                                </label>
                                <select
                                    value={formData.stateId}
                                    onChange={handleStateChange}
                                    className="input w-full"
                                    required
                                >
                                    <option value="">Select State</option>
                                    {states.map((state) => (
                                        <option key={state.id} value={state.id}>
                                            {state.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    City *
                                </label>
                                <select
                                    value={formData.cityId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, cityId: e.target.value })
                                    }
                                    className="input w-full"
                                    required
                                    disabled={!formData.stateId}
                                >
                                    <option value="">Select City</option>
                                    {cities.map((city) => (
                                        <option key={city.id} value={city.id}>
                                            {city.name}
                                        </option>
                                    ))}
                                </select>
                                {!formData.stateId && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Select a state first
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData({ name: '', stateId: '', cityId: '' });
                                        setError('');
                                    }}
                                    className="btn btn-secondary flex-1"
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary flex-1"
                                    disabled={creating}
                                >
                                    {creating ? 'Creating...' : 'Create Chapter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmDelete && (
                <ConfirmDialog
                    title={`Delete Chapter: ${confirmDelete.name}?`}
                    message="Are you sure you want to delete this chapter? This will remove all members and disassociate the chapter from users and events. This action cannot be undone."
                    confirmVariant="danger"
                    loading={deleting}
                    onConfirm={handleDeleteChapter}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
}
