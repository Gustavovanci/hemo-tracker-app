# 🫀 HemoFlow - Sistema Avançado de Tracking Hemodinâmico

## 📋 Visão Geral

O **HemoFlow** é um sistema avançado de tracking para otimização de fluxo na Hemodinâmica, desenvolvido como PWA (Progressive Web App) com design disruptivo e integração completa com Google Sheets.

### ✨ Principais Funcionalidades

- 📱 **PWA Nativo** - Instalável como app no celular
- 📷 **Scanner de Código de Barras** - Leitura de pulseiras de pacientes
- ⏱️ **Timeline Visual Interativa** - 9 checkpoints de tempo precisos
- 📊 **Métricas em Tempo Real** - Cálculo automático de KPIs
- 🔗 **Integração Google Sheets** - Banco de dados automático
- 🎨 **Design Glassmorphism** - Interface moderna e intuitiva
- 📈 **Dashboard Analítico** - Identificação de gargalos

## 🎯 Checkpoints de Tempo

O sistema coleta dados em **9 etapas precisas**:

1. **Chegada na Hemodinâmica**
2. **Entrada na Sala**
3. **Início da Cobertura** (panos cirúrgicos)
4. **Término da Cobertura**
5. **Início do Procedimento**
6. **Término do Procedimento**
7. **Saída da Sala**
8. **Início da Limpeza**
9. **Término da Limpeza**

## 📊 Métricas Calculadas

### Tempos Principais
- **Tempo Total** - Do início ao fim da limpeza
- **Tempo de Giro** - Para liberação da sala
- **Tempo de Procedimento** - Duração do procedimento
- **Tempo de Preparação** - Entrada até início do procedimento
- **Tempo de Limpeza** - Duração da higienização

### Análises Disponíveis
- Gargalos por etapa
- Performance por sala
- Padrões por período do dia
- Eficiência da equipe
- Tempo médio de rotatividade

## 🚀 Configuração e Deploy

### Pré-requisitos
- Node.js 16+
- Conta Google (para Google Sheets)
- Vercel CLI (para deploy)

### 1. Instalação Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/hemoflow-tracker.git
cd hemoflow-tracker

# Instale dependências
npm install

# Build do CSS
npm run build

# Servidor local
npm run preview
```

### 2. Configuração Google Sheets

#### Criar a Planilha
1. Acesse [Google Sheets](https://sheets.google.com)
2. Crie nova planilha: "HemoFlow - Dados Hemodinâmica"
3. Copie o **ID da planilha** da URL

#### Configurar Google Apps Script
1. Na planilha: `Extensões > Apps Script`
2. Cole o código do Google Apps Script fornecido
3. Substitua `SEU_SPREADSHEET_ID_AQUI` pelo ID da planilha
4. Salve como "HemoFlow Script"

#### Deploy do Script
1. No Apps Script: `Implantar > Nova implantação`
2. Tipo: "Aplicativo da Web"
3. Executar como: **Eu**
4. Acesso: **Qualquer pessoa**
5. Copie a **URL do aplicativo web**

#### Atualizar o App
No arquivo `script.js`, substitua:
```javascript
const URL_BACKEND = "COLE_SUA_URL_AQUI";
```

### 3. Deploy no Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy em produção
vercel --prod
```

### 4. Estrutura das Planilhas

O sistema criará automaticamente 3 abas:

#### 📊 **Dashboard**
- Métricas em tempo real
- Total de pacientes do dia
- Tempos médios por etapa
- Análise por sala

#### 📝 **Resumo por Paciente**
- Uma linha por paciente
- Todas as métricas calculadas
- Tempos de cada etapa
- Ideal para relatórios

#### 🔍 **Dados Detalhados**
- Cada etapa como linha separada
- Horário exato de cada checkpoint
- Duração entre etapas
- Ideal para análises granulares

## 🎨 Recursos do Design

### Visual Moderno
- **Glassmorphism** com efeitos de blur
- **Gradientes vibrantes** e animações fluidas
- **Timeline visual** interativa
- **Feedback em tempo real**

### UX Otimizada
- Interface intuitiva com ícones claros
- Animações de sucesso e loading
- Responsivo para mobile e desktop
- Modo offline (PWA)

### Performance
- Service Worker otimizado
- Cache inteligente de recursos
- Sincronização em background
- Carregamento instantâneo

## 📱 Uso do Aplicativo

### 1. Escanear Paciente
- Toque em "Escanear Pulseira do Paciente"
- Permita acesso à câmera
- Escaneie o código de barras da pulseira

### 2. Timeline do Procedimento
- Após escanear, aparece a timeline
- Toque em "Próxima Etapa" conforme o progresso
- O sistema registra horário automaticamente
- Cada etapa muda de cor ao ser concluída

### 3. Métricas Automáticas
- Após todas as etapas, veja as métricas
- Tempos são calculados automaticamente
- Dashboard mostra KPIs principais

### 4. Finalizar Atendimento
- Selecione a sala utilizada
- Escolha o destino do paciente
- Toque em "Salvar no Google Sheets"
- Dados são enviados automaticamente

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento com watch mode
npm run dev

# Build para produção
npm run build-prod

# Limpar arquivos gerados
npm run clean

# Servidor local
npm run preview

# Deploy completo
npm run deploy

# Validar HTML
npm run validate

# Análise de performance
npm run lighthouse
```

## 📊 Monitoramento e Análise

### Dashboards Disponíveis

#### Métricas Diárias
- Total de pacientes atendidos
- Tempo médio por procedimento
- Identificação de gargalos
- Performance por sala

#### Análise Semanal/Mensal
- Tendências de tempo
- Padrões por período
- Eficiência da equipe
- Relatórios personalizados

### Exportação de Dados
- Dados em tempo real no Google Sheets
- Exportação para Excel/CSV
- Gráficos automáticos
- Relatórios personalizáveis

## 🔒 Segurança e Privacidade

- **HTTPS obrigatório** - Comunicação criptografada
- **Dados anônimos** - Apenas IDs de pacientes
- **Acesso controlado** - Permissões no Google Sheets
- **Cache local** - Funcionamento offline

## 🆘 Solução de Problemas

### Câmera não funciona
- Verifique permissões do navegador
- Use HTTPS (obrigatório para câmera)
- Teste em dispositivo diferente

### Dados não salvam
- Verifique a URL do Google Apps Script
- Confirme permissões do script
- Teste conexão com internet

### PWA não instala
- Use navegador compatível (Chrome/Safari)
- Acesse via HTTPS
- Verifique manifest.json

### Performance lenta
- Execute `npm run build-prod`
- Verifique cache do navegador
- Analise com `npm run lighthouse`

## 🤝 Contribuição

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

- 📧 Email: contato@hemoflow.com
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/hemoflow-tracker/issues)
- 📚 Docs: [Wiki do Projeto](https://github.com/seu-usuario/hemoflow-tracker/wiki)

---

**Desenvolvido com ❤️ para otimizar o fluxo da Hemodinâmica**