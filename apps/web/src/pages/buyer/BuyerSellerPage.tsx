import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSellerProfile,
  getSellerReviews,
  submitSellerReview,
  getProductsBySeller,
  getAccountById,
  extractApiError,
  SellerProfile,
  AccountInfo,
  ReviewsResponse,
  Product,
} from "../../services/api";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span style={{ color: "#f5c518", fontSize: 16 }}>
      {[1, 2, 3, 4, 5].map((s) => (s <= rating ? "★" : "☆")).join("")}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <span style={{ fontSize: 28, cursor: "pointer", userSelect: "none" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          style={{ color: s <= (hovered || value) ? "#f5c518" : "rgba(255,255,255,0.25)" }}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function BuyerSellerPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [reviewData, setReviewData] = useState<ReviewsResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Review form state
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!sellerId) return;

    getSellerProfile(sellerId)
      .then(setProfile)
      .catch(() => {
        // Profile may not exist for all sellers — show page anyway with
        // a placeholder so reviews and listings are still accessible
        setProfile({
          id: sellerId,
          sellerId,
          storeName: null,
          bio: null,
          statusName: "active",
          createdAt: new Date().toISOString(),
        });
      })
      .finally(() => setLoadingProfile(false));

    getAccountById(sellerId).then(setAccountInfo).catch(() => {});
    getSellerReviews(sellerId).then(setReviewData).catch(() => {});
    getProductsBySeller(sellerId).then(setProducts).catch(() => {});
  }, [sellerId]);

  async function handleSubmitReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sellerId || rating === 0) { setSubmitError("Please select a star rating."); return; }
    setSubmitting(true);
    setSubmitError("");
    setSubmitMsg("");
    try {
      await submitSellerReview(sellerId, rating, reviewText || undefined);
      setSubmitMsg("Review submitted!");
      setRating(0);
      setReviewText("");
      const updated = await getSellerReviews(sellerId);
      setReviewData(updated);
    } catch (err) {
      setSubmitError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProfile) return <div className="card cardPad">Loading seller...</div>;
  if (!profile)
    return (
      <div className="card cardPad">
        <button className="btn" onClick={() => navigate("/buyer")}>Back</button>
      </div>
    );

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Back link */}
      <div>
        <button className="btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {/* Seller profile card */}
      <div className="card cardPad">
        <div className="h1" style={{ fontSize: 22 }}>
          {profile.storeName ||
            (accountInfo
              ? `${accountInfo.firstName} ${accountInfo.lastName}`
              : "SportVault Seller")}
        </div>
        {accountInfo && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{accountInfo.email}</div>
        )}
        {profile.bio && (
          <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>{profile.bio}</div>
        )}
        {reviewData && reviewData.totalReviews > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <StarDisplay rating={Math.round(reviewData.averageRating ?? 0)} />
            <span className="muted" style={{ fontSize: 13 }}>
              {reviewData.averageRating?.toFixed(1)} ({reviewData.totalReviews} review{reviewData.totalReviews !== 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>

      {/* Seller's active listings */}
      {products.length > 0 && (
        <div className="card cardPad">
          <div className="h2">Listings ({products.length})</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 14,
              marginTop: 12,
            }}
          >
            {products.map((p) => (
              <div
                key={p.id}
                className="card cardPad"
                style={{ cursor: "pointer", gap: 8, display: "flex", flexDirection: "column" }}
                onClick={() => navigate(`/buyer/products/${p.id}`)}
              >
                <img
                  src={p.imageUrl || "/images/default-product.png"}
                  alt={p.name}
                  style={{ width: "100%", height: 130, objectFit: "contain", background: "#181717", borderRadius: 6, padding: 4 }}
                />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>${Number(p.unitPrice).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave a review */}
      <div className="card cardPad">
        <div className="h2">Leave a Review for this Seller</div>
        <form onSubmit={handleSubmitReview} className="col" style={{ gap: 12, marginTop: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Your rating</div>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Your review (optional)</div>
            <textarea
              className="input"
              rows={3}
              style={{ resize: "vertical", width: "100%" }}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this seller..."
            />
          </div>
          {submitError && <div style={{ color: "red", fontSize: 13 }}>{submitError}</div>}
          {submitMsg  && <div style={{ color: "#4caf50", fontSize: 13 }}>{submitMsg}</div>}
          <div>
            <button className="btn btnPrimary" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>

      {/* Reviews list */}
      <div className="card cardPad">
        <div className="h2">Seller Reviews</div>
        {!reviewData || reviewData.totalReviews === 0 ? (
          <div className="muted" style={{ marginTop: 10 }}>No reviews yet. Be the first to review this seller!</div>
        ) : (
          <div className="col" style={{ gap: 12, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StarDisplay rating={Math.round(reviewData.averageRating ?? 0)} />
              <span style={{ fontWeight: 700, fontSize: 18 }}>
                {reviewData.averageRating?.toFixed(1)}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                out of 5 · {reviewData.totalReviews} review{reviewData.totalReviews !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="divider" />
            {(reviewData.reviews ?? []).map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarDisplay rating={r.rating} />
                  {(r.buyerFirstName || r.buyerLastName) && (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {[r.buyerFirstName, r.buyerLastName].filter(Boolean).join(" ")}
                    </span>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.review && (
                  <div style={{ marginTop: 6, fontSize: 14 }}>{r.review}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
