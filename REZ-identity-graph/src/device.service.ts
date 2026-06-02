import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
import {
  Device,
  IDevice,
  IDeviceFingerprint,
  DeviceType,
  DeviceStatus
} from './models/device.model';
import { logger } from './utils/logger';

export interface DeviceFingerprintOptions {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  colorDepth?: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  touchPoints?: number;
  webGLVendor?: string;
  webGLRenderer?: string;
}

export interface CreateDeviceOptions {
  fingerprint: DeviceFingerprintOptions;
  ipAddress?: string;
  clusterId?: string;
  metadata?: Partial<IDevice['metadata']>;
}

export interface DeviceRiskAssessment {
  riskScore: number;
  riskFlags: string[];
  isSuspicious: boolean;
  recommendations: string[];
}

export class DeviceService {
  private calculateFingerprintHash(fingerprint: DeviceFingerprintOptions): string {
    const components = [
      fingerprint.userAgent,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.platform,
      fingerprint.webGLVendor,
      fingerprint.webGLRenderer
    ].filter(Boolean);

    return CryptoJS.SHA256(components.join('|')).toString();
  }

  private determineDeviceType(userAgent: string): DeviceType {
    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return DeviceType.MOBILE;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return DeviceType.TABLET;
    }
    if (ua.includes('web') || ua.includes('electron')) {
      return DeviceType.WEB;
    }
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return DeviceType.UNKNOWN;
    }
    if (
      ua.includes('windows') ||
      ua.includes('macintosh') ||
      ua.includes('linux') ||
      ua.includes('ubuntu')
    ) {
      return DeviceType.DESKTOP;
    }

    return DeviceType.UNKNOWN;
  }

  async createOrUpdateDevice(options: CreateDeviceOptions): Promise<IDevice> {
    const { fingerprint, ipAddress, clusterId, metadata } = options;

    const fingerprintHash = this.calculateFingerprintHash(fingerprint);
    const deviceType = this.determineDeviceType(fingerprint.userAgent);
    const now = new Date();

    let device = await Device.findOne({ fingerprintHash });

    if (device) {
      device.fingerprints.push(fingerprint);
      device.metadata.lastSeenAt = now;
      device.metadata.lastIpAddress = ipAddress || device.metadata.lastIpAddress;
      device.metadata.lastUserAgent = fingerprint.userAgent;
      device.metadata.sessionCount = (device.metadata.sessionCount || 0) + 1;

      if (metadata) {
        device.metadata = { ...device.metadata, ...metadata };
      }

      if (clusterId && !device.clusterId) {
        device.clusterId = clusterId;
      }

      await device.save();

      logger.info('Device updated', {
        deviceId: device.deviceId,
        fingerprintHash
      });

      return device;
    }

    const deviceId = uuidv4();

    device = new Device({
      deviceId,
      fingerprintHash,
      type: deviceType,
      status: DeviceStatus.ACTIVE,
      clusterId,
      fingerprints: [fingerprint],
      metadata: {
        firstSeenAt: now,
        lastSeenAt: now,
        sessionCount: 1,
        lastIpAddress: ipAddress,
        lastUserAgent: fingerprint.userAgent,
        ...metadata
      },
      linkedIdentities: [],
      privacySettings: {
        trackingEnabled: true
      },
      riskScore: 0,
      riskFlags: []
    });

    await device.save();

    logger.info('Device created', {
      deviceId,
      type: deviceType,
      fingerprintHash
    });

    return device;
  }

  async getDevice(deviceId: string): Promise<IDevice | null> {
    return Device.findOne({ deviceId });
  }

  async getDeviceByFingerprint(fingerprint: DeviceFingerprintOptions): Promise<IDevice | null> {
    const fingerprintHash = this.calculateFingerprintHash(fingerprint);
    return Device.findOne({ fingerprintHash });
  }

  async linkIdentityToDevice(
    deviceId: string,
    identityId: string,
    linkType: string = 'user_action'
  ): Promise<boolean> {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return false;
    }

    const existingLink = device.linkedIdentities.find(
      (link) => link.identityId === identityId
    );

    if (!existingLink) {
      device.linkedIdentities.push({
        identityId,
        linkedAt: new Date(),
        linkType
      });
      await device.save();

      logger.info('Identity linked to device', {
        deviceId,
        identityId,
        linkType
      });
    }

    return true;
  }

  async unlinkIdentityFromDevice(
    deviceId: string,
    identityId: string
  ): Promise<boolean> {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return false;
    }

    device.linkedIdentities = device.linkedIdentities.filter(
      (link) => link.identityId !== identityId
    );
    await device.save();

    logger.info('Identity unlinked from device', {
      deviceId,
      identityId
    });

    return true;
  }

  async assessDeviceRisk(deviceId: string): Promise<DeviceRiskAssessment> {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return {
        riskScore: 0,
        riskFlags: [],
        isSuspicious: false,
        recommendations: []
      };
    }

    const riskFlags: string[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    if (device.fingerprints.length > 10) {
      riskFlags.push('excessive_fingerprint_variations');
      riskScore += 20;
      recommendations.push('Monitor for fingerprint spoofing attempts');
    }

    if (device.metadata.sessionCount && device.metadata.sessionCount > 100) {
      riskFlags.push('high_session_count');
      riskScore += 10;
    }

    if (device.linkedIdentities.length > 5) {
      riskFlags.push('multiple_linked_identities');
      riskScore += 25;
      recommendations.push('Review linked identities for potential fraud');
    }

    const uniqueIps = new Set(
      device.fingerprints.map((f) => f.userAgent).filter(Boolean)
    );
    if (uniqueIps.size > 10) {
      riskFlags.push('geographic_anomaly');
      riskScore += 15;
      recommendations.push('Investigate potential VPN or proxy usage');
    }

    if (device.type === DeviceType.UNKNOWN) {
      riskFlags.push('unknown_device_type');
      riskScore += 5;
    }

    device.riskScore = riskScore;
    device.riskFlags = riskFlags;
    await device.save();

    return {
      riskScore,
      riskFlags,
      isSuspicious: riskScore >= 50,
      recommendations
    };
  }

  async getDevicesByCluster(clusterId: string): Promise<IDevice[]> {
    return Device.find({
      clusterId,
      status: { $ne: DeviceStatus.BLOCKED }
    }).sort({ 'metadata.lastSeenAt': -1 });
  }

  async getDevicesByIdentity(identityId: string): Promise<IDevice[]> {
    return Device.find({
      'linkedIdentities.identityId': identityId,
      status: { $ne: DeviceStatus.BLOCKED }
    }).sort({ 'metadata.lastSeenAt': -1 });
  }

  async blockDevice(deviceId: string): Promise<boolean> {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return false;
    }

    device.status = DeviceStatus.BLOCKED;
    await device.save();

    logger.warn('Device blocked', { deviceId });

    return true;
  }

  async unblockDevice(deviceId: string): Promise<boolean> {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return false;
    }

    device.status = DeviceStatus.ACTIVE;
    await device.save();

    logger.info('Device unblocked', { deviceId });

    return true;
  }

  async mergeDevices(sourceDeviceId: string, targetDeviceId: string): Promise<boolean> {
    const [sourceDevice, targetDevice] = await Promise.all([
      Device.findOne({ deviceId: sourceDeviceId }),
      Device.findOne({ deviceId: targetDeviceId })
    ]);

    if (!sourceDevice || !targetDevice) {
      return false;
    }

    targetDevice.fingerprints.push(...sourceDevice.fingerprints);
    targetDevice.linkedIdentities.push(...sourceDevice.linkedIdentities);
    targetDevice.metadata.sessionCount =
      (targetDevice.metadata.sessionCount || 0) +
      (sourceDevice.metadata.sessionCount || 0);

    const uniqueFingerprints = targetDevice.fingerprints.filter(
      (f, index, self) =>
        index === self.findIndex((t) => t.userAgent === f.userAgent)
    );
    targetDevice.fingerprints = uniqueFingerprints;

    const uniqueLinkedIdentities = targetDevice.linkedIdentities.filter(
      (l, index, self) =>
        index === self.findIndex((t) => t.identityId === l.identityId)
    );
    targetDevice.linkedIdentities = uniqueLinkedIdentities;

    sourceDevice.status = DeviceStatus.INACTIVE;
    sourceDevice.mergedInto = targetDeviceId;

    await Promise.all([sourceDevice.save(), targetDevice.save()]);

    logger.info('Devices merged', {
      sourceDeviceId,
      targetDeviceId
    });

    return true;
  }

  async getDeviceAnalytics(): Promise<{
    totalDevices: number;
    byType: Record<DeviceType, number>;
    activeDevices: number;
    blockedDevices: number;
    highRiskDevices: number;
  }> {
    const [totalDevices, byType, activeDevices, blockedDevices, highRiskDevices] =
      await Promise.all([
        Device.countDocuments(),
        Device.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]),
        Device.countDocuments({ status: DeviceStatus.ACTIVE }),
        Device.countDocuments({ status: DeviceStatus.BLOCKED }),
        Device.countDocuments({ riskScore: { $gte: 50 } })
      ]);

    const byTypeMap: Record<string, number> = {};
    byType.forEach((item) => {
      byTypeMap[item._id] = item.count;
    });

    return {
      totalDevices,
      byType: byTypeMap as Record<DeviceType, number>,
      activeDevices,
      blockedDevices,
      highRiskDevices
    };
  }
}

export const deviceService = new DeviceService();
