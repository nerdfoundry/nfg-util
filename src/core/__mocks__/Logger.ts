const Mock: any = vi.fn();
// const Mock: any = console.log;
// Mock.extend = msg => {
//   const prevExtend = Mock.extend;
//   const extended = Mock.bind(console, msg, '->');
//   extended.extend = prevExtend;
//   return extended;
// };

Mock.extend = vi.fn().mockReturnValue(Mock);

console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! YO DAWG WE SET UP THE LOGGER');
debugger;

export default Mock;
