# Clube Vida e Saúde — material de origem da página

Levantamento das fontes oficiais para montar a rota `/vida-e-saude`, seguindo
[o padrão de página de departamento](../patterns/pagina-departamento.md).

Tudo aqui vem dos materiais oficiais do Departamento de Saúde da IASD (Manual do Clube Vida e
Saúde, edição 2022, e Cartilha do Ciclo de Aprendizagem). Nada foi inventado — o que ainda
falta está listado no final, em "Pendências".

---

## 1. O que é o Clube Vida e Saúde

Iniciativa prática para desenvolver a obra médico-missionária na igreja e na comunidade.
São encontros regulares e de longo prazo, com projetos que orientam um estilo de vida
saudável baseado em medidas preventivas e curativas.

**Quem pode participar:** todos — leigos e profissionais de saúde. O clube existe justamente
para fazer trabalhar juntos membros sem formação técnica e médicos, enfermeiros,
nutricionistas, fisioterapeutas e afins.

**Quem dirige:** o diretor do clube, recomendado pela igreja local — normalmente o líder de
saúde — e certificado como Facilitador Vida e Saúde.

### Os oito fundamentos (do manual)

1. Permanente
2. Ênfase educacional e preventiva
3. Atividades práticas
4. Serviço comunitário
5. Espiritualidade
6. Ênfase positiva e inclusiva
7. Convívio social
8. Missão

> Ponto crucial do manual: **o clube não rejeita a medicina tradicional.**

### Estrutura da liderança

| Função | O que faz |
|---|---|
| Diretor(a) | Coordenação geral do clube e da equipe |
| Diretor(a) associado(a) | Auxilia e substitui o diretor |
| Coordenador(a) | Conduz os ciclos de aprendizagem e projetos específicos |
| Secretaria | Registros, organização e acompanhamento dos participantes |
| Tesouraria | Receitas e registros contábeis |
| Voluntário | Ajuda nas atividades; não precisa ser membro da igreja |

Em clubes menores o diretor pode acumular as funções administrativas.

### O que o clube faz na prática

- **Ações avulsas ao longo do ano** — corridas, aulas de culinária, Feira Vida e Saúde.
- **Ciclos de aprendizagem** — séries de encontros semanais (12 encontros de até 1h30),
  com conteúdo, interação, amizade e incentivo à mudança de estilo de vida.
- **Oficinas** — culinária saudável, espiritualidade e saúde, horta orgânica.
- **Pequenos grupos e discipulado** como amadurecimento do vínculo.

### Os 12 temas do ciclo "Quero Mais Vida e Saúde"

1. Estilo de vida e doenças crônicas
2. O estilo de vida é o melhor remédio
3. Alimentação para a longevidade
4. O segundo cérebro
5. Desarmar o diabetes
6. Saúde do coração
7. Saúde dos ossos
8. Seu DNA não é o destino
9. Prevenção do câncer
10. A importância dos bons pensamentos
11. Reestruturando seu ambiente
12. Confiança em Deus

### Os oito remédios naturais

Base da mensagem de saúde adventista, citada no manual como requisito do facilitador:
água, ar puro, luz solar, exercício físico, alimentação saudável, descanso, temperança e
confiança em Deus.

---

## 2. Identidade visual

### Logo oficial

`public/img/vidasaude-logo.png` — 451×145 px, PNG com fundo transparente.

Extraído do PDF oficial da Cartilha do Ciclo de Aprendizagem (Departamento de Saúde da IASD),
onde está embutido a 300 ppi com máscara de transparência própria. É o melhor original
disponível nos materiais oficiais: não existe versão vetorial pública. Exibido até ~330 px de
largura, fica nítido em telas de alta densidade.

Desenho: a palavra "clube" em branco, itálico, dentro de uma pastilha ciano de cantos
arredondados; "vida e" e "saúde" em amarelo, tipografia pesada e arredondada, "saúde" em
corpo maior sob as duas primeiras palavras.

### Cores oficiais (medidas no logo e na capa do manual)

| Cor | Hex | Uso na arte oficial |
|---|---|---|
| Ciano | `#34C2D7` | pastilha da palavra "clube" |
| Amarelo | `#FFD430` | "vida e saúde" |
| Verde-menta | `#D2F3E1` | fundo das capas |
| Rosa claro | `#FFE5F1` | detalhe gráfico |
| Branco | `#FFFFFF` | tipografia sobre o ciano |

### Paleta proposta para o Tailwind

O padrão de departamento pede as chaves `red` / `gold` / `ink` / `cream` / `sand`. Mapeando:

```ts
vidasaude: {
  red:   '#34C2D7',  // primária do clube (ciano) — botões, títulos de seção
  gold:  '#FFD430',  // acento (subtítulos, bordas, labels)
  ink:   '#0E2C33',  // escuro azul-esverdeado — hero, header, "Fale conosco"
  cream: '#F1FBF5',  // fundo claro principal (menta muito claro)
  sand:  '#D2F3E1',  // fundo claro alternativo (menta oficial)
}
```

`ink` e `cream` não existem na arte oficial: são derivados para harmonizar com o ciano e o
menta, como o padrão faz para os outros departamentos.

---

## 3. Estrutura proposta da página

As cinco seções do padrão, mais uma dedicada ao Maranata 360 entre "Quem pode participar" e
"Galeria" — é a atividade que mais mobiliza gente de fora da igreja, então merece o ponto
alto da página.

| # | Seção | Fundo | Conteúdo |
|---|---|---|---|
| 1 | Hero | `ink` | Logo, título, subtítulo, CTA para o WhatsApp |
| 2 | Sobre o clube | `cream` | O que é, para que serve, quem dirige |
| 3 | O que fazemos | `sand` | Três cards: ciclos de aprendizagem, oficinas, ações na comunidade |
| 4 | **Maranata 360** | `ink` ou paleta do evento | Cards de data, distâncias, inscrições e contato |
| 5 | Galeria | `cream` | Carrossel Embla com fotos do Flickr |
| 6 | Fale conosco | `ink` | Card glassmorphism com botão do WhatsApp |

### Textos sugeridos

**Hero**
- Título: `Clube Vida e Saúde`
- Subtítulo: `Cuidar do corpo também é adorar a Deus`
- CTA: `Quero participar`

**Sobre o clube**
> O Clube Vida e Saúde é o jeito que a igreja encontrou de cuidar de gente inteira — corpo,
> mente e espírito. São encontros regulares, abertos a todo mundo, com conteúdo sério sobre
> prevenção, hábitos e qualidade de vida, conduzidos por voluntários capacitados e por
> profissionais de saúde da própria comunidade.
>
> Não é palestra solta nem receita milagrosa: o clube trabalha com ciclos de aprendizagem de
> vários encontros, atividades práticas e acompanhamento de quem decide mudar. E deixa claro
> desde o começo que nada disso substitui o acompanhamento médico.

Badge discreto: `Iniciativa oficial do Departamento de Saúde da Igreja Adventista`

**O que fazemos** — três cards:

| Card | Texto |
|---|---|
| Ciclos de aprendizagem | Séries de 12 encontros semanais sobre alimentação, coração, diabetes, sono, mente e propósito. Cada encontro tem conteúdo, conversa em grupo e um desafio para a semana. |
| Oficinas e feiras | Culinária saudável, horta em casa, aferição e orientação na Feira Vida e Saúde. Prática, não teoria. |
| Ações na comunidade | Caminhadas, corridas e atividades abertas ao bairro — incluindo o Maranata 360, nossa corrida anual. |

Nota abaixo: `Dúvidas sobre horários e próximos encontros? Fale com a gente no WhatsApp.`

**Fale conosco**
> Todo mundo é bem-vindo — membro da igreja ou não, com formação em saúde ou sem nenhuma.
> Chame no WhatsApp e a gente te conta quando é o próximo encontro.

---

## 4. Seção Maranata 360

Corrida e caminhada anual organizada pela igreja de Tucuruvi. Dados da arte oficial da
II Edição, salva em `public/img/maranata360-flyer.jpg`.

| Item | Valor |
|---|---|
| Nome | Maranata 360 — II Edição |
| Assinatura do logo | É chegada a hora |
| Slogan | Mais que uma corrida, uma missão! |
| Data | 20/09/2026 |
| Inscrições | de 30/05 a 20/07 |
| Vagas | 150 |
| Percursos | 5 km (corrida) e 2,5 km (caminhada) |
| Kit | camiseta, medalha, número de peito e cordão |
| Contato | Suely Moraes — (11) 94127-7521 (WhatsApp) |

### Cores do evento (medidas na arte)

| Cor | Hex |
|---|---|
| Laranja | `#F84A03` |
| Azul-marinho | `#0F2240` |
| Preto de fundo | `#010509` |

A seção usa a paleta do próprio evento, não a do clube — a arte do Maranata 360 tem
identidade forte e reconhecível, e diluí-la no ciano do clube tiraria justamente o que faz
as pessoas reconhecerem a corrida.

### Comportamento sugerido

O flyer traz datas de uma edição específica. Para a página não envelhecer sozinha, a seção
deve ter um estado para quando a data já passou — algo como "A III Edição vem aí. Chame no
WhatsApp para saber quando abrem as inscrições" — em vez de exibir uma data vencida como se
fosse futura.

---

## 5. Pendências

Informações que não estão em nenhuma fonte pública e precisam vir da igreja:

| O que falta | Para que |
|---|---|
| Nome e WhatsApp do diretor do clube em Tucuruvi | Constantes `WHATSAPP_URL` e `WHATSAPP_DISPLAY` do padrão de departamento |
| Dia, horário e local dos encontros | Card "Quem pode participar" e nota de rodapé da seção |
| ID do álbum do Flickr com fotos do clube e da corrida | Endpoint `/api/flickr/vidasaude` |
| Foto de hero | `public/img/vidasaude-hero.jpg` — pessoas do clube em ação |
| Confirmação dos dados do Maranata 360 | A arte é da II Edição; conferir se há edição mais recente |

## Fontes

- [Manual Clube Vida e Saúde (PDF oficial)](https://f000.backblazeb2.com/file/deptos/saude/2022/manual-clube-vida-saude.pdf)
- [Materiais de apoio do Clube Vida e Saúde](https://downloads.adventistas.org/pt/saude/manuais-e-guias/clube-vida-e-saude/)
- [Kit dos 8 Remédios Naturais](https://downloads.adventistas.org/pt/kits/8-remedios-naturais/)
- [Notícias Adventistas — Igreja incentiva estilo de vida saudável por meio do Clube Vida e Saúde](https://noticias.adventistas.org/pt/igreja-adventista-incentiva-estilo-de-vida-saudavel-por-meio-do-clube-vida-e-saude/)
- [ADVIDAESAÚDE — materiais de apoio aos clubes](https://advidaesaude.com.br/)
