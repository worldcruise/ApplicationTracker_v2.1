import {DefaultExportRoot} from './default-export-root';
import {MeetingTimezoneSettings} from './meeting-timezone-settings';
export function OtherSettings(){
  return <section className="prompt-settings" aria-labelledby="other-settings-title"><header className="settings-pane-heading"><h2 id="other-settings-title">Other</h2></header><MeetingTimezoneSettings /><DefaultExportRoot /></section>;
}
