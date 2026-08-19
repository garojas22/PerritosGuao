export default function CategoryTabs({ categories, activeCat, setActiveCat }) {
  return (
    <div className="cat-tabs">
      {categories.map(cat => (
        <button
          key={cat}
          className={cat === activeCat ? "active" : ""}
          onClick={() => setActiveCat(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
