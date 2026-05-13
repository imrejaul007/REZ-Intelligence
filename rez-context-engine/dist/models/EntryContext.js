"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntryContextInputSchema = exports.MerchantCategory = exports.ReZPlatform = exports.QRCodeType = exports.EntryPointType = void 0;
exports.createDefaultEntryContext = createDefaultEntryContext;
const zod_1 = require("zod");
/**
 * Entry point types for user interactions
 */
var EntryPointType;
(function (EntryPointType) {
    EntryPointType["QR_CODE"] = "QR_CODE";
    EntryPointType["VOICE"] = "VOICE";
    EntryPointType["TEXT"] = "TEXT";
    EntryPointType["APP"] = "APP";
    EntryPointType["WEB"] = "WEB";
    EntryPointType["API"] = "API";
    EntryPointType["DEEP_LINK"] = "DEEP_LINK";
    EntryPointType["NOTIFICATION"] = "NOTIFICATION";
    EntryPointType["UNKNOWN"] = "UNKNOWN";
})(EntryPointType || (exports.EntryPointType = EntryPointType = {}));
/**
 * QR code prefixes that indicate specific verticals
 */
var QRCodeType;
(function (QRCodeType) {
    QRCodeType["HOTEL"] = "QR_HOTEL";
    QRCodeType["RESTAURANT"] = "QR_RESTAURANT";
    QRCodeType["GYM"] = "QR_GYM";
    QRCodeType["CLINIC"] = "QR_CLINIC";
    QRCodeType["RETAIL"] = "QR_RETAIL";
    QRCodeType["SALON"] = "QR_SALON";
    QRCodeType["GENERAL"] = "QR_GENERAL";
})(QRCodeType || (exports.QRCodeType = QRCodeType = {}));
/**
 * ReZ platform entry points
 */
var ReZPlatform;
(function (ReZPlatform) {
    ReZPlatform["WEB_MENU"] = "REZ_WEB_MENU";
    ReZPlatform["STAY"] = "REZ_STAY";
    ReZPlatform["FIT"] = "REZ_FIT";
    ReZPlatform["HEALTH"] = "REZ_HEALTH";
    ReZPlatform["GENERAL"] = "REZ_GENERAL";
})(ReZPlatform || (exports.ReZPlatform = ReZPlatform = {}));
/**
 * Merchant category classification
 */
var MerchantCategory;
(function (MerchantCategory) {
    MerchantCategory["HOSPITALITY"] = "HOSPITALITY";
    MerchantCategory["CULINARY"] = "CULINARY";
    MerchantCategory["FITNESS"] = "FITNESS";
    MerchantCategory["HEALTH"] = "HEALTH";
    MerchantCategory["RETAIL"] = "RETAIL";
    MerchantCategory["SALON"] = "SALON";
    MerchantCategory["ENTERTAINMENT"] = "ENTERTAINMENT";
    MerchantCategory["TRAVEL"] = "TRAVEL";
    MerchantCategory["UNKNOWN"] = "UNKNOWN";
})(MerchantCategory || (exports.MerchantCategory = MerchantCategory = {}));
/**
 * Schema for entry context input validation
 */
exports.EntryContextInputSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid().optional(),
    userId: zod_1.z.string().optional(),
    entryType: zod_1.z.nativeEnum(EntryPointType).optional(),
    qrCode: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().optional(),
    merchantName: zod_1.z.string().optional(),
    merchantCategory: zod_1.z.nativeEnum(MerchantCategory).optional(),
    platform: zod_1.z.string().optional(),
    deviceType: zod_1.z.enum(['mobile', 'tablet', 'desktop', 'unknown']).optional(),
    userAgent: zod_1.z.string().optional(),
    ipAddress: zod_1.z.string().optional(),
    location: zod_1.z
        .object({
        latitude: zod_1.z.number().optional(),
        longitude: zod_1.z.number().optional(),
        country: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
    })
        .optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/**
 * Create default entry context
 */
function createDefaultEntryContext(sessionId) {
    return {
        id: '',
        sessionId,
        entryType: EntryPointType.UNKNOWN,
        merchantCategory: MerchantCategory.UNKNOWN,
        deviceType: 'unknown',
        detectedAt: new Date(),
        confidence: 0,
        metadata: {},
    };
}
//# sourceMappingURL=EntryContext.js.map