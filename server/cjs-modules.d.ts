declare module "*.cjs" {
  type CommonJsDefault = ((...args: readonly unknown[]) => unknown) & Record<string, unknown>;
  const value: CommonJsDefault;
  export default value;
}
