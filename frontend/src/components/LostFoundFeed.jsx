const LostFoundFeed = ({ items = [] }) => {
  if (!items.length) {
    return (
      <div className="card">
        <p className="muted">No reports yet.</p>
      </div>
    );
  }
  return (
    <div className="grid">
      {items.map((item) => {
        const when = item.created_at ? new Date(item.created_at) : new Date();
        return (
          <article key={item.id} className="card">
            <div className="card__header">
              <p className="muted">{when.toLocaleString()}</p>
              <span className="pill small">{item.status}</span>
            </div>
            <p className="card__title">{item.title}</p>
            <p>{item.description}</p>
            <p className="muted">{item.location}</p>
            <p className="muted">Contact: {item.contact}</p>
            {(item.username || item.user_email) && (
              <p className="muted">Reporter: {item.username || item.user_email}</p>
            )}
            {item.image_url && (
              <div className="media">
                <img src={item.image_url} alt={item.title} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default LostFoundFeed;
