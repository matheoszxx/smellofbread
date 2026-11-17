// ============================================================
// CONFIGURAÇÃO E CARDÁPIO
// Para mudar preços ou itens, edite somente este arquivo.
// ============================================================

const CONFIG = {
  nomeLoja: "Cheiro de Pão",
  // WhatsApp que recebe os pedidos (formato: 55 + DDD + número, só dígitos)
  whatsapp: "5575982419173",

  // Regras do cardápio enviado pela loja
  minimoPadrao: 10,          // salgados tradicionais: mínimo de 10 por tipo
  minimoEspecial: 25,        // camarão, carne seca e bacalhau: mínimo de 25 por tipo
  antecedenciaEspecial: 2,   // especiais: 2 dias de antecedência
  antecedenciaPadrao: 1,     // PRESSUPOSTO — confirmar com a loja
  passo: 5,                  // quanto o botão "+" soma depois de atingir o mínimo
  entradaPercentual: 50,

  pagamentos: ["Pix", "Dinheiro", "Cartão de crédito"],

  condicoes: [
    "Para confirmar o pedido é necessária entrada de 50%.",
    "Desistência ou reagendamento com reembolso integral somente com 3 dias de antecedência da data e horário de retirada.",
    "Não nos responsabilizamos pela não retirada do produto no dia e horário combinados.",
  ],
};

// especial: true  -> mínimo de 25 un. e 2 dias de antecedência
// minimo: N       -> mínimo próprio do item (sem exigir antecedência extra)
// forma           -> qual peça 3D representa o item na bandeja
const CARDAPIO = [
  {
    id: "fritos",
    nome: "Fritos",
    itens: [
      { nome: "Banana real", forma: "bananaReal", preco: 1.4 },
      { nome: "Bolinha de queijo", forma: "bola", preco: 1.4 },
      { nome: "Bolinha de carne seca com banana", forma: "bola", preco: 1.8, especial: true },
      { nome: "Boliviano de frango", forma: "oval", preco: 1.4 },
      { nome: "Boliviano de carne", forma: "oval", preco: 1.4 },
      { nome: "Camarão encapado", forma: "camarao", preco: 3.0, especial: true },
      { nome: "Coxinha", forma: "coxinha", preco: 1.4 },
      { nome: "Croquete de bacalhau", forma: "croquete", preco: 2.0, especial: true },
      { nome: "Risole de camarão", forma: "risole", preco: 2.0, especial: true },
      { nome: "Pastel frito de carne", forma: "pastel", preco: 1.4 },
      { nome: "Pastel frito de frango", forma: "pastel", preco: 1.4 },
      { nome: "Quibe", forma: "quibe", preco: 1.4 },
      { nome: "Turco (queijo e presunto)", forma: "travesseiro", preco: 1.4 },
      { nome: "Travesseiro de calabresa", forma: "travesseiro", preco: 1.4 },
    ],
  },
  {
    id: "assados",
    nome: "Assados",
    itens: [
      { nome: "Esfirra de frango", forma: "esfirra", preco: 1.4 },
      { nome: "Esfirra de carne", forma: "esfirra", preco: 1.4 },
      { nome: "Enroladinho de queijo e presunto", forma: "enroladinhoQP", preco: 1.4 },
      { nome: "Enroladinho de salsicha", forma: "enroladinhoSalsicha", preco: 1.4 },
      { nome: "Empada doce", forma: "empada", preco: 1.5 },
      { nome: "Empada de frango", forma: "empada", preco: 1.4 },
      { nome: "Empada de bacalhau", forma: "empada", preco: 2.0, especial: true },
      { nome: "Empada de camarão", forma: "empada", preco: 2.0, especial: true },
      { nome: "Barquete de queijo e presunto", forma: "barquete", preco: 1.4 },
      { nome: "Barquete de camarão", forma: "barquete", preco: 2.0, especial: true },
      { nome: "Barquete de bacalhau", forma: "barquete", preco: 2.0, especial: true },
      { nome: "Pastel de forno", forma: "pastelForno", preco: 1.4 },
      { nome: "Saltenha de carne", forma: "saltenha", preco: 1.5 },
      { nome: "Sonho de goiabada", forma: "sonhoGoiabada", preco: 1.5 },
      { nome: "Sonho de doce de leite", forma: "sonhoDoceLeite", preco: 2.0 },
      { nome: "Sonho de chocolate", forma: "sonhoChocolate", preco: 2.0 },
      { nome: "Tropical", forma: "enroladinho", preco: 1.8 },
    ],
  },
  {
    id: "paezinhos",
    nome: "Pãezinhos",
    itens: [
      { nome: "Pãozinho tradicional com recheio", forma: "pao", preco: 1.4 },
      { nome: "Pãozinho queijo cuia", forma: "paoCuia", preco: 1.8 },
      { nome: "Pãozinho peito de peru", forma: "pao", preco: 1.8 },
      { nome: "Pãozinho de atum", forma: "pao", preco: 1.6, minimo: 25 },
      { nome: "Pãozinho de frango", forma: "pao", preco: 1.4 },
      { nome: "Pãozinho queijo parmesão", forma: "paoParmesao", preco: 1.8 },
      { nome: "Pãozinho tradicional sem recheio", forma: "pao", preco: 1.2 },
      { nome: "Pãozinho parmesão sem recheio", forma: "paoParmesao", preco: 1.6 },
      { nome: "Pãozinho queijo cuia sem recheio", forma: "paoCuia", preco: 1.6 },
      { nome: "Mini pão de hot dog", forma: "paoHotdog", preco: 0.5 },
      { nome: "Mini pão de hambúrguer", forma: "paoHamburguer", preco: 0.5 },
      { nome: "Mini hambúrguer", forma: "burger", preco: 2.5 },
    ],
  },
];
