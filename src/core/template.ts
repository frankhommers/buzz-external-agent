export type TemplateVars = Record<
  'name' | 'slot' | 'host' | 'pubkey' | 'npub' | 'auth_tag' | 'file',
  string
>

const PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g

/** POSIX single-quote a value so a shell treats it as one inert argument. */
export const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`

/** Every substituted value is shell-quoted; templates must not add their own quotes. */
export const renderTemplate = (template: string, vars: TemplateVars): string =>
  template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => {
    if (!Object.hasOwn(vars, key)) throw new Error(`Unknown placeholder {${key}}`)
    return shellQuote(vars[key as keyof TemplateVars])
  })
