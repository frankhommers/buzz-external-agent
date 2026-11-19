export interface PluginCtx {
  react: unknown
}

export const inject: readonly string[] = ['react']

export function apply(_ctx: PluginCtx): void {}
