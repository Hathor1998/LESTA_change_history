import { useId, type ReactNode } from 'react';

export default function BottomDock({ children }: { children: ReactNode }) {
  const id = `dock-edge-${useId().replace(/:/g, '')}`;
  return <div className="bottom-dock glass" aria-label="浏览工具">
    <svg className="dock-edge" aria-hidden="true" width="100%" height="100%">
      <defs><filter id={id} x="-5%" y="-10%" width="110%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".015 .06" numOctaves="1" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
      <rect x="2" y="2" width="99%" height="94%" rx="26" fill="none" stroke="currentColor" strokeWidth="1" filter={`url(#${id})`} />
    </svg>
    {children}
  </div>;
}
