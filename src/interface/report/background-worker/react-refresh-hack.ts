declare global {
  var $RefreshReg$: () => void;
  var $RefreshSig$: (type: string) => (type: string) => string;
}

if (import.meta.hot) {
  self.window = self;
  self.$RefreshReg$ = () => {};
  self.$RefreshSig$ = () => (type) => type;
}
