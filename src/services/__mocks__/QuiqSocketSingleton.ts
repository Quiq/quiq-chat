 class QuiqSocketSingletonMock {
    _listeners: {[name: string]: Function} = {};
    withURL = jest.fn().mockReturnThis();
    withLogger = jest.fn().mockReturnThis();
    withOptions = jest.fn().mockReturnThis();
    addEventListener = jest.fn((name, handler) => {
       this._listeners[name] = handler; 
       return this;
    });
    connect = jest.fn(() => {
        if (this._listeners['connectionEstablish']) this._listeners['connectionEstablish']();
        return this;
    });
    disconnect = jest.fn().mockReturnThis();
}

export default new QuiqSocketSingletonMock();