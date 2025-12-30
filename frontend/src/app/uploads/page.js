"use client";

import UploadForm from "../../components/UploadForm";
import Feed from "../../components/Feed";
import { useAppData } from "../../components/AppProvider";

export default function UploadsPage() {
  const { user, posts, refreshData, loading } = useAppData();

  if (loading || !user) {
    return (
      <div className="loading">
        <p>{loading ? "Loading uploads..." : "Please log in to upload."}</p>
      </div>
    );
  }

  return (
    <>
      <section className="section split">
        <UploadForm user={user} onCreated={refreshData} />
        <div className="card subtle">
          <h3>Tips</h3>
          <p className="muted">
            Upload clear photos or short videos showing proper disposal. Each verified post grants
            credits toward rewards. Avoid stock or duplicate images.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="section__header">
          <h2>All uploads</h2>
          <p className="muted">Proof-based posts from students.</p>
        </div>
        <Feed posts={posts} />
      </section>
    </>
  );
}
