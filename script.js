/* ========================================================
   COR & FLOR, interactions
======================================================== */

/* ---------- PRODUCT DATA ---------- */
const products = [
  { id: 1, name: "Blusa Drapeado Sereno", category: "Blusa", price: 129, originalPrice: 199.90, badge: "SALE",
    image: "assets/p-blusa-azul.png",
    colors: [{ name: "Azul Sereno", hex: "#9CAEB8" }],
    sizes: ["36","42"],
    description: "Blusa de tecido fluido com drapeado assimétrico que valoriza o corpo com suavidade. Ideal para compor looks do dia a dia com elegância descomplicada.",
    material: "96% viscose, 4% elastano. Tecido leve, fluido e de toque macio. Não amassa.",
    care: "Lavar à mão ou na máquina em ciclo delicado, água fria. Não torcer. Secar à sombra na horizontal.",
    fit: "Modelagem solta com queda suave. Veste bem nos tamanhos 34 ao 42. A modelo usa tamanho 36."
  },
  { id: 2, name: "Vestido Citrus", category: "Vestido Midi", price: 149, originalPrice: null, badge: "NOVO",
    image: "assets/p-vestido-laranja.png",
    colors: [{ name: "Laranja Citrus", hex: "#F4A05B" }, { name: "Rosa Claro", hex: "#F4C9D8" }],
    sizes: ["P","M","G"],
    description: "Vestido midi vibrante em tom citrus, com caimento elegante e corte que valoriza a silhueta. Uma peça que transforma qualquer dia em celebração.",
    material: "100% algodão com fio egípcio. Tecido respirável, macio e de alta durabilidade.",
    care: "Lavar na máquina em ciclo delicado com água fria. Passar com ferro morno pelo avesso.",
    fit: "Modelagem ajustada no busto com saia evazê. Para um caimento soltinho, suba um tamanho."
  },
  { id: 3, name: "Conjunto Rosé", category: "Conjunto Cropped", price: 259, originalPrice: null, badge: "NOVO",
    image: "assets/p-conjunto-rosa.png",
    colors: [{ name: "Rosé", hex: "#E29AB0" }, { name: "Nude", hex: "#F9EFF0" }],
    sizes: ["36","38","40","42"],
    description: "Conjunto cropped + calça pantalona em tecido de malha rosé. Peças vendidas juntas que combinam conforto e sofisticação em harmonia perfeita.",
    material: "85% poliéster, 15% elastano. Malha de alta compressão com brilho acetinado.",
    care: "Lavar à mão com sabão neutro. Não usar amaciante. Secar à sombra.",
    fit: "Cropped com ajuste abaixo do busto. Calça modelagem slim de cintura alta. Segue tabela padrão."
  },
  { id: 4, name: "Body Bronze", category: "Body Drapeado", price: 199, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/p-body-marrom.png",
    colors: [{ name: "Bronze Escuro", hex: "#7A4234" }, { name: "Caramelo", hex: "#C4956A" }],
    sizes: ["P"],
    description: "Body drapeado em tom bronze com abertura profunda nas costas. Peça exclusiva que exige atitude, para noites que ficam na memória.",
    material: "78% nylon, 22% elastano. Tecido com compressão suave e acabamento fosco premium.",
    care: "Lavar somente à mão com água fria e sabonete neutro. Secar sobre superfície plana.",
    fit: "Modelagem colada ao corpo. Recomendamos medir busto e quadril antes de escolher. Disponível em tamanho P."
  },
  { id: 5, name: "Saia Cetim Lua", category: "Saia Longa", price: 239, originalPrice: null, badge: null,
    image: "assets/p-saia-cetim.png",
    colors: [{ name: "Prata Lua", hex: "#C9CACE" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["36","38","40"],
    description: "Saia longa de cetim com reflexos suaves que evocam o brilho da lua. Fluida, elegante e atemporal, a peça-chave de um guarda-roupa consciente.",
    material: "100% poliéster cetinado de gramatura alta. Forro interno em chiffon.",
    care: "Lavar na máquina em ciclo delicado. Passar com ferro a vapor pelo avesso em temperatura média.",
    fit: "Cós elástico para conforto máximo. Comprimento midi até o tornozelo (aprox. 90cm). Para corpos mais altos, considere um tamanho acima."
  },
  { id: 6, name: "Blazer Camélia", category: "Blazer", price: 379, originalPrice: null, badge: "NOVO",
    image: "assets/p-blazer-caqui.png",
    colors: [{ name: "Caqui Camélia", hex: "#8C7350" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["38","40","42"],
    description: "Blazer estruturado em tweed misto com botões dourados e lapela clássica. Transita do trabalho à noite com elegância natural e sem esforço.",
    material: "60% lã, 35% poliéster, 5% elastano. Forro de seda sintética. Botões em metal dourado.",
    care: "Limpeza a seco recomendada. Para lavagem em casa, ciclo delicado em água fria com cuidado extra na estrutura dos ombros.",
    fit: "Modelagem slim com ombros levemente estruturados. Caimento alinhado ao corpo. Comprimento no quadril."
  },
  { id: 7, name: "Regata Pérola", category: "Regata Cetim", price: 89, originalPrice: 139.90, badge: "SALE",
    image: "assets/p-regata-branca.png",
    colors: [{ name: "Pérola", hex: "#F5F2EC" }, { name: "Bege", hex: "#E8DDD0" }],
    sizes: ["P","M","G","GG"],
    description: "Regata de cetim leve com alças finas e bojo removível. Uma peça versátil que funciona sozinha ou por baixo de sobreposições com charme discreto.",
    material: "100% seda sintética cetinada. Bojo em esponja removível. Alças reguláveis.",
    care: "Lavar somente à mão com sabonete neutro. Não torcer. Secar à sombra deitada sobre toalha.",
    fit: "Modelagem ajustada com bojo leve. Para usar por baixo de blazers e sobreposições, suba um tamanho."
  },
  { id: 8, name: "Conjunto Cargo Azul", category: "conjuntos", price: 199.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-cargo-azul.png",
    colors: [{ name: "Azul Claro", hex: "#8FA8C0" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G"],
    description: "Conjunto urbano com calça cargo azul de cintura alta e body preto gola alta. Combinação arrojada que une estilo despojado e feminilidade com muita personalidade.",
    material: "Calça em gabardine leve com bolsos laterais. Body em malha elástica confortável.",
    care: "Lavar na máquina em ciclo delicado, água fria. Não usar secadora.",
    fit: "Calça de cintura alta modelagem ampla. Body ajustado ao corpo. Segue tabela padrão."
  },
  { id: 9, name: "Conjunto Linho Bege", category: "conjuntos", price: 179.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-conj-bege.png",
    colors: [{ name: "Bege Off-White", hex: "#E8DDD0" }],
    sizes: ["P","M","G","GG"],
    description: "Conjunto elegante em linho bege com short de cintura alta e blusa estruturada. Perfeito para almoços e eventos ao ar livre com toda a sofisticação que você merece.",
    material: "70% linho, 30% viscose. Tecido respirável e de toque suave.",
    care: "Lavar na máquina em ciclo delicado, água fria. Passar com ferro morno.",
    fit: "Short de cintura alta com cós largo. Blusa com modelagem reta e levemente ampla."
  },
  { id: 10, name: "Macacão Glamour Nude", category: "conjuntos", price: 239.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-macacao-nude.png",
    colors: [{ name: "Nude", hex: "#C4956A" }, { name: "Bege", hex: "#E8DDD0" }],
    sizes: ["P","M","G"],
    description: "Macacão curto em tom nude com cinto dourado que valoriza a silhueta. Peça versátil que passa do trabalho à balada com elegância e praticidade únicos.",
    material: "95% poliéster, 5% elastano. Tecido com leve brilho acetinado.",
    care: "Lavar à mão com sabão neutro em água fria. Não usar secadora.",
    fit: "Modelagem ajustada com decote em V. Cinto removível. Segue tabela padrão."
  },
  { id: 11, name: "Conjunto Preto Refinado", category: "conjuntos", price: 199.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-conj-preto.png",
    colors: [{ name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G","GG"],
    description: "Conjunto preto atemporal com short de alfaiataria e blusa sem mangas estruturada. O cinto dourado completa o look com sofisticação que nunca sai de moda.",
    material: "Crepe de alta qualidade com caimento impecável. Cinto em metal dourado incluso.",
    care: "Lavar na máquina ciclo delicado, separado das roupas coloridas.",
    fit: "Short de cintura alta com abertura lateral. Blusa com alças largas. Segue tabela padrão."
  },
  { id: 12, name: "Tricot Rosê Manguinha", category: "blusas", price: 159.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-tricot-rose.png",
    colors: [{ name: "Rosê", hex: "#C4826A" }, { name: "Caramelo", hex: "#C4956A" }],
    sizes: ["P","M","G"],
    description: "Blusa tricot rosê one-shoulder com manga fina e textura canelada. Combina elegância casual com o conforto do tricot para um visual sofisticado no dia a dia.",
    material: "80% viscose, 20% poliamida. Tricot canelado de malha fina.",
    care: "Lavar à mão com água fria e sabonete neutro. Secar à sombra deitado.",
    fit: "Modelagem ajustada. One-shoulder com alça única. Recomendamos verificar a tabela de medidas."
  },
  { id: 13, name: "Tricot Marrom Gola Alta", category: "blusas", price: 189.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-tricot-marrom.png",
    colors: [{ name: "Marrom Chocolate", hex: "#4A2F1A" }, { name: "Caramelo", hex: "#C4956A" }],
    sizes: ["P","M","G","GG"],
    description: "Tricot de gola alta em marrom chocolate com textura torcida que aquece com estilo. Uma peça de inverno que não abre mão da elegância em nenhum momento.",
    material: "60% lã merino, 40% acrílico. Tricot de espessura média com toque suave.",
    care: "Lavar à mão com sabão especial para lã em água fria. Secar deitado à sombra.",
    fit: "Modelagem solta e confortável. Gola alta que pode ser dobrada. Manga longa."
  },
  { id: 14, name: "Look Tricot Cinza + Short Saia", category: "conjuntos", price: 189.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-look-cinza.png",
    colors: [{ name: "Cinza", hex: "#9A9A9A" }, { name: "Marrom", hex: "#6B4226" }],
    sizes: ["P","M","G"],
    description: "Look poderoso com tricot cropped cinza e short saia de couro marrom. Contraste de texturas que cria um visual editorial cheio de atitude e feminilidade.",
    material: "Tricot em viscose canelada. Short saia em couro ecológico de alta qualidade.",
    care: "Tricot: lavar à mão. Short saia: limpar com pano úmido.",
    fit: "Tricot cropped com barra assimétrica. Short saia de cintura alta com botões laterais."
  },
  { id: 15, name: "Look Tricot Azul + Calça Couro", category: "conjuntos", price: 189.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-look-azul.png",
    colors: [{ name: "Azul Marinho", hex: "#1A2744" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G"],
    description: "Combinação sofisticada de tricot azul marinho com calça de couro preta. Look poderoso para ocasiões especiais que pede confiança e estilo.",
    material: "Tricot em viscose grossa. Calça em couro ecológico com elastano.",
    care: "Tricot: lavar à mão com água fria. Calça: limpar com pano úmido e condicionador de couro.",
    fit: "Tricot cropped one-shoulder. Calça slim de cintura alta com fechamento lateral."
  },
  { id: 16, name: "Macacão Estampa Zebra", category: "conjuntos", price: 299.90, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/lj-macacao-zebra.png",
    colors: [{ name: "Animal Print", hex: "#F5F0E8" }],
    sizes: ["P","M","G"],
    description: "Macacão pantalona em estampa zebra com ombro único e lenço coordenado. Uma declaração de moda para quem não tem medo de ser notada e adora tendências.",
    material: "100% viscose com estampa animal print exclusiva. Tecido leve e fluido.",
    care: "Lavar à mão ou em ciclo delicado. Não usar alvejante.",
    fit: "Modelagem ampla pantalona. Ombro único com lenço decorativo incluso. Cinto incluso."
  },
  { id: 17, name: "Conjunto Off-White Drapeado", category: "conjuntos", price: 229.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-conj-offwhite.png",
    colors: [{ name: "Off-White", hex: "#F5F0E8" }, { name: "Bege", hex: "#E8DDD0" }],
    sizes: ["P","M","G"],
    description: "Conjunto refinado com top drapeado assimétrico e short saia off-white. A combinação perfeita de elegância e leveza para eventos e jantares sofisticados.",
    material: "95% poliéster, 5% elastano. Tecido drapeado de alta fluidez com leve brilho.",
    care: "Lavar à mão com sabão neutro em água fria. Secar à sombra.",
    fit: "Top com drapeado frontal e amarração nas costas. Short saia com cós elástico."
  },
  { id: 18, name: "Corset Preto", category: "blusas", price: 129.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-corset-preto.png",
    colors: [{ name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G"],
    description: "Corset preto estruturado que define a silhueta com elegância. Versátil para usar por dentro da calça ou saia, transforma qualquer look em um statement de moda.",
    material: "Tecido estruturado com barbatanas internas e forro. Fechamento frontal com colchetes.",
    care: "Lavar somente à mão com cuidado nas barbatanas. Não torcer.",
    fit: "Corset com modelagem estruturada. Consulte tabela de medidas de busto para escolher o tamanho."
  },
  { id: 19, name: "Vestido Verde Longo Renda", category: "vestidos", price: 299.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-vestido-verde.png",
    colors: [{ name: "Verde Esmeralda", hex: "#2E7D4F" }],
    sizes: ["P","M","G"],
    description: "Vestido longo verde esmeralda com renda bordada e recorte lateral. Uma peça deslumbrante para ocasiões especiais que pede toda a atenção para você.",
    material: "Tecido principal em crepe. Renda em 100% poliéster com bordado artesanal.",
    care: "Limpeza a seco recomendada. Lavar à mão com muito cuidado na renda.",
    fit: "Modelagem ajustada no busto e quadril com saia fluida. Recorte lateral com elástico."
  },
  { id: 20, name: "Vestido Preto Paetê", category: "vestidos", price: 249.90, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/lj-vestido-paete.png",
    colors: [{ name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G"],
    description: "Vestido curto preto com saia em paetê brilhante e top recortado. A pedida certeira para noites inesquecíveis que merecem uma peça à altura da ocasião.",
    material: "Top em tecido elástico. Saia em tecido de paetê costurado à mão.",
    care: "Limpeza a seco recomendada para preservar o paetê.",
    fit: "Top ajustado com recorte frontal. Saia rodada acima do joelho. Modelagem estruturada."
  },
  { id: 21, name: "Colete Vermelho", category: "blazers", price: 99.90, originalPrice: null, badge: "NOVO",
    image: "assets/lj-colete-vermelho.png",
    colors: [{ name: "Vermelho", hex: "#C0392B" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G","GG"],
    description: "Colete vermelho com botões dourados para compor looks poderosos. Peça coringa que transforma qualquer produção em um visual elegante e marcante.",
    material: "Crepe de alta qualidade com forro interno. Botões em metal dourado.",
    care: "Lavar na máquina em ciclo delicado ou limpeza a seco para maior durabilidade.",
    fit: "Modelagem ajustada com botões na frente. Sem mangas. Comprimento na cintura."
  },
  { id: 22, name: "Macacão Branco One-Shoulder", category: "conjuntos", price: 389.90, originalPrice: null, badge: "EXCLUSIVO",
    image: "assets/lj-macacao-branco.png",
    colors: [{ name: "Branco", hex: "#FAFAFA" }, { name: "Off-White", hex: "#F5F0E8" }],
    sizes: ["38","40","42"],
    description: "Macacão pantalona branco one-shoulder com drapeado sofisticado. Uma peça de luxo para eventos formais, casamentos e festas que exigem elegância impecável.",
    material: "100% viscose premium com leve elastano. Acabamento de alta costura.",
    care: "Limpeza a seco recomendada. Lavar à mão somente em água fria com sabão neutro.",
    fit: "Modelagem pantalona de cintura alta. Ombro único estruturado. Disponível nos números 38, 40 e 42."
  },
  { id: 23, name: "Cropped Couro Caramelo", category: "blusas", price: 189.00, originalPrice: null, badge: "NOVO",
    image: "assets/lj-cropped-caramelo.png",
    colors: [{ name: "Caramelo", hex: "#C4956A" }, { name: "Preto", hex: "#1C1414" }],
    sizes: ["P","G"],
    description: "Cropped em couro ecológico caramelo com bojo embutido e barra reta. Peça versátil que eleva qualquer look com um toque de atitude e feminilidade sofisticada.",
    material: "Couro ecológico de alta qualidade com forro interno e bojo removível.",
    care: "Limpar com pano úmido suave. Não mergulhar em água. Aplicar condicionador de couro periodicamente.",
    fit: "Modelagem ajustada com bojo embutido. Disponível em P e G. Consulte tabela de medidas."
  },
  { id: 24, name: "Short Couro Preto", category: "calcas", price: 69.90, originalPrice: 99.90, badge: "SALE",
    image: "assets/lj-short-couro.png",
    colors: [{ name: "Preto", hex: "#1C1414" }],
    sizes: ["P","M","G"],
    description: "Short de couro ecológico preto com cinto de argolas e cintura alta. Uma peça statement que combina rock e feminilidade para looks ousados e cheios de estilo.",
    material: "Couro ecológico com forro interno. Cinto de argolas removível incluso.",
    care: "Limpar com pano úmido. Não lavar na máquina. Guardar em local arejado.",
    fit: "Cintura alta com cós largo. Modelagem reta. Disponível em P, M e G."
  },
  { id: 25, name: "Calça Jeans Reta", category: "calcas", price: 279.00, originalPrice: null, badge: "NOVO",
    image: "assets/lj-calca-jeans.png",
    colors: [{ name: "Azul Médio", hex: "#4A6FA5" }, { name: "Azul Escuro", hex: "#2C3E6B" }],
    sizes: ["38","40","42"],
    description: "Calça jeans reta de cintura alta com caimento impecável e tecido premium. Uma peça essencial no guarda-roupa feminino que combina com absolutamente tudo.",
    material: "98% algodão, 2% elastano. Jeans premium lavagem média com tratamento antidesbotamento.",
    care: "Lavar na máquina ao contrário em água fria. Não usar alvejante. Secar à sombra.",
    fit: "Modelagem reta de cintura alta. Disponível nos números 38, 40 e 42."
  },
  { id: 26, name: "Vestido Vermelho Midi", category: "vestidos", price: 189.00, originalPrice: 299.00, badge: "SALE",
    image: "assets/lj-vestido-vermelho.png",
    colors: [{ name: "Vermelho", hex: "#C0392B" }],
    sizes: ["P","GG"],
    description: "Vestido midi vermelho com franzido lateral que valoriza cada curva com elegância. Para ocasiões especiais onde você quer ser a protagonista da noite.",
    material: "95% poliéster, 5% elastano. Tecido de malha stretch com franzido.",
    care: "Lavar na máquina em ciclo delicado. Não torcer. Pendurar para secar.",
    fit: "Modelagem ajustada com franzido no quadril. Disponível em P e GG. Comprimento midi."
  },
  { id: 27, name: "Regata Tule Preta", category: "blusas", price: 89.00, originalPrice: 139.90, badge: "SALE",
    image: "assets/lj-regata-preta.png",
    colors: [{ name: "Preto", hex: "#1C1414" }, { name: "Branco", hex: "#FAFAFA" }],
    sizes: ["38","40","42"],
    description: "Regata preta com sobreposição em tule transparente e alças estruturadas. Peça sofisticada que transita entre o dia e a noite com charme e elegância incomparáveis.",
    material: "Regata em cetim. Sobreposto em tule 100% poliéster. Alças reguláveis.",
    care: "Lavar à mão com sabonete neutro em água fria. Secar à sombra deitada.",
    fit: "Modelagem ajustada. Alças reguláveis. Disponível nos números 38, 40 e 42."
  },
  { id: 28, name: "Cropped Floral Rosa", category: "blusas", price: 79.00, originalPrice: 129.90, badge: "SALE",
    image: "assets/lj-cropped-floral.png",
    colors: [{ name: "Rosa Floral", hex: "#E8708A" }, { name: "Branco", hex: "#FAFAFA" }],
    sizes: ["P","M","G"],
    description: "Cropped com estampa floral vibrante em rosa e branco. Peça alegre e cheia de personalidade perfeita para dias ensolarados e looks despojados e femininos.",
    material: "100% viscose com estampa digital exclusiva. Tecido leve e fresco.",
    care: "Lavar na máquina em ciclo delicado, separado de roupas escuras. Secar à sombra.",
    fit: "Cropped com barra reta. Decote na frente. Modelagem ajustada. Segue tabela padrão."
  },
  { id: 29, name: "Body One-Shoulder Nude", category: "blusas", price: 199.00, originalPrice: null, badge: "NOVO",
    image: "assets/lj-body-nude.png",
    colors: [{ name: "Nude", hex: "#D4A882" }, { name: "Marrom", hex: "#7A4234" }],
    sizes: ["P","M","G"],
    description: "Body one-shoulder nude com drapeado suave no decote e tecido de segunda pele. Uma peça elegante e sensual que combina com qualquer saia ou calça.",
    material: "92% poliamida, 8% elastano. Tecido de alta compressão com efeito segunda pele.",
    care: "Lavar somente à mão com água fria e sabonete neutro. Secar sobre superfície plana.",
    fit: "Modelagem ajustada ao corpo. One-shoulder com alça única. Fecho com colchetes na entreperna."
  }
];

const BRL = n => "R$ " + n.toFixed(2).replace(".", ",");

/* ---------- CATEGORY CAROUSELS ---------- */
const DISPLAY_CATS = [
  { key: 'conjuntos', label: 'Conjuntos',       eyebrow: 'CONJUNTOS & MACACÕES',
    test: p => /conjuntos|conjunto/i.test(p.category) },
  { key: 'blusas',    label: 'Blusas & Tops',   eyebrow: 'BLUSAS & TOPS',
    test: p => /blusas|blusa|regata|body/i.test(p.category) },
  { key: 'vestidos',  label: 'Vestidos & Saias', eyebrow: 'VESTIDOS & SAIAS',
    test: p => /vestidos|vestido|saia/i.test(p.category) },
  { key: 'calcas',    label: 'Calças & Shorts',  eyebrow: 'CALÇAS & SHORTS',
    test: p => /calcas|calça/i.test(p.category) },
  { key: 'blazers',   label: 'Blazers & Coletes', eyebrow: 'BLAZERS & COLETES',
    test: p => /blazers|blazer/i.test(p.category) },
];

function makeCard(p) {
  const badgeClass = p.badge === "SALE" ? "card__badge--sale"
                   : p.badge === "EXCLUSIVO" ? "card__badge--exclusive" : "";
  const badge   = p.badge ? `<span class="card__badge ${badgeClass}">${p.badge}</span>` : "";
  const was     = p.originalPrice ? `<span class="card__price-was">${BRL(p.originalPrice)}</span>` : "";
  const swatches = p.colors.map(c => `<span class="card__sw" style="background:${c.hex||c}"></span>`).join("");
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="card__media">
      ${badge}
      <button class="card__fav" aria-label="Favoritar ${p.name}">
        <svg width="18" height="18"><use href="#i-heart"/></svg>
      </button>
      <img src="${p.image}" alt="${p.name}" loading="lazy"/>
      <button class="card__add" data-add="${p.id}"><svg width="14" height="14"><use href="#i-bag"/></svg> Adicionar</button>
    </div>
    <div class="card__body">
      <span class="card__cat">${p.category}</span>
      <h3 class="card__name"><a href="produto.html?id=${p.id}" style="color:inherit">${p.name}</a></h3>
      <div class="card__price">
        <span class="card__price-now">${BRL(p.price)}</span>
        ${was}
      </div>
      <div class="card__colors" aria-label="Cores disponíveis">${swatches}</div>
    </div>`;
  el.querySelector('.card__media').addEventListener('click', e => {
    if (!e.target.closest('button')) window.location.href = `produto.html?id=${p.id}`;
  });
  return el;
}

function initCarousel(block) {
  const track = block.querySelector('.carousel-track');
  const prev  = block.querySelector('.car-btn--prev');
  const next  = block.querySelector('.car-btn--next');
  const step  = () => (track.querySelector('.card')?.offsetWidth ?? 280) + 20;

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left:  step(), behavior: 'smooth' }));

  const upd = () => {
    prev.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  track.addEventListener('scroll', upd, { passive: true });
  upd();

  // arrastar com mouse (desktop)
  let dragging = false, sx = 0, ss = 0;
  track.addEventListener('mousedown',  e => { dragging = true; sx = e.clientX; ss = track.scrollLeft; track.style.cursor = 'grabbing'; e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (!dragging) return; track.scrollLeft = ss - (e.clientX - sx); });
  window.addEventListener('mouseup',   () => { dragging = false; track.style.cursor = ''; });

  // swipe touch
  let tx = 0;
  track.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const d = tx - e.changedTouches[0].clientX;
    if (Math.abs(d) > 40) track.scrollBy({ left: d > 0 ? step() : -step(), behavior: 'smooth' });
  }, { passive: true });
}

const catRoot = document.getElementById('categories-root');
DISPLAY_CATS.forEach(cat => {
  const items = products.filter(cat.test);
  if (!items.length) return;

  const block = document.createElement('div');
  block.className = 'cat-block reveal';
  block.id = 'cat-' + cat.key;
  block.innerHTML = `
    <div class="cat-block__head">
      <div>
        <span class="sec-eyebrow">✦ ${cat.eyebrow}</span>
        <h2 class="cat-block__title">${cat.label}</h2>
      </div>
      <div class="car-nav">
        <button class="car-btn car-btn--prev" aria-label="Ver anteriores">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="car-btn car-btn--next" aria-label="Ver mais">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
    <div class="carousel-wrap">
      <div class="carousel-track" id="track-${cat.key}"></div>
    </div>`;

  const track = block.querySelector('.carousel-track');
  items.forEach(p => track.appendChild(makeCard(p)));
  catRoot.appendChild(block);
  initCarousel(block);
});

/* Scroll suave com offset do navbar para links de categoria */
document.querySelectorAll('a[href^="#cat-"], a[href^="#novidades"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 90;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* Favoritar + Carrinho (event delegation no root) */
catRoot.addEventListener('click', e => {
  const fav = e.target.closest('.card__fav');
  if (fav) {
    fav.classList.toggle('is-on');
    fav.querySelector('use').setAttribute('href', fav.classList.contains('is-on') ? '#i-heart-fill' : '#i-heart');
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) addToCart(parseInt(add.dataset.add, 10));
});


/* ---------- NAVBAR SCROLL STATE ---------- */
const nav = document.getElementById("nav");
const onScroll = () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 80);
  // parallax
  document.querySelectorAll("[data-parallax], .hs-img").forEach(el => {
    const speed = parseFloat(el.dataset.parallax);
    const rect = el.getBoundingClientRect();
    const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed * -1;
    el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  });
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();


/* ---------- PAGE LOAD VEIL + HERO ANIM ---------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("page-veil").classList.add("is-out");
    document.querySelector(".hero").classList.add("is-ready");
  }, 350);
  setTimeout(() => {
    document.getElementById("page-veil").remove();
  }, 1900);
});


/* ---------- HERO SLIDER (automático + swipe) ---------- */
(function () {
  const bgs   = document.querySelectorAll(".hs-bg");
  const conts = document.querySelectorAll(".hs-content");
  const dots  = document.querySelectorAll(".hs-dot");
  const hero  = document.querySelector(".hero");
  if (!bgs.length) return;

  let cur = 0, timer;

  function go(n) {
    bgs[cur].classList.remove("active");
    conts[cur].classList.remove("active");
    dots[cur].classList.remove("active");
    cur = ((n % bgs.length) + bgs.length) % bgs.length;
    bgs[cur].classList.add("active");
    conts[cur].classList.add("active");
    dots[cur].classList.add("active");
    clearInterval(timer);
    timer = setInterval(() => go(cur + 1), 6000);
  }

  // Dots
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));

  // Swipe (mobile)
  let touchX = 0;
  hero?.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  hero?.addEventListener("touchend",   e => {
    const diff = touchX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 48) go(diff > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  // Auto
  timer = setInterval(() => go(cur + 1), 6000);
})();


/* ---------- INTERSECTION OBSERVER REVEALS ---------- */
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.classList.add("is-in");
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".reveal").forEach(el => io.observe(el));


/* ---------- MOBILE MENU ---------- */
const burger = document.getElementById("burger");
const mmenu  = document.getElementById("mmenu");
const mclose = document.getElementById("mmenu-close");
burger.addEventListener("click", () => { mmenu.classList.add("is-open"); mmenu.setAttribute("aria-hidden", "false"); });
mclose.addEventListener("click", () => { mmenu.classList.remove("is-open"); mmenu.setAttribute("aria-hidden", "true"); });
mmenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  mmenu.classList.remove("is-open");
}));


/* ---------- DEPOIMENTOS CARROSSEL ---------- */
const slides = document.querySelectorAll(".quote");
const dots   = document.querySelectorAll("#quotes-dots .dot");
let q = 0;
const showQuote = i => {
  slides.forEach((s, k) => s.classList.toggle("is-active", k === i));
  dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
  q = i;
};
dots.forEach((d, i) => d.addEventListener("click", () => showQuote(i)));
setInterval(() => showQuote((q + 1) % slides.length), 5000);


/* ---------- CART ---------- */
const cart = document.getElementById("cart");
const cartVeil = document.getElementById("cart-veil");
const cartList = document.getElementById("cart-list");
const cartCount = document.getElementById("cart-count");
const cartHeadCount = document.getElementById("cart-head-count");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartTotal    = document.getElementById("cart-total");
const cartBanner   = document.querySelector(".cart__banner");
const FRETE_FREE_MIN = 299;

// Carrega do localStorage ou inicia vazio (não seed)
let cartState = JSON.parse(localStorage.getItem('cf_cart') || '[]');

function renderCart() {
  localStorage.setItem('cf_cart', JSON.stringify(cartState));
  cartList.innerHTML = "";
  let subtotal = 0;
  let count = 0;

  cartState.forEach((it, idx) => {
    const p = products.find(x => x.id === it.id);
    if (!p) return;
    subtotal += p.price * it.qty;
    count += it.qty;

    const li = document.createElement("li");
    li.className = "cart__item";
    li.innerHTML = `
      <div class="cart__item-img">
        <button class="cart__item-img-x" data-remove="${idx}" aria-label="Remover">×</button>
        <img src="${p.image}" alt="${p.name}"/>
      </div>
      <div class="cart__item-body">
        <h4 class="cart__item-name">${p.name}</h4>
        <span class="cart__item-size">Tamanho ${it.size}</span>
        <div class="cart__qty">
          <button data-q="-1" data-i="${idx}" aria-label="Diminuir"><svg width="14" height="14"><use href="#i-minus"/></svg></button>
          <span>${it.qty}</span>
          <button data-q="1" data-i="${idx}" aria-label="Aumentar"><svg width="14" height="14"><use href="#i-plus"/></svg></button>
        </div>
      </div>
      <div class="cart__item-price">${BRL(p.price * it.qty)}</div>
    `;
    cartList.appendChild(li);
  });

  if (cartState.length === 0){
    cartList.innerHTML = `<li style="text-align:center;padding:60px 20px;color:var(--warm-gray);font-family:var(--serif);font-style:italic;">Seu jardim está vazio. ✿<br><span style="font-size:13px;font-family:var(--sans);font-style:normal;">Adicione peças que façam você florescer.</span></li>`;
  }

  cartCount.textContent = count;
  cartHeadCount.textContent = `(${count})`;
  cartSubtotal.textContent = BRL(subtotal);
  cartTotal.textContent = BRL(subtotal);

  const missing = Math.max(0, FRETE_FREE_MIN - subtotal);
  cartBanner.innerHTML = missing > 0
    ? `<span>✿</span> Falta <strong>${BRL(missing)}</strong> para frete grátis!`
    : `<span>✿</span> <strong>Você ganhou frete grátis!</strong> 💌`;
}
renderCart();

document.getElementById("open-cart").addEventListener("click", openCart);
document.getElementById("close-cart").addEventListener("click", closeCart);
document.getElementById("cart-continue").addEventListener("click", closeCart);
cartVeil.addEventListener("click", closeCart);
function openCart(){ cart.classList.add("is-open"); cartVeil.classList.add("is-open"); cart.setAttribute("aria-hidden","false"); document.body.style.overflow = "hidden"; }
function closeCart(){ cart.classList.remove("is-open"); cartVeil.classList.remove("is-open"); cart.setAttribute("aria-hidden","true"); document.body.style.overflow = ""; }

cartList.addEventListener("click", e => {
  const q = e.target.closest("[data-q]");
  if (q){
    const i = parseInt(q.dataset.i, 10);
    const d = parseInt(q.dataset.q, 10);
    cartState[i].qty = Math.max(0, cartState[i].qty + d);
    if (cartState[i].qty === 0) cartState.splice(i, 1);
    renderCart();
    return;
  }
  const r = e.target.closest("[data-remove]");
  if (r){
    cartState.splice(parseInt(r.dataset.remove,10), 1);
    renderCart();
  }
});

function addToCart(id){
  const p = products.find(x => x.id === id);
  if (!p) return;
  const existing = cartState.find(x => x.id === id);
  if (existing) existing.qty += 1;
  else cartState.push({ id, qty: 1, size: p.sizes[0] || 'Único', color: p.colors[0]?.hex || p.colors[0] || '' });
  renderCart();
  toast(`✿ ${p.name} entrou no seu jardim`);
  // bump bag icon
  const ic = document.querySelector("#open-cart");
  ic.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(.25,.46,.45,.94)" }
  );
}


/* ---------- TOAST ---------- */
const toastEl = document.getElementById("toast");
let toastT;
function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("is-show"), 2400);
}


/* ---------- CUSTOM CURSOR ---------- */
const cursor = document.getElementById("cursor");
if (window.matchMedia("(hover:hover) and (pointer:fine)").matches){
  let x = 0, y = 0, cx = 0, cy = 0;
  window.addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; });
  const tick = () => {
    cx += (x - cx) * 0.22;
    cy += (y - cy) * 0.22;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(tick);
  };
  tick();
  document.querySelectorAll("a, button, .card").forEach(el => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });
}

