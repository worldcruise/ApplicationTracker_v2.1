export type StatusEntry = { key: string; token: string; level: string; message: string; busy?: boolean; sticky?: boolean; context?: string; actions?: any; detail?: any };
export const statusMessageId = (key: string) => 'workspace-status-' + key;
export function StatusBar({ messages }: { messages: StatusEntry[]; host?: HTMLElement | null }) {
  return <div className="prompt-status" aria-label="Prompt status">{messages.map(message => <div key={message.key} className={`prompt-message prompt-message-${message.level}`}>
    <p id={statusMessageId(message.key)} role={message.level === 'error' ? 'alert' : 'status'} aria-busy={message.busy}>{message.message}</p>
    {message.actions}{message.detail}
  </div>)}</div>;
}
