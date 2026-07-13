# Legendas Pro

Sistema profissional de transcrição, edição, tradução, exportação e renderização de legendas para vídeo. Uma aplicação web local com backend em Node.js/Express, fila de processamento assíncrona, frontend em HTML/CSS/JavaScript puro e motores Python integrados para transcrição offline com aceleração CUDA.

## 🎯 Visão Geral

O **Legendas Pro** é uma suíte completa de legendagem projetada para operar localmente como um aplicativo desktop, oferecendo:

- ✅ Upload e gestão de arquivos de vídeo
- ✅ Transcrição automática offline com Whisper (faster-whisper, stable-ts, whisperx)
- ✅ Fila de processamento assíncrona com Bull
- ✅ Acompanhamento em tempo real via Socket.IO
- ✅ Editor de legendas sincronizado com playback de vídeo
- ✅ Exportação para múltiplos formatos (SRT, VTT, TXT, JSON, ASS)
- ✅ Tradução de legendas
- ✅ Renderização de legenda queimada no vídeo
- ✅ Processamento em lote
- ✅ Histórico de vídeos processados
- ✅ Configurações avançadas de engine, modelo e estilo

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Navegador)                     │
│  HTML/CSS/JS Puro | Dashboard | Editor | Histórico | Lote   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                   Backend Node.js/Express                    │
│  API REST | Socket.IO | Bull Queue | Multer | FFmpeg        │
│  Controllers | Routes | Services | Models | Sockets         │
└─────────────────────────────────────────────────────────────┘
                            ↕ Subprocess (JSON/Stdout)
┌─────────────────────────────────────────────────────────────┐
│              Camada Python (Motores de Transcrição)          │
│  faster-whisper | stable-ts | whisperx | CUDA 12.8          │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQLite
┌─────────────────────────────────────────────────────────────┐
│  Banco de Dados (better-sqlite3)                             │
│  videos | transcricoes | segmentos | jobs | configuracoes   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura do Projeto

```
legendas-pro/
├── backend/
│   ├── app.js                 # Ponto de entrada principal
│   ├── controllers/           # Controladores da API
│   ├── routes/                # Rotas da API
│   ├── services/              # Serviços de negócio
│   │   ├── job.processor.js   # Processador de fila
│   │   ├── subtitle.service.js
│   │   ├── ffmpeg.service.js
│   │   ├── whisperBridge.service.js
│   │   └── queue.service.js
│   ├── models/                # Modelos de dados
│   │   └── database.js        # Schema SQLite
│   ├── sockets/               # Handlers Socket.IO
│   │   └── progress.socket.js
│   ├── uploads/               # Arquivos temporários
│   └── db/                    # Banco de dados SQLite
├── frontend/
│   ├── views/                 # Páginas HTML
│   │   ├── index.html
│   │   ├── upload.html
│   │   ├── processamento.html
│   │   ├── editor.html
│   │   ├── historico.html
│   │   ├── lote.html
│   │   └── configuracoes.html
│   ├── js/
│   │   ├── core/              # Módulos compartilhados
│   │   └── pages/             # Scripts específicos por página
│   └── css/                   # Estilos globais
├── python/
│   ├── scripts/
│   │   └── transcribe.py      # Script principal de transcrição
│   ├── engines/
│   │   ├── faster_whisper_engine.py
│   │   ├── stable_ts_engine.py
│   │   └── whisperx_engine.py
│   └── requirements.txt       # Dependências Python
├── package.json
└── README.md
```

## 🚀 Requisitos

### Sistema

- Node.js (versão compatível com as dependências)
- Python 3.x
- CUDA 12.8 (para aceleração GPU)
- FFmpeg e FFprobe instalados e configuráveis

### Backend (Node.js)

- express ^4.19.2
- socket.io ^4.7.5
- bull ^4.16.5
- multer ^2.2.0
- better-sqlite3 ^11.3.0
- dotenv ^16.4.5
- cors ^2.8.5
- uuid ^14.0.1
- fluent-ffmpeg ^2.1.3

### Python (CUDA 12.8)

```txt
torch==2.8.0+cu128
torchaudio==2.8.0+cu128
faster-whisper==1.2.1
stable-ts==2.19.1
whisperx==3.8.6
ctranslate2==4.8.1
numpy>=2.1.0
ffmpeg-python==0.2.0
torchvision>=0.19.0
librosa>=0.10.0
soundfile>=0.12.0
tqdm>=4.66.0
pyannote.audio>=3.1.0
```

## 🛠️ Instalação

### 1. Instalar dependências do Node.js

```bash
npm install
```

### 2. Instalar dependências do Python

```bash
cd python
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as configurações necessárias (consulte `.env.example` se disponível).

### 4. Inicializar banco de dados

```bash
npm run migrate
```

## ▶️ Execução

### Iniciar o servidor

```bash
npm start
```

### Modo desenvolvimento (com auto-reload)

```bash
npm dev
```

Após iniciar, acesse `http://localhost:<porta>` no navegador.

## 📋 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o servidor de produção |
| `npm run dev` | Inicia em modo desenvolvimento com nodemon |
| `npm run migrate` | Executa migrações do banco de dados |
| `npm run inspect` | Inspeciona o banco de dados |
| `npm run reset-db` | Reseta o banco de dados |

## 🔧 Pipeline de Transcrição

1. **Upload** do vídeo local
2. **Validação** de tamanho e extensão
3. **Registro** do vídeo no banco de dados
4. **Criação** da transcrição e job associado
5. **Enfileiramento** do processamento (Bull Queue)
6. **Extração** de áudio com FFmpeg (quando necessário)
7. **Execução** do engine Python selecionado
8. **Persistência** dos segmentos transcritos
9. **Atualização** de status e progresso em tempo real (Socket.IO)

## 🎨 Funcionalidades

### Upload e Gestão de Arquivos
- Upload de vídeos locais com suporte a formatos comuns
- Validação de tamanho e extensão (frontend e backend)
- Persistência de metadados no banco de dados
- Rota segura para preview e processamento

### Editor de Legendas
- Carregamento de vídeo e seleção da transcrição
- Renderização de segmentos com sincronização temporal
- Edição textual de segmentos
- Navegação de playback sincronizada
- Exportação para SRT, VTT, TXT, JSON e ASS
- Tradução em lote de segmentos
- Renderização de legenda queimada

### Processamento em Lote
- Upload múltiplo de vídeos
- Aplicação de parâmetros comuns
- Enfileiramento sequencial ou controlado
- Status individual por item

### Configurações Avançadas
- Seleção de engine (faster-whisper, stable-ts, whisperx)
- Configuração de modelo e idioma
- Device CUDA e compute type
- Estilo visual da legenda queimada (presets e personalizado)
- Caminhos de binários FFmpeg/FFprobe

## 📡 Comunicação em Tempo Real

O sistema utiliza **Socket.IO** para comunicação bidirecional entre backend e frontend:

- Eventos de progresso de jobs
- Atualização de status em tempo real
- Rooms por `jobId`, `transcricaoId`, `videoId` e fila global
- Atualização visual contínua sem refresh manual

## 💾 Banco de Dados

SQLite com `better-sqlite3`, estruturado nas seguintes tabelas:

- `videos` - Metadados de vídeos uploadados
- `transcricoes` - Transcrições associadas a vídeos
- `segmentos` - Segmentos de texto com timestamps
- `jobs` - Jobs de processamento na fila
- `configuracoes` - Configurações globais do sistema

## 🔒 Considerações de Segurança

- Aplicação projetada para operação **local** (localhost)
- Validação de arquivos no frontend e backend
- Rotas seguras para acesso a arquivos
- Tratamento global de erros
- Limpeza de arquivos temporários após processamento

## 🎯 UX/UI

- Design profissional dark mode consistente
- Foco em legibilidade e produtividade
- Feedback visual explícito para todas ações assíncronas
- Estados visuais: carregando, vazio, erro, sucesso, progresso
- Layout responsivo para desktop e notebook
- Editor com três zonas: controles, player e painel de segmentos

## 📈 Performance

- Operações eficientes com listas grandes de segmentos
- Transações SQLite para inserção em massa
- Minimização de re-renderizações no frontend
- Limpeza automática de temporários
- Bridge Node/Python otimizado para parsing

## 🔌 Integração Node ↔ Python

A comunicação entre Node.js e Python é feita via **subprocesso**:

- **stdout**: JSON final com resultados da transcrição
- **stderr**: Progresso textual no padrão `PROGRESS:<percent>:<message>`
- Detecção automática de CUDA via `torch.cuda.is_available()`
- Resiliente a timeout, falha de parsing e fragmentação de buffers

## 📝 Licença

ISC

## 🤝 Contribuição

Este projeto é mantido como uma base estável e extensível para operação local. Para contribuições, preserve a arquitetura existente e siga os padrões de código estabelecidos.

---

<div align="center">

**Legendas Pro** — Suíte profissional de legendagem para operação local

</div>
