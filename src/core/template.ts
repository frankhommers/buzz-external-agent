export type TemplateVars = Record<
  'name' | 'slot' | 'host' | 'pubkey' | 'npub' | 'auth_tag' | 'file',
  string
>

const PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g

export const renderTemplate = (template: string, vars: TemplateVars): string =>
  template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    if (!Object.hasOwn(vars, key)) throw new Error(`Unknown placeholder {${key}}`)
    return vars[key as keyof TemplateVars]
  })
