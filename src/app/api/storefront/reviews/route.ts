export async function POST() {
  return Response.json(
    { success: false, error: "As avaliações de produtos foram desativadas nesta loja." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
