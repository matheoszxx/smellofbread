(() => {
  "use strict";
  document.documentElement.classList.add("js");

  // ---------- Utilitários ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const fmt = (centavos) => moeda.format(centavos / 100);
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const toque = matchMedia("(pointer: coarse)").matches;
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ITENS = [];
  CARDAPIO.forEach((cat) => {
    cat.itens.forEach((it) => {
      ITENS.push({
        ...it,
        id: it.nome,
        categoria: cat.id,
        centavos: Math.round(it.preco * 100),
        min: it.especial ? CONFIG.minimoEspecial : it.minimo || CONFIG.minimoPadrao,
      });
    });
  });
  const porId = Object.fromEntries(ITENS.map((i) => [i.id, i]));

  // ---------- Estado (salvo no aparelho) ----------
  const CHAVE = "cheirodepao-encomenda-v2";
  let estado = { qtd: {}, ordem: [], nome: "", data: "", hora: "", pagamento: "", obs: "" };
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo && typeof salvo === "object") estado = { ...estado, ...salvo };
    Object.keys(estado.qtd).forEach((id) => { if (!porId[id]) delete estado.qtd[id]; });
    estado.ordem = (estado.ordem || []).filter((id) => estado.qtd[id]);
    Object.keys(estado.qtd).forEach((id) => { if (!estado.ordem.includes(id)) estado.ordem.push(id); });
  } catch (_) { /* ignora */ }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (_) {} };

  // Último pedido enviado (para o botão "Repetir último pedido")
  const CHAVE_ULTIMO = "cheirodepao-ultimo-pedido";
  let ultimo = null;
  try {
    const u = JSON.parse(localStorage.getItem(CHAVE_ULTIMO));
    if (u && u.qtd) {
      u.ordem = (u.ordem || Object.keys(u.qtd)).filter((id) => porId[id] && u.qtd[id]);
      if (u.ordem.length) ultimo = u;
    }
  } catch (_) { /* ignora */ }

  // Se o pedido anterior já foi enviado, começa uma bandeja nova (mantém nome e pagamento)
  if (estado.enviado) {
    estado = { ...estado, qtd: {}, ordem: [], data: "", hora: "", obs: "", enviado: false };
    salvar();
  }

  let abaAtual = CARDAPIO[0].id;

  // ---------- Cálculos ----------
  const selecionados = () => estado.ordem.filter((id) => estado.qtd[id]).map((id) => ({ ...porId[id], q: estado.qtd[id] }));

  const totais = () => {
    const sel = selecionados();
    const unidades = sel.reduce((s, i) => s + i.q, 0);
    const total = sel.reduce((s, i) => s + i.q * i.centavos, 0);
    const entrada = Math.ceil((total * CONFIG.entradaPercentual) / 100);
    return { sel, unidades, total, entrada, temEspecial: sel.some((i) => i.especial) };
  };

  // Quantas unidades cada peça 3D representa (mantém a bandeja legível)
  const MAX_PECAS = 140;
  const unidadesPorPeca = (unidades) => Math.max(5, Math.ceil(unidades / MAX_PECAS / 5) * 5);

  const hojeISO = (somaDias = 0) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + somaDias);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const antecedencia = () => (totais().temEspecial ? CONFIG.antecedenciaEspecial : CONFIG.antecedenciaPadrao);
  const dataMinima = () => hojeISO(antecedencia());
  const dataBR = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    const dt = new Date(a, m - 1, d);
    return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
  };

  // ---------- Comunicação com a cena 3D ----------
  const estadoBandeja = () => {
    const t = totais();
    const unidade = unidadesPorPeca(t.unidades);
    return {
      unidade,
      itens: t.sel.map((i) => ({ id: i.id, nome: i.nome, forma: i.forma, q: i.q, pecas: Math.max(1, Math.round(i.q / unidade)) })),
    };
  };
  const notificar = () => document.dispatchEvent(new CustomEvent("encomenda:mudou", { detail: estadoBandeja() }));
  const destacar = (id) => document.dispatchEvent(new CustomEvent("encomenda:destaque", { detail: { id } }));

  // ---------- Aviso ----------
  let timerAviso;
  const avisar = (texto) => {
    const el = $("#aviso");
    el.textContent = texto;
    el.classList.add("visivel");
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => el.classList.remove("visivel"), 2800);
  };

  // ---------- Quantidades ----------
  const definirQtd = (id, valor, origem) => {
    const item = porId[id];
    const antes = estado.qtd[id] || 0;
    let q = Math.max(0, Math.floor(Number(valor) || 0));
    if (q > 0 && q < item.min) {
      if (origem === "digitado") avisar(`${item.nome}: mínimo de ${item.min} unidades.`);
      q = origem === "menos" ? 0 : item.min;
    }
    if (q > 9999) q = 9999;

    if (q === 0) {
      delete estado.qtd[id];
      estado.ordem = estado.ordem.filter((x) => x !== id);
    } else {
      estado.qtd[id] = q;
      if (!estado.ordem.includes(id)) estado.ordem.push(id);
    }

    if (antes === 0 && q > 0 && item.especial) {
      avisar(`Item especial: mínimo de ${item.min} un. e ${CONFIG.antecedenciaEspecial} dias de antecedência.`);
    }
    salvar();
    atualizarItem(id, q > antes);
    atualizarAbas();
    atualizarResumoGeral();
    notificar();
  };

  // ---------- Abas ----------
  const renderAbas = () => {
    const abas = $("#abas");
    CARDAPIO.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "aba";
      b.setAttribute("role", "tab");
      b.dataset.aba = c.id;
      b.innerHTML = `${c.nome}<span class="contador" hidden></span>`;
      abas.appendChild(b);
    });
    atualizarAbas();
  };

  const moverIndicador = () => {
    const ativa = $(`.aba[data-aba="${abaAtual}"]`);
    const ind = $("#aba-indicador");
    if (!ativa) return;
    ind.style.width = `${ativa.offsetWidth}px`;
    ind.style.transform = `translateX(${ativa.offsetLeft}px)`;
  };

  const atualizarAbas = () => {
    $$(".aba").forEach((b) => {
      const n = ITENS.filter((i) => i.categoria === b.dataset.aba && estado.qtd[i.id]).length;
      const c = $(".contador", b);
      c.hidden = n === 0;
      c.textContent = n;
      b.setAttribute("aria-selected", String(b.dataset.aba === abaAtual));
    });
    moverIndicador();
  };

  // ---------- Lista ----------
  const detalheItem = (item, q) => {
    let html = `${fmt(item.centavos)} / un.`;
    if (q > 0) html += ` · <span class="subtotal">${fmt(q * item.centavos)}</span>`;
    if (item.especial) html += ` <span class="selo">Especial</span>`;
    else if (item.min !== CONFIG.minimoPadrao) html += ` · mín. ${item.min} un.`;
    return html;
  };

  const htmlItem = (item, i) => {
    const q = estado.qtd[item.id] || 0;
    return `
      <li class="item${q ? " ativo" : ""}" data-id="${item.id}" style="animation-delay:${Math.min(i, 12) * 35}ms">
        <div class="item-info">
          <div class="item-nome">${item.nome}</div>
          <div class="item-detalhe">${detalheItem(item, q)}</div>
        </div>
        <div class="qtd${q ? "" : " vazio"}">
          <button type="button" class="menos" aria-label="Diminuir ${item.nome}">−</button>
          <input type="number" inputmode="numeric" min="0" step="1" value="${q || ""}" aria-label="Quantidade de ${item.nome}">
          <button type="button" class="mais" aria-label="Adicionar ${item.nome}">${q ? "+" : "Adicionar"}</button>
        </div>
      </li>`;
  };

  const renderLista = () => {
    $("#lista").innerHTML = ITENS.filter((i) => i.categoria === abaAtual).map(htmlItem).join("");
  };

  const atualizarItem = (id, cresceu) => {
    const li = document.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    const item = porId[id];
    const q = estado.qtd[id] || 0;
    li.classList.toggle("ativo", q > 0);
    $(".item-detalhe", li).innerHTML = detalheItem(item, q);
    const qtd = $(".qtd", li);
    qtd.classList.toggle("vazio", q === 0);
    const input = $("input", li);
    if (document.activeElement !== input) input.value = q || "";
    $(".mais", li).textContent = q ? "+" : "Adicionar";
    if (cresceu) {
      qtd.classList.remove("pulsar");
      void qtd.offsetWidth;
      qtd.classList.add("pulsar");
    }
  };

  // ---------- Bandeja (textos sobre o 3D) e barra ----------
  const atualizarResumoGeral = () => {
    const t = totais();
    const palavra = t.unidades === 1 ? "salgado" : "salgados";
    $("#bandeja").classList.toggle("cheia", t.unidades > 0);
    $("#bandeja-qtd").textContent = `${t.unidades} ${palavra} · ${t.sel.length} ${t.sel.length === 1 ? "sabor" : "sabores"}`;
    $("#bandeja-legenda").textContent = t.unidades ? `cada peça ≈ ${unidadesPorPeca(t.unidades)} un.` : "";
    $("#barra-qtd").textContent = `${t.unidades} ${palavra}`;
    $("#barra-total").textContent = fmt(t.total);
    atualizarRepetir(t.unidades);
    const barra = $("#barra");
    const mostrar = t.unidades > 0 && !$("#painel").classList.contains("aberto");
    barra.classList.toggle("visivel", mostrar);
    barra.setAttribute("aria-hidden", String(!mostrar));
  };

  // ---------- Repetir último pedido ----------
  function atualizarRepetir(unidades) {
    const box = $("#repetir");
    if (!ultimo || unidades > 0) { box.hidden = true; return; }
    const un = ultimo.ordem.reduce((s, id) => s + ultimo.qtd[id], 0);
    const tot = ultimo.ordem.reduce((s, id) => s + ultimo.qtd[id] * porId[id].centavos, 0);
    $("#repetir-resumo").textContent = `${un} salgados · ${ultimo.ordem.length} ${ultimo.ordem.length === 1 ? "sabor" : "sabores"} · ${fmt(tot)}`;
    box.hidden = false;
  }

  const repetirPedido = () => {
    if (!ultimo) return;
    estado.qtd = {};
    estado.ordem = [];
    ultimo.ordem.forEach((id) => {
      const q = Math.max(ultimo.qtd[id], porId[id].min);
      estado.qtd[id] = q;
      estado.ordem.push(id);
    });
    salvar();
    renderLista();
    atualizarAbas();
    atualizarResumoGeral();
    notificar();
    avisar("Pedido anterior carregado. Ajuste o que quiser.");
  };

  // ---------- Painel do pedido ----------
  const renderPainel = () => {
    const t = totais();
    $("#resumo").innerHTML = t.sel
      .map((i) => `<li><span><span class="q">${i.q}×</span>${i.nome}</span><strong>${fmt(i.q * i.centavos)}</strong></li>`)
      .join("");
    $("#total-final").textContent = fmt(t.total);
    $("#entrada").textContent = fmt(t.entrada);
    const data = $("#data");
    data.min = dataMinima();
    $("#dica-data").textContent = t.temEspecial
      ? `Seu pedido tem itens especiais: retirada a partir de ${dataBR(data.min)}.`
      : `Retirada a partir de ${dataBR(data.min)}.`;
  };

  let focoAnterior = null;
  const abrirPainel = () => {
    if (totais().unidades === 0) return;
    renderPainel();
    focoAnterior = document.activeElement;
    const painel = $("#painel");
    painel.classList.add("aberto");
    painel.setAttribute("aria-hidden", "false");
    document.body.classList.add("travado");
    atualizarResumoGeral();
    setTimeout(() => $(".fechar", painel).focus({ preventScroll: true }), 50);
  };
  const fecharPainel = () => {
    const painel = $("#painel");
    if (!painel.classList.contains("aberto")) return;
    painel.classList.remove("aberto");
    painel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("travado");
    atualizarResumoGeral();
    if (focoAnterior) focoAnterior.focus({ preventScroll: true });
  };

  const renderFixos = () => {
    $("#pagamentos").innerHTML = CONFIG.pagamentos
      .map((p) => `<label><input type="radio" name="pagamento" value="${p}"${estado.pagamento === p ? " checked" : ""}><span>${p}</span></label>`)
      .join("");
    $("#condicoes").innerHTML = CONFIG.condicoes.map((c) => `<li>${c}</li>`).join("");
    $("#nome").value = estado.nome;
    $("#data").value = estado.data;
    $("#hora").value = estado.hora;
    $("#obs").value = estado.obs;

    // Links de WhatsApp
    const textoOrcamento = "Olá! Vim pelo site e gostaria de um orçamento de bolo/doces para um evento.";
    $("#link-orcamento").href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(textoOrcamento)}`;
    $("#link-whats-rodape").href = `https://wa.me/${CONFIG.whatsapp}`;
  };

  // ---------- Validação e envio ----------
  const marcarErro = (campo, msg) => {
    const el = document.querySelector(`[data-erro="${campo}"]`);
    if (el) el.textContent = msg || "";
  };

  const validar = () => {
    let primeiro = null;
    const falha = (campo, msg, el) => { marcarErro(campo, msg); if (!primeiro) primeiro = el; };
    ["nome", "data", "pagamento"].forEach((c) => marcarErro(c, ""));

    if (estado.nome.trim().length < 2) falha("nome", "Informe seu nome.", $("#nome"));
    if (!estado.data || !estado.hora) {
      falha("data", "Escolha a data e o horário da retirada.", estado.data ? $("#hora") : $("#data"));
    } else if (estado.data < dataMinima()) {
      const dias = antecedencia();
      falha("data", `Este pedido precisa de ${dias} ${dias === 1 ? "dia" : "dias"} de antecedência. Escolha a partir de ${dataBR(dataMinima())}.`, $("#data"));
    }
    if (!estado.pagamento) falha("pagamento", "Escolha a forma de pagamento.", $("#pagamentos"));

    if (primeiro) {
      primeiro.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", block: "center" });
      if (primeiro.focus) primeiro.focus({ preventScroll: true });
    }
    return !primeiro;
  };

  const montarMensagem = () => {
    const t = totais();
    const linhas = [
      `*Nova encomenda de salgados*`,
      ``,
      `*Nome:* ${estado.nome.trim()}`,
      `*Retirada:* ${dataBR(estado.data)} às ${estado.hora}`,
      `*Pagamento:* ${estado.pagamento}`,
      ``,
      `*Itens*`,
      ...t.sel.map((i) => `• ${i.q}× ${i.nome} — ${fmt(i.q * i.centavos)}`),
      ``,
      `Total de salgados: ${t.unidades} un.`,
      `*Total: ${fmt(t.total)}*`,
      `*Entrada (${CONFIG.entradaPercentual}%): ${fmt(t.entrada)}*`,
    ];
    if (estado.obs.trim()) linhas.push(``, `*Observações:* ${estado.obs.trim()}`);
    return linhas.join("\n");
  };
  const linkWhatsApp = () => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(montarMensagem())}`;

  // ---------- Eventos: cardápio ----------
  $("#abas").addEventListener("click", (e) => {
    const b = e.target.closest(".aba");
    if (!b || b.dataset.aba === abaAtual) return;
    abaAtual = b.dataset.aba;
    atualizarAbas();
    renderLista();
  });

  $("#lista").addEventListener("click", (e) => {
    const li = e.target.closest(".item");
    if (!li) return;
    const id = li.dataset.id;
    const q = estado.qtd[id] || 0;
    if (e.target.closest(".mais")) definirQtd(id, q === 0 ? porId[id].min : q + CONFIG.passo, "mais");
    else if (e.target.closest(".menos")) definirQtd(id, q - CONFIG.passo, "menos");
  });
  $("#lista").addEventListener("change", (e) => {
    if (!e.target.matches(".qtd input")) return;
    const id = e.target.closest(".item").dataset.id;
    definirQtd(id, e.target.value, "digitado");
    e.target.value = estado.qtd[id] || "";
  });
  $("#lista").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".qtd input")) e.target.blur();
  });

  // Destacar as peças do item na bandeja
  $("#lista").addEventListener("pointerover", (e) => {
    const li = e.target.closest(".item");
    if (li && !toque) destacar(li.dataset.id);
  });
  $("#lista").addEventListener("pointerleave", () => destacar(null));
  $("#lista").addEventListener("focusin", (e) => {
    const li = e.target.closest(".item");
    if (li) destacar(li.dataset.id);
  });

  // ---------- Eventos: painel ----------
  $("#abrir-pedido").addEventListener("click", abrirPainel);
  $$("[data-fechar]").forEach((el) => el.addEventListener("click", fecharPainel));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharPainel(); });

  $("#form").addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "nome") { estado.nome = t.value; marcarErro("nome", ""); }
    if (t.id === "data") { estado.data = t.value; marcarErro("data", ""); }
    if (t.id === "hora") { estado.hora = t.value; marcarErro("data", ""); }
    if (t.id === "obs") estado.obs = t.value;
    if (t.name === "pagamento") { estado.pagamento = t.value; marcarErro("pagamento", ""); }
    salvar();
  });
  $("#form").addEventListener("change", (e) => {
    if (e.target.name === "pagamento") { estado.pagamento = e.target.value; marcarErro("pagamento", ""); salvar(); }
  });
  $("#form").addEventListener("submit", (e) => e.preventDefault());

  $("#enviar").addEventListener("click", () => {
    if (totais().unidades === 0 || !validar()) return;
    window.open(linkWhatsApp(), "_blank", "noopener");
    try {
      ultimo = { qtd: { ...estado.qtd }, ordem: [...estado.ordem], em: Date.now() };
      localStorage.setItem(CHAVE_ULTIMO, JSON.stringify(ultimo));
    } catch (_) {}
    estado.enviado = true;
    salvar();
  });

  $("#repetir-botao").addEventListener("click", repetirPedido);

  window.addEventListener("resize", moverIndicador);
  document.fonts && document.fonts.ready.then(moverIndicador);

  // ---------- Início ----------
  renderAbas();
  renderLista();
  renderFixos();
  atualizarResumoGeral();

  // A cena 3D (módulo) chama isto quando estiver pronta
  window.__encomenda = { estadoBandeja, montarMensagem, linkWhatsApp, totais, abrirPainel };
})();
