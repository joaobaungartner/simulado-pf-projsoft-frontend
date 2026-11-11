
import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const API = import.meta.env.VITE_API_URL;
const AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;
const ROLES_CLAIM = "https://api.prova-final.local/roles";

function parseToken(token) {
  const partes = token.split(".");

  if (partes.length !== 3) {
    throw new Error(
      "O Auth0 não retornou um JWT válido para a API."
    );
  }

  const payload = partes[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = payload.padEnd(
    Math.ceil(payload.length / 4) * 4,
    "="
  );

  return JSON.parse(atob(padded));
}

export default function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    isLoading,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  const [avaliacoes, setAvaliacoes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [form, setForm] = useState({
    emailAvaliado: "",
    comentarios: "",
    nota: 10,
  });

  // Solicita um JWT destinado à nossa API
  const obterToken = useCallback(async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: AUDIENCE,
      },
    });

    return token;
  }, [getAccessTokenSilently]);

  // Buscar as avaliações do backend
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const token = await obterToken();

      // Identificar roles pelo JWT
      const claims = parseToken(token);
      setRoles(claims[ROLES_CLAIM] || []);

      const resposta = await fetch(`${API}/avaliacoes`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!resposta.ok) {
        throw new Error(
          `Erro ao listar avaliações: HTTP ${resposta.status}`
        );
      }

      const dados = await resposta.json();
      setAvaliacoes(dados);

    } catch (e) {
      console.error("Erro ao carregar:", e);
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [obterToken]);

  // Carregar automaticamente após login
  useEffect(() => {
    if (isAuthenticated) {
      carregar();
    } else {
      setRoles([]);
      setAvaliacoes([]);
    }
  }, [isAuthenticated, carregar]);

  // Cadastrar avaliação
  async function cadastrar(event) {
    event.preventDefault();
    setErro("");

    try {
      const token = await obterToken();

      const resposta = await fetch(`${API}/avaliacoes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailAvaliado: form.emailAvaliado,
          comentarios: form.comentarios,
          nota: Number(form.nota),
        }),
      });

      if (!resposta.ok) {
        throw new Error(
          `Erro ao cadastrar: HTTP ${resposta.status}`
        );
      }

      setForm({
        emailAvaliado: "",
        comentarios: "",
        nota: 10,
      });

      await carregar();

    } catch (e) {
      console.error("Erro ao cadastrar:", e);
      setErro(e.message);
    }
  }

  if (isLoading) {
    return <p>Carregando autenticação...</p>;
  }

  // Tela de login
  if (!isAuthenticated) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto" }}>
        <h1>Sistema de Avaliações</h1>

        <button onClick={() => loginWithRedirect()}>
          Entrar com Auth0
        </button>
      </main>
    );
  }

  const isAdmin = roles.includes("ADMIN");

  return (
    <main style={{ maxWidth: 800, margin: "40px auto" }}>
      <h1>Sistema de Avaliações</h1>

      <p>
        Logado como: <strong>{user?.email}</strong>
      </p>

      <p>
        Perfil: {roles.length > 0
          ? roles.join(", ")
          : "Não identificado"}
      </p>

      <button
        onClick={() =>
          logout({
            logoutParams: {
              returnTo: window.location.origin,
            },
          })
        }
      >
        Sair
      </button>

      {erro && (
        <p style={{ color: "red" }}>
          {erro}
        </p>
      )}

      {/* Cadastro exclusivo para ADMIN */}
      {isAdmin && (
        <section style={{ marginTop: 30 }}>
          <h2>Cadastrar avaliação</h2>

          <form onSubmit={cadastrar}>
            <div>
              <label>Email do avaliado</label>
              <br />

              <input
                type="email"
                required
                placeholder="email@exemplo.com"
                value={form.emailAvaliado}
                onChange={(e) =>
                  setForm({
                    ...form,
                    emailAvaliado: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Comentários</label>
              <br />

              <textarea
                required
                placeholder="Digite a avaliação"
                value={form.comentarios}
                onChange={(e) =>
                  setForm({
                    ...form,
                    comentarios: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Nota (0 a 10)</label>
              <br />

              <input
                type="number"
                min="0"
                max="10"
                required
                value={form.nota}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nota: e.target.value,
                  })
                }
              />
            </div>

            <button
              type="submit"
              style={{ marginTop: 15 }}
            >
              Cadastrar avaliação
            </button>
          </form>
        </section>
      )}

      {/* Listagem para ADMIN e USER */}
      <section style={{ marginTop: 30 }}>
        <h2>Avaliações cadastradas</h2>

        <button onClick={carregar}>
          Atualizar lista
        </button>

        {carregando && <p>Carregando avaliações...</p>}

        {!carregando && avaliacoes.length === 0 && (
          <p>Nenhuma avaliação encontrada.</p>
        )}

        {avaliacoes.map((a) => (
          <article key={a.id}>
            <hr />

            <p>
              <strong>Avaliador:</strong>{" "}
              {a.emailAvaliador}
            </p>

            <p>
              <strong>Avaliado:</strong>{" "}
              {a.emailAvaliado}
            </p>

            <p>
              <strong>Nota:</strong> {a.nota}/10
            </p>

            <p>
              <strong>Comentário:</strong>{" "}
              {a.comentarios}
            </p>

            <p>
              <strong>Data:</strong>{" "}
              {a.dataAvaliacao}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
