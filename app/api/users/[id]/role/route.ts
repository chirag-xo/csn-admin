import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/session';
import { canAssignRole } from '@/lib/permissions';
import { roleAssignmentSchema } from '@/lib/validations';
import { logAudit } from '@/lib/audit';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        // Authenticate
        const session = await requireAuth();

        // Parse body
        const body = await request.json();
        const validation = roleAssignmentSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.errors },
                { status: 400 }
            );
        }

        const { role, stateId, cityId } = validation.data;

        // Get target user from unified DB
        const targetUser = await db.user.findUnique({
            where: { id },
        });

        if (!targetUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check permission
        if (!canAssignRole(session, role, targetUser)) {
            return NextResponse.json(
                { error: 'Forbidden: cannot assign this role to this user' },
                { status: 403 }
            );
        }

        // Validate state/city requirements
        if (role === 'STATE_DIRECTOR' && !stateId) {
            return NextResponse.json(
                { error: 'State is required for STATE_DIRECTOR role' },
                { status: 400 }
            );
        }

        if (stateId) {
            const stateExists = await db.state.findUnique({ where: { id: stateId } });
            if (!stateExists) {
                return NextResponse.json({ error: 'Invalid state ID' }, { status: 400 });
            }
        }

        if (['CITY_DIRECTOR', 'PRESIDENT'].includes(role) && (!stateId || !cityId)) {
            return NextResponse.json(
                { error: `State and city are required for ${role} role` },
                { status: 400 }
            );
        }

        if (cityId) {
            const cityExists = await db.city.findUnique({ where: { id: cityId } });
            if (!cityExists) {
                return NextResponse.json({ error: 'Invalid city ID' }, { status: 400 });
            }
        }

        // Update user role in unified DB
        const updatedUser = await db.user.update({
            where: { id },
            data: {
                role,
                stateId: stateId || null,
                cityId: cityId || null,
            },
        });

        // Fetch State/City details from unified DB for response
        let state = null;
        let city = null;

        if (updatedUser.stateId) {
            state = await db.state.findUnique({ where: { id: updatedUser.stateId } });
        }
        if (updatedUser.cityId) {
            city = await db.city.findUnique({ where: { id: updatedUser.cityId } });
        }

        // Log audit (Audit log is now in unified DB)
        await logAudit({
            action: 'ROLE_ASSIGNED',
            performedBy: session.userId,
            targetUser: id,
            details: JSON.stringify({
                oldRole: targetUser.role,
                newRole: role,
                stateId,
                cityId,
            }),
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;
        const enrichedUser = {
            ...userWithoutPassword,
            name: `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.email,
            state,
            city,
        };

        return NextResponse.json({
            user: enrichedUser,
            message: 'Role assigned successfully',
        });
    } catch (error: any) {
        console.error('Role assignment error:', error);

        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
