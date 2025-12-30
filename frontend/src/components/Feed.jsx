const Feed = ({ posts = [] }) => {
  if (!posts.length) {
    return (
      <div className="card">
        <p className="muted">No uploads yet. Be the first to log a cleanup!</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {posts.map((post) => {
        const when = post.created_at ? new Date(post.created_at) : new Date();
        return (
          <article key={post.id} className="card">
            <div className="card__header">
              <p className="muted">{when.toLocaleString()}</p>
              <span className="pill small">
                {post.status === "verified" ? `+${post.credits_awarded} credits` : post.status}
              </span>
            </div>
            <p className="card__title">{post.caption}</p>
            {(post.username || post.user_email) && (
              <p className="muted">By: {post.username || post.user_email}</p>
            )}
            <p className="muted">{post.location || "Location not provided"}</p>
            <div className="media">
              {post.media_type === "video" ? (
                <video controls src={post.media_url} />
              ) : (
                <img src={post.media_url} alt={post.caption} />
              )}
            </div>
            {/* {post.review_notes && <p className="muted">Review: {post.review_notes}</p>} */}
            {post.ai_summary && <p className="ai-summary">{post.ai_summary}</p>}
          </article>
        );
      })}
    </div>
  );
};

export default Feed;
