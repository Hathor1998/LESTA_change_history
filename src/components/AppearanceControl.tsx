import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { APPEARANCE_KEY, parseAppearance, resolveAppearance, type Appearance } from '../utils/appearance';

const choices = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
] as const;

export default function AppearanceControl() {
  const [preference, setPreference] = useState<Appearance>(() => parseAppearance(document.documentElement.dataset.appearance));
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = resolveAppearance(preference, media.matches);
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.appearance = preference;
      document.documentElement.style.colorScheme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1524' : '#edf3f9');
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) setPreference(parseAppearance(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const choose = (value: Appearance) => {
    setPreference(value);
    try { localStorage.setItem(APPEARANCE_KEY, value); } catch { /* In-memory mode still works. */ }
  };
  const Icon = choices.find(c => c.value === preference)!.icon;
  return <>
    <button ref={trigger} className="icon-button" aria-label="外观设置" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}><Icon size={20} /></button>
    <dialog ref={dialog} className="appearance-panel glass" aria-label="外观设置" onClose={() => trigger.current?.focus()} onClick={e => { if (e.target === dialog.current) dialog.current?.close(); }}>
      <div className="panel-heading"><h2>外观</h2><button className="text-button" onClick={() => dialog.current?.close()}>完成</button></div>
      <fieldset><legend className="sr-only">场景模式</legend>{choices.map(({ value, label, icon: ChoiceIcon }) => <label key={value} className="appearance-choice">
        <input type="radio" name="appearance" value={value} checked={preference === value} onChange={() => choose(value)} />
        <ChoiceIcon size={20} /><span>{label}</span>{preference === value && <Check size={18} className="choice-check" />}
      </label>)}</fieldset>
      <p className="panel-help">仅保存本机外观偏好，不影响数据。</p>
    </dialog>
  </>;
}
