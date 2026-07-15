"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Falha ao carregar o painel administrativo", error);
  }, [error]);

  return (
    <main className="admin-state-page">
      <div className="admin-state-card error" role="alert">
        <span aria-hidden="true">!</span>
        <h1>Não foi possível carregar o painel</h1>
        <p>Os dados locais não foram usados para mascarar a falha. Verifique a conexão com o Supabase e tente novamente.</p>
        <button className="admin-button primary" onClick={reset}>Tentar novamente</button>
      </div>
    </main>
  );
}
