import { EntryContext, EntryContextInput, EntryPointType, QRCodeType, ReZPlatform } from '../models/EntryContext';
export interface EntryPointDetectionResult {
    entryType: EntryPointType;
    qrCodeType?: QRCodeType;
    rePlatform?: ReZPlatform;
    confidence: number;
    metadata: Record<string, unknown>;
}
/**
 * Service for detecting entry point types from various input sources
 */
export declare class EntryPointDetector {
    /**
     * Detect entry point from input context
     */
    detect(input: EntryContextInput, sessionId: string): Promise<EntryContext>;
    /**
     * Detect entry point details from input
     */
    private detectEntryPoint;
    /**
     * Detect entry point from QR code
     */
    private detectFromQRCode;
    /**
     * Detect entry point from platform identifier
     */
    private detectFromPlatform;
    /**
     * Detect device type from user agent
     */
    private detectDeviceType;
    /**
     * Validate if a QR code is a valid ReZ QR code
     */
    isValidReZQRCode(qrCode: string): boolean;
}
export declare const entryPointDetector: EntryPointDetector;
//# sourceMappingURL=entryPointDetector.d.ts.map