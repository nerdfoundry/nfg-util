const MockInstance = {
  getOption: vi.fn(),
  setOption: vi.fn()
};

export default vi.fn(() => MockInstance);
