const Mock: any = vi.fn();
// const Mock: any = console.log;
// Mock.extend = msg => {
//   const prevExtend = Mock.extend;
//   const extended = Mock.bind(console, msg, '->');
//   extended.extend = prevExtend;
//   return extended;
// };

Mock.extend = vi.fn(() => Mock);

export default Mock;
