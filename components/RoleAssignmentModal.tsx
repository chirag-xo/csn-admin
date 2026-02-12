'use client';

import { useState, useEffect } from 'react';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    stateId?: string;
    cityId?: string;
}

interface State {
    id: string;
    name: string;
    code: string;
}

interface City {
    id: string;
    name: string;
}

interface Props {
    user: User;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RoleAssignmentModal({ user, onClose, onSuccess }: Props) {
    const [role, setRole] = useState(user.role);
    const [stateId, setStateId] = useState(user.stateId || '');
    const [cityId, setCityId] = useState(user.cityId || '');
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/states')
            .then((res) => res.json())
            .then((data) => setStates(data.states));
    }, []);

    useEffect(() => {
        if (stateId) {
            fetch(`/api/cities?stateId=${stateId}`)
                .then((res) => res.json())
                .then((data) => setCities(data.cities));
        } else {
            setCities([]);
            setCityId('');
        }
    }, [stateId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`/api/users/${user.id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    ...(stateId && { stateId }),
                    ...(cityId && { cityId }),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to assign role');
                setLoading(false);
                return;
            }

            onSuccess();
        } catch (err) {
            setError('Network error');
            setLoading(false);
        }
    };

    const requiresState = ['STATE_DIRECTOR', 'CITY_DIRECTOR'].includes(role);
    const requiresCity = role === 'CITY_DIRECTOR';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Assign Role</h2>
                <p className="text-sm text-gray-600 mb-4">
                    User: {user.name} ({user.email})
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="input"
                            required
                        >
                            <option value="USER">User</option>
                            <option value="PRESIDENT">President</option>
                            <option value="CITY_DIRECTOR">City Director</option>
                            <option value="STATE_DIRECTOR">State Director</option>
                            <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                    </div>

                    {requiresState && (
                        <div>
                            <label className="block text-sm font-medium mb-1">State</label>
                            <select
                                value={stateId}
                                onChange={(e) => setStateId(e.target.value)}
                                className="input"
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
                    )}

                    {requiresCity && (
                        <div>
                            <label className="block text-sm font-medium mb-1">City</label>
                            <select
                                value={cityId}
                                onChange={(e) => setCityId(e.target.value)}
                                className="input"
                                required
                                disabled={!stateId}
                            >
                                <option value="">Select City</option>
                                {cities.map((city) => (
                                    <option key={city.id} value={city.id}>
                                        {city.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Assigning...' : 'Assign Role'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
