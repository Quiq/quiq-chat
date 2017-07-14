export const registerCallbacks = jest.fn();
export const onInit = jest.fn();
export default jest.fn().mockReturnValue({then: () => ({catch: jest.fn()})});
