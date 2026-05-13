"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TONE_CONFIGS = exports.ToneType = void 0;
exports.getToneForRiskScore = getToneForRiskScore;
exports.formatMessageWithTone = formatMessageWithTone;
exports.getUrgencyLevel = getUrgencyLevel;
var ToneType;
(function (ToneType) {
    ToneType["PROFESSIONAL"] = "professional";
    ToneType["ALERT"] = "alert";
    ToneType["CAUTIOUS"] = "cautious";
    ToneType["URGENT"] = "urgent";
    ToneType["REASSURING"] = "reassuring";
})(ToneType || (exports.ToneType = ToneType = {}));
exports.TONE_CONFIGS = {
    [ToneType.PROFESSIONAL]: {
        type: ToneType.PROFESSIONAL,
        prefix: '',
        suffix: '.',
        urgency: 'low',
    },
    [ToneType.ALERT]: {
        type: ToneType.ALERT,
        prefix: '[ALERT] ',
        suffix: ' - Review required.',
        urgency: 'medium',
    },
    [ToneType.CAUTIOUS]: {
        type: ToneType.CAUTIOUS,
        prefix: '[CAUTION] ',
        suffix: ' - Proceeding with verification.',
        urgency: 'medium',
    },
    [ToneType.URGENT]: {
        type: ToneType.URGENT,
        prefix: '[URGENT] ',
        suffix: ' - Immediate action required.',
        urgency: 'high',
    },
    [ToneType.REASSURING]: {
        type: ToneType.REASSURING,
        prefix: '',
        suffix: ' - Transaction secured.',
        urgency: 'low',
    },
};
function getToneForRiskScore(riskScore) {
    if (riskScore >= 90) {
        return exports.TONE_CONFIGS[ToneType.URGENT];
    }
    else if (riskScore >= 75) {
        return exports.TONE_CONFIGS[ToneType.ALERT];
    }
    else if (riskScore >= 50) {
        return exports.TONE_CONFIGS[ToneType.CAUTIOUS];
    }
    else if (riskScore >= 25) {
        return exports.TONE_CONFIGS[ToneType.PROFESSIONAL];
    }
    else {
        return exports.TONE_CONFIGS[ToneType.REASSURING];
    }
}
function formatMessageWithTone(message, tone) {
    return `${tone.prefix}${message}${tone.suffix}`;
}
function getUrgencyLevel(riskScore) {
    if (riskScore >= 90)
        return 'critical';
    if (riskScore >= 75)
        return 'high';
    if (riskScore >= 50)
        return 'medium';
    return 'low';
}
//# sourceMappingURL=tone.js.map