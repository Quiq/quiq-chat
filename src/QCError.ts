export default (name: string, message: string) => {
  const e = new Error(message);
  e.name = name;
  return e;
};
