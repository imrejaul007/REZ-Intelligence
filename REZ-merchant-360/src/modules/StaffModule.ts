/**
 * StaffModule.ts - Staff & Team Management for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
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
  breaks: { start: string; end?: string }[];
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

export class StaffModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Staff; timestamp: number }> = new Map();
  private cacheTTL: number = 300000; // 5 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.STAFF_SERVICE_URL || 'http://localhost:4006',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get staff summary for a merchant
   */
  async getStaff(merchantId: string): Promise<Staff> {
    const cacheKey = `staff:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getStaffSummary(merchantId);

      const staff: Staff = {
        total: summary.total,
        admins: summary.admins,
        employees: summary.employees,
        roles: summary.roles,
        last_hire_date: summary.last_hire_date,
      };

      this.cache.set(cacheKey, { data: staff, timestamp: Date.now() });
      return staff;
    } catch (error) {
      console.error(`Failed to fetch staff for merchant ${merchantId}:`, error);
      return this.getDefaultStaff();
    }
  }

  /**
   * Get detailed staff summary
   */
  async getStaffSummary(merchantId: string): Promise<StaffSummary> {
    try {
      const response = await this.client.get<StaffSummary>(
        `/merchants/${merchantId}/staff/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch staff summary for merchant ${merchantId}:`, error);
      return this.getDefaultStaffSummary();
    }
  }

  /**
   * Get all staff members
   */
  async getMembers(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: StaffMember['status'];
      role?: string;
      department?: string;
      search?: string;
      sort_by?: 'name' | 'role' | 'hire_date' | 'last_login';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<StaffMember[]> {
    try {
      const response = await this.client.get<StaffMember[]>(
        `/merchants/${merchantId}/staff/members`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch staff members for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get single staff member
   */
  async getMember(merchantId: string, memberId: string): Promise<StaffMember | null> {
    try {
      const response = await this.client.get<StaffMember>(
        `/merchants/${merchantId}/staff/members/${memberId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch staff member ${memberId}:`, error);
      return null;
    }
  }

  /**
   * Invite a new staff member
   */
  async inviteMember(
    merchantId: string,
    invite: {
      email: string;
      first_name: string;
      last_name: string;
      role: string;
      permissions?: string[];
      department?: string;
      position?: string;
      employment_type?: StaffMember['employment_type'];
    }
  ): Promise<{ success: boolean; member_id?: string; error?: string }> {
    try {
      const response = await this.client.post<{ member_id: string }>(
        `/merchants/${merchantId}/staff/invite`,
        invite
      );
      this.cache.delete(`staff:${merchantId}`);
      return { success: true, member_id: response.data.member_id };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Invitation failed',
      };
    }
  }

  /**
   * Update staff member
   */
  async updateMember(
    merchantId: string,
    memberId: string,
    updates: Partial<StaffMember>
  ): Promise<StaffMember> {
    try {
      const response = await this.client.patch<StaffMember>(
        `/merchants/${merchantId}/staff/members/${memberId}`,
        updates
      );
      this.cache.delete(`staff:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update staff member:`, error);
      throw error;
    }
  }

  /**
   * Update staff member role
   */
  async updateMemberRole(
    merchantId: string,
    memberId: string,
    role: string,
    permissions: string[]
  ): Promise<StaffMember> {
    try {
      const response = await this.client.patch<StaffMember>(
        `/merchants/${merchantId}/staff/members/${memberId}`,
        { role, permissions }
      );
      this.cache.delete(`staff:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update member role:`, error);
      throw error;
    }
  }

  /**
   * Deactivate staff member
   */
  async deactivateMember(merchantId: string, memberId: string): Promise<boolean> {
    try {
      await this.client.patch(
        `/merchants/${merchantId}/staff/members/${memberId}`,
        { status: 'inactive' }
      );
      this.cache.delete(`staff:${merchantId}`);
      return true;
    } catch (error) {
      console.error(`Failed to deactivate staff member:`, error);
      return false;
    }
  }

  /**
   * Delete staff member
   */
  async deleteMember(merchantId: string, memberId: string): Promise<boolean> {
    try {
      await this.client.delete(`/merchants/${merchantId}/staff/members/${memberId}`);
      this.cache.delete(`staff:${merchantId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete staff member:`, error);
      return false;
    }
  }

  /**
   * Get roles
   */
  async getRoles(merchantId: string): Promise<Role[]> {
    try {
      const response = await this.client.get<Role[]>(
        `/merchants/${merchantId}/staff/roles`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch roles for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create role
   */
  async createRole(
    merchantId: string,
    role: { name: string; description: string; permissions: string[] }
  ): Promise<Role> {
    try {
      const response = await this.client.post<Role>(
        `/merchants/${merchantId}/staff/roles`,
        role
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create role:`, error);
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(
    merchantId: string,
    roleId: string,
    updates: Partial<Role>
  ): Promise<Role> {
    try {
      const response = await this.client.patch<Role>(
        `/merchants/${merchantId}/staff/roles/${roleId}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to update role:`, error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(merchantId: string, roleId: string): Promise<boolean> {
    try {
      await this.client.delete(`/merchants/${merchantId}/staff/roles/${roleId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete role:`, error);
      return false;
    }
  }

  /**
   * Clock in
   */
  async clockIn(merchantId: string, memberId: string): Promise<TimeEntry> {
    try {
      const response = await this.client.post<TimeEntry>(
        `/merchants/${merchantId}/staff/members/${memberId}/clock-in`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to clock in:`, error);
      throw error;
    }
  }

  /**
   * Clock out
   */
  async clockOut(
    merchantId: string,
    memberId: string,
    notes?: string
  ): Promise<TimeEntry> {
    try {
      const response = await this.client.post<TimeEntry>(
        `/merchants/${merchantId}/staff/members/${memberId}/clock-out`,
        { notes }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to clock out:`, error);
      throw error;
    }
  }

  /**
   * Get time entries
   */
  async getTimeEntries(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      staff_id?: string;
      from_date?: string;
      to_date?: string;
      status?: TimeEntry['status'];
    } = {}
  ): Promise<TimeEntry[]> {
    try {
      const response = await this.client.get<TimeEntry[]>(
        `/merchants/${merchantId}/staff/time-entries`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch time entries:`, error);
      return [];
    }
  }

  /**
   * Get schedule for date range
   */
  async getSchedule(
    merchantId: string,
    startDate: string,
    endDate: string,
    staffId?: string
  ): Promise<Schedule[]> {
    try {
      const response = await this.client.get<Schedule[]>(
        `/merchants/${merchantId}/staff/schedule`,
        { params: { start_date: startDate, end_date: endDate, staff_id: staffId } }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch schedule:`, error);
      return [];
    }
  }

  /**
   * Create/update schedule entry
   */
  async setSchedule(
    merchantId: string,
    schedule: Partial<Schedule> & { staff_id: string; date: string; start_time: string; end_time: string }
  ): Promise<Schedule> {
    try {
      const response = await this.client.post<Schedule>(
        `/merchants/${merchantId}/staff/schedule`,
        schedule
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to set schedule:`, error);
      throw error;
    }
  }

  /**
   * Sync staff from external source
   */
  async syncStaff(merchantId: string, sourceData: Partial<Staff>): Promise<Staff> {
    const current = await this.getStaff(merchantId);
    const updated: Staff = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`staff:${merchantId}`);
    return updated;
  }

  private getDefaultStaff(): Staff {
    return {
      total: 0,
      admins: 0,
      employees: 0,
    };
  }

  private getDefaultStaffSummary(): StaffSummary {
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

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`staff:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
