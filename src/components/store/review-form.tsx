"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import type { ProductReview, Product } from "@/types/store";

export function ReviewForm({
  review,
  product,
  tenant,
}: {
  review: ProductReview;
  product: Product;
  tenant: string;
}) {
  const [rating, setRating] = useState(review.rating || 5);
  const [comment, setComment] = useState(review.comment || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(review.status === "approved" || review.status === "rejected");
  const [error, setError] = useState("");

  if (success) {
    return (
      <div className="store-container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <h2>Avaliação registrada!</h2>
        <p>Obrigado por avaliar o produto {product.name}.</p>
        <a href={`/loja/${tenant}`} className="store-button" style={{ marginTop: "2rem", display: "inline-block" }}>Voltar para a loja</a>
      </div>
    );
  }

  return (
    <div className="store-container" style={{ padding: "4rem 1rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Avaliar Produto</h1>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "2rem", padding: "1rem", background: "var(--store-surface)", borderRadius: "8px" }}>
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px" }} />}
        <div>
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{product.name}</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>Olá, {review.customerName}!</p>
        </div>
      </div>

      <form onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
          const res = await fetch(`/api/storefront/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: review.reviewToken, rating, comment })
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || "Erro ao salvar avaliação.");
          setSuccess(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
        } finally {
          setSaving(false);
        }
      }}>
        <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontWeight: 600 }}>Sua nota</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: star <= rating ? "#fbbf24" : "var(--store-border)",
                  padding: "0.5rem",
                }}
              >
                <Star fill={star <= rating ? "currentColor" : "none"} size={32} />
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontWeight: 600 }}>Seu comentário (opcional)</label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: "100%", padding: "1rem", borderRadius: "8px", border: "1px solid var(--store-border)", background: "var(--store-surface)", color: "inherit", fontFamily: "inherit" }}
            placeholder="O que achou do produto?"
          />
        </div>

        {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}
        
        <button type="submit" className="store-button" style={{ width: "100%" }} disabled={saving}>
          {saving ? "Enviando..." : "Enviar Avaliação"}
        </button>
      </form>
    </div>
  );
}
