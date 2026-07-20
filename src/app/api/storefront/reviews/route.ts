import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { platformConfig } from "@/config/platform";

const reviewSchema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = reviewSchema.safeParse(json);
    
    if (!parsed.success) {
      return Response.json({ success: false, error: "Dados inválidos" }, { status: 400 });
    }

    const supabase = createClient(platformConfig.supabaseUrl, platformConfig.supabaseServiceRole);

    // Get the review by token
    const { data: review, error: findError } = await supabase
      .from("product_reviews")
      .select("id, status")
      .eq("review_token", parsed.data.token)
      .single();

    if (findError || !review) {
      return Response.json({ success: false, error: "Avaliação não encontrada ou inválida." }, { status: 404 });
    }

    if (review.status !== "pending") {
      return Response.json({ success: false, error: "Esta avaliação já foi registrada." }, { status: 400 });
    }

    // Update the review
    const { error: updateError } = await supabase
      .from("product_reviews")
      .update({
        rating: parsed.data.rating,
        comment: parsed.data.comment || "",
        status: "approved", // Automatically approve for now, or could be 'in_review'
      })
      .eq("id", review.id);

    if (updateError) {
      console.error("Error updating review", updateError);
      return Response.json({ success: false, error: "Erro ao salvar avaliação no banco de dados." }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error processing review POST", error);
    return Response.json({ success: false, error: "Erro interno do servidor." }, { status: 500 });
  }
}
