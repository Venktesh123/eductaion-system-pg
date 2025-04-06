// Middleware to catch async errors and pass them to the error handler
const catchAsyncErrors = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsyncErrors;
