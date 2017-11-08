let establishCallback = () => {};

export default {
  withURL: jest.fn().mockReturnThis(),
  onConnectionLoss: jest.fn().mockReturnThis(),
  onConnectionEstablish: jest.fn(function(fn) {
    establishCallback = fn;
    return this;
  }),
  onMessage: jest.fn().mockReturnThis(),
  onFatalError: jest.fn().mockReturnThis(),
  disconnect: jest.fn(),
  connect: jest.fn(() => establishCallback()),
};
