// Inline styles for the plugin's cards, built on Buzz Desktop 1.0.5 design tokens
// (src/shared/design-system/styles/{tokens,typography}.css @ desktop-v1.0.5). Plugins cannot
// ship CSS, and on Buzz 1.0.5 plain inputs, buttons and tables in a card render unstyled, so
// controls are styled here. Only tokens that exist in 1.0.5 are used (tests/ui/styles.test.ts).

export type Style = Readonly<Record<string, string | number>>

/** The card surface: the host `ui-card` class plus this padding and spacing. */
export const CARD: Style = {
  padding: 'var(--space-panel-inset)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
  color: 'var(--text-standard)',
}

/** One named group inside a card: heading, copy, fields and actions. */
export const SECTION: Style = { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }

export const HEADING: Style = {
  margin: 0,
  fontSize: 'var(--text-label)',
  fontWeight: 'var(--type-weight-medium)',
  color: 'var(--text-standard)',
}

export const TEXT: Style = { margin: 0, fontSize: 'var(--text-body)' }

export const HINT: Style = {
  margin: 0,
  fontSize: 'var(--text-body-sm)',
  color: 'var(--text-subtle)',
}

/** A result line after an action. */
export const STATUS: Style = {
  margin: 0,
  fontSize: 'var(--text-body-sm)',
  color: 'var(--text-subtle)',
}

/** An error line: the host's danger text colour. */
export const ERROR: Style = {
  margin: 0,
  fontSize: 'var(--text-body-sm)',
  color: 'var(--text-danger)',
}

/** A visible label stacked above its control, filling the width it is given. */
export const FIELD: Style = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  flex: '1 1 14rem',
  minWidth: 0,
}

/** A field that needs a whole row, such as one holding a full npub. */
export const WIDE_FIELD: Style = { ...FIELD, flex: '1 1 100%' }

export const LABEL: Style = { fontSize: 'var(--text-body-sm)', color: 'var(--text-standard)' }

export const INPUT: Style = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  border: '1px solid var(--border-standard)',
  borderRadius: 'var(--radius-control)',
  padding: 'var(--space-2) var(--space-3)',
  background: 'var(--surface-inset)',
  color: 'var(--text-standard)',
  font: 'inherit',
  fontSize: 'var(--text-body)',
}

/** Multi-line input for keys, JSON and templates: monospaced and resizable. */
export const TEXTAREA: Style = {
  ...INPUT,
  borderRadius: 'var(--radius-row)',
  minHeight: '6rem',
  resize: 'vertical',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-body-sm)',
}

/** Controls (and short text) side by side, wrapping on a narrow card. */
export const ROW: Style = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
  flexWrap: 'wrap',
}

/** A row of fields: their labels line up at the top. */
export const FIELD_ROW: Style = { ...ROW, alignItems: 'flex-start', gap: 'var(--space-3)' }

const BUTTON: Style = {
  border: '1px solid var(--border-standard)',
  borderRadius: 'var(--radius-pill)',
  padding: 'var(--space-1h) var(--space-4)',
  background: 'var(--surface-panel)',
  color: 'var(--text-standard)',
  font: 'inherit',
  fontSize: 'var(--text-body-sm)',
  fontWeight: 'var(--type-weight-medium)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

const DISABLED_BUTTON: Style = { ...BUTTON, opacity: 0.5, cursor: 'default' }

/** A host-looking button; inline styles have no :disabled, so pass the state. */
export const buttonStyle = (disabled: boolean): Style => (disabled ? DISABLED_BUTTON : BUTTON)

/** A list of rows without bullets. */
export const LIST: Style = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
}

/** One bordered row in a list. */
export const LIST_ITEM: Style = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3)',
  border: '1px solid var(--border-standard)',
  borderRadius: 'var(--radius-row)',
}

/** A list row whose text and actions sit side by side. */
export const LIST_ROW: Style = { ...LIST_ITEM, ...ROW }

/** Lets a wide table scroll inside a narrow card instead of squeezing its words. */
export const TABLE_WRAP: Style = { overflowX: 'auto', maxWidth: '100%' }

export const TABLE: Style = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-body-sm)',
}

export const TH: Style = {
  textAlign: 'left',
  padding: 'var(--space-1h) var(--space-2)',
  borderBottom: '1px solid var(--border-standard)',
  color: 'var(--text-subtle)',
  fontWeight: 'var(--type-weight-medium)',
  whiteSpace: 'nowrap',
}

/** A cell with short words (label, slot, state, actions): never broken mid-word. */
export const TD: Style = {
  padding: 'var(--space-1h) var(--space-2)',
  borderBottom: '1px solid var(--border-standard)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
}

/** A cell with a long key (fingerprint, npub): wraps anywhere, within a readable width. */
export const TD_KEY: Style = {
  ...TD,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-caption)',
  minWidth: '10rem',
  maxWidth: '18rem',
}

/** The owner cell of an open slot, wide enough for a full npub input. */
export const TD_OWNER_INPUT: Style = { ...TD, minWidth: '20rem' }

export const PRE: Style = {
  margin: 0,
  padding: 'var(--space-2) var(--space-3)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  background: 'var(--surface-inset)',
  borderRadius: 'var(--radius-row)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-caption)',
}

/** The line after an action: a result, or an error shown in the danger colour. */
export type Notice = Readonly<{ text: string; error: boolean }>

export const NO_NOTICE: Notice = { text: '', error: false }

/** Errors are announced as alerts, results as status. */
export const noticeProps = (notice: Notice): Record<string, unknown> =>
  notice.error ? { role: 'alert', style: ERROR } : { role: 'status', style: STATUS }
