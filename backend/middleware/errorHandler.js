/**
 * Unified Error Handler Middleware
 * Provides consistent error responses across the API
 */

/**
 * Global error handler middleware
 * @param {Error} err - The error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  const method = req.method || 'UNKNOWN';
  const path = req.path || req.url || 'UNKNOWN';
  
  // Log error details
  console.error(`[ERROR] ${method} ${path}:`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR STACK]:', err.stack);
  }
  
  // PostgreSQL error codes
  if (err.code) {
    switch (err.code) {
      // Unique violation
      case '23505':
        return res.status(409).json({ 
          error: 'duplicate_entry', 
          message: 'A record with this value already exists.',
          details: err.detail 
        });
      
      // Foreign key violation
      case '23503':
        return res.status(400).json({ 
          error: 'foreign_key_violation', 
          message: 'Referenced record does not exist.',
          details: err.detail 
        });
      
      // Not null violation
      case '23502':
        return res.status(400).json({ 
          error: 'required_field_missing', 
          message: 'A required field is missing.',
          details: err.column 
        });
      
      // Check constraint violation
      case '23514':
        return res.status(400).json({ 
          error: 'validation_failed', 
          message: 'Data validation failed.',
          details: err.constraint 
        });
      
      // Invalid text representation (e.g., invalid UUID)
      case '22P02':
        return res.status(400).json({ 
          error: 'invalid_input', 
          message: 'Invalid input format.' 
        });
      
      // Connection errors
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
      case '57P01': // admin_shutdown
      case '57P02': // crash_shutdown
        return res.status(503).json({ 
          error: 'database_unavailable', 
          message: 'Database is temporarily unavailable. Please try again.' 
        });
    }
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'invalid_token', 
      message: 'Authentication token is invalid.' 
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'token_expired', 
      message: 'Authentication token has expired.' 
    });
  }
  
  // Validation errors (custom)
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'validation_error', 
      message: err.message,
      details: err.details 
    });
  }
  
  // Default server error
  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.code || 'server_error',
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An internal server error occurred.'
  };
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Not Found handler - for undefined routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ 
    error: 'not_found', 
    message: `Route ${req.method} ${req.path} not found.` 
  });
}

/**
 * Async handler wrapper - catches async errors and passes them to error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware function
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
