import { z } from 'zod';

// Login validation
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Role assignment validation
export const roleAssignmentSchema = z.object({
    role: z.enum(['SUPER_ADMIN', 'STATE_DIRECTOR', 'CITY_DIRECTOR', 'PRESIDENT', 'USER']),
    stateId: z.string().uuid().optional(),
    cityId: z.string().uuid().optional(),
});

export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>;

// Chapter creation validation
export const chapterCreationSchema = z.object({
    name: z.string().min(3, 'Chapter name must be at least 3 characters'),
    stateId: z.string().uuid(),
    cityId: z.string().uuid(),
});

export type ChapterCreationInput = z.infer<typeof chapterCreationSchema>;

// Add chapter member validation
export const addMemberSchema = z.object({
    userId: z.string().uuid(),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

// User filters validation
export const userFiltersSchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('20'),
    search: z.string().optional(),
    role: z.enum(['USER', 'PRESIDENT', 'CITY_DIRECTOR', 'STATE_DIRECTOR', 'SUPER_ADMIN']).optional(),
    stateId: z.string().uuid().optional(),
    cityId: z.string().uuid().optional(),
});

export type UserFiltersInput = z.infer<typeof userFiltersSchema>;

// Chapter Validation Schemas

export const createChapterSchema = z.object({
    name: z.string().min(3, 'Chapter name must be at least 3 characters').max(100, 'Chapter name must be at most 100 characters'),
    stateId: z.string().uuid('Invalid state ID'),
    cityId: z.string().uuid('Invalid city ID'),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;

export const assignPresidentSchema = z.object({
    userId: z.string().uuid('Invalid user ID'),
});

export type AssignPresidentInput = z.infer<typeof assignPresidentSchema>;

export const chapterFiltersSchema = z.object({
    page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
    limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).default('20'),
    search: z.string().optional(),
    stateId: z.string().uuid().optional(),
    cityId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type ChapterFiltersInput = z.infer<typeof chapterFiltersSchema>;
