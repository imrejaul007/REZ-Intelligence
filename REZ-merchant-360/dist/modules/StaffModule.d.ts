/**
 * StaffModule.ts - Staff & Team Management for Merchant360
 */
import { Staff } from '../MerchantProfile';
export interface StaffMember {
    id: string;
    merchant_id: string;
    user_id?: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
    phone?: string;
    role: string;
    permissions: string[];
    status: 'active' | 'invited' | 'inactive' | 'pending';
    avatar_url?: string;
    is_owner: boolean;
    last_login_at?: string;
    hire_date?: string;
    department?: string;
    position?: string;
    employment_type: 'full_time' | 'part_time' | 'contractor' | 'intern';
    hourly_rate?: number;
    created_at: string;
    updated_at: string;
}
export interface Role {
    id: string;
    merchant_id: string;
    name: string;
    description: string;
    permissions: string[];
    is_system: boolean;
    member_count: number;
    created_at: string;
    updated_at: string;
}
export interface StaffSummary {
    total: number;
    admins: number;
    employees: number;
    active: number;
    invited: number;
    inactive: number;
    roles: Record<string, number>;
    by_department: Record<string, number>;
    by_employment_type: Record<string, number>;
    last_hire_date?: string;
    last_login?: string;
}
export interface TimeEntry {
    id: string;
    staff_id: string;
    clock_in: string;
    clock_out?: string;
    duration_minutes?: number;
    breaks: {
        start: string;
        end?: string;
    }[];
    notes?: string;
    status: 'active' | 'completed' | 'edited';
    created_at: string;
}
export interface Schedule {
    id: string;
    staff_id: string;
    date: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    is_confirmed: boolean;
    notes?: string;
    created_at: string;
    updated_at: string;
}
export declare class StaffModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get staff summary for a merchant
     */
    getStaff(merchantId: string): Promise<Staff>;
    /**
     * Get detailed staff summary
     */
    getStaffSummary(merchantId: string): Promise<StaffSummary>;
    /**
     * Get all staff members
     */
    getMembers(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        status?: StaffMember['status'];
        role?: string;
        department?: string;
        search?: string;
        sort_by?: 'name' | 'role' | 'hire_date' | 'last_login';
        sort_order?: 'asc' | 'desc';
    }): Promise<StaffMember[]>;
    /**
     * Get single staff member
     */
    getMember(merchantId: string, memberId: string): Promise<StaffMember | null>;
    /**
     * Invite a new staff member
     */
    inviteMember(merchantId: string, invite: {
        email: string;
        first_name: string;
        last_name: string;
        role: string;
        permissions?: string[];
        department?: string;
        position?: string;
        employment_type?: StaffMember['employment_type'];
    }): Promise<{
        success: boolean;
        member_id?: string;
        error?: string;
    }>;
    /**
     * Update staff member
     */
    updateMember(merchantId: string, memberId: string, updates: Partial<StaffMember>): Promise<StaffMember>;
    /**
     * Update staff member role
     */
    updateMemberRole(merchantId: string, memberId: string, role: string, permissions: string[]): Promise<StaffMember>;
    /**
     * Deactivate staff member
     */
    deactivateMember(merchantId: string, memberId: string): Promise<boolean>;
    /**
     * Delete staff member
     */
    deleteMember(merchantId: string, memberId: string): Promise<boolean>;
    /**
     * Get roles
     */
    getRoles(merchantId: string): Promise<Role[]>;
    /**
     * Create role
     */
    createRole(merchantId: string, role: {
        name: string;
        description: string;
        permissions: string[];
    }): Promise<Role>;
    /**
     * Update role
     */
    updateRole(merchantId: string, roleId: string, updates: Partial<Role>): Promise<Role>;
    /**
     * Delete role
     */
    deleteRole(merchantId: string, roleId: string): Promise<boolean>;
    /**
     * Clock in
     */
    clockIn(merchantId: string, memberId: string): Promise<TimeEntry>;
    /**
     * Clock out
     */
    clockOut(merchantId: string, memberId: string, notes?: string): Promise<TimeEntry>;
    /**
     * Get time entries
     */
    getTimeEntries(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        staff_id?: string;
        from_date?: string;
        to_date?: string;
        status?: TimeEntry['status'];
    }): Promise<TimeEntry[]>;
    /**
     * Get schedule for date range
     */
    getSchedule(merchantId: string, startDate: string, endDate: string, staffId?: string): Promise<Schedule[]>;
    /**
     * Create/update schedule entry
     */
    setSchedule(merchantId: string, schedule: Partial<Schedule> & {
        staff_id: string;
        date: string;
        start_time: string;
        end_time: string;
    }): Promise<Schedule>;
    /**
     * Sync staff from external source
     */
    syncStaff(merchantId: string, sourceData: Partial<Staff>): Promise<Staff>;
    private getDefaultStaff;
    private getDefaultStaffSummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=StaffModule.d.ts.map