declare module "../script/load-local-env.cjs" {
  export default function loadLocalEnv(options?: { cwd?: string }): void;
}

declare module "./script/load-local-env.cjs" {
  export default function loadLocalEnv(options?: { cwd?: string }): void;
}
