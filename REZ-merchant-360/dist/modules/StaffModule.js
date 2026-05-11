"use strict";
/**
 * StaffModule.ts - Staff & Team Management for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffModule = void 0;
const axios_1 = __importDefault(require("axios"));
class StaffModule {
    client;
    cache = new Map();
    cacheTTL = 300000; // 5 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.STAFF_SERVICE_URL || 'http://localhost:4006',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
    }
    /**
     * Get staff summary for a merchant
     */
    async getStaff(merchantId) {
        const cacheKey = `staff:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getStaffSummary(merchantId);
            const staff = {
                total: summary.total,
                admins: summary.admins,
                employees: summary.employees,
                roles: summary.roles,
                last_hire_date: summary.last_hire_date,
            };
            this.cache.set(cacheKey, { data: staff, timestamp: Date.now() });
            return staff;
        }
        catch (error) {
            console.error(`Failed to fetch staff for merchant ${merchantId}:`, error);
            return this.getDefaultStaff();
        }
    }
    /**
     * Get detailed staff summary
     */
    async getStaffSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch staff summary for merchant ${merchantId}:`, error);
            return this.getDefaultStaffSummary();
        }
    }
    /**
     * Get all staff members
     */
    async getMembers(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/members`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch staff members for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get single staff member
     */
    async getMember(merchantId, memberId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/members/${memberId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch staff member ${memberId}:`, error);
            return null;
        }
    }
    /**
     * Invite a new staff member
     */
    async inviteMember(merchantId, invite) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/staff/invite`, invite);
            this.cache.delete(`staff:${merchantId}`);
            return { success: true, member_id: response.data.member_id };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Invitation failed',
            };
        }
    }
    /**
     * Update staff member
     */
    async updateMember(merchantId, memberId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/staff/members/${memberId}`, updates);
            this.cache.delete(`staff:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update staff member:`, error);
            throw error;
        }
    }
    /**
     * Update staff member role
     */
    async updateMemberRole(merchantId, memberId, role, permissions) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/staff/members/${memberId}`, { role, permissions });
            this.cache.delete(`staff:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update member role:`, error);
            throw error;
        }
    }
    /**
     * Deactivate staff member
     */
    async deactivateMember(merchantId, memberId) {
        try {
            await this.client.patch(`/merchants/${merchantId}/staff/members/${memberId}`, { status: 'inactive' });
            this.cache.delete(`staff:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to deactivate staff member:`, error);
            return false;
        }
    }
    /**
     * Delete staff member
     */
    async deleteMember(merchantId, memberId) {
        try {
            await this.client.delete(`/merchants/${merchantId}/staff/members/${memberId}`);
            this.cache.delete(`staff:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete staff member:`, error);
            return false;
        }
    }
    /**
     * Get roles
     */
    async getRoles(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/roles`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch roles for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create role
     */
    async createRole(merchantId, role) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/staff/roles`, role);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create role:`, error);
            throw error;
        }
    }
    /**
     * Update role
     */
    async updateRole(merchantId, roleId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/staff/roles/${roleId}`, updates);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update role:`, error);
            throw error;
        }
    }
    /**
     * Delete role
     */
    async deleteRole(merchantId, roleId) {
        try {
            await this.client.delete(`/merchants/${merchantId}/staff/roles/${roleId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete role:`, error);
            return false;
        }
    }
    /**
     * Clock in
     */
    async clockIn(merchantId, memberId) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/staff/members/${memberId}/clock-in`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to clock in:`, error);
            throw error;
        }
    }
    /**
     * Clock out
     */
    async clockOut(merchantId, memberId, notes) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/staff/members/${memberId}/clock-out`, { notes });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to clock out:`, error);
            throw error;
        }
    }
    /**
     * Get time entries
     */
    async getTimeEntries(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/time-entries`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch time entries:`, error);
            return [];
        }
    }
    /**
     * Get schedule for date range
     */
    async getSchedule(merchantId, startDate, endDate, staffId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/staff/schedule`, { params: { start_date: startDate, end_date: endDate, staff_id: staffId } });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch schedule:`, error);
            return [];
        }
    }
    /**
     * Create/update schedule entry
     */
    async setSchedule(merchantId, schedule) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/staff/schedule`, schedule);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to set schedule:`, error);
            throw error;
        }
    }
    /**
     * Sync staff from external source
     */
    async syncStaff(merchantId, sourceData) {
        const current = await this.getStaff(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`staff:${merchantId}`);
        return updated;
    }
    getDefaultStaff() {
        return {
            total: 0,
            admins: 0,
            employees: 0,
        };
    }
    getDefaultStaffSummary() {
        return {
            total: 0,
            admins: 0,
            employees: 0,
            active: 0,
            invited: 0,
            inactive: 0,
            roles: {},
            by_department: {},
            by_employment_type: {},
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`staff:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.StaffModule = StaffModule;
//# sourceMappingURL=StaffModule.js.map