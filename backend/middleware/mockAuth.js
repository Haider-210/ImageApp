// middleware/mockAuth.js

module.exports = function mockAuth(req, res, next) {
  // Simulate a logged-in user
  req.user = {
    name: 'Test User',
    email: 'testuser@example.com',
    roles: ['creator'] // Change to ['consumer'] to simulate a consumer
  };
  next();
};
