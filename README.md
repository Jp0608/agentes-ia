# Agentes de IA

Sistema de agentes de IA para negócios que atendem pelo WhatsApp: recepção que responde a qualquer hora e marca na agenda, lembrete com confirmação, lista de espera, aviso de falta, retornos, orçamentos que voltam sozinhos, avaliações que avisam o dono primeiro e a página da manhã.

Cada cliente que você vender ganha a própria instalação (o próprio banco, o próprio número de WhatsApp). A sua instalação é a de demonstração.

## Os agentes

| Agente | Quando age | O que faz |
| --- | --- | --- |
| **Recepção no WhatsApp** | chega mensagem, a qualquer hora | Conversa com o Claude, vê horários livres, marca, remarca, cancela, coloca na lista de espera, responde dúvidas com as informações do negócio e chama o dono quando precisa. |
| **Lembrete e confirmação** | véspera às 18h (ou até 3 h antes se marcou no dia) | Manda o lembrete; 1 confirma, 2 cancela e oferece outro horário. |
| **Aviso de falta** | você marca "Faltou" na agenda | Manda mensagem na hora oferecendo dois horários; na 3ª falta avisa o dono. |
| **Lista de espera** | um horário é cancelado | Oferece a vaga para a primeira pessoa da lista. |
| **Retornos** | todo dia, 9h às 11h | Chama quem passou do tempo de voltar (definido por nicho), oferecendo um horário livre. Máx. 20 por dia, uma vez por mês por pessoa. |
| **Orçamentos** | você cria no painel | Explica em palavras simples (Claude), manda; volta no 3º e no 10º dia se ninguém responder. |
| **Avaliações** | dia seguinte, a partir das 10h | Pede nota de 1 a 5. Nota 4 ou 5 recebe o link do Google; nota baixa vai primeiro para o dono. |
| **Página da manhã** | todo dia às 7h | Manda ao dono: marcados hoje, atrasados, perdido ontem e orçamentos esperando. |

Cada agente tem o **fluxo escrito** em português, editável em **Agentes**. A página **Mapa** mostra o mapa completo de agentes de 21 tipos de negócio, com o que já roda e o que dá para montar depois.

## Tipos de negócio

Barbearia, salão, manicure, estética, tatuagem, odontologia, clínica médica, fisioterapia, psicologia, pet shop, veterinária, imobiliária, advocacia, contabilidade, oficina, loja, restaurante, academia, personal, escola e cursos. Cada um vem com serviços, preços, tempo de retorno e o jeito de chamar as coisas ("cadeira", "sala", "box"); tudo editável em **Configurar**.

## Demonstração

Em **Simulador** você conversa como se fosse um cliente, com os agentes e a agenda de verdade, sem mandar nada para ninguém. Do lado direito aparece o WhatsApp do dono. Use **Criar dados de demonstração** (10 clientes simulados com histórico) e **Rodar tudo agora** para ver todos os agentes trabalhando na hora.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e entre com a senha `demo1234`. Sem `DATABASE_URL`, os dados ficam num Postgres embutido em `.data/`.

## Instalar para um cliente

1. **Banco (Supabase):** crie um projeto, vá em **Connect → Transaction pooler** e copie a URI (porta 6543). As tabelas são criadas sozinhas.
2. **WhatsApp (Evolution API no Railway):** use o modelo https://railway.com/deploy/evolution-api-4. No serviço *Evolution API*: **Settings → Networking → Generate Domain** e adicione um volume em `/evolution/instances`. Copie o domínio e a variável `AUTHENTICATION_API_KEY`. Um servidor atende vários clientes; dê a cada um um `EVOLUTION_INSTANCE` diferente.
3. **IA:** crie uma chave em console.anthropic.com (**API Keys**, começa com `sk-ant-api03-`).
4. **Vercel:** importe este repositório e cadastre as variáveis do `.env.example`. Faça o deploy.
5. **Agentes automáticos:** no GitHub, em **Settings → Secrets and variables → Actions**, crie `APP_URL` e `CRON_SECRET`. O workflow `.github/workflows/agentes.yml` chama o sistema a cada 10 minutos.
6. Entre no painel, configure o negócio e conecte o WhatsApp em **WhatsApp → Gerar QR code**.

## Custos por cliente (aproximados)

- Vercel e Supabase: plano grátis aguenta um negócio pequeno.
- Evolution API no Railway: uns US$ 5/mês, e um servidor serve vários clientes.
- IA: cada mensagem respondida custa centavos. O modelo padrão é `claude-opus-5-5`; para gastar menos, troque `ANTHROPIC_MODEL` por `claude-sonnet-5-5` ou `claude-haiku-5-5`.

> A Evolution API usa o protocolo do WhatsApp Web, não a API oficial. Para atender clientes não há problema prático, mas não use para disparos em massa: o WhatsApp pode bloquear o número.
