const mockStubbornFetch = jest.fn().mockImplementation(() => {
  // tslint:disable-next-line no-console
  console.log('Using mock stubborn fetch instance');
  return {
    send: jest.fn().mockReturnValue(Promise.resolve({})),
    disable: jest.fn(),
  };
});

// @ts-ignore
mockStubbornFetch.disable = jest.fn();

export default mockStubbornFetch;
