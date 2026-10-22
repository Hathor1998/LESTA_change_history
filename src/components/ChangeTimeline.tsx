import type { BalanceChange } from '../types.ts';
import { groupChangeBatches, groupChangeSections, hasChangeValue } from '../utils/change-batches.ts';

function ChangeLine({ item, label, showDetails }: { item: BalanceChange; label: string; showDetails: boolean }) {
  const oldKnown = hasChangeValue(item.oldValue), newKnown = hasChangeValue(item.newValue);
  return <li>
    <span className="change-text">
      {label}
      {newKnown && <>：{oldKnown && <><span className={`change-${item.trend}`}>{item.oldValue}</span> → </>}<strong className={`change-${item.trend}`}>{item.newValue}</strong></>}
      {!newKnown && oldKnown && <>（原值：<span className={`change-${item.trend}`}>{item.oldValue}</span>；新值未提供）</>}
    </span>
    {showDetails && item.notes && <p className="change-note">{item.notes}</p>}
  </li>;
}

export default function ChangeTimeline({ changes, showDetails }: { changes: BalanceChange[]; showDetails: boolean }) {
  return <div className="change-timeline">{groupChangeBatches(changes).map(([key, records]) => {
    const first = records[0];
    const stage = first.changeStage === 'public-test' ? '公测调整' : first.shipStatus === 'test' ? '测试舰艇调整' : '正式调整';
    return <section className="change-batch" key={key}>
      <div className="change-batch-heading">
        <strong>{first.version} · {stage}</strong>
        <span>{first.publishedAt ? <time dateTime={first.publishedAt}>{first.publishedAt.slice(0, 10)}</time> : '公告日期未记录'}</span>
      </div>
      <ul className="change-lines">{groupChangeSections(records).map(section => section.title
        ? <li key={section.key}><span>{section.title}：</span>
          <ul className="change-lines change-subitems">{section.items.map(({ record, label }) =>
            <ChangeLine key={record.id} item={record} label={label} showDetails={showDetails} />)}</ul>
        </li>
        : <ChangeLine key={section.key} item={section.items[0].record} label={section.items[0].label} showDetails={showDetails} />
      )}</ul>
      {showDetails && first.sourceUrl && /^https?:\/\//.test(first.sourceUrl) && <a className="change-source" href={first.sourceUrl} target="_blank" rel="noreferrer">查看原始公告 ↗</a>}
    </section>;
  })}</div>;
}
