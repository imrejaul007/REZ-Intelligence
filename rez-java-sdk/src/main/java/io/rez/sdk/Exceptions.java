package io.rez.sdk;

/**
 * Base exception for REZ SDK errors
 */
public class REZException extends Exception {
    public REZException(String message) {
        super(message);
    }

    public REZException(String message, Throwable cause) {
        super(message, cause);
    }
}

/**
 * API Exception with status code and error details
 */
class APIException extends REZException {
    private final int statusCode;
    private final APIError error;

    public APIException(int statusCode, APIError error) {
        super(error != null ? error.toString() : "HTTP " + statusCode);
        this.statusCode = statusCode;
        this.error = error;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public APIError getError() {
        return error;
    }

    public boolean isNotFound() {
        return statusCode == 404;
    }

    public boolean isUnauthorized() {
        return statusCode == 401;
    }

    public boolean isRateLimited() {
        return statusCode == 429;
    }

    public boolean isServerError() {
        return statusCode >= 500;
    }
}