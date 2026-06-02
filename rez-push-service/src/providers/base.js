class BaseProvider {
  constructor(channel, config) {
    this.channel = channel;
    this.config = config;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    await this._init();
    this.isInitialized = true;
  }

  async _init() {
  }

  async send(notification, user, content) {
    throw new Error('Method not implemented');
  }

  async validateConfig() {
    throw new Error('Method not implemented');
  }

  getErrorCode(error) {
    if (error.code) return error.code;
    if (error.status) return error.status;
    return 'UNKNOWN_ERROR';
  }

  getErrorMessage(error) {
    return error.message || error.error?.message || 'Unknown error occurred';
  }

  isRetryableError(error) {
    const retryableCodes = [
      'RESOURCE_EXHAUSTED',
      'UNAVAILABLE',
      'ABORTED',
      'INTERNAL',
      'DEADLINE_EXCEEDED',
    ];
    return retryableCodes.includes(this.getErrorCode(error));
  }

  formatResult(success, messageId = null, error = null) {
    return {
      success,
      channel: this.channel,
      messageId,
      error: error ? {
        code: this.getErrorCode(error),
        message: this.getErrorMessage(error),
        retryable: this.isRetryableError(error),
      } : null,
    };
  }
}

module.exports = BaseProvider;
