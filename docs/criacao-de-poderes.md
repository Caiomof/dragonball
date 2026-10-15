# Criação de poderes — proposta prática (UI e regras)

## Objetivo

O jogador **monta e equipa** até **6 poderes** na barra inferior. Poderes de demonstração (Kamehameha, etc.) viram **modelos da biblioteca**. O foco é **criar o próprio** (nome, símbolo, cor, tamanho, tipo) e **pagar** para desbloquear tipos e slots extras.

---

## Moeda

| Nome sugerido | Onde ganha | Para quê |
|---------------|------------|----------|
| **Zeni** | missões, bosses de bioma, inimigos, objetos, jornada | comprar **tipos**, **criar** poder, **editar** |
| **Ki reservado** | não é moeda — gasto **na hora do uso** | equilibrar poder forte = mais ki por disparo |

### Como ganhar Zeni (jogo final)

| Fonte | O que o jogador faz | Recompensa (faixa) |
|-------|---------------------|--------------------|
| **Missões curtas** | painel no santuário (ex.: destruir rochas, derrotar animais) | 80–250 Zeni |
| **Missão de bioma** | 2–3 objetivos na planície / deserto / neve | 400–900 Zeni |
| **Boss do bioma** | **invocar** no altar → lutar → vencer | 1.200–2.800 Zeni |
| **Combate** | animais, totem (pouco) | 5–40 Zeni |
| **Mundo** | pedras e árvores | 2–15 Zeni |
| **Jornada** | marcos (santuários, voo, nado) | pacotes únicos |

**Boss por bioma:**

| Bioma | Boss | Invocação |
|-------|------|-----------|
| Planície | guardião do totem | totem / clareira |
| Deserto | titã das dunas | santuário das dunas |
| Neve | colosso da aurora | farol da aurora |

UI: **Desafiar guardião** → confirma → spawn → vida do boss → vitória mostra **+Zeni** (cooldown no protótipo: ~5 min).

### Protótipo — regular Zeni (só teste)

Em **Configurações (O)** ou debug — **não** existe no jogo final:

| Controle | Função |
|----------|--------|
| **Saldo** | número ou slider (0–99.999) — quanto você tem agora |
| **+500 / +2.000** | testar compras rápido |
| **Zerar** | saldo 0 |
| **Multiplicador de ganho** (opcional) | ×1 / ×2 / ×5 em missões e boss |

Persiste no perfil só no protótipo.

**Custos sugeridos (ajustáveis):**

- Desbloquear **tipo** na biblioteca (ex.: Disco, Feixe fino): 800–2.500 Zeni (feixe fino mais caro).
- **Criar** um poder (uma ficha na coleção): 400 Zeni + tipo já desbloqueado.
- **Editar** estética depois: 150 Zeni.
- **Voo** e **Teleporte**: habilidades da biblioteca, 3.000 / 5.000 Zeni (não são “projéteis”).

No início: **1 tipo grátis** + **Zeni inicial** (ex.: 1.200) para criar o primeiro poder sem travar.

---

## O que o jogador customiza (por poder)

| Campo | O que vê na UI | Efeito no jogo (simples) |
|-------|----------------|---------------------------|
| **Nome** | texto (máx. 20) | só identidade + barra |
| **Símbolo** | grade de ícones (★ ◉ ✦ ◇ ▲ ● ⚡ etc.) | só barra |
| **Cor principal** | paleta + seletor | cor do VFX e do projétil |
| **Cor do núcleo** | opcional (mais clara) | centro do efeito |
| **Tamanho** | slider **Pequeno → Enorme** (3 ou 5 passos) | raio visual + área de hit (maior = mais fácil acertar, mais ki) |
| **Tipo** | escolha na biblioteca (bloqueado até comprar) | define **forma** e **regra** (tabela abaixo) |

**Não** pedir edição de mesh/código — só **presets** com variação de cor e tamanho.

---

## Tipos da biblioteca (base de jogo)

Cada tipo é um **molde**. O jogador compra o molde, depois cria quantas **variantes** quiser (cores/tamanhos/nomes).

| Tipo | Fantasia | Comportamento resumido |
|------|----------|-------------------------|
| **Bola** | ki ball | médio alcance, fácil de acertar, dano médio |
| **Feixe largo** | kame-style | alcance alto, carrega, dano alto, hitbox largo |
| **Feixe fino** | sniper | alcance máximo, carrega, dano muito alto, hitbox fino (difícil) |
| **Disco** | kienzan | curva/lento ou reta, corta, dano alto em linha |
| **Rajada** | metralhadora | curto alcance, vários tiros rápidos, dano baixo por hit |
| **Explosão perto** | onda / soco energético | só curto alcance, sem projétil longo, alto dano melee |
| **Voo** | toggle | já existe no jogo; vira **habilidade equipável** (slot gasta ki contínuo) |
| **Teleporte** | blink curto | custo ki alto, CD longo, alcance fixo à frente |

*Demonstrações atuais = variantes pré-feitas desses tipos (nomes fixos até o jogador criar os dele).*

---

## Como tamanho e cor “pesam” no equilíbrio

Regra fácil de explicar na UI (tooltip):

- **Maior** → +dano e +ki por uso, +área; **Menor** → oposto.
- **Feixe fino** ignora parte do bônus de tamanho na área, mas ganha +dano se Pequeno.
- Cor **não** muda número — só visual (evita pay-to-win de cor).

Fórmula escondida; o jogador vê **estrelas** ou barras: Dano · Alcance · Ki · Dificuldade de acerto.

---

## UI — Barra de 6 poderes (HUD)

- **6 slots** fixos (teclas **1–6**), **sem scroll**.
- Cada slot: ícone + nome curto + cooldown/ki (como hoje).
- Slot vazio: “+” abre **Biblioteca**.
- Clique direito ou ícone de engrenagem no slot: **trocar** ou **editar** poder equipado.

---

## UI — Modal “Biblioteca de poderes”

Abre por **K** (ou botão na barra). Duas abas:

### Aba **Meus poderes**

Lista em cards: símbolo, nome, tipo, cor (faixa), barras de resumo.

- **Equipar** → escolhe slot 1–6.
- **Editar** → vai ao criador (custo Zeni se já criado).
- **Criar novo** → criador.

### Aba **Loja de tipos**

Grid de tipos com preço em Zeni, descrição em uma linha, botão **Desbloquear**.

Filtros: Todos · Ataque · Movimento · Defesa (voo/teleporte em Movimento).

---

## UI — Modal “Criar / editar poder”

Passo único (uma tela, sem wizard longo):

1. **Tipo** (dropdown só com tipos desbloqueados).
2. **Nome** + **Símbolo** (grade).
3. **Cor** + **Núcleo** (swatches).
4. **Tamanho** (slider).
5. **Prévia 3D** ao lado (personagem mini disparando — igual prévia de raça).
6. Rodapé: resumo **Dano / Alcance / Ki / Acerto** + botão **Criar (400 Z)** ou **Salvar**.

Se tipo = **Voo** ou **Teleporte**: esconder tamanho; mostrar só duração/alcance/CD fixos do tipo.

---

## Fluxo do jogador (exemplo)

1. Ganha Zeni na planície.
2. Abre biblioteca → desbloqueia **Bola** (grátis ou barato).
3. Cria “Esfera Azul” (cor azul, tamanho M).
4. Equipa no slot **2**.
5. Depois desbloqueia **Feixe fino**, cria “Raio Preciso” (pequeno, vermelho), equipa no **4**.
6. Compra **Voo**, equipa no **6** (substitui duplo espaço ou complementa — definir no implementar).

---

## MVP (primeira entrega)

- Moeda **Zeni** + saldo no HUD (canto superior, perto de ki/stamina).
- **Ganhar Zeni:** 1 missão simples + 1 boss invocável na planície + quebráveis (valores fixos).
- **Protótipo:** ajuste de saldo e +Zeni rápido em Configurações.
- Biblioteca + criar com: tipo (3 ataque: Bola, Feixe largo, Disco) + nome + símbolo + cor + tamanho.
- Barra **6 slots**, sem scroll; equipar pela biblioteca.
- Poderes salvos no **perfil** (Postgres/API depois; protótipo pode local só se combinado).
- Voo na biblioteca como habilidade equipável (mesma mecânica atual).

**Depois:** bosses nos 3 biomas, missões por bioma, multiplicador de ganho, Feixe fino, Rajada, Explosão perto, Teleporte, prévia 3D rica.

---

## Decisões em aberto (curtas)

1. Voo continua **Espaço×2** ou só pelo slot equipado?
2. Teleporte: para frente fixo ou mira no chão?
3. Limite de poderes **criados** por personagem (ex.: 12) ou ilimitado?
4. Poderes da demo somem ou viram “cartas legado” na biblioteca?
5. Boss: reinvocável com cooldown ou só uma vitória por bioma?
6. Missões: geradas por bioma ou fixas por santuário?

---

*Documento para alinhamento de produto — sem implementação técnica.*
