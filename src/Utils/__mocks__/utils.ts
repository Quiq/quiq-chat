export const formatQueryParams = (url: string) => url;
export const getBrowserName = () => 'Chrome';
export const getMajor = () => '53';
interface Timestamped {
  timestamp: number;
}
export const sortByTimestamp = <T extends Timestamped>(arr: Array<T>): Array<T> =>
  arr.slice().sort((a, b) => a.timestamp - b.timestamp);
export const burnItDown = jest.fn();
export const registerOnBurnCallback = jest.fn();
export const inLocalDevelopment = () => true;
export const getTenantFromHostname = () => 'tester';
export const createGuid = () => 'imALittleGuidShortAndStout';
export const onceAtATime = (f: Function) => f;
export const parseUrl = (url: string) => ({ rawUrl: url });
export const getTimezone = () => 'America/Denver';
