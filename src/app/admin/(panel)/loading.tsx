export default function AdminLoading() {
  return (
    <main className="admin-state-page" aria-busy="true" aria-live="polite">
      <div className="admin-state-card">
        <span className="admin-loading-spinner" aria-hidden="true" />
        <h1>Carregando o painel</h1>
        <p>Buscando os dados administrativos com segurança.</p>
      </div>
    </main>
  );
}
