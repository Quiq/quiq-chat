let burned = false;
export const getBurned = () => burned;
export const setBurned = (shouldBurn?: boolean) => {
  burned = typeof shouldBurn === 'boolean' ? shouldBurn : true;
};
export const setGlobals = jest.fn();
export const checkRequiredSettings = jest.fn();
export const getHost = () => 'someHost';
export const getContactPoint = () => 'someContactPoint';
export const getPublicApiUrl = () => 'somePublicApiUrl';
export const getUrlForContactPoint = () => 'someUrlForContactPoint';
export const isActive = jest.fn().mockReturnValue(true);
