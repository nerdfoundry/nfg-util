const MockInstance = {
  getOption: vi.fn(),
  setOption: vi.fn()
};

const Mocker = function () {
  return MockInstance;
};

export default Mocker;
