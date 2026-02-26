import { APIResponseInternalErr } from './responseutil.js';

/**
 * Creates a timeout middleware that will abort requests that exceed the specified timeout
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000ms = 30 seconds)
 * @returns {Function} Express middleware function
 */
export function createTimeoutMiddleware(timeoutMs = 30000) {
    return (req, res, next) => {
        const abortController = new AbortController();

        req.abortSignal = abortController.signal;

        const timeoutId = setTimeout(() => {
            abortController.abort();

            if (!res.headersSent) {
                APIResponseInternalErr(
                    req,
                    res,
                    'REQUEST_TIMEOUT',
                    { message: 'Request timed out after ' + timeoutMs / 1000 + ' seconds', path: req.path },
                    'Request timed out after ' + timeoutMs / 1000 + ' seconds'
                );
            }
        }, timeoutMs);

        const originalEnd = res.end;
        res.end = function (...args) {
            clearTimeout(timeoutId);
            return originalEnd.apply(this, args);
        };

        abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            if (!res.headersSent) {
                APIResponseInternalErr(req, res, 'REQUEST_ABORTED', { message: 'Request timed out after ' + timeoutMs / 1000 + ' seconds', path: req.path }, 'Request was aborted due to timeout');
            }
        });

        next();
    };
}
