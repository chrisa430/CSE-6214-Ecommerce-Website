import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getProductReviews,
  submitProductReview,
  extractApiError,
  ReviewsResponse,
} from "../../services/api";

// Minimal product detail shape returned by GET /inventory/products/:id
interface ProductDetailData {
  id: string;
  sellerId: string;
  name: string;
  shortDesc: string | null;
  longDesc: string | null;
  unitPrice: number;
  quantity: number;
  status: string;
  teamName: string | null;
  playerName: string | null;
  condition: string | null;
  isSigned: boolean;
  isAuthenticated: boolean;
  images: { imageUrl: string; isPrimary: boolean; name: string }[];
}

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

export default function BuyerProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [reviewData, setReviewData] = useState<ReviewsResponse | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [productError, setProductError] = useState("");

  // Review form state
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!id) return;

    fetch(`/api/inventory/products/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setProductError(data.error); return; }
        setProduct({
          id: data.id,
          sellerId: data.seller_id,
          name: data.name,
          shortDesc: data.short_desc ?? null,
          longDesc: data.long_desc ?? null,
          unitPrice: data.unit_price,
          quantity: data.quantity,
          status: data.status_name ?? data.status ?? "",
          teamName: data.team_name ?? null,
          playerName: data.player_name ?? null,
          condition: data.condition_name ?? null,
          isSigned: data.is_signed ?? false,
          isAuthenticated: data.is_authenticated ?? false,
          images: (data.images ?? []).map((img: any) => ({
            imageUrl:  img.image_url  ?? img.imageUrl  ?? "",
            isPrimary: img.is_primary ?? img.isPrimary ?? false,
            name:      img.name ?? "",
          })),
        });
      })
      .catch(() => setProductError("Failed to load product."))
      .finally(() => setLoadingProduct(false));

    getProductReviews(id)
      .then(setReviewData)
      .catch(() => {})
      .finally(() => setLoadingReviews(false));
  }, [id]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!id || rating === 0) { setSubmitError("Please select a star rating."); return; }
    setSubmitting(true);
    setSubmitError("");
    setSubmitMsg("");
    try {
      await submitProductReview(id, rating, reviewText || undefined);
      setSubmitMsg("Review submitted!");
      setRating(0);
      setReviewText("");
      const updated = await getProductReviews(id);
      setReviewData(updated);
    } catch (err) {
      setSubmitError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const primaryImage =
    product?.images.find((i) => i.isPrimary)?.imageUrl ||
    product?.images[0]?.imageUrl ||
    "/images/default-product.png";

  if (loadingProduct) return <div className="card cardPad">Loading product...</div>;
  if (productError || !product)
    return (
      <div className="card cardPad" style={{ color: "red" }}>
        {productError || "Product not found."}
        <button className="btn" style={{ marginLeft: 12 }} onClick={() => navigate("/buyer")}>
          Back
        </button>
      </div>
    );

  return (
    <div className="col" style={{ gap: 16 }}>
      {/* Back link */}
      <div>
        <button className="btn" onClick={() => navigate("/buyer")}>
          ← Back to Browse
        </button>
      </div>

      {/* Product card */}
      <div className="card cardPad">
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          <img
            src={primaryImage}
            alt={product.name}
            style={{ width: "100%", borderRadius: 8, objectFit: "contain", background: "#181717", padding: 8 }}
          />
          <div className="col" style={{ gap: 10 }}>
            <div className="h1" style={{ fontSize: 22 }}>{product.name}</div>

            {product.playerName && (
              <div className="muted" style={{ fontSize: 13 }}>
                {product.playerName}{product.teamName ? ` — ${product.teamName}` : ""}
              </div>
            )}

            {reviewData && reviewData.totalReviews > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StarDisplay rating={Math.round(reviewData.averageRating ?? 0)} />
                <span className="muted" style={{ fontSize: 13 }}>
                  {reviewData.averageRating?.toFixed(1)} ({reviewData.totalReviews} review{reviewData.totalReviews !== 1 ? "s" : ""})
                </span>
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 22 }}>${Number(product.unitPrice).toFixed(2)}</div>

            <div className="muted" style={{ fontSize: 13 }}>
              {product.quantity === 0 ? "Out of stock" : `In stock: ${product.quantity}`}
            </div>

            {product.condition && (
              <div className="muted" style={{ fontSize: 13 }}>Condition: {product.condition}</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              {product.isSigned && <span className="badge">Signed</span>}
              {product.isAuthenticated && <span className="badge">Authenticated</span>}
            </div>

            {product.shortDesc && (
              <div style={{ fontSize: 14, marginTop: 4 }}>{product.shortDesc}</div>
            )}
            {product.longDesc && (
              <div className="muted" style={{ fontSize: 13 }}>{product.longDesc}</div>
            )}

            {product.sellerId && (
              <div style={{ marginTop: 8 }}>
                <Link
                  to={`/buyer/sellers/${product.sellerId}`}
                  style={{ color: "rgba(124,92,255,0.9)", fontSize: 13, fontWeight: 600 }}
                >
                  View Seller Profile →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leave a review */}
      <div className="card cardPad">
        <div className="h2">Leave a Review</div>
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
              placeholder="Share your experience with this product..."
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
        <div className="h2">Customer Reviews</div>
        {loadingReviews ? (
          <div className="muted" style={{ marginTop: 10 }}>Loading reviews...</div>
        ) : !reviewData || reviewData.totalReviews === 0 ? (
          <div className="muted" style={{ marginTop: 10 }}>No reviews yet. Be the first to review this product!</div>
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
            {reviewData.reviews.map((r) => (
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
