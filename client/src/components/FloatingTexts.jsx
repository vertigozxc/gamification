export default function FloatingTexts({ items }) {
  return items.map((item) => (
    <div key={item.id} className={`floating-text ${item.colorClass} cinzel`} style={{ left: `${item.x}px`, top: `${item.y}px` }}>
      {item.text}
    </div>
  ));
}
